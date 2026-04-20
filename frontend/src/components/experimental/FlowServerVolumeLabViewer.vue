<template>
  <div class="server-volume-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">体渲染</span>
        <el-radio-group v-model="renderStyle" size="small" @change="handleOptionChange">
          <el-radio-button value="mip">投影</el-radio-button>
          <el-radio-button value="iso">等值体</el-radio-button>
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
        <span class="label">体积对比</span>
        <el-slider
          v-model="contrast"
          :min="0.65"
          :max="2.4"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">体积浓度</span>
        <el-slider
          v-model="opacityBoost"
          :min="0.35"
          :max="1.5"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">ISO 阈值</span>
        <el-slider
          v-model="isoThreshold"
          :min="0.08"
          :max="0.98"
          :step="0.02"
          show-input
          input-size="small"
          :disabled="renderStyle !== 'iso'"
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
        <span class="label">自动旋转</span>
        <el-switch v-model="autoRotate" @change="handleAutoRotateChange" />
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
      <div ref="canvasHost" class="canvas-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">服务端三维体实验加载失败</div>
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
          <strong>原始 CFD 结果 -> 服务端体缓存 -> 浏览器 3D volume</strong>
        </div>
        <div class="chip">
          <span>模式</span>
          <strong>{{ renderStyle === 'iso' ? 'ISO 等值体' : 'MIP 体积投影' }}</strong>
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
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VolumeRenderShader1 } from 'three/examples/jsm/shaders/VolumeShader.js';

import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const canvasHost = ref(null);
const metadata = ref(null);
const loading = ref(false);
const rebuilding = ref(false);
const loadingText = ref('正在构建服务端三维体...');
const errorMessage = ref('');
const renderStyle = ref('mip');
const targetCellsPreset = ref('1500000');
const contrast = ref(1.08);
const opacityBoost = ref(0.9);
const isoThreshold = ref(0.46);
const verticalExaggeration = ref(1.8);
const showTerrain = ref(true);
const autoRotate = ref(true);
const requestLatencyMs = ref(0);

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let orbitControls = null;
let resizeObserver = null;
let animationFrameId = null;
let sceneRoot = null;
let lastFrameTime = performance.now();
let volumeTexture = null;
let colormapTexture = null;
let terrainData = null;
const baseVolumeData = ref(null);

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

const latencyLabel = computed(() => requestLatencyMs.value > 0 ? `${requestLatencyMs.value.toFixed(0)} ms` : '-');

