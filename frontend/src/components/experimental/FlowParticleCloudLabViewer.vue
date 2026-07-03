<template>
  <div class="particle-cloud-viewer">
    <div class="viewer-shell">
      <div ref="canvasHost" class="canvas-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">风场舞台加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene(true, false)">重试</el-button>
      </div>

      <div class="stage-header">
        <div class="stage-copy">
          <h3>风场舞台</h3>
        </div>
        <div class="stage-actions">
          <el-button type="primary" plain :loading="loading" @click="loadScene(false, false)">重载</el-button>
          <el-button plain :loading="rebuilding" @click="rebuildCache">重新采样</el-button>
        </div>
      </div>

      <div class="mode-dock">
        <button
          v-for="mode in viewModes"
          :key="mode.name"
          type="button"
          class="mode-pill"
          :class="{ 'mode-pill--active': viewMode === mode.name }"
          @click="setViewMode(mode.name)"
        >
          <span>{{ mode.title }}</span>
        </button>
      </div>

      <div class="hud hud--left">
        <div class="chip-grid">
          <div class="chip">
            <span>数据源</span>
            <strong>{{ sourceLabel }}</strong>
          </div>
          <div class="chip">
            <span>粒子数</span>
            <strong>{{ particleCountLabel }}</strong>
          </div>
          <div class="chip">
            <span>模式</span>
            <strong>{{ styleLabel }}</strong>
          </div>
          <div class="chip">
            <span>配色</span>
            <strong>{{ legendLabel }}</strong>
          </div>
        </div>
      </div>

      <div class="hud hud--right">
        <div class="control-group">
          <span class="eyebrow">采样与配色</span>
          <label class="field">
            <span>粒子密度</span>
            <el-select v-model="particleCountPreset" class="select">
              <el-option label="12 k" value="12000" />
              <el-option label="24 k" value="24000" />
              <el-option label="40 k" value="40000" />
            </el-select>
          </label>
          <label class="field">
            <span>配色</span>
            <el-select v-model="colormapPreset" class="select" @change="handleOptionChange">
              <el-option label="Black Body" value="blackBody" />
              <el-option label="JET" value="jet" />
              <el-option label="Viridis" value="viridis" />
            </el-select>
          </label>
        </div>

        <div class="control-group">
          <span class="eyebrow">动态参数</span>
          <label class="field">
            <span>粒子尺寸</span>
            <el-slider v-model="pointSize" :min="6" :max="24" :step="0.5" show-input input-size="small" @change="handleOptionChange" />
          </label>
          <label class="field">
            <span>摆动幅度</span>
            <el-slider v-model="motionAmplitude" :min="6" :max="90" :step="2" show-input input-size="small" @change="handleOptionChange" />
          </label>
          <label class="field">
            <span>摆动速度</span>
            <el-slider v-model="motionSpeed" :min="0.2" :max="2.2" :step="0.05" show-input input-size="small" @change="handleOptionChange" />
          </label>
          <label class="field">
            <span>辉光</span>
            <el-slider v-model="glowStrength" :min="0.55" :max="2.2" :step="0.05" show-input input-size="small" @change="handleOptionChange" />
          </label>
        </div>

        <div class="control-group">
          <span class="eyebrow">场景控制</span>
          <label class="field">
            <span>垂向放大</span>
            <el-slider v-model="verticalExaggeration" :min="1" :max="4.5" :step="0.1" show-input input-size="small" @change="handleOptionChange" />
          </label>
          <label class="toggle">
            <span>地形轮廓</span>
            <el-switch v-model="showTerrain" @change="handleOptionChange" />
          </label>
          <label class="toggle">
            <span>自动旋转</span>
            <el-switch v-model="autoRotate" @change="handleAutoRotateChange" />
          </label>
        </div>
      </div>

      <div class="legend">
        <div class="legend-top">
          <span>{{ legendLabel }}</span>
          <span>速度大小 (m/s)</span>
        </div>
        <div class="legend-bar" :style="legendBarStyle"></div>
        <div class="legend-ticks">
          <span v-for="tick in legendTicks" :key="tick">{{ tick }}</span>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><span>速度范围</span><strong>{{ speedRangeLabel }}</strong></div>
      <div class="stat"><span>采样策略</span><strong>{{ sampleBiasLabel }}</strong></div>
      <div class="stat"><span>粒子缓存</span><strong>{{ cloudSizeLabel }}</strong></div>
      <div class="stat"><span>缓存构建</span><strong>{{ buildSecondsLabel }}</strong></div>
      <div class="stat"><span>上次请求</span><strong>{{ latencyLabel }}</strong></div>
      <div class="stat"><span>规则体尺寸</span><strong>{{ cacheGridLabel }}</strong></div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { buildColorLookupTable, buildCssGradient, SIMULATION_COLORMAP_PRESETS } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const GLYPH_TARGET_COUNT = 6800;
