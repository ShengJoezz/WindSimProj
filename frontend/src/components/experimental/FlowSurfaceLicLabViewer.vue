<template>
  <div class="lic-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">高度</span>
        <el-select
          v-model="selectedHeight"
          class="select"
          :disabled="loading || !availableHeights.length"
          @change="loadScene"
        >
          <el-option
            v-for="height in availableHeights"
            :key="height"
            :label="`${height} m`"
            :value="height"
          />
        </el-select>
      </div>

      <div class="toolbar-item">
        <span class="label">颜色混合</span>
        <el-radio-group v-model="colorModeName" size="small" @change="handleOptionsChange">
          <el-radio-button value="blend">Blend</el-radio-button>
          <el-radio-button value="multiply">Multiply</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">LIC 强度</span>
        <el-slider
          v-model="licIntensity"
          :min="0.1"
          :max="1"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionsChange"
        />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">积分步数</span>
        <el-slider
          v-model="numberOfSteps"
          :min="8"
          :max="64"
          :step="4"
          show-input
          input-size="small"
          @change="handleOptionsChange"
        />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">步长</span>
        <el-slider
          v-model="stepSize"
          :min="0.05"
          :max="0.7"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionsChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">增强</span>
        <el-select v-model="contrastModeName" class="select" @change="handleOptionsChange">
          <el-option label="无" value="none" />
          <el-option label="LIC" value="lic" />
          <el-option label="颜色" value="color" />
          <el-option label="双增强" value="both" />
        </el-select>
      </div>

      <div class="toolbar-item">
        <span class="label">向量归一化</span>
        <el-switch v-model="normalizeVectors" @change="handleOptionsChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">切向投影</span>
        <el-switch v-model="transformVectors" @change="handleOptionsChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">重载</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="vtkContainer" class="vtk-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">LIC 实验视图加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>引擎</span>
          <strong>VTK.js Surface LIC</strong>
        </div>
        <div class="chip">
          <span>切片文件</span>
          <strong>{{ surfaceFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>向量场</span>
          <strong>{{ vectorSourceLabel }}</strong>
        </div>
        <div class="chip">
          <span>模式</span>
          <strong>{{ licModeLabel }}</strong>
        </div>
      </div>

      <div class="legend">
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
        <span>切片三角形</span>
        <strong>{{ polygonCount }}</strong>
      </div>
      <div class="stat">
        <span>LIC 步数</span>
        <strong>{{ numberOfSteps }}</strong>
      </div>
      <div class="stat">
        <span>步长</span>
        <strong>{{ stepSize.toFixed(2) }}</strong>
      </div>
      <div class="stat">
        <span>LIC 强度</span>
        <strong>{{ licIntensity.toFixed(2) }}</strong>
      </div>
      <div class="stat">
        <span>速度范围</span>
        <strong>{{ speedRangeLabel }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/LIC';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkSurfaceLICMapper from '@kitware/vtk.js/Rendering/Core/SurfaceLICMapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import { ColorMode as MapperColorMode, ScalarMode } from '@kitware/vtk.js/Rendering/Core/Mapper/Constants';
import {
  ColorMode as LicColorMode,
  ContrastEnhanceMode,
} from '@kitware/vtk.js/Rendering/Core/SurfaceLICInterface/Constants';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const vtkContainer = ref(null);
const availableHeights = ref([]);
const selectedHeight = ref(null);
const licIntensity = ref(0.55);
const numberOfSteps = ref(32);
const stepSize = ref(0.2);
const contrastModeName = ref('both');
const colorModeName = ref('blend');
const normalizeVectors = ref(true);
const transformVectors = ref(true);
const loading = ref(false);
const loadingText = ref('正在读取 LIC 实验数据...');
const errorMessage = ref('');
const polygonCount = ref(0);
const speedRange = ref({ min: 0, max: 1 });

let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let rawSurfaceData = null;
let surfaceActor = null;
let licMapper = null;
const handleWindowResize = () => fullScreenRenderer?.resize();

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const licModeLabel = computed(() => (
  `${contrastModeName.value.toUpperCase()} / ${colorModeName.value.toUpperCase()}`
));

const legendBarStyle = computed(() => ({
  background: buildCssGradient(SIMULATION_JET_STOPS, '90deg'),
}));

const legendTicks = computed(() => {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const safeMax = Math.abs(max - min) < 1e-6 ? min + 1 : max;
  return Array.from({ length: 5 }, (_, index) => (
    (min + ((safeMax - min) * index) / 4).toFixed(2)
  ));
});

const speedRangeLabel = computed(() => (
  `${Number(speedRange.value.min ?? 0).toFixed(2)} ~ ${Number(speedRange.value.max ?? 1).toFixed(2)} m/s`
));

const vectorSourceLabel = computed(() => 'PointData.licVectors <- CellData.U');

function normalizeRange(range) {
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? min + 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return { min, max };
}

function createLookupTable(range) {
  const table = vtkColorTransferFunction.newInstance();
  SIMULATION_JET_STOPS.forEach(([position, rgb]) => {
    const value = range.min + ((range.max - range.min) * position);
    table.addRGBPoint(value, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  });
  return table;
}

function clearActor(actor) {
  if (actor && renderer) renderer.removeActor(actor);
}

function clearScene() {
  clearActor(surfaceActor);
  try {
    surfaceActor?.delete?.();
  } catch (error) {
    console.warn('释放 LIC actor 失败:', error);
  }
  try {
    licMapper?.delete?.();
  } catch (error) {
    console.warn('释放 LIC mapper 失败:', error);
  }
  surfaceActor = null;
  licMapper = null;
}

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
}

function ensureSpeedMagnitude(dataSet) {
  const cellData = dataSet?.getCellData?.();
  const existing = cellData?.getArrayByName?.('speedMagnitude');
  if (existing) return normalizeRange(existing.getRange());

  const vectorArray = cellData?.getArrayByName?.('U');
  if (!vectorArray || !cellData) return { min: 0, max: 1 };

  const values = vectorArray.getData();
  const tupleCount = vectorArray.getNumberOfTuples();
  const compCount = vectorArray.getNumberOfComponents();
  const speeds = new Float32Array(tupleCount);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < tupleCount; index += 1) {
    const offset = index * compCount;
    const ux = Number(values[offset] ?? 0);
    const uy = Number(values[offset + 1] ?? 0);
    const uz = Number(values[offset + 2] ?? 0);
    const magnitude = Math.sqrt((ux * ux) + (uy * uy) + (uz * uz));
    speeds[index] = magnitude;
    if (magnitude < min) min = magnitude;
    if (magnitude > max) max = magnitude;
  }

  const magnitudeArray = vtkDataArray.newInstance({
    name: 'speedMagnitude',
    values: speeds,
    numberOfComponents: 1,
  });
  cellData.addArray(magnitudeArray);
  if (cellData.setScalars) cellData.setScalars(magnitudeArray);
  const vectorHolder = cellData.getArrayByName('U');
  if (vectorHolder && cellData.setVectors) cellData.setVectors(vectorHolder);
  dataSet.modified();
  return normalizeRange([min, max]);
}

function accumulateCellVectors(cellArray, vectorValues, compCount, pointSums, pointCounts, startCellId) {
  const connectivity = cellArray?.getData?.();
  if (!connectivity?.length) return startCellId;

  let cellId = startCellId;
  for (let offset = 0; offset < connectivity.length;) {
    const pointCount = Number(connectivity[offset++] ?? 0);
    const vectorOffset = cellId * compCount;
    const vx = Number(vectorValues[vectorOffset] ?? 0);
    const vy = Number(vectorValues[vectorOffset + 1] ?? 0);
    const vz = Number(vectorValues[vectorOffset + 2] ?? 0);

    for (let index = 0; index < pointCount; index += 1) {
      const pointId = Number(connectivity[offset + index] ?? -1);
      if (pointId < 0) continue;
      const sumOffset = pointId * 3;
      pointSums[sumOffset] += vx;
      pointSums[sumOffset + 1] += vy;
      pointSums[sumOffset + 2] += vz;
      pointCounts[pointId] += 1;
    }

    offset += pointCount;
    cellId += 1;
  }

  return cellId;
}

function ensureLicPointData(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();
  const points = dataSet?.getPoints?.();

  if (!pointData || !cellData || !points) return { min: 0, max: 1 };

  let pointVectors = pointData.getArrayByName('licVectors');
  if (!pointVectors) {
    const cellVectors = cellData.getArrayByName('U');
    const pointCount = Number(points.getNumberOfPoints?.() ?? 0);
    if (!cellVectors || !pointCount) return { min: 0, max: 1 };

    const vectorValues = cellVectors.getData();
    const compCount = Number(cellVectors.getNumberOfComponents?.() ?? 3);
    const pointSums = new Float32Array(pointCount * 3);
    const pointCounts = new Uint32Array(pointCount);

    let cellId = 0;
    cellId = accumulateCellVectors(dataSet.getVerts?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    cellId = accumulateCellVectors(dataSet.getLines?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    cellId = accumulateCellVectors(dataSet.getPolys?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    accumulateCellVectors(dataSet.getStrips?.(), vectorValues, compCount, pointSums, pointCounts, cellId);

    for (let pointId = 0; pointId < pointCount; pointId += 1) {
      const count = pointCounts[pointId] || 1;
      const offset = pointId * 3;
      pointSums[offset] /= count;
      pointSums[offset + 1] /= count;
      pointSums[offset + 2] /= count;
    }

    pointVectors = vtkDataArray.newInstance({
      name: 'licVectors',
      values: pointSums,
      numberOfComponents: 3,
    });
    pointData.addArray(pointVectors);
  }

  let pointSpeeds = pointData.getArrayByName('pointSpeedMagnitude');
  if (!pointSpeeds) {
    const pointValues = pointVectors.getData();
    const tupleCount = Number(pointVectors.getNumberOfTuples?.() ?? 0);
    const compCount = Number(pointVectors.getNumberOfComponents?.() ?? 3);
    const speeds = new Float32Array(tupleCount);

    for (let index = 0; index < tupleCount; index += 1) {
      const offset = index * compCount;
      const ux = Number(pointValues[offset] ?? 0);
      const uy = Number(pointValues[offset + 1] ?? 0);
      const uz = Number(pointValues[offset + 2] ?? 0);
      speeds[index] = Math.sqrt((ux * ux) + (uy * uy) + (uz * uz));
    }

    pointSpeeds = vtkDataArray.newInstance({
      name: 'pointSpeedMagnitude',
      values: speeds,
      numberOfComponents: 1,
    });
    pointData.addArray(pointSpeeds);
  }

  if (pointData.setVectors) pointData.setVectors(pointVectors);
  if (pointData.setScalars) pointData.setScalars(pointSpeeds);
  dataSet.modified();
  return normalizeRange(pointSpeeds.getRange());
}

function getLicContrastMode() {
  switch (contrastModeName.value) {
    case 'lic':
      return ContrastEnhanceMode.LIC;
    case 'color':
      return ContrastEnhanceMode.COLOR;
    case 'both':
      return ContrastEnhanceMode.BOTH;
    default:
      return ContrastEnhanceMode.NONE;
  }
}

function getLicColorMode() {
  return colorModeName.value === 'multiply' ? LicColorMode.MULTIPLY : LicColorMode.BLEND;
}

function configureMapper() {
  if (!licMapper || !rawSurfaceData) return;

  const lookupTable = createLookupTable(speedRange.value);
  const licInterface = licMapper.getLicInterface();

  licMapper.setInputData(rawSurfaceData);
  licMapper.setInputArrayToProcess(0, 'licVectors', 'PointData');
  licMapper.setLookupTable(lookupTable);
  licMapper.setScalarRange(speedRange.value.min, speedRange.value.max);
  licMapper.setColorMode(MapperColorMode.MAP_SCALARS);
  licMapper.setInterpolateScalarsBeforeMapping(true);
  licMapper.setColorByArrayName('pointSpeedMagnitude');
  licMapper.setScalarMode(ScalarMode.USE_POINT_FIELD_DATA);

  licInterface.setEnableLIC(true);
  licInterface.setEnhancedLIC(true);
  licInterface.setColorMode(getLicColorMode());
  licInterface.setLICIntensity(licIntensity.value);
  licInterface.setNumberOfSteps(numberOfSteps.value);
  licInterface.setStepSize(stepSize.value);
  licInterface.setEnhanceContrast(getLicContrastMode());
  licInterface.setNormalizeVectors(normalizeVectors.value);
  licInterface.setTransformVectors(transformVectors.value);
  licInterface.setMaskOnSurface(false);
  licInterface.setMaskIntensity(0);
  licInterface.setAntiAlias(1);
  licInterface.setNoiseTextureSize(256);
  licInterface.setNoiseGrainSize(8);
  licInterface.setNoiseGeneratorSeed(1);
  licInterface.setViewPortScale(1);
  licInterface.setRebuildNoiseTexture(true);
}

function renderScene(resetCamera = false) {
  if (!renderer || !rawSurfaceData) return;

  clearScene();
  licMapper = vtkSurfaceLICMapper.newInstance();
  configureMapper();

  surfaceActor = vtkActor.newInstance();
  surfaceActor.setMapper(licMapper);
  renderer.addActor(surfaceActor);

  if (resetCamera) {
    renderer.resetCamera();
    renderer.getActiveCamera().elevation(8);
    renderer.getActiveCamera().azimuth(16);
    renderer.resetCameraClippingRange();
  }

  renderWindow?.render();
}

function handleOptionsChange() {
  renderScene(false);
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于 LIC 实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function loadScene() {
  if (!selectedHeight.value || !renderer) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的 LIC 切片数据...`;
  errorMessage.value = '';

  try {
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    const surfaceData = await loadPolyData(surfaceUrl);
    rawSurfaceData = surfaceData;
    polygonCount.value = Number(rawSurfaceData?.getNumberOfPolys?.() ?? 0);
    ensureSpeedMagnitude(rawSurfaceData);
    speedRange.value = ensureLicPointData(rawSurfaceData);
    renderScene(true);
  } catch (error) {
    console.error('LIC 实验页加载失败:', error);
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initRenderer() {
  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    container: vtkContainer.value,
    rootContainer: vtkContainer.value,
    background: [0.05, 0.08, 0.12],
    containerStyle: { width: '100%', height: '100%', position: 'absolute', inset: '0' },
  });
  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();
  const interactor = renderWindow.getInteractor?.();
  if (interactor?.setCurrentRenderer) interactor.setCurrentRenderer(renderer);
  renderer.setTwoSidedLighting(true);
  renderer.setAutomaticLightCreation(true);
}

onMounted(async () => {
  await nextTick();
  if (!vtkContainer.value) return;
  initRenderer();
  window.addEventListener('resize', handleWindowResize);

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化 LIC 实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  clearScene();
  try {
    fullScreenRenderer?.delete();
  } catch (error) {
    console.warn('释放 LIC 实验页渲染器失败:', error);
  }
});
</script>

<style scoped>
.lic-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-item--wide {
  grid-column: span 2;
}

.label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.select {
  width: 100%;
}

.viewer-shell {
  position: relative;
  min-height: 720px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(180deg, #07111b 0%, #0b1624 100%);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
}

.vtk-host {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  backdrop-filter: blur(14px);
}

.overlay--loading {
  background: rgba(15, 23, 42, 0.6);
  color: #f8fafc;
}

.overlay--error {
  background: rgba(15, 23, 42, 0.72);
  color: #fff7ed;
}

.overlay-title {
  font-size: 18px;
  font-weight: 700;
}

.overlay-text {
  max-width: 420px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
}

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 4px solid rgba(255, 255, 255, 0.18);
  border-top-color: #facc15;
  animation: spin 0.9s linear infinite;
}

.chip-row {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  min-width: 150px;
  padding: 10px 14px;
  border-radius: 15px;
  background: rgba(7, 17, 27, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.chip span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.7);
}

.chip strong {
  color: #f8fafc;
  font-size: 13px;
}

.legend {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 4;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 36px));
  padding: 12px 16px 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.95);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.legend-top,
.legend-ticks {
  display: flex;
  justify-content: space-between;
}

.legend-top {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.legend-bar {
  height: 16px;
  border-radius: 999px;
}

.legend-ticks {
  margin-top: 8px;
  font-size: 11px;
  color: #475569;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.stat {
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.stat span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}

.stat strong {
  font-size: 18px;
  color: #0f172a;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .toolbar,
  .stats {
    grid-template-columns: 1fr;
  }

  .toolbar-item--wide {
    grid-column: span 1;
  }

  .viewer-shell {
    min-height: 540px;
  }
}
</style>
