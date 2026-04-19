<template>
  <div class="stack-viewer">
    <div class="toolbar">
      <div class="toolbar-item toolbar-item--wide">
        <span class="label">叠层高度</span>
        <el-select
          v-model="selectedHeights"
          class="select"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="3"
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
        <span class="label">地形</span>
        <el-switch v-model="showTerrain" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">网格外壳</span>
        <el-switch v-model="showShell" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">切片层</span>
        <el-switch v-model="showSlices" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">流线层</span>
        <el-switch v-model="showStreamlines" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">刷新</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">每层流线预算</span>
        <el-slider
          v-model="perLayerLineBudget"
          :min="20"
          :max="160"
          :step="10"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">切片透明度</span>
        <el-slider
          v-model="sliceOpacity"
          :min="0.08"
          :max="0.85"
          :step="0.04"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">流线宽度</span>
        <el-slider
          v-model="lineWidthPx"
          :min="2"
          :max="10"
          :step="0.5"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">视角</span>
        <el-radio-group v-model="cameraPreset" size="small" @change="applyCameraPreset">
          <el-radio-button value="oblique">斜视</el-radio-button>
          <el-radio-button value="top">俯视</el-radio-button>
          <el-radio-button value="side">侧视</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="canvasHost" class="canvas-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">三维叠层实验加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>模式</span>
          <strong>3D 真实叠层</strong>
        </div>
        <div class="chip">
          <span>数据源</span>
          <strong>bot.vtp + mesh.vtp + 多高度 slice/streamlines</strong>
        </div>
        <div class="chip">
          <span>高度数</span>
          <strong>{{ selectedHeights.length }}</strong>
        </div>
        <div class="chip">
          <span>说明</span>
          <strong>真实 3D 叠层，不走 PNG 假平滑，也不强读 415MB raw VTU</strong>
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
        <span>叠层高度</span>
        <strong>{{ selectedHeightsLabel }}</strong>
      </div>
      <div class="stat">
        <span>切片层数</span>
        <strong>{{ sliceActorCount }}</strong>
      </div>
      <div class="stat">
        <span>流线层数</span>
        <strong>{{ streamlineActorCount }}</strong>
      </div>
      <div class="stat">
        <span>展示流线</span>
        <strong>{{ displayedLineCount }}</strong>
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
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const canvasHost = ref(null);
const availableHeights = ref([]);
const selectedHeights = ref([]);
const showTerrain = ref(true);
const showShell = ref(false);
const showSlices = ref(true);
const showStreamlines = ref(true);
const perLayerLineBudget = ref(60);
const sliceOpacity = ref(0.42);
const lineWidthPx = ref(4);
const cameraPreset = ref('oblique');
const loading = ref(false);
const loadingText = ref('正在读取三维叠层实验数据...');
const errorMessage = ref('');
const sliceActorCount = ref(0);
const streamlineActorCount = ref(0);
const displayedLineCount = ref(0);
const speedRange = ref({ min: 0, max: 1 });

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let orbitControls = null;
let resizeObserver = null;
let animationFrameId = null;
let sceneRoot = null;
let lineMaterials = [];
let pulseSeeds = [];
let lastFrameTime = performance.now();

let terrainData = null;
let shellData = null;
let sliceDataMap = new Map();
let streamlineDataMap = new Map();