const viewModes = [
  { name: 'nebula', title: '风场星云' },
  { name: 'glyphs', title: '风矢雕塑' },
  { name: 'hybrid', title: '混合态' },
];

const canvasHost = ref(null);
const particleMeta = ref(null);
const loading = ref(false);
const rebuilding = ref(false);
const loadingText = ref('正在构建风场粒子缓存...');
const errorMessage = ref('');
const particleCountPreset = ref('24000');
const colormapPreset = ref('blackBody');
const viewMode = ref('hybrid');
const pointSize = ref(12);
const motionAmplitude = ref(28);
const motionSpeed = ref(0.85);
const glowStrength = ref(1.35);
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
let terrainData = null;
let particleRecords = null;
let colormapTexture = null;
let pointsMaterial = null;
let suppressParticlePresetWatch = false;

const colormapLabelMap = { blackBody: 'Black Body', jet: 'JET', viridis: 'Viridis' };
const activeStops = computed(() => SIMULATION_COLORMAP_PRESETS[colormapPreset.value] || SIMULATION_COLORMAP_PRESETS.blackBody);
const activeViewModeMeta = computed(() => viewModes.find((mode) => mode.name === viewMode.value) || viewModes[0]);
const legendBarStyle = computed(() => ({ background: buildCssGradient(activeStops.value, '90deg') }));
const legendLabel = computed(() => colormapLabelMap[colormapPreset.value] || 'Black Body');
const sourceLabel = computed(() => {
  const sourceKind = particleMeta.value?.sourceKind;
  if (sourceKind === 'foam') return '.foam / OpenFOAMReader';
  if (sourceKind === 'internal_vtu') return 'internal.vtu';
  return '-';
});
const cacheGridLabel = computed(() => {
  const dims = particleMeta.value?.cacheDims;
  return Array.isArray(dims) && dims.length === 3 ? `${dims[0]} x ${dims[1]} x ${dims[2]}` : '-';
});
const particleCountLabel = computed(() => {
  const count = Number(particleMeta.value?.particleCount ?? 0);
  return count > 0 ? `${count.toLocaleString('en-US')} pts` : '-';
});
const styleLabel = computed(() => `${legendLabel.value} / ${activeViewModeMeta.value.title}`);
const speedRangeLabel = computed(() => {
  const range = particleMeta.value?.speedRange;
  if (!Array.isArray(range) || range.length !== 2) return '-';
  return `${Number(range[0]).toFixed(2)} ~ ${Number(range[1]).toFixed(2)} m/s`;
});
const sampleBiasLabel = computed(() => String(particleMeta.value?.sampleBias || '') === 'weighted_by_speed' ? '按风速加权抽样' : '-');
const cloudSizeLabel = computed(() => {
  const byteLength = Number(particleMeta.value?.particleCloudByteLength ?? 0);
  return Number.isFinite(byteLength) && byteLength > 0 ? `${(byteLength / (1024 * 1024)).toFixed(2)} MB` : '-';
});
const buildSecondsLabel = computed(() => {
  const seconds = Number(particleMeta.value?.buildSeconds ?? 0);
  return seconds > 0 ? `${seconds.toFixed(2)} s` : '-';
});
const latencyLabel = computed(() => requestLatencyMs.value > 0 ? `${requestLatencyMs.value.toFixed(0)} ms` : '-');
const legendTicks = computed(() => {
  const range = particleMeta.value?.speedRange;
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return Array.from({ length: 5 }, (_, index) => (min + ((max - min) * index) / 4).toFixed(2));
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  disposeTexture(colormapTexture);
  colormapTexture = null;
  pointsMaterial = null;
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
        positions.push(Number(points[offset] ?? 0), Number(points[offset + 1] ?? 0), Number(points[offset + 2] ?? 0));
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
      color: 0xdbeafe,
      wireframe: true,
      transparent: true,
      opacity: viewMode.value === 'glyphs' ? 0.22 : 0.16,
      depthWrite: false,
    }),
  );
  const scaleValue = Number(meta?.scale ?? 1);
  const modelToMeters = scaleValue > 0 ? (1 / scaleValue) : 1;
  terrain.scale.set(modelToMeters, modelToMeters, modelToMeters);
  return terrain;
}