const volumeByteSizeLabel = computed(() => {
  if (!baseVolumeData.value?.byteLength) return '-';
  return `${(baseVolumeData.value.byteLength / (1024 * 1024)).toFixed(2)} MB`;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function interpolateJetRgb(t) {
  const unit = clamp(t, 0, 1);
  let left = SIMULATION_JET_STOPS[0];
  let right = SIMULATION_JET_STOPS[SIMULATION_JET_STOPS.length - 1];

  for (let index = 1; index < SIMULATION_JET_STOPS.length; index += 1) {
    if (unit <= SIMULATION_JET_STOPS[index][0]) {
      left = SIMULATION_JET_STOPS[index - 1];
      right = SIMULATION_JET_STOPS[index];
      break;
    }
  }

  const span = Math.max(1e-6, right[0] - left[0]);
  const mix = clamp((unit - left[0]) / span, 0, 1);
  return [
    Math.round(left[1][0] + ((right[1][0] - left[1][0]) * mix)),
    Math.round(left[1][1] + ((right[1][1] - left[1][1]) * mix)),
    Math.round(left[1][2] + ((right[1][2] - left[1][2]) * mix)),
  ];
}

function disposeTexture(texture) {
  texture?.dispose?.();
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function clearSceneRoot() {
  if (!threeScene || !sceneRoot) return;
  threeScene.remove(sceneRoot);
  disposeObject3D(sceneRoot);
  sceneRoot = null;
  disposeTexture(volumeTexture);
  disposeTexture(colormapTexture);
  volumeTexture = null;
  colormapTexture = null;
}

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
}

function buildTriangulatedGeometry(polyData) {
  const polys = polyData?.getPolys?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  if (!polys?.length || !points?.length) return null;

  const positions = [];
  for (let cursor = 0; cursor < polys.length;) {
    const count = Number(polys[cursor++] ?? 0);
    const ids = polys.slice(cursor, cursor + count);
    cursor += count;
    if (count < 3) continue;

    for (let index = 1; index < count - 1; index += 1) {
      [ids[0], ids[index], ids[index + 1]].forEach((pointId) => {
        const offset = Number(pointId) * 3;
        positions.push(
          Number(points[offset] ?? 0),
          Number(points[offset + 1] ?? 0),
          Number(points[offset + 2] ?? 0),
        );
      });
    }
  }

  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createTerrainWireframe(polyData, meta) {
  const geometry = buildTriangulatedGeometry(polyData);
  if (!geometry) return null;

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  const scaleValue = Number(meta?.scale ?? 1);
  const modelToMeters = scaleValue > 0 ? (1 / scaleValue) : 1;
  terrain.scale.set(modelToMeters, modelToMeters, modelToMeters * verticalExaggeration.value);
  return terrain;
}

function buildColormapTexture() {
  const data = new Uint8Array(256 * 4);
  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    const [r, g, b] = interpolateJetRgb(t);
    const alpha = index === 0
      ? 0
      : Math.round(clamp((0.12 + (0.88 * Math.pow(t, 1.08))) * opacityBoost.value, 0, 1) * 255);
    const offset = index * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = alpha;
  }

  const texture = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function buildDisplayTextureData(sourceData) {
  const shaped = new Uint8Array(sourceData.length);
  for (let index = 0; index < sourceData.length; index += 1) {
    const raw = sourceData[index];
    if (raw === 0) continue;
    const normalized = (raw - 1) / 254;
    const contrasted = Math.pow(clamp(normalized, 0, 1), contrast.value);
    shaped[index] = clamp(Math.round(1 + (contrasted * 254)), 1, 255);
  }
  return shaped;
}

function createVolumeMesh(volumeData, meta) {
  const dims = meta?.dims || [1, 1, 1];
  const bounds = meta?.bounds_m || [-1, 1, -1, 1, -1, 1];
  const cols = Number(dims[0] || 1);
  const rows = Number(dims[1] || 1);
  const layers = Number(dims[2] || 1);
  const textureData = buildDisplayTextureData(volumeData);

  volumeTexture = new THREE.Data3DTexture(textureData, cols, rows, layers);
  volumeTexture.format = THREE.RedFormat;
  volumeTexture.type = THREE.UnsignedByteType;
  volumeTexture.minFilter = THREE.LinearFilter;
  volumeTexture.magFilter = THREE.LinearFilter;
  volumeTexture.unpackAlignment = 1;
  volumeTexture.generateMipmaps = false;
  volumeTexture.needsUpdate = true;

  colormapTexture = buildColormapTexture();
  const shader = VolumeRenderShader1;
  const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
  uniforms.u_data.value = volumeTexture;
  uniforms.u_cmdata.value = colormapTexture;
  uniforms.u_size.value = new THREE.Vector3(cols, rows, layers);
  uniforms.u_clim.value = new THREE.Vector2(0, 1);
  uniforms.u_renderstyle.value = renderStyle.value === 'iso' ? 1 : 0;
  uniforms.u_renderthreshold.value = clamp(isoThreshold.value, 1 / 255, 0.99);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    side: THREE.BackSide,
    transparent: true,
  });

  const geometry = new THREE.BoxGeometry(cols, rows, layers);
  geometry.translate((cols - 1) / 2, (rows - 1) / 2, (layers - 1) / 2);

  const mesh = new THREE.Mesh(geometry, material);
  const width = Math.max(0.01, Number(bounds[1]) - Number(bounds[0]));
  const depth = Math.max(0.01, Number(bounds[3]) - Number(bounds[2]));
  const height = Math.max(0.01, Number(bounds[5]) - Number(bounds[4]));
  const scaleX = width / cols;
  const scaleY = depth / rows;
  const scaleZ = (height / layers) * verticalExaggeration.value;
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.position.set(
    Number(bounds[0]) + (scaleX * 0.5),
    Number(bounds[2]) + (scaleY * 0.5),
    Number(bounds[4]) + (scaleZ * 0.5),
  );

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
    }),
  );
  outline.scale.copy(mesh.scale);
  outline.position.copy(mesh.position);

  const group = new THREE.Group();
  group.add(mesh);
  group.add(outline);
  return group;
}

function syncRendererSize() {
  if (!threeRenderer || !threeCamera || !canvasHost.value) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  threeRenderer.setSize(width, height, false);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
}

function fitCameraToScene(root) {
  if (!root || !threeCamera || !orbitControls) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1e-3);
  const distance = maxSize * 1.7;

  orbitControls.target.copy(center);
  threeCamera.position.set(center.x + distance, center.y - (distance * 1.08), center.z + (distance * 0.7));
  threeCamera.near = Math.max(0.001, distance / 250);
  threeCamera.far = Math.max(200, distance * 32);
  threeCamera.updateProjectionMatrix();
  orbitControls.update();
}

