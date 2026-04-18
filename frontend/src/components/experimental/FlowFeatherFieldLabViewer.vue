<template>
  <div class="feather-viewer">
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

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">风羽数量</span>
        <el-slider
          v-model="glyphBudget"
          :min="400"
          :max="2600"
          :step="100"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">长度倍率</span>
        <el-slider
          v-model="glyphLengthScale"
          :min="0.45"
          :max="2.4"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">羽流强度</span>
        <el-slider
          v-model="glyphOpacity"
          :min="0.2"
          :max="0.95"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">呼吸动效</span>
        <el-switch v-model="shimmerMotion" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">显示底图</span>
        <el-switch v-model="showSurface" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">重载</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="canvasHost" class="canvas-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">风羽实验视图加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>引擎</span>
          <strong>Three.js Instanced Feathers</strong>
        </div>
        <div class="chip">
          <span>切片文件</span>
          <strong>{{ surfaceFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>向量来源</span>
          <strong>{{ vectorSourceLabel }}</strong>
        </div>
        <div class="chip">
          <span>模式</span>
          <strong>{{ styleLabel }}</strong>
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
        <span>切片点数</span>
        <strong>{{ pointCount }}</strong>
      </div>
      <div class="stat">
        <span>风羽数量</span>
        <strong>{{ renderedGlyphCount }}</strong>
      </div>
      <div class="stat">
        <span>切片三角形</span>
        <strong>{{ surfaceTriangleCount }}</strong>
      </div>
      <div class="stat">
        <span>长度倍率</span>
        <strong>{{ glyphLengthScale.toFixed(2) }}</strong>
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
const selectedHeight = ref(null);
const glyphBudget = ref(1400);
const glyphLengthScale = ref(1.15);
const glyphOpacity = ref(0.7);
const shimmerMotion = ref(true);
const showSurface = ref(false);
const loading = ref(false);
const loadingText = ref('正在读取风羽实验数据...');
const errorMessage = ref('');
const pointCount = ref(0);
const renderedGlyphCount = ref(0);
const surfaceTriangleCount = ref(0);
const speedRange = ref({ min: 0, max: 1 });

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let orbitControls = null;
let resizeObserver = null;
let animationFrameId = null;
let featherTexture = null;
let sceneRoot = null;
let featherMaterial = null;
let rawSurfaceData = null;
let lastFrameTime = performance.now();

const reusableColor = new THREE.Color();
const reusableQuat = new THREE.Quaternion();
const reusableScale = new THREE.Vector3();
const reusablePosition = new THREE.Vector3();
const reusableMatrix = new THREE.Matrix4();

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const vectorSourceLabel = computed(() => 'PointData.featherVectors <- CellData.U');

const styleLabel = computed(() => (
  `${shimmerMotion.value ? '呼吸风羽' : '静态风羽'}${showSurface.value ? ' + 切片底图' : ' + 无底图'}`
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(range) {
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? min + 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return { min, max };
}

function loadHash(index) {
  const raw = Math.sin((index + 1) * 12.9898) * 43758.5453123;
  return raw - Math.floor(raw);
}

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
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

  const range = Math.max(1e-6, right[0] - left[0]);
  const mix = clamp((t - left[0]) / range, 0, 1);
  reusableColor.setRGB(
    (left[1][0] + ((right[1][0] - left[1][0]) * mix)) / 255,
    (left[1][1] + ((right[1][1] - left[1][1]) * mix)) / 255,
    (left[1][2] + ((right[1][2] - left[1][2]) * mix)) / 255,
  );
  return reusableColor.clone();
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
  dataSet.modified();
  return normalizeRange([min, max]);
}

function accumulateCellVectors(cellArray, vectorValues, compCount, pointSums, pointCounts, startCellId) {
  const connectivity = cellArray?.getData?.();
  if (!connectivity?.length) return startCellId;

  let cellId = startCellId;
  for (let offset = 0; offset < connectivity.length;) {
    const count = Number(connectivity[offset++] ?? 0);
    const vectorOffset = cellId * compCount;
    const vx = Number(vectorValues[vectorOffset] ?? 0);
    const vy = Number(vectorValues[vectorOffset + 1] ?? 0);
    const vz = Number(vectorValues[vectorOffset + 2] ?? 0);

    for (let index = 0; index < count; index += 1) {
      const pointId = Number(connectivity[offset + index] ?? -1);
      if (pointId < 0) continue;
      const sumOffset = pointId * 3;
      pointSums[sumOffset] += vx;
      pointSums[sumOffset + 1] += vy;
      pointSums[sumOffset + 2] += vz;
      pointCounts[pointId] += 1;
    }

    offset += count;
    cellId += 1;
  }

  return cellId;
}

function ensurePointVectors(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();
  const points = dataSet?.getPoints?.();
  if (!pointData || !cellData || !points) return { min: 0, max: 1 };

  let pointVectors = pointData.getArrayByName('featherVectors');
  if (!pointVectors) {
    const cellVectors = cellData.getArrayByName('U');
    const pointTotal = Number(points.getNumberOfPoints?.() ?? 0);
    if (!cellVectors || !pointTotal) return { min: 0, max: 1 };

    const vectorValues = cellVectors.getData();
    const compCount = Number(cellVectors.getNumberOfComponents?.() ?? 3);
    const pointSums = new Float32Array(pointTotal * 3);
    const pointCounts = new Uint32Array(pointTotal);

    let cellId = 0;
    cellId = accumulateCellVectors(dataSet.getVerts?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    cellId = accumulateCellVectors(dataSet.getLines?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    cellId = accumulateCellVectors(dataSet.getPolys?.(), vectorValues, compCount, pointSums, pointCounts, cellId);
    accumulateCellVectors(dataSet.getStrips?.(), vectorValues, compCount, pointSums, pointCounts, cellId);

    for (let pointId = 0; pointId < pointTotal; pointId += 1) {
      const count = pointCounts[pointId] || 1;
      const offset = pointId * 3;
      pointSums[offset] /= count;
      pointSums[offset + 1] /= count;
      pointSums[offset + 2] /= count;
    }

    pointVectors = vtkDataArray.newInstance({
      name: 'featherVectors',
      values: pointSums,
      numberOfComponents: 3,
    });
    pointData.addArray(pointVectors);
  }

  let pointSpeeds = pointData.getArrayByName('pointSpeedMagnitude');
  if (!pointSpeeds) {
    const values = pointVectors.getData();
    const tupleCount = Number(pointVectors.getNumberOfTuples?.() ?? 0);
    const compCount = Number(pointVectors.getNumberOfComponents?.() ?? 3);
    const speeds = new Float32Array(tupleCount);

    for (let index = 0; index < tupleCount; index += 1) {
      const offset = index * compCount;
      const ux = Number(values[offset] ?? 0);
      const uy = Number(values[offset + 1] ?? 0);
      const uz = Number(values[offset + 2] ?? 0);
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

function createFeatherTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.5);
  ctx.quadraticCurveTo(canvas.width * 0.16, canvas.height * 0.08, canvas.width * 0.56, canvas.height * 0.24);
  ctx.quadraticCurveTo(canvas.width * 0.88, canvas.height * 0.38, canvas.width, canvas.height * 0.5);
  ctx.quadraticCurveTo(canvas.width * 0.88, canvas.height * 0.62, canvas.width * 0.56, canvas.height * 0.76);
  ctx.quadraticCurveTo(canvas.width * 0.16, canvas.height * 0.92, 0, canvas.height * 0.5);
  ctx.closePath();
  ctx.fill();

  const shine = ctx.createLinearGradient(0, 0, canvas.width, 0);
  shine.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  shine.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  shine.addColorStop(0.68, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, canvas.height * 0.36, canvas.width, canvas.height * 0.28);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function clearSceneRoot() {
  if (!sceneRoot || !threeScene) return;
  threeScene.remove(sceneRoot);
  disposeObject3D(sceneRoot);
  sceneRoot = null;
  featherMaterial = null;
}

function extractSurfaceMesh(polyData) {
  const polys = polyData?.getPolys?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  const cellSpeeds = polyData?.getCellData?.()?.getArrayByName?.('speedMagnitude')?.getData?.();
  if (!polys?.length || !points?.length || !cellSpeeds?.length) {
    surfaceTriangleCount.value = 0;
    return null;
  }

  const positions = [];
  const colors = [];
  let cellIndex = 0;
  let triangleCount = 0;

  for (let cursor = 0; cursor < polys.length;) {
    const count = Number(polys[cursor] ?? 0);
    cursor += 1;
    const ids = polys.slice(cursor, cursor + count);
    cursor += count;

    if (count < 3) {
      cellIndex += 1;
      continue;
    }

    const color = getJetColor(Number(cellSpeeds[cellIndex] ?? 0));
    for (let index = 1; index < count - 1; index += 1) {
      [ids[0], ids[index], ids[index + 1]].forEach((pointId) => {
        const offset = Number(pointId) * 3;
        positions.push(
          Number(points[offset] ?? 0),
          Number(points[offset + 1] ?? 0),
          Number(points[offset + 2] ?? 0),
        );
        colors.push(color.r, color.g, color.b);
      });
      triangleCount += 1;
    }
    cellIndex += 1;
  }

  surfaceTriangleCount.value = triangleCount;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    shininess: 12,
    emissive: new THREE.Color(0x03111b),
  });

  return new THREE.Mesh(geometry, material);
}

function buildFeatherField(polyData) {
  const pointData = polyData?.getPointData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  const vectors = pointData?.getArrayByName?.('featherVectors')?.getData?.();
  const speeds = pointData?.getArrayByName?.('pointSpeedMagnitude')?.getData?.();
  if (!points?.length || !vectors?.length || !speeds?.length) return null;

  const totalPoints = Math.min(
    Number(polyData?.getPoints?.()?.getNumberOfPoints?.() ?? 0),
    Math.floor(points.length / 3),
    Math.floor(vectors.length / 3),
    speeds.length,
  );
  pointCount.value = totalPoints;
  if (!totalPoints) return null;

  const bounds = polyData.getBounds?.() || [-1, 1, -1, 1, -0.2, 0.2];
  const spanX = Math.max(1e-6, Number(bounds[1] ?? 1) - Number(bounds[0] ?? 0));
  const spanY = Math.max(1e-6, Number(bounds[3] ?? 1) - Number(bounds[2] ?? 0));
  const baseSpan = Math.max(spanX, spanY);
  const threshold = glyphBudget.value / totalPoints;
  const candidates = [];

  for (let pointId = 0; pointId < totalPoints; pointId += 1) {
    const speed = Number(speeds[pointId] ?? 0);
    if (speed < speedRange.value.min + ((speedRange.value.max - speedRange.value.min) * 0.06)) continue;
    if (loadHash(pointId) > threshold) continue;

    const vectorOffset = pointId * 3;
    const vx = Number(vectors[vectorOffset] ?? 0);
    const vy = Number(vectors[vectorOffset + 1] ?? 0);
    const planarLength = Math.sqrt((vx * vx) + (vy * vy));
    if (planarLength < 1e-5) continue;

    candidates.push({ pointId, speed, vx, vy, planarLength });
  }

  candidates.sort((left, right) => right.speed - left.speed);
  const selected = candidates.slice(0, glyphBudget.value);
  renderedGlyphCount.value = selected.length;
  if (!selected.length) return null;

  if (!featherTexture) featherTexture = createFeatherTexture();

  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: featherTexture,
    transparent: true,
    opacity: glyphOpacity.value,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    alphaTest: 0.05,
    toneMapped: false,
    color: 0xffffff,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  selected.forEach((item, index) => {
    const pointOffset = item.pointId * 3;
    const px = Number(points[pointOffset] ?? 0);
    const py = Number(points[pointOffset + 1] ?? 0);
    const pz = Number(points[pointOffset + 2] ?? 0);
    const speedFactor = clamp(
      (item.speed - speedRange.value.min) / Math.max(1e-6, speedRange.value.max - speedRange.value.min),
      0,
      1,
    );
    const length = baseSpan * (0.018 + (0.08 * speedFactor * glyphLengthScale.value));
    const width = length * (0.18 + (0.06 * loadHash(index + 7)));

    reusablePosition.set(px, py, pz + (baseSpan * 0.0025));
    reusableQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(item.vy, item.vx));
    reusableScale.set(length, width, 1);
    reusableMatrix.compose(reusablePosition, reusableQuat, reusableScale);
    mesh.setMatrixAt(index, reusableMatrix);
    mesh.setColorAt(index, getJetColor(item.speed));
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  featherMaterial = material;
  return mesh;
}

function syncRendererSize() {
  if (!threeRenderer || !threeCamera || !canvasHost.value) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  threeRenderer.setSize(width, height, false);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  const aspect = width / height;
  const orthoSize = 2.8;
  threeCamera.left = -orthoSize * aspect;
  threeCamera.right = orthoSize * aspect;
  threeCamera.top = orthoSize;
  threeCamera.bottom = -orthoSize;
  threeCamera.updateProjectionMatrix();
}

function fitCameraToScene() {
  if (!sceneRoot || !threeCamera || !orbitControls) return;
  const box = new THREE.Box3().setFromObject(sceneRoot);
  if (!Number.isFinite(box.min.x)) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const width = Math.max(1e-4, box.max.x - box.min.x);
  const height = Math.max(1e-4, box.max.y - box.min.y);
  const hostAspect = Math.max(1e-6, (canvasHost.value?.clientWidth || 1) / Math.max(1, canvasHost.value?.clientHeight || 1));
  const padding = 1.16;
  let halfWidth = (width * padding) / 2;
  let halfHeight = (height * padding) / 2;

  if ((halfWidth / Math.max(halfHeight, 1e-6)) > hostAspect) {
    halfHeight = halfWidth / hostAspect;
  } else {
    halfWidth = halfHeight * hostAspect;
  }

  threeCamera.left = -halfWidth;
  threeCamera.right = halfWidth;
  threeCamera.top = halfHeight;
  threeCamera.bottom = -halfHeight;
  threeCamera.position.set(
    center.x,
    center.y - (height * 0.04),
    center.z + Math.max(width, height) * 2.1,
  );
  threeCamera.near = 0.001;
  threeCamera.far = Math.max(sphere.radius * 40, 20);
  threeCamera.up.set(0, 1, 0);
  threeCamera.lookAt(center);
  threeCamera.updateProjectionMatrix();
  orbitControls.minZoom = 0.75;
  orbitControls.maxZoom = 12;
  orbitControls.minDistance = 0.01;
  orbitControls.maxDistance = Math.max(sphere.radius * 10, 10);
  orbitControls.target.copy(center);
  orbitControls.update();
}

function rebuildVisuals(resetCamera = true) {
  if (!threeScene || !rawSurfaceData) return;

  stopAnimation();
  clearSceneRoot();

  const root = new THREE.Group();
  const cellRange = ensureSpeedMagnitude(rawSurfaceData);
  const pointRange = ensurePointVectors(rawSurfaceData);
  speedRange.value = pointRange;

  if (showSurface.value) {
    const surface = extractSurfaceMesh(rawSurfaceData);
    if (surface) root.add(surface);
  } else {
    surfaceTriangleCount.value = 0;
  }

  const field = buildFeatherField(rawSurfaceData);
  if (field) root.add(field);

  sceneRoot = root;
  threeScene.add(root);
  syncRendererSize();
  if (resetCamera) fitCameraToScene();
  lastFrameTime = performance.now();
  startAnimation();
}

function handleOptionChange() {
  rebuildVisuals(false);
}

function startAnimation() {
  stopAnimation();
  const tick = (now) => {
    const delta = Math.min(2.5, Math.max(0.25, (now - lastFrameTime) / 16.6667));
    lastFrameTime = now;

    if (featherMaterial) {
      const pulse = shimmerMotion.value ? (0.84 + (0.14 * Math.sin(now * 0.0014))) : 1;
      featherMaterial.opacity = glyphOpacity.value * pulse;
    }

    orbitControls?.update();
    threeRenderer?.render(threeScene, threeCamera);
    animationFrameId = requestAnimationFrame(tick);
  };

  animationFrameId = requestAnimationFrame(tick);
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于风羽实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function loadScene() {
  if (!selectedHeight.value || !threeScene) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的风羽切片数据...`;
  errorMessage.value = '';

  try {
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    rawSurfaceData = await loadPolyData(surfaceUrl);
    rebuildVisuals(true);
  } catch (error) {
    console.error('风羽实验页加载失败:', error);
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initThree() {
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.02;
  threeRenderer.setClearColor(0x06111b, 1);

  threeScene = new THREE.Scene();
  threeCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.001, 50);
  threeCamera.position.set(0, 0, 5);

  const ambient = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.08);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, -1.4, 3.2);
  const fill = new THREE.DirectionalLight(0x9dd6ff, 0.55);
  fill.position.set(-2.2, 2.1, 1.4);
  threeScene.add(ambient, key, fill);

  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.06;
  orbitControls.enableRotate = false;
  orbitControls.screenSpacePanning = true;

  canvasHost.value?.appendChild(threeRenderer.domElement);
  syncRendererSize();

  if (typeof ResizeObserver !== 'undefined' && canvasHost.value) {
    resizeObserver = new ResizeObserver(() => syncRendererSize());
    resizeObserver.observe(canvasHost.value);
  }
}

onMounted(async () => {
  await nextTick();
  if (!canvasHost.value) return;
  initThree();

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化风羽实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  stopAnimation();
  clearSceneRoot();
  orbitControls?.dispose?.();
  resizeObserver?.disconnect?.();
  featherTexture?.dispose?.();

  if (threeRenderer) {
    threeRenderer.dispose();
    if (threeRenderer.domElement?.parentNode === canvasHost.value) {
      canvasHost.value.removeChild(threeRenderer.domElement);
    }
  }

  threeRenderer = null;
  threeScene = null;
  threeCamera = null;
  orbitControls = null;
  resizeObserver = null;
  featherTexture = null;
  rawSurfaceData = null;
});
</script>

<style scoped>
.feather-viewer {
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
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 30%),
    linear-gradient(180deg, #05101a 0%, #091624 100%);
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
  max-width: 420px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
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
  font-size: 12px;
  color: #475569;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.stat {
  padding: 16px 18px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat span {
  color: #64748b;
  font-size: 13px;
}

.stat strong {
  color: #0f172a;
  font-size: 22px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1200px) {
  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
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

  .chip-row {
    top: 14px;
    left: 14px;
    right: 14px;
  }
}
</style>