function buildColormapTexture() {
  const rgba = buildColorLookupTable(activeStops.value, 256);
  const texture = new THREE.DataTexture(new Uint8Array(rgba), 256, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function sampleColorFromStops(stops, rawT) {
  const t = clamp(rawT, 0, 1);
  if (!Array.isArray(stops) || !stops.length) return new THREE.Color(1, 1, 1);
  let left = stops[0];
  let right = stops[stops.length - 1];
  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index][0]) {
      left = stops[index - 1];
      right = stops[index];
      break;
    }
  }
  const span = Math.max(1e-6, right[0] - left[0]);
  const mix = clamp((t - left[0]) / span, 0, 1);
  const rgb = [
    left[1][0] + ((right[1][0] - left[1][0]) * mix),
    left[1][1] + ((right[1][1] - left[1][1]) * mix),
    left[1][2] + ((right[1][2] - left[1][2]) * mix),
  ];
  return new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
}

function createParticleMaterial(meta) {
  disposeTexture(colormapTexture);
  colormapTexture = buildColormapTexture();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 },
      u_colormap: { value: colormapTexture },
      u_speedMin: { value: Number(meta?.speedRange?.[0] ?? 0) },
      u_speedMax: { value: Number(meta?.speedRange?.[1] ?? 1) },
      u_pointSize: { value: Number(pointSize.value) },
      u_motionAmplitude: { value: Number(motionAmplitude.value) },
      u_motionSpeed: { value: Number(motionSpeed.value) },
      u_glowStrength: { value: Number(glowStrength.value) },
      u_opacityScale: { value: viewMode.value === 'hybrid' ? 0.86 : 1.0 },
    },
    vertexShader: `
      precision highp float;
      attribute vec3 direction;
      attribute float speed;
      attribute float phase;
      uniform float u_time;
      uniform float u_speedMin;
      uniform float u_speedMax;
      uniform float u_pointSize;
      uniform float u_motionAmplitude;
      uniform float u_motionSpeed;
      varying float v_speedUnit;
      varying float v_phaseGlow;
      void main() {
        float speedUnit = clamp((speed - u_speedMin) / max(1e-6, u_speedMax - u_speedMin), 0.0, 1.0);
        float phaseAngle = (u_time * (0.45 + speedUnit * u_motionSpeed)) + phase * 6.28318530718;
        float wave = sin(phaseAngle);
        vec3 displaced = position + direction * wave * (u_motionAmplitude * (0.28 + speedUnit * 0.72));
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        float depth = max(1.0, -mvPosition.z);
        float depthScale = clamp(1800.0 / depth, 0.3, 3.5);
        gl_PointSize = clamp(u_pointSize * (0.6 + speedUnit * 1.25) * depthScale, 2.0, 42.0);
        gl_Position = projectionMatrix * mvPosition;
        v_speedUnit = speedUnit;
        v_phaseGlow = 0.58 + 0.42 * sin(phaseAngle * 0.62 + phase * 5.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D u_colormap;
      uniform float u_glowStrength;
      uniform float u_opacityScale;
      varying float v_speedUnit;
      varying float v_phaseGlow;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float radius2 = dot(uv, uv);
        if (radius2 > 1.0) discard;
        float radius = sqrt(radius2);
        float halo = exp(-radius2 * (2.4 + u_glowStrength * 1.15));
        float core = smoothstep(0.36, 0.0, radius);
        vec3 color = texture2D(u_colormap, vec2(v_speedUnit, 0.5)).rgb;
        float alpha = clamp((halo * 0.42 + core * 0.68) * v_phaseGlow * u_opacityScale, 0.0, 1.0);
        vec3 shaded = color * (0.7 + core * 0.9 + halo * 0.25);
        gl_FragColor = vec4(shaded, alpha);
      }
    `,
  });
}

