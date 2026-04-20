<template>
  <div class="vtk-volume-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">渲染模式</span>
        <el-radio-group v-model="blendModeName" size="small" @change="handleOptionChange">
          <el-radio-button value="composite">复合</el-radio-button>
          <el-radio-button value="mip">MIP</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item">
        <span class="label">缓存密度</span>
        <el-select v-model="targetCellsPreset" class="select">
          <el-option label="0.8 M" value="800000" />
          <el-option label="1.5 M" value="1500000" />
          <el-option label="2.2 M" value="2200000" />
        </el-select>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">体积浓度</span>
        <el-slider
          v-model="opacityLevel"
          :min="0.4"
          :max="1.55"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">射线步长倍率</span>
        <el-slider
          v-model="sampleDistanceFactor"
          :min="0.55"
          :max="1.8"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">垂向放大</span>
        <el-slider
          v-model="verticalExaggeration"
          :min="1"
          :max="4.5"
          :step="0.1"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">地形轮廓</span>
        <el-switch v-model="showTerrain" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">视角</span>
        <el-button plain @click="resetCamera">重置视角</el-button>
      </div>

      <div class="toolbar-item">
        <span class="label">刷新</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene(false, false)">重载</el-button>
      </div>

      <div class="toolbar-item">
        <span class="label">重建缓存</span>
        <el-button plain :loading="rebuilding" @click="rebuildCache">重新采样</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="vtkContainer" class="vtk-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">VTK.js 体渲染实验加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene(true, false)">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>数据源</span>
          <strong>{{ sourceLabel }}</strong>
        </div>
        <div class="chip">
          <span>缓存体素</span>
          <strong>{{ cacheGridLabel }}</strong>
        </div>
        <div class="chip">
          <span>说明</span>
          <strong>服务端规则体缓存 -> vtkImageData -> VTK.js VolumeMapper</strong>
        </div>
        <div class="chip">
          <span>模式</span>
          <strong>{{ blendModeLabel }}</strong>
        </div>
      </div>

      <div class="legend legend--bottom">
        <div class="legend-top">
          <span>JET</span>
          <span>速度大小 (m/s)</span>
        </div>
        <div class="legend-bar" :style="legendBarStyle"></div>
        <div class="legend-ticks">
          <span v-for="tick in legendTicks" :key="tick">{{ tick }}</span>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span>速度范围</span>
        <strong>{{ speedRangeLabel }}</strong>
      </div>
      <div class="stat">
        <span>有效体素</span>
        <strong>{{ validRatioLabel }}</strong>
      </div>
      <div class="stat">
        <span>纹理体积</span>
        <strong>{{ voxelCountLabel }}</strong>
      </div>
      <div class="stat">
        <span>缓存构建</span>
        <strong>{{ buildSecondsLabel }}</strong>
      </div>
      <div class="stat">
        <span>上次请求</span>
        <strong>{{ latencyLabel }}</strong>
      </div>
      <div class="stat">
        <span>原始纹理</span>
        <strong>{{ volumeByteSizeLabel }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import { BlendMode } from '@kitware/vtk.js/Rendering/Core/VolumeMapper/Constants';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const vtkContainer = ref(null);
const metadata = ref(null);
const loading = ref(false);
const rebuilding = ref(false);
const loadingText = ref('正在构建 VTK.js 体渲染缓存...');
const errorMessage = ref('');
const targetCellsPreset = ref('1500000');
const blendModeName = ref('composite');
const opacityLevel = ref(0.8);
const sampleDistanceFactor = ref(1.0);
const verticalExaggeration = ref(1.8);
const showTerrain = ref(true);
const requestLatencyMs = ref(0);
const volumeData = ref(null);

let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let volumeActor = null;
let volumeMapper = null;
let terrainActor = null;
let terrainMapper = null;
let currentImageData = null;
let terrainData = null;

const legendBarStyle = computed(() => ({
  background: buildCssGradient(SIMULATION_JET_STOPS, '90deg'),
}));

const sourceLabel = computed(() => {
  const sourceKind = metadata.value?.sourceKind;
  if (sourceKind === 'foam') return '.foam / OpenFOAMReader';
  if (sourceKind === 'internal_vtu') return 'internal.vtu';
  return '-';
});

const cacheGridLabel = computed(() => {
  const dims = metadata.value?.dims;
  return Array.isArray(dims) && dims.length === 3 ? `${dims[0]} x ${dims[1]} x ${dims[2]}` : '-';
});

const blendModeLabel = computed(() => (
  blendModeName.value === 'mip' ? 'VTK 最大强度投影' : 'VTK 体积复合'
));

const speedRangeLabel = computed(() => {
  const range = metadata.value?.speedRange;
  if (!Array.isArray(range) || range.length !== 2) return '-';
  return `${Number(range[0]).toFixed(2)} ~ ${Number(range[1]).toFixed(2)} m/s`;
});

const validRatioLabel = computed(() => {
  const value = Number(metadata.value?.validRatio ?? 0);
  return `${(value * 100).toFixed(1)}%`;
});

const voxelCountLabel = computed(() => {
  const count = Number(metadata.value?.voxelCount ?? 0);
  if (!Number.isFinite(count) || count <= 0) return '-';
  return count.toLocaleString('en-US');
});

const buildSecondsLabel = computed(() => {
  const seconds = Number(metadata.value?.buildSeconds ?? 0);
  return seconds > 0 ? `${seconds.toFixed(2)} s` : '-';
});

const latencyLabel = computed(() => (
  requestLatencyMs.value > 0 ? `${requestLatencyMs.value.toFixed(0)} ms` : '-'
));

const volumeByteSizeLabel = computed(() => {
  if (!volumeData.value?.byteLength) return '-';
  return `${(volumeData.value.byteLength / (1024 * 1024)).toFixed(2)} MB`;
});

const legendTicks = computed(() => {
  const range = metadata.value?.speedRange;
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return Array.from({ length: 5 }, (_, index) => (
    (min + ((max - min) * index) / 4).toFixed(2)
  ));
});

const handleWindowResize = () => fullScreenRenderer?.resize();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(range) {
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? min + 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return { min, max };
}

function speedToRaw(speed, meta) {
  const { min, max } = normalizeRange(meta?.speedRange);
  if (max - min < 1e-6) return 255;
  return clamp(Math.round(1 + (254 * (speed - min)) / (max - min)), 1, 255);
}

function createColorTransfer(meta) {
  const transfer = vtkColorTransferFunction.newInstance();
  transfer.addRGBPoint(0, 0, 0, 0);
  SIMULATION_JET_STOPS.forEach(([position, rgb]) => {
    const rawValue = clamp(Math.round(position * 255), 0, 255);
    transfer.addRGBPoint(rawValue, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  });
  if (meta?.speedP995) {
    transfer.addRGBPoint(speedToRaw(meta.speedP995, meta), 0.96, 0.96, 0.96);
  }
  return transfer;
}

function createOpacityTransfer(meta) {
  const transfer = vtkPiecewiseFunction.newInstance();
  const range = normalizeRange(meta?.speedRange);
  const startSpeed = range.min + ((range.max - range.min) * 0.18);
  const p95Speed = Number(meta?.speedP95 ?? (range.min + ((range.max - range.min) * 0.78)));
  const p995Speed = Number(meta?.speedP995 ?? range.max);
  const startRaw = speedToRaw(startSpeed, meta);
  const p95Raw = speedToRaw(p95Speed, meta);
  const p995Raw = speedToRaw(p995Speed, meta);

  transfer.addPoint(0, 0.0);
  transfer.addPoint(1, 0.0);
  transfer.addPoint(Math.max(8, Math.round(startRaw * 0.55)), 0.0);
  transfer.addPoint(startRaw, 0.035 * opacityLevel.value);
  transfer.addPoint(p95Raw, 0.14 * opacityLevel.value);
  transfer.addPoint(p995Raw, 0.28 * opacityLevel.value);
  transfer.addPoint(255, 0.45 * opacityLevel.value);
  return transfer;
}

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
}

function clearScene() {
  if (renderer && volumeActor) renderer.removeVolume(volumeActor);
  if (renderer && terrainActor) renderer.removeActor(terrainActor);

  try {
    volumeActor?.delete?.();
  } catch (error) {
    console.warn('释放 volume actor 失败:', error);
  }
  try {
    volumeMapper?.delete?.();
  } catch (error) {
    console.warn('释放 volume mapper 失败:', error);
  }
  try {
    terrainActor?.delete?.();
  } catch (error) {
    console.warn('释放 terrain actor 失败:', error);
  }
  try {
    terrainMapper?.delete?.();
  } catch (error) {
    console.warn('释放 terrain mapper 失败:', error);
  }
  try {
    currentImageData?.delete?.();
  } catch (error) {
    console.warn('释放 vtkImageData 失败:', error);
  }

  volumeActor = null;
  volumeMapper = null;
  terrainActor = null;
  terrainMapper = null;
  currentImageData = null;
}

function createImageData(meta, rawVolume) {
  const dims = meta?.dims || [1, 1, 1];
  const origin = meta?.origin_m || [0, 0, 0];
  const spacing = meta?.spacing_m || [1, 1, 1];
  const imageData = vtkImageData.newInstance();
  imageData.setDimensions(dims);
  imageData.setOrigin(origin[0], origin[1], origin[2]);
  imageData.setSpacing(
    Number(spacing[0] ?? 1),
    Number(spacing[1] ?? 1),
    Number(spacing[2] ?? 1) * verticalExaggeration.value,
  );
  imageData.getPointData().setScalars(vtkDataArray.newInstance({
    name: 'speed_u8',
    values: rawVolume,
    numberOfComponents: 1,
  }));
  return imageData;
}

function configureVolumePipeline() {
  if (!renderer || !metadata.value || !volumeData.value) return;

  clearScene();
  currentImageData = createImageData(metadata.value, volumeData.value);

  volumeMapper = vtkVolumeMapper.newInstance();
  volumeMapper.setInputData(currentImageData);
  volumeMapper.setBlendMode(
    blendModeName.value === 'mip'
      ? BlendMode.MAXIMUM_INTENSITY_BLEND
      : BlendMode.COMPOSITE_BLEND,
  );

  const spacing = currentImageData.getSpacing();
  const baseSampleDistance = 0.7 * Math.sqrt(spacing.reduce((sum, value) => sum + (value * value), 0));
  volumeMapper.setSampleDistance(baseSampleDistance * sampleDistanceFactor.value);
  volumeMapper.setAutoAdjustSampleDistances(false);

  volumeActor = vtkVolume.newInstance();
  volumeActor.setMapper(volumeMapper);

  const property = volumeActor.getProperty();
  property.setRGBTransferFunction(0, createColorTransfer(metadata.value));
  property.setScalarOpacity(0, createOpacityTransfer(metadata.value));
  property.setScalarOpacityUnitDistance(0, Math.max(1.0, baseSampleDistance * 1.4));
  property.setInterpolationTypeToLinear();
  property.setShade(blendModeName.value === 'composite');
  property.setAmbient(0.16);
  property.setDiffuse(0.86);
  property.setSpecular(0.22);
  property.setSpecularPower(18);

  renderer.addVolume(volumeActor);

  if (showTerrain.value && terrainData) {
    terrainMapper = vtkMapper.newInstance();
    terrainMapper.setInputData(terrainData);
    terrainActor = vtkActor.newInstance();
    terrainActor.setMapper(terrainMapper);
    const scaleValue = Number(metadata.value?.scale ?? 1);
    const modelToMeters = scaleValue > 0 ? (1 / scaleValue) : 1;
    terrainActor.setScale(
      modelToMeters,
      modelToMeters,
      modelToMeters * verticalExaggeration.value,
    );
    terrainActor.getProperty().setRepresentationToWireframe();
    terrainActor.getProperty().setColor(0.88, 0.93, 0.98);
    terrainActor.getProperty().setLineWidth(1.2);
    terrainActor.getProperty().setOpacity(0.22);
    renderer.addActor(terrainActor);
  }
}

function resetCamera() {
  if (!renderer || !renderWindow) return;
  renderer.resetCamera();
  const camera = renderer.getActiveCamera();
  camera?.setViewUp?.(0, 0, 1);
  camera?.azimuth?.(22);
  camera?.elevation?.(14);
  camera?.zoom?.(1.08);
  currentImageData?.modified?.();
  volumeMapper?.modified?.();
  volumeActor?.modified?.();
  renderer.resetCameraClippingRange();
  renderWindow.render();
  window.requestAnimationFrame(() => {
    renderer?.resetCameraClippingRange?.();
    renderWindow?.render?.();
  });
}

function renderScene(reset = false) {
  if (!renderer || !renderWindow || !metadata.value || !volumeData.value) return;
  configureVolumePipeline();
  currentImageData?.modified?.();
  volumeMapper?.modified?.();
  volumeActor?.modified?.();
  if (reset) resetCamera();
  else {
    renderer.resetCameraClippingRange();
    renderWindow.render();
    window.requestAnimationFrame(() => {
      renderer?.resetCameraClippingRange?.();
      renderWindow?.render?.();
    });
  }
}

function handleOptionChange() {
  renderScene(false);
}

function initRenderer() {
  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    container: vtkContainer.value,
    rootContainer: vtkContainer.value,
    background: [0.04, 0.08, 0.12],
    containerStyle: { width: '100%', height: '100%', position: 'absolute', inset: '0' },
  });
  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();
  renderer.setTwoSidedLighting(true);
  renderer.setAutomaticLightCreation(true);
}