const selectedHeightsLabel = computed(() => (
  selectedHeights.value.length ? selectedHeights.value.map((value) => `${value}m`).join(', ') : '-'
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

function normalizeRange(range) {
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? min + 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return { min, max };
}

function mergeRanges(...ranges) {
  const valid = ranges.filter((item) => item && Number.isFinite(item.min) && Number.isFinite(item.max));
  if (!valid.length) return { min: 0, max: 1 };
  return normalizeRange([
    Math.min(...valid.map((item) => item.min)),
    Math.max(...valid.map((item) => item.max)),
  ]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
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
  if (!sceneRoot || !threeScene) return;
  threeScene.remove(sceneRoot);
  disposeObject3D(sceneRoot);
  sceneRoot = null;
  lineMaterials = [];
  pulseSeeds = [];
}

function renderFrame() {
  orbitControls?.update();
  threeRenderer?.render?.(threeScene, threeCamera);
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
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();

  const existingPoint = pointData?.getArrayByName?.('speedMagnitude');
  if (existingPoint) return { association: 'point', range: normalizeRange(existingPoint.getRange()) };

  const existingCell = cellData?.getArrayByName?.('speedMagnitude');
  if (existingCell) return { association: 'cell', range: normalizeRange(existingCell.getRange()) };

  const pointVectorArray = pointData?.getArrayByName?.('U');
  const cellVectorArray = cellData?.getArrayByName?.('U');
  const vectorArray = pointVectorArray || cellVectorArray;
  const holder = pointVectorArray ? pointData : cellVectorArray ? cellData : null;
  const association = pointVectorArray ? 'point' : 'cell';
  if (!vectorArray || !holder) return null;

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
  holder.addArray(magnitudeArray);
  if (association === 'point' && holder.setScalars) holder.setScalars(magnitudeArray);
  dataSet.modified();
  return { association, range: normalizeRange([min, max]) };
}

function getJetColor(speed) {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const span = Math.max(1e-6, max - min);
  const t = clamp((speed - min) / span, 0, 1);

  let left = SIMULATION_JET_STOPS[0];
  let right = SIMULATION_JET_STOPS[SIMULATION_JET_STOPS.length - 1];

  for (let index = 1; index < SIMULATION_JET_STOPS.length; index += 1) {
    if (t <= SIMULATION_JET_STOPS[index][0]) {
      left = SIMULATION_JET_STOPS[index - 1];
      right = SIMULATION_JET_STOPS[index];
      break;
    }
  }

  const localSpan = Math.max(1e-6, right[0] - left[0]);
  const mix = clamp((t - left[0]) / localSpan, 0, 1);
  return new THREE.Color(
    (left[1][0] + ((right[1][0] - left[1][0]) * mix)) / 255,
    (left[1][1] + ((right[1][1] - left[1][1]) * mix)) / 255,
    (left[1][2] + ((right[1][2] - left[1][2]) * mix)) / 255,
  );
}

function buildTriangulatedGeometry(polyData, options = {}) {
  const polys = polyData?.getPolys?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  if (!polys?.length || !points?.length) return null;

  const {
    useCellSpeedColors = false,
    uniformColor = null,
  } = options;

  const cellSpeeds = useCellSpeedColors
    ? polyData?.getCellData?.()?.getArrayByName?.('speedMagnitude')?.getData?.()
    : null;

  const positions = [];
  const colors = [];
  let cellIndex = 0;

  for (let cursor = 0; cursor < polys.length;) {
    const count = Number(polys[cursor] ?? 0);
    cursor += 1;
    const ids = polys.slice(cursor, cursor + count);
    cursor += count;

    if (count < 3) {
      cellIndex += 1;
      continue;
    }

    const color = useCellSpeedColors
      ? getJetColor(Number(cellSpeeds?.[cellIndex] ?? 0))
      : uniformColor;

    for (let index = 1; index < count - 1; index += 1) {
      [ids[0], ids[index], ids[index + 1]].forEach((pointId) => {
        const offset = Number(pointId) * 3;
        positions.push(
          Number(points[offset] ?? 0),
          Number(points[offset + 1] ?? 0),
          Number(points[offset + 2] ?? 0),
        );
        if (color) colors.push(color.r, color.g, color.b);
      });
    }

    cellIndex += 1;
  }

  if (!positions.length) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createTerrainMesh(polyData) {
  const geometry = buildTriangulatedGeometry(polyData, {
    uniformColor: new THREE.Color(0xa9b8c8),
  });
  if (!geometry) return null;

  const material = new THREE.MeshBasicMaterial({
    color: 0xa9b8c8,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

function createShellMesh(polyData) {
  const geometry = buildTriangulatedGeometry(polyData, {
    uniformColor: new THREE.Color(0xe6eef7),
  });
  if (!geometry) return null;

  const material = new THREE.MeshBasicMaterial({
    color: 0xe6eef7,
    transparent: true,
    opacity: 0.12,
    wireframe: true,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}

function createSliceMesh(polyData) {
  const geometry = buildTriangulatedGeometry(polyData, {
    useCellSpeedColors: true,
  });
  if (!geometry) return null;

  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
    transparent: true,
    opacity: Math.min(0.72, Math.max(sliceOpacity.value, 0.18)),
  });

  return new THREE.Mesh(geometry, material);
}

function extractDisplayTrajectories(polyData, maxLines, pointStride = 10) {
  const lines = polyData?.getLines?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  const pointSpeeds = polyData?.getPointData?.()?.getArrayByName?.('speedMagnitude')?.getData?.();
  if (!lines?.length || !points?.length || !pointSpeeds?.length) return [];

  let totalLines = 0;
  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1 + count;
    totalLines += 1;
  }

  const step = Math.max(1, Math.ceil(totalLines / Math.max(1, maxLines)));
  const trajectories = [];
  let lineIndex = 0;

  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1;
    const ids = lines.slice(cursor, cursor + count);
    cursor += count;

    if (count < 2 || lineIndex % step !== 0) {
      lineIndex += 1;
      continue;
    }

    const sampledIds = [];
    for (let index = 0; index < ids.length; index += pointStride) sampledIds.push(Number(ids[index]));
    const lastId = Number(ids[ids.length - 1] ?? 0);
    if (sampledIds[sampledIds.length - 1] !== lastId) sampledIds.push(lastId);
    if (sampledIds.length < 2) {
      lineIndex += 1;
      continue;
    }

    const trajectoryPoints = [];
    const segmentLengths = [];
    let pathLength = 0;
    let speedSum = 0;
    let speedMax = 0;

    sampledIds.forEach((pointId) => {
      const offset = pointId * 3;
      const speed = Number(pointSpeeds[pointId] ?? 0);
      const point = {
        x: Number(points[offset] ?? 0),
        y: Number(points[offset + 1] ?? 0),
        z: Number(points[offset + 2] ?? 0),
        speed,
      };
      if (trajectoryPoints.length > 0) {
        const segmentLength = distance3(trajectoryPoints[trajectoryPoints.length - 1], point);
        segmentLengths.push(segmentLength);
        pathLength += segmentLength;
      }
      trajectoryPoints.push(point);
      speedSum += speed;
      if (speed > speedMax) speedMax = speed;
    });

    if (pathLength > 1e-6) {
      trajectories.push({
        points: trajectoryPoints,
        segmentLengths,
        length: pathLength,
        meanSpeed: speedSum / trajectoryPoints.length,
        maxSpeed: speedMax,
      });
    }

    lineIndex += 1;
  }

  return trajectories;
}

function createLineMesh(trajectory) {
  const positions = trajectory.points.flatMap((point) => [point.x, point.y, point.z]);
  const geometry = new MeshLineGeometry();
  geometry.setPoints(positions, (ratio) => {
    const bell = Math.sin(Math.PI * ratio);
    return 0.52 + (0.42 * Math.pow(Math.max(0, bell), 0.95));
  });

  const width = Math.max(1, canvasHost.value?.clientWidth ?? 1);
  const height = Math.max(1, canvasHost.value?.clientHeight ?? 1);
  const headColor = getJetColor(trajectory.meanSpeed);
  const tailColor = headColor.clone().multiplyScalar(0.48);

  const material = new MeshLineMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0.86,
    lineWidth: lineWidthPx.value,
    color: headColor,
    gradient: [tailColor, headColor],
    useGradient: 1,
    resolution: new THREE.Vector2(width, height),
    sizeAttenuation: 0,
    dashArray: 1.05,
    dashRatio: 0.56,
    dashOffset: 0,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  lineMaterials.push(material);
  pulseSeeds.push(Math.random() * Math.PI * 2);
  return mesh;
}

function syncRendererSize() {
  if (!threeRenderer || !threeCamera || !canvasHost.value) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  threeRenderer.setSize(width, height, false);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
  lineMaterials.forEach((material) => material.resolution.set(width, height));
}

function getSceneBounds() {
  if (!sceneRoot) return null;
  const box = new THREE.Box3().setFromObject(sceneRoot);
  if (!Number.isFinite(box.min.x)) return null;
  return box.getBoundingSphere(new THREE.Sphere());
}

function applyCameraPreset() {
  if (!sceneRoot || !threeCamera || !orbitControls) return;
  const sphere = getSceneBounds();
  if (!sphere) return;

  const center = sphere.center.clone();
  const radius = Math.max(sphere.radius, 0.6);

  if (cameraPreset.value === 'top') {
    threeCamera.position.set(center.x, center.y, center.z + (radius * 3.4));
    threeCamera.up.set(0, 1, 0);
  } else if (cameraPreset.value === 'side') {
    threeCamera.position.set(center.x + (radius * 3.1), center.y - (radius * 0.2), center.z + (radius * 0.55));
    threeCamera.up.set(0, 0, 1);
  } else {
    threeCamera.position.set(center.x + (radius * 2.45), center.y - (radius * 2.05), center.z + (radius * 1.08));
    threeCamera.up.set(0, 0, 1);
  }

  threeCamera.near = Math.max(radius / 220, 0.001);
  threeCamera.far = Math.max(radius * 44, 20);
  threeCamera.lookAt(center);
  threeCamera.updateProjectionMatrix();

  orbitControls.target.copy(center);
  orbitControls.minDistance = Math.max(radius * 0.45, 0.5);
  orbitControls.maxDistance = Math.max(radius * 18, 12);
  orbitControls.update();
  renderFrame();
}

function startAnimation() {
  stopAnimation();

  const tick = (now) => {
    const delta = Math.min(2.5, Math.max(0.4, (now - lastFrameTime) / 16.6667));
    lastFrameTime = now;

    lineMaterials.forEach((material, index) => {
      material.dashOffset = -((now * 0.00022 * delta) + (pulseSeeds[index] ?? 0));
    });

    renderFrame();
    animationFrameId = requestAnimationFrame(tick);
  };

  animationFrameId = requestAnimationFrame(tick);
}

function rebuildScene(resetCamera = true) {
  if (!threeScene) return;

  stopAnimation();
  clearSceneRoot();

  sliceActorCount.value = 0;
  streamlineActorCount.value = 0;
  displayedLineCount.value = 0;

  const selectedSlices = selectedHeights.value
    .map((height) => sliceDataMap.get(height))
    .filter(Boolean);
  const selectedStreamlines = selectedHeights.value
    .map((height) => streamlineDataMap.get(height))
    .filter(Boolean);

  const ranges = [];
  selectedSlices.forEach((data) => {
    const info = ensureSpeedMagnitude(data);
    if (info?.range) ranges.push(info.range);
  });
  selectedStreamlines.forEach((data) => {
    const info = ensureSpeedMagnitude(data);
    if (info?.range) ranges.push(info.range);
  });
  speedRange.value = mergeRanges(...ranges);

  const root = new THREE.Group();

  if (showTerrain.value && terrainData) {
    const terrainMesh = createTerrainMesh(terrainData);
    if (terrainMesh) root.add(terrainMesh);
  }

  if (showShell.value && shellData) {
    const shellMesh = createShellMesh(shellData);
    if (shellMesh) root.add(shellMesh);
  }

  if (showSlices.value) {
    selectedHeights.value.forEach((height) => {
      const polyData = sliceDataMap.get(height);
      if (!polyData) return;
      ensureSpeedMagnitude(polyData);
      const mesh = createSliceMesh(polyData);
      if (!mesh) return;
      root.add(mesh);
      sliceActorCount.value += 1;
    });
  }

  if (showStreamlines.value) {
    selectedHeights.value.forEach((height) => {
      const polyData = streamlineDataMap.get(height);
      if (!polyData) return;
      ensureSpeedMagnitude(polyData);
      const trajectories = extractDisplayTrajectories(
        polyData,
        perLayerLineBudget.value,
        perLayerLineBudget.value >= 100 ? 12 : 9,
      );
      if (!trajectories.length) return;
      const group = new THREE.Group();
      trajectories.forEach((trajectory) => group.add(createLineMesh(trajectory)));
      root.add(group);
      streamlineActorCount.value += 1;
      displayedLineCount.value += trajectories.length;
    });
  }

  sceneRoot = root;
  threeScene.add(root);
  syncRendererSize();
  if (resetCamera) applyCameraPreset();
  startAnimation();
  renderFrame();
}

function handleOptionChange() {
  rebuildScene(false);
}

function sampleDefaultHeights(heights, targetCount = 4) {
  if (!heights.length) return [];
  if (heights.length <= targetCount) return [...heights];
  const result = [];
  for (let index = 0; index < targetCount; index += 1) {
    const position = Math.round((index * (heights.length - 1)) / Math.max(targetCount - 1, 1));
    result.push(heights[position]);
  }
  return Array.from(new Set(result));
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于三维叠层实验的切片 VTP 文件。');
  if (!selectedHeights.value.length) {
    selectedHeights.value = sampleDefaultHeights(heights, 4);
  }
}

async function loadScene() {
  if (!selectedHeights.value.length || !threeScene) return;
  loading.value = true;
  loadingText.value = '正在读取三维叠层实验数据...';
  errorMessage.value = '';

  try {
    if (!terrainData || !shellData) {
      const [terrain, shell] = await Promise.all([
        loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/bot.vtp`),
        loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/mesh.vtp`),
      ]);
      terrainData = terrain;
      shellData = shell;
    }

    const heights = [...selectedHeights.value];
    const missingHeights = heights.filter((height) => (
      !sliceDataMap.has(height) || !streamlineDataMap.has(height)
    ));

    await Promise.all(missingHeights.map(async (height) => {
      const [sliceData, streamlineData] = await Promise.all([
        loadPolyData(`/uploads/${props.caseId}/run/postProcessing/Data/${height}.vtp`),
        loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/internal_${height}m_web.vtp`),
      ]);
      sliceDataMap.set(height, sliceData);
      streamlineDataMap.set(height, streamlineData);
    }));

    rebuildScene(true);
  } catch (error) {
    console.error('三维叠层实验加载失败:', error);
    errorMessage.value = error?.message || '三维实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initThreeScene() {
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x07111b);
  threeScene.fog = new THREE.Fog(0x07111b, 16, 34);

  const width = Math.max(1, canvasHost.value?.clientWidth ?? 1);
  const height = Math.max(1, canvasHost.value?.clientHeight ?? 1);

  threeCamera = new THREE.PerspectiveCamera(42, width / height, 0.001, 100);
  threeRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.02;
  threeRenderer.setClearColor(0x07111b, 1);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  threeRenderer.setSize(width, height, false);
  canvasHost.value.appendChild(threeRenderer.domElement);

  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.rotateSpeed = 0.82;
  orbitControls.panSpeed = 0.72;

  const hemi = new THREE.HemisphereLight(0xcdeeff, 0x142536, 1.08);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(14, -11, 16);
  const rim = new THREE.DirectionalLight(0x85d5ff, 0.42);
  rim.position.set(-10, 7, 8);
  const fill = new THREE.DirectionalLight(0xffe8c0, 0.28);
  fill.position.set(6, 12, 7);
  threeScene.add(hemi, key, rim, fill);
}

onMounted(async () => {
  await nextTick();
  if (!canvasHost.value) return;

  initThreeScene();
  resizeObserver = new ResizeObserver(() => {
    syncRendererSize();
    renderFrame();
  });
  resizeObserver.observe(canvasHost.value);

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化三维叠层实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  stopAnimation();
  resizeObserver?.disconnect();
  resizeObserver = null;
  clearSceneRoot();
  orbitControls?.dispose();
  orbitControls = null;
  if (threeRenderer?.domElement?.parentNode === canvasHost.value) {
    canvasHost.value.removeChild(threeRenderer.domElement);
  }
  threeRenderer?.dispose?.();
  threeRenderer = null;
  threeScene = null;
  threeCamera = null;
  sliceDataMap.clear();
  streamlineDataMap.clear();
  terrainData = null;
  shellData = null;
});
</script>

<style scoped>
.stack-viewer {
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
  min-height: 760px;
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 24%),
    radial-gradient(circle at bottom right, rgba(250, 204, 21, 0.1), transparent 24%),
    linear-gradient(180deg, #06111b 0%, #0b1724 100%);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
}

.canvas-host {
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
  max-width: 480px;
  text-align: center;
  color: rgba(255, 255, 255, 0.82);
}

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 4px solid rgba(255, 255, 255, 0.18);
  border-top-color: #38bdf8;
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
  pointer-events: none;
}

.chip {
  min-width: 170px;
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
  background: rgba(6, 15, 24, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.24);
  pointer-events: none;
}

.legend-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.86);
}

.legend-bar {
  height: 16px;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.24);
}

.legend-ticks {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(226, 232, 240, 0.68);
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat span {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
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

@media (max-width: 1180px) {
  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    min-height: 620px;
  }
}
</style>