function createParticleCloud(records, meta) {
  const stride = Number(meta?.particleStrideFloats ?? 8);
  const count = stride > 0 ? Math.floor(records.length / stride) : 0;
  if (!count) return null;
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * stride;
    positions[index * 3] = records[offset];
    positions[(index * 3) + 1] = records[offset + 1];
    positions[(index * 3) + 2] = records[offset + 2];
    directions[index * 3] = records[offset + 3];
    directions[(index * 3) + 1] = records[offset + 4];
    directions[(index * 3) + 2] = records[offset + 5];
    speeds[index] = records[offset + 6];
    phases[index] = records[offset + 7];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('direction', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  pointsMaterial = createParticleMaterial(meta);
  const cloud = new THREE.Points(geometry, pointsMaterial);
  cloud.frustumCulled = false;
  return cloud;
}

function createGlyphField(records, meta) {
  const stride = Number(meta?.particleStrideFloats ?? 8);
  const totalCount = stride > 0 ? Math.floor(records.length / stride) : 0;
  if (!totalCount) return null;
  const desiredCount = Math.min(GLYPH_TARGET_COUNT, totalCount);
  const step = Math.max(1, Math.floor(totalCount / desiredCount));
  const minSpeed = Number(meta?.speedRange?.[0] ?? 0);
  const maxSpeedRaw = Number(meta?.speedRange?.[1] ?? 1);
  const maxSpeed = Math.abs(maxSpeedRaw - minSpeed) < 1e-6 ? minSpeed + 1 : maxSpeedRaw;
  const geometry = new THREE.CylinderGeometry(0.18, 0.95, 1, 6, 1, false);
  const material = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: viewMode.value === 'hybrid' ? 0.58 : 0.82,
    shininess: 80,
    vertexColors: true,
    emissive: new THREE.Color(0x14283a),
    emissiveIntensity: viewMode.value === 'glyphs' ? 1.2 : 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, desiredCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const axis = new THREE.Vector3(0, 1, 0);
  let instanceIndex = 0;
  for (let index = 0; index < totalCount && instanceIndex < desiredCount; index += step) {
    const offset = index * stride;
    position.set(records[offset], records[offset + 1], records[offset + 2]);
    direction.set(records[offset + 3], records[offset + 4], records[offset + 5]);
    if (direction.lengthSq() < 1e-8) continue;
    direction.normalize();
    const speed = Number(records[offset + 6] ?? 0);
    const speedUnit = clamp((speed - minSpeed) / (maxSpeed - minSpeed), 0, 1);
    quaternion.setFromUnitVectors(axis, direction);
    scale.set(2.2 + (speedUnit * 4.8), 34 + (speedUnit * 92), 2.2 + (speedUnit * 4.8));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(instanceIndex, matrix);
    mesh.setColorAt(instanceIndex, sampleColorFromStops(activeStops.value, speedUnit));
    instanceIndex += 1;
  }
  mesh.count = instanceIndex;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

function createBoundsFrame(meta) {
  const bounds = meta?.bounds_m;
  if (!Array.isArray(bounds) || bounds.length !== 6) return null;
  const sizeX = Math.max(1, Number(bounds[1]) - Number(bounds[0]));
  const sizeY = Math.max(1, Number(bounds[3]) - Number(bounds[2]));
  const sizeZ = Math.max(1, Number(bounds[5]) - Number(bounds[4]));
  const centerX = 0.5 * (Number(bounds[0]) + Number(bounds[1]));
  const centerY = 0.5 * (Number(bounds[2]) + Number(bounds[3]));
  const centerZ = 0.5 * (Number(bounds[4]) + Number(bounds[5]));
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, sizeY, sizeZ));
  const material = new THREE.LineBasicMaterial({
    color: viewMode.value === 'glyphs' ? 0x7dd3fc : 0x60a5fa,
    transparent: true,
    opacity: 0.18,
  });
  const frame = new THREE.LineSegments(geometry, material);
  frame.position.set(centerX, centerY, centerZ);
  return frame;
}