async function fetchMetadata(forceRebuild = false) {
  const response = await axios.get(`/api/cases/${props.caseId}/experimental-cfd-metadata`, {
    params: {
      targetCells: Number(targetCellsPreset.value),
      forceRebuild: forceRebuild ? 'true' : undefined,
    },
  });
  metadata.value = response.data?.metadata || null;
}

async function fetchVolumeTexture(meta) {
  const url = meta?.volumeTextureUrl;
  if (!url) throw new Error('服务端缓存缺少 volumeTextureUrl。');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`读取体纹理失败: ${url}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function loadScene(reset = true, forceRebuild = false) {
  if (!props.caseId) return;
  loading.value = true;
  errorMessage.value = '';
  loadingText.value = metadata.value && !forceRebuild ? '正在加载 VTK.js 体渲染数据...' : '正在构建 VTK.js 体缓存...';

  try {
    const startedAt = performance.now();
    await fetchMetadata(forceRebuild);
    const [terrain, rawVolume] = await Promise.all([
      loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/bot.vtp`).catch(() => null),
      fetchVolumeTexture(metadata.value),
    ]);
    requestLatencyMs.value = performance.now() - startedAt;
    terrainData = terrain;
    volumeData.value = rawVolume;
    await nextTick();
    renderScene(reset);
  } catch (error) {
    console.error('VTK.js 体渲染实验加载失败:', error);
    errorMessage.value = error?.response?.data?.message || error.message || 'VTK.js 体渲染加载失败';
  } finally {
    loading.value = false;
  }
}

