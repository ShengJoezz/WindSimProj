<template>
  <div class="meshline-viewer">
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
        <span class="label">实验风格</span>
        <el-radio-group v-model="stylePreset" size="small" @change="handleOptionChange">
          <el-radio-button value="clarity">清晰</el-radio-button>
          <el-radio-button value="glow">发光</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">展示流线数</span>
        <el-slider
          v-model="displayLineBudget"
          :min="60"
          :max="260"
          :step="20"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">线宽 (px)</span>
        <el-slider
          v-model="lineWidthPx"
          :min="2"
          :max="16"
          :step="1"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">脉冲流向</span>
        <el-switch v-model="pulseMotion" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">真实粒子头</span>
        <el-switch v-model="showParticles" @change="handleOptionChange" />
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
        <div class="overlay-title">开源实验视图加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>引擎</span>
          <strong>Three.js + MeshLine</strong>
        </div>
        <div class="chip">
          <span>流线文件</span>
          <strong>{{ streamlineFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>切片文件</span>
          <strong>{{ surfaceFileLabel }}</strong>
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
        <span>原始流线</span>
        <strong>{{ rawLineCount }}</strong>
      </div>
      <div class="stat">
        <span>展示流线</span>
        <strong>{{ displayedLineCount }}</strong>
      </div>
      <div class="stat">
        <span>切片三角形</span>
        <strong>{{ surfaceTriangleCount }}</strong>
      </div>
      <div class="stat">
        <span>活动粒子</span>
        <strong>{{ liveParticleCount }}</strong>
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
const selectedHeight = ref(null);
const stylePreset = ref('clarity');
const displayLineBudget = ref(140);
const lineWidthPx = ref(4);
const pulseMotion = ref(true);
const showParticles = ref(false);
const loading = ref(false);
const loadingText = ref('正在读取开源实验数据...');
const errorMessage = ref('');
const rawLineCount = ref(0);
const displayedLineCount = ref(0);
const surfaceTriangleCount = ref(0);
const liveParticleCount = ref(0);
const speedRange = ref({ min: 0, max: 1 });
const PARTICLE_TRAIL_COUNT = 2;

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let orbitControls = null;
let resizeObserver = null;
let animationFrameId = null;

let rawSurfaceData = null;
let rawStreamlineData = null;
let sceneRoot = null;
let lineMaterials = [];
let particleSystem = null;
let particleTexture = null;
let particleStates = [];
let pulseSeeds = [];
let lastFrameTime = performance.now();

const streamlineFileLabel = computed(() => (
  selectedHeight.value ? `internal_${selectedHeight.value}m_web.vtp` : '-'
));

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const styleLabel = computed(() => (
  `${stylePreset.value === 'glow' ? '发光带状流线' : '工程清晰流线'}${showParticles.value ? ' + 真实粒子头' : ' + 无粒子'}`
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

function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createParticleSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 246, 216, 1)');
  gradient.addColorStop(0.55, 'rgba(255, 182, 77, 0.65)');
  gradient.addColorStop(1, 'rgba(255, 182, 77, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
  lineMaterials = [];
  particleSystem = null;
  particleStates = [];
  pulseSeeds = [];
  liveParticleCount.value = 0;
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

  const range = Math.max(1e-6, right[0] - left[0]);
  const mix = clamp((t - left[0]) / range, 0, 1);
  const color = new THREE.Color();
  color.setRGB(
    (left[1][0] + ((right[1][0] - left[1][0]) * mix)) / 255,
    (left[1][1] + ((right[1][1] - left[1][1]) * mix)) / 255,
    (left[1][2] + ((right[1][2] - left[1][2]) * mix)) / 255,
  );
  return color;
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
    opacity: stylePreset.value === 'glow' ? 0.82 : 0.9,
    shininess: stylePreset.value === 'glow' ? 28 : 10,
    emissive: stylePreset.value === 'glow' ? new THREE.Color(0x09121e) : new THREE.Color(0x000000),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
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

  rawLineCount.value = totalLines;
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
    const lastId = Number(ids[ids.length - 1]);
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

  displayedLineCount.value = trajectories.length;
  return trajectories;
}

function createLineMesh(trajectory) {
  const positions = trajectory.points.flatMap((point) => [point.x, point.y, point.z]);
  const geometry = new MeshLineGeometry();
  geometry.setPoints(positions, (ratio) => {
    const bell = Math.sin(Math.PI * ratio);
    return stylePreset.value === 'glow'
      ? 0.35 + (0.9 * Math.pow(Math.max(0, bell), 0.8))
      : 0.55 + (0.35 * Math.pow(Math.max(0, bell), 1.2));
  });

  const baseColor = getJetColor(trajectory.meanSpeed);
  const tailColor = baseColor.clone().multiplyScalar(stylePreset.value === 'glow' ? 0.28 : 0.6);
  const material = new MeshLineMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: stylePreset.value !== 'glow',
    opacity: stylePreset.value === 'glow' ? 0.34 : 0.82,
    lineWidth: lineWidthPx.value,
    color: baseColor,
    gradient: [tailColor, baseColor],
    useGradient: 1,
    resolution: new THREE.Vector2(1, 1),
    sizeAttenuation: 0,
    dashArray: pulseMotion.value ? 1.1 : 0,
    dashRatio: pulseMotion.value ? 0.45 : 0.5,
    dashOffset: 0,
    blending: stylePreset.value === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  lineMaterials.push(material);
  pulseSeeds.push(Math.random() * 2 * Math.PI);
  return mesh;
}

function sampleTrajectory(trajectory, distance) {
  const wrapped = ((distance % trajectory.length) + trajectory.length) % trajectory.length;
  let walked = 0;
  for (let index = 0; index < trajectory.segmentLengths.length; index += 1) {
    const segmentLength = trajectory.segmentLengths[index];
    const next = walked + segmentLength;
    if (wrapped <= next || index === trajectory.segmentLengths.length - 1) {
      const start = trajectory.points[index];
      const end = trajectory.points[index + 1];
      const mix = segmentLength > 1e-6 ? (wrapped - walked) / segmentLength : 0;
      return {
        x: start.x + ((end.x - start.x) * mix),
        y: start.y + ((end.y - start.y) * mix),
        z: start.z + ((end.z - start.z) * mix),
      };
    }
    walked = next;
  }
  return trajectory.points[trajectory.points.length - 1];
}

function buildParticleSystem(trajectories) {
  liveParticleCount.value = 0;
  if (!showParticles.value || !trajectories.length) return null;

  const trajectoryStep = Math.max(1, Math.floor(trajectories.length / Math.min(24, trajectories.length)));
  const selectedTrajectories = trajectories.filter((_, index) => index % trajectoryStep === 0).slice(0, 24);
  if (!selectedTrajectories.length) return null;

  const particleCount = selectedTrajectories.length * PARTICLE_TRAIL_COUNT;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  if (!particleTexture) particleTexture = createParticleSpriteTexture();

  const material = new THREE.PointsMaterial({
    size: stylePreset.value === 'glow' ? 8 : 5,
    map: particleTexture,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    vertexColors: true,
    blending: stylePreset.value === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending,
    sizeAttenuation: true,
  });

  particleStates = selectedTrajectories.map((trajectory, index) => ({
    trajectory,
    distance: (trajectory.length * index) / selectedTrajectories.length,
    step: Math.max(trajectory.length * 0.006, 0.012),
    color: getJetColor(trajectory.maxSpeed),
    trailSpacing: Math.max(trajectory.length * 0.05, 0.028),
  }));

  liveParticleCount.value = particleStates.length;
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function updateParticles(deltaScale = 1) {
  if (!particleSystem || !particleStates.length) return;
  const positionAttr = particleSystem.geometry.getAttribute('position');
  const colorAttr = particleSystem.geometry.getAttribute('color');
  let cursor = 0;

  particleStates.forEach((state) => {
    for (let trailIndex = 0; trailIndex < PARTICLE_TRAIL_COUNT; trailIndex += 1) {
      const samplePoint = sampleTrajectory(
        state.trajectory,
        state.distance - (trailIndex * state.trailSpacing),
      );
      positionAttr.array[cursor * 3] = samplePoint.x;
      positionAttr.array[(cursor * 3) + 1] = samplePoint.y;
      positionAttr.array[(cursor * 3) + 2] = samplePoint.z;

      const brightness = 1 - (trailIndex / PARTICLE_TRAIL_COUNT);
      const tint = state.color.clone()
        .lerp(new THREE.Color(0xffffff), 0.36 * brightness)
        .multiplyScalar(0.35 + (0.85 * brightness));
      colorAttr.array[cursor * 3] = tint.r;
      colorAttr.array[(cursor * 3) + 1] = tint.g;
      colorAttr.array[(cursor * 3) + 2] = tint.b;
      cursor += 1;
    }

    state.distance += state.step * deltaScale;
  });

  positionAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
}

function syncRendererSize() {
  if (!threeRenderer || !threeCamera || !canvasHost.value) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  threeRenderer.setSize(width, height, false);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
  lineMaterials.forEach((material) => material.resolution.set(width, height));
}

function fitCameraToScene() {
  if (!sceneRoot || !threeCamera || !orbitControls) return;
  const box = new THREE.Box3().setFromObject(sceneRoot);
  if (!Number.isFinite(box.min.x)) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const distance = Math.max(sphere.radius * 2.8, 1.8);

  threeCamera.position.set(
    center.x + (distance * 0.92),
    center.y - (distance * 1.14),
    center.z + (distance * 0.74),
  );
  threeCamera.near = Math.max(sphere.radius / 300, 0.001);
  threeCamera.far = Math.max(sphere.radius * 30, 20);
  threeCamera.updateProjectionMatrix();
  orbitControls.minDistance = Math.max(sphere.radius * 0.35, 0.4);
  orbitControls.maxDistance = Math.max(sphere.radius * 18, 12);
  orbitControls.target.copy(center);
  orbitControls.update();
}

function rebuildVisuals(resetCamera = true) {
  if (!threeScene || !rawSurfaceData || !rawStreamlineData) return;
  if (threeRenderer) {
    threeRenderer.toneMappingExposure = stylePreset.value === 'glow' ? 1.06 : 0.95;
  }

  stopAnimation();
  clearSceneRoot();

  const root = new THREE.Group();
  const surfaceMeta = ensureSpeedMagnitude(rawSurfaceData);
  const streamlineMeta = ensureSpeedMagnitude(rawStreamlineData);
  speedRange.value = mergeRanges(surfaceMeta?.range, streamlineMeta?.range);

  const surfaceMesh = extractSurfaceMesh(rawSurfaceData);
  if (surfaceMesh) root.add(surfaceMesh);

  const trajectories = extractDisplayTrajectories(
    rawStreamlineData,
    displayLineBudget.value,
    displayLineBudget.value > 180 ? 14 : 10,
  );

  const lineGroup = new THREE.Group();
  trajectories.forEach((trajectory) => {
    lineGroup.add(createLineMesh(trajectory));
  });
  root.add(lineGroup);

  const particles = buildParticleSystem(trajectories);
  if (particles) {
    particleSystem = particles;
    root.add(particles);
    updateParticles(0);
  }

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

    if (pulseMotion.value) {
      lineMaterials.forEach((material, index) => {
        material.dashOffset = -((now * 0.00022) + (pulseSeeds[index] ?? 0));
      });
    }

    updateParticles(delta);
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
  if (!heights.length) throw new Error('当前工况没有可用于实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function loadScene() {
  if (!selectedHeight.value || !threeScene) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的真实 VTP 数据...`;
  errorMessage.value = '';

  try {
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    const streamlineUrl = `/uploads/${props.caseId}/run/VTK/processed/internal_${selectedHeight.value}m_web.vtp`;
    const [surfaceData, streamlineData] = await Promise.all([
      loadPolyData(surfaceUrl),
      loadPolyData(streamlineUrl),
    ]);
    rawSurfaceData = surfaceData;
    rawStreamlineData = streamlineData;
    rebuildVisuals(true);
  } catch (error) {
    console.error('MeshLine 实验页加载失败:', error);
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initThreeScene() {
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x07111b);

  const width = Math.max(1, canvasHost.value?.clientWidth ?? 1);
  const height = Math.max(1, canvasHost.value?.clientHeight ?? 1);

  threeCamera = new THREE.PerspectiveCamera(42, width / height, 1, 20000);
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = stylePreset.value === 'glow' ? 1.06 : 0.95;
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  threeRenderer.setSize(width, height, false);
  canvasHost.value.appendChild(threeRenderer.domElement);

  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.rotateSpeed = 0.78;
  orbitControls.panSpeed = 0.68;

  const hemiLight = new THREE.HemisphereLight(0xc4ecff, 0x14293c, 1.1);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(1200, -800, 1400);
  const rimLight = new THREE.DirectionalLight(0x89d2ff, 0.48);
  rimLight.position.set(-1000, 600, 900);
  const fillLight = new THREE.DirectionalLight(0xfff0c7, 0.32);
  fillLight.position.set(400, 900, 550);

  threeScene.add(hemiLight, keyLight, rimLight, fillLight);
}

onMounted(async () => {
  await nextTick();
  if (!canvasHost.value) return;
  initThreeScene();
  resizeObserver = new ResizeObserver(() => syncRendererSize());
  resizeObserver.observe(canvasHost.value);

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化开源实验页失败';
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
  threeRenderer?.dispose();
  if (threeRenderer?.domElement?.parentNode) {
    threeRenderer.domElement.parentNode.removeChild(threeRenderer.domElement);
  }
  particleTexture?.dispose?.();
  particleTexture = null;
});
</script>

<style scoped>
.meshline-viewer {
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
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.16), transparent 26%),
    linear-gradient(180deg, #07111b 0%, #0b1624 58%, #0d1b2c 100%);
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