function createStageGrid(meta) {
  const bounds = meta?.bounds_m;
  if (!Array.isArray(bounds) || bounds.length !== 6) return null;
  const sizeX = Math.max(1, Number(bounds[1]) - Number(bounds[0]));
  const sizeY = Math.max(1, Number(bounds[3]) - Number(bounds[2]));
  const centerX = 0.5 * (Number(bounds[0]) + Number(bounds[1]));
  const centerY = 0.5 * (Number(bounds[2]) + Number(bounds[3]));
  const baseZ = Number(bounds[4]);
  const span = Math.max(sizeX, sizeY);
  const grid = new THREE.GridHelper(span, span > 3500 ? 24 : 18, 0x375d7c, 0x173146);
  grid.rotation.x = Math.PI / 2;
  grid.position.set(centerX, centerY, baseZ + 2);
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  materials.forEach((material, index) => {
    material.transparent = true;
    material.opacity = index === 0 ? 0.18 : 0.08;
    material.depthWrite = false;
  });
  return grid;
}

function syncMaterialUniforms() {
  if (!pointsMaterial || !particleMeta.value) return;
  pointsMaterial.uniforms.u_colormap.value = colormapTexture;
  pointsMaterial.uniforms.u_speedMin.value = Number(particleMeta.value?.speedRange?.[0] ?? 0);
  pointsMaterial.uniforms.u_speedMax.value = Number(particleMeta.value?.speedRange?.[1] ?? 1);
  pointsMaterial.uniforms.u_pointSize.value = Number(pointSize.value);
  pointsMaterial.uniforms.u_motionAmplitude.value = Number(motionAmplitude.value);
  pointsMaterial.uniforms.u_motionSpeed.value = Number(motionSpeed.value);
  pointsMaterial.uniforms.u_glowStrength.value = Number(glowStrength.value);
  pointsMaterial.uniforms.u_opacityScale.value = viewMode.value === 'hybrid' ? 0.86 : 1.0;
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
  const distance = maxSize * 1.42;
  orbitControls.target.copy(center);
  threeCamera.position.set(center.x + distance, center.y - (distance * 0.94), center.z + (distance * 0.72));
  threeCamera.near = Math.max(0.01, distance / 220);
  threeCamera.far = Math.max(200, distance * 24);
  threeCamera.updateProjectionMatrix();
  orbitControls.update();
}

function renderFrame() {
  orbitControls?.update();
  threeRenderer?.render?.(threeScene, threeCamera);
}

function animate(now = performance.now()) {
  const dt = Math.min(0.08, Math.max(0.001, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if (pointsMaterial?.uniforms?.u_time) pointsMaterial.uniforms.u_time.value += dt;
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
  if (!threeScene || !particleMeta.value || !particleRecords) return;
  clearSceneRoot();
  const root = new THREE.Group();
  const showParticles = viewMode.value === 'nebula' || viewMode.value === 'hybrid';
  const showGlyphs = viewMode.value === 'glyphs' || viewMode.value === 'hybrid';
  if (showParticles) {
    const cloud = createParticleCloud(particleRecords, particleMeta.value);
    if (cloud) root.add(cloud);
  }
  if (showGlyphs) {
    const glyphField = createGlyphField(particleRecords, particleMeta.value);
    if (glyphField) root.add(glyphField);
  }
  const boundsFrame = createBoundsFrame(particleMeta.value);
  if (boundsFrame) root.add(boundsFrame);
  const stageGrid = createStageGrid(particleMeta.value);
  if (stageGrid) root.add(stageGrid);
  if (showTerrain.value && terrainData) {
    const terrain = createTerrainWireframe(terrainData, particleMeta.value);
    if (terrain) root.add(terrain);
  }
  root.scale.set(1, 1, verticalExaggeration.value);
  sceneRoot = root;
  threeScene.add(root);
  syncMaterialUniforms();
  if (resetCamera) fitCameraToScene(root);
  renderFrame();
}

function handleOptionChange() {
  rebuildScene(false);
}

function handleAutoRotateChange() {
  if (!orbitControls) return;
  orbitControls.autoRotate = autoRotate.value;
  orbitControls.autoRotateSpeed = 0.42;
  renderFrame();
}

function setViewMode(modeName) {
  viewMode.value = modeName;
  rebuildScene(false);
}

async function initThreeScene() {
  if (!canvasHost.value || threeRenderer) return;
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true });
  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  threeRenderer.setClearColor(0x040912, 1);
  canvasHost.value.appendChild(threeRenderer.domElement);
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x040912);
  threeScene.fog = new THREE.FogExp2(0x040912, 0.00018);
  threeCamera = new THREE.PerspectiveCamera(40, 1, 0.01, 12000);
  threeCamera.position.set(2400, -3200, 1700);
  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.autoRotate = autoRotate.value;
  orbitControls.autoRotateSpeed = 0.42;
  orbitControls.maxDistance = 12000;
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.46));
  const keyLight = new THREE.DirectionalLight(0xaedbff, 0.94);
  keyLight.position.set(1200, -900, 1500);
  threeScene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffb774, 0.28);
  fillLight.position.set(-800, 650, 500);
  threeScene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.24);
  rimLight.position.set(0, 1500, 900);
  threeScene.add(rimLight);
  syncRendererSize();
  startAnimation();
}