function renderFrame() {
  orbitControls?.update();
  threeRenderer?.render?.(threeScene, threeCamera);
}

function animate(now = performance.now()) {
  lastFrameTime = now;
  renderFrame();
  animationFrameId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function startAnimation() {
  stopAnimation();
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animate);
}

function rebuildScene(resetCamera = false) {
  if (!threeScene || !metadata.value || !baseVolumeData.value) return;
  clearSceneRoot();

  const root = new THREE.Group();
  root.add(createVolumeMesh(baseVolumeData.value, metadata.value));

  if (showTerrain.value && terrainData) {
    const terrain = createTerrainWireframe(terrainData, metadata.value);
    if (terrain) root.add(terrain);
  }

  sceneRoot = root;
  threeScene.add(root);
  if (resetCamera) fitCameraToScene(root);
  renderFrame();
}

function handleOptionChange() {
  rebuildScene(false);
}

function handleAutoRotateChange() {
  if (!orbitControls) return;
  orbitControls.autoRotate = autoRotate.value;
  orbitControls.autoRotateSpeed = 0.35;
  renderFrame();
}

async function initThreeScene() {
  if (!canvasHost.value || threeRenderer) return;
  threeRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.value.appendChild(threeRenderer.domElement);

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x07111f);

  threeCamera = new THREE.PerspectiveCamera(42, 1, 0.01, 8000);
  threeCamera.position.set(800, -900, 600);

  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.autoRotate = autoRotate.value;
  orbitControls.autoRotateSpeed = 0.35;
  orbitControls.maxDistance = 8000;

  threeScene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const keyLight = new THREE.DirectionalLight(0xdbeafe, 1.1);
  keyLight.position.set(400, -260, 680);
  threeScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.38);
  fillLight.position.set(-260, 340, 280);
  threeScene.add(fillLight);

  syncRendererSize();
  startAnimation();
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

async function loadScene(resetCamera = true, forceRebuild = false) {
  if (!props.caseId) return;
  loading.value = true;
  errorMessage.value = '';
  loadingText.value = metadata.value && !forceRebuild ? '正在加载服务端 3D 体纹理...' : '正在构建服务端体缓存...';

  try {
    const startedAt = performance.now();
    await fetchMetadata(forceRebuild);
    const [terrain, volumeData] = await Promise.all([
      loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/bot.vtp`).catch(() => null),
      fetchVolumeTexture(metadata.value),
    ]);
    requestLatencyMs.value = performance.now() - startedAt;

    terrainData = terrain;
    baseVolumeData.value = volumeData;
    await nextTick();
    rebuildScene(resetCamera);
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error.message || '加载服务端三维体失败';
  } finally {
    loading.value = false;
  }
}

async function rebuildCache() {
  rebuilding.value = true;
  try {
    await loadScene(true, true);
    if (!errorMessage.value) ElMessage.success('服务端三维体缓存已重建。');
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '重建缓存失败');
  } finally {
    rebuilding.value = false;
  }
}

watch(targetCellsPreset, async () => {
  metadata.value = null;
  baseVolumeData.value = null;
  await loadScene(true, false);
});

watch(() => props.caseId, async () => {
  metadata.value = null;
  terrainData = null;
  baseVolumeData.value = null;
  requestLatencyMs.value = 0;
  await loadScene(true, false);
});

onMounted(async () => {
  await initThreeScene();
  resizeObserver = new ResizeObserver(() => {
    syncRendererSize();
    renderFrame();
  });
  if (canvasHost.value) resizeObserver.observe(canvasHost.value);
  await loadScene(true, false);
});

onBeforeUnmount(() => {
  stopAnimation();
  clearSceneRoot();
  resizeObserver?.disconnect?.();
  orbitControls?.dispose?.();
  threeRenderer?.dispose?.();
  if (threeRenderer?.domElement?.parentNode) {
    threeRenderer.domElement.parentNode.removeChild(threeRenderer.domElement);
  }
  threeRenderer = null;
  threeScene = null;
  threeCamera = null;
  orbitControls = null;
  terrainData = null;
  baseVolumeData.value = null;
});
</script>

<style scoped>
.server-volume-viewer {
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

.canvas-host {
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

  .chip-row {
    grid-template-columns: 1fr;
  }
}
</style>