async function rebuildCache() {
  rebuilding.value = true;
  try {
    await loadScene(true, true);
    if (!errorMessage.value) ElMessage.success('VTK.js 体渲染缓存已重建。');
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '重建缓存失败');
  } finally {
    rebuilding.value = false;
  }
}

watch(targetCellsPreset, async () => {
  metadata.value = null;
  volumeData.value = null;
  await loadScene(true, false);
});

watch(() => props.caseId, async () => {
  metadata.value = null;
  terrainData = null;
  volumeData.value = null;
  requestLatencyMs.value = 0;
  await loadScene(true, false);
});

onMounted(async () => {
  await nextTick();
  if (!vtkContainer.value) return;
  initRenderer();
  window.addEventListener('resize', handleWindowResize);
  await loadScene(true, false);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  clearScene();
  try {
    fullScreenRenderer?.delete?.();
  } catch (error) {
    console.warn('释放 VTK.js 体渲染器失败:', error);
  }
  fullScreenRenderer = null;
  renderer = null;
  renderWindow = null;
  terrainData = null;
  volumeData.value = null;
});
</script>

<style scoped>
.vtk-volume-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-items: end;
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-item--wide {
  min-width: 220px;
}

.label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.select {
  width: 100%;
}

.viewer-shell {
  position: relative;
  min-height: 620px;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background:
    radial-gradient(circle at top left, rgba(30, 64, 175, 0.24), transparent 30%),
    linear-gradient(180deg, #06111d 0%, #081524 100%);
}

.vtk-host {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  background: rgba(4, 12, 24, 0.78);
  z-index: 5;
  text-align: center;
  padding: 24px;
}

.overlay--error {
  background: rgba(24, 10, 10, 0.84);
}

.overlay-title {
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
}

.overlay-text {
  max-width: 640px;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.7;
}

.spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 255, 255, 0.9);
  animation: spin 0.9s linear infinite;
}

.chip-row {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  z-index: 2;
  pointer-events: none;
}

.chip {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(7, 18, 31, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(10px);
}

.chip span {
  display: block;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.92);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.chip strong {
  display: block;
  margin-top: 6px;
  color: #e2e8f0;
  line-height: 1.5;
  font-size: 13px;
}

.legend {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 48px));
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(7, 18, 31, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(10px);
  z-index: 2;
}

.legend--bottom {
  bottom: 18px;
}

.legend-top,
.legend-ticks {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(226, 232, 240, 0.86);
  font-size: 12px;
}

.legend-bar {
  margin: 10px 0 8px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.stat span {
  display: block;
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat strong {
  display: block;
  margin-top: 8px;
  font-size: 15px;
  color: #0f172a;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .viewer-shell {
    min-height: 540px;
  }

  .legend {
    width: calc(100% - 32px);
  }
}
</style>