async function fetchParticleMetadata(forceRebuild = false) {
  const response = await axios.get(`/api/cases/${props.caseId}/experimental-cfd-particles`, {
    params: {
      targetCells: 1500000,
      particleCount: Number(particleCountPreset.value),
      forceRebuild: forceRebuild ? 'true' : undefined,
    },
  });
  particleMeta.value = response.data?.particles || null;
}

async function fetchParticleCloud(meta) {
  const url = meta?.particleCloudUrl;
  if (!url) throw new Error('服务端缓存缺少 particleCloudUrl。');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`读取粒子缓存失败: ${url}`);
  const buffer = await response.arrayBuffer();
  return new Float32Array(buffer);
}

async function loadScene(resetCamera = true, forceRebuild = false) {
  if (!props.caseId) return;
  loading.value = true;
  errorMessage.value = '';
  loadingText.value = particleMeta.value && !forceRebuild ? '正在加载风场舞台...' : '正在构建风场粒子缓存...';
  try {
    const startedAt = performance.now();
    await fetchParticleMetadata(forceRebuild);
    const [terrain, records] = await Promise.all([
      loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/bot.vtp`).catch(() => null),
      fetchParticleCloud(particleMeta.value),
    ]);
    requestLatencyMs.value = performance.now() - startedAt;
    terrainData = terrain;
    particleRecords = records;
    await nextTick();
    rebuildScene(resetCamera);
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error.message || '风场舞台加载失败';
  } finally {
    loading.value = false;
  }
}

async function rebuildCache() {
  rebuilding.value = true;
  try {
    await loadScene(true, true);
    if (!errorMessage.value) ElMessage.success('风场粒子缓存已重建。');
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '重建缓存失败');
  } finally {
    rebuilding.value = false;
  }
}

function resetStageControls() {
  suppressParticlePresetWatch = true;
  particleCountPreset.value = '24000';
  colormapPreset.value = 'blackBody';
  viewMode.value = 'hybrid';
  pointSize.value = 12;
  motionAmplitude.value = 28;
  motionSpeed.value = 0.85;
  glowStrength.value = 1.35;
  verticalExaggeration.value = 1.8;
  showTerrain.value = true;
  autoRotate.value = true;
  nextTick(() => {
    suppressParticlePresetWatch = false;
  });
}

watch(particleCountPreset, async () => {
  if (suppressParticlePresetWatch) return;
  particleMeta.value = null;
  particleRecords = null;
  await loadScene(true, false);
});

watch(() => props.caseId, async () => {
  resetStageControls();
  particleMeta.value = null;
  terrainData = null;
  particleRecords = null;
  requestLatencyMs.value = 0;
  await loadScene(true, false);
});

onMounted(async () => {
  resetStageControls();
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
  particleRecords = null;
});
</script>

<style scoped>
.particle-cloud-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.viewer-shell {
  position: relative;
  min-height: 760px;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(125, 211, 252, 0.12);
  background:
    radial-gradient(circle at 18% 12%, rgba(249, 115, 22, 0.16), transparent 18%),
    radial-gradient(circle at 82% 18%, rgba(125, 211, 252, 0.16), transparent 20%),
    linear-gradient(180deg, #030912 0%, #07111d 58%, #091622 100%);
}

.canvas-host,
.overlay {
  position: absolute;
  inset: 0;
}

.overlay {
  z-index: 12;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  background: rgba(4, 10, 18, 0.84);
  text-align: center;
  padding: 24px;
}

.overlay--error {
  background: rgba(28, 10, 10, 0.88);
}

.overlay-title {
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
}

.overlay-text {
  max-width: 640px;
  color: rgba(226, 232, 240, 0.9);
  line-height: 1.7;
}

.spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.22);
  border-top-color: rgba(255, 255, 255, 0.92);
  animation: spin 0.9s linear infinite;
}

.stage-header,
.mode-dock,
.hud,
.legend {
  position: absolute;
  z-index: 4;
}

.stage-header {
  top: 18px;
  left: 18px;
  right: 18px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  pointer-events: none;
}

.stage-copy,
.stage-actions,
.mode-dock,
.hud,
.legend {
  pointer-events: auto;
}

.stage-copy,
.hud,
.legend,
.mode-pill {
  border: 1px solid rgba(125, 211, 252, 0.14);
  background: rgba(5, 12, 22, 0.74);
  backdrop-filter: blur(14px);
}

.stage-copy {
  max-width: 420px;
  padding: 16px 18px;
  border-radius: 18px;
}

.eyebrow,
.chip span,
.stat span {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(125, 211, 252, 0.82);
}

.stage-copy h3 {
  margin: 0;
  font-size: 28px;
  color: #f8fbff;
}

.stage-actions {
  display: flex;
  gap: 10px;
}

.mode-dock {
  top: 136px;
  left: 18px;
  width: min(360px, calc(100% - 36px));
  display: flex;
  gap: 10px;
  background: transparent;
  border: 0;
  backdrop-filter: none;
}

.mode-pill {
  flex: 1;
  padding: 14px 14px 12px;
  border-radius: 18px;
  color: rgba(226, 232, 240, 0.9);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.mode-pill:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.3);
}

.mode-pill span {
  display: block;
  font-size: 15px;
  font-weight: 700;
}

.mode-pill--active {
  background: rgba(12, 26, 40, 0.9);
  box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.1);
}

.hud {
  border-radius: 20px;
}

.hud--left {
  top: 236px;
  left: 18px;
  right: 18px;
  max-width: 640px;
  padding: 14px;
}

.hud--right {
  top: 88px;
  right: 18px;
  width: min(360px, calc(100% - 36px));
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chip,
.stat {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(8, 18, 30, 0.74);
  border: 1px solid rgba(125, 211, 252, 0.1);
}

.chip strong,
.stat strong {
  display: block;
  margin-top: 8px;
  color: #eff6ff;
  line-height: 1.55;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field,
.toggle {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: rgba(226, 232, 240, 0.92);
  font-size: 13px;
}

.toggle {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.select {
  width: 100%;
}

.legend {
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: min(560px, calc(100% - 48px));
  padding: 14px 16px;
  border-radius: 18px;
}

.legend-top,
.legend-ticks {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(226, 232, 240, 0.88);
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
  background: rgba(8, 19, 30, 0.92);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .viewer-shell {
    min-height: 840px;
  }

  .hud--left {
    max-width: 520px;
  }

  .hud--right {
    top: auto;
    bottom: 118px;
  }
}

@media (max-width: 960px) {
  .viewer-shell {
    min-height: 980px;
  }

  .stage-header {
    flex-direction: column;
  }

  .mode-dock {
    top: 186px;
    flex-direction: column;
    width: calc(100% - 36px);
  }

  .hud--left {
    top: 390px;
    max-width: none;
  }

  .hud--right {
    width: calc(100% - 36px);
  }

  .chip-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .viewer-shell {
    min-height: 1120px;
  }

  .stage-header,
  .mode-dock,
  .hud--left,
  .hud--right,
  .legend {
    left: 12px;
    right: 12px;
    width: auto;
    transform: none;
  }

  .legend {
    bottom: 12px;
  }

  .stage-header {
    top: 12px;
  }

  .mode-dock {
    top: 198px;
  }

  .hud--left {
    top: 402px;
  }

  .hud--right {
    bottom: 104px;
  }
}
</style>
