<template>
  <div class="server-slice-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">切面模式</span>
        <el-select v-model="mode" class="select">
          <el-option label="水平 XY" value="xy" />
          <el-option label="竖向 XZ" value="xz" />
          <el-option label="竖向 YZ" value="yz" />
          <el-option label="斜切面" value="oblique" />
        </el-select>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">沿法向偏移 (m)</span>
        <el-slider
          v-model="offsetM"
          :min="offsetRange.min"
          :max="offsetRange.max"
          :step="offsetStep"
          show-input
          input-size="small"
        />
      </div>

      <div v-if="mode === 'oblique'" class="toolbar-item">
        <span class="label">方位角 (deg)</span>
        <el-slider
          v-model="azimuthDeg"
          :min="-180"
          :max="180"
          :step="1"
          show-input
          input-size="small"
        />
      </div>

      <div v-if="mode === 'oblique'" class="toolbar-item">
        <span class="label">倾角 (deg)</span>
        <el-slider
          v-model="tiltDeg"
          :min="0"
          :max="90"
          :step="1"
          show-input
          input-size="small"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">采样分辨率</span>
        <el-select v-model="resolutionPreset" class="select">
          <el-option label="160 x 120" value="low" />
          <el-option label="220 x 160" value="medium" />
          <el-option label="300 x 220" value="high" />
        </el-select>
      </div>

      <div class="toolbar-item">
        <span class="label">色标口径</span>
        <el-radio-group v-model="rangeMode" size="small">
          <el-radio-button value="global">全局</el-radio-button>
          <el-radio-button value="slice">当前切面</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item">
        <span class="label">矢量箭头</span>
        <el-switch v-model="showVectors" />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">箭头疏密</span>
        <el-slider
          v-model="vectorStride"
          :min="6"
          :max="26"
          :step="2"
          show-input
          input-size="small"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">缓存密度</span>
        <el-select v-model="targetCellsPreset" class="select">
          <el-option label="0.8 M" value="800000" />
          <el-option label="1.5 M" value="1500000" />
          <el-option label="2.2 M" value="2200000" />
        </el-select>
      </div>

      <div class="toolbar-item">
        <span class="label">重载</span>
        <el-button type="primary" plain :loading="loading" @click="loadSlice">切面刷新</el-button>
      </div>

      <div class="toolbar-item">
        <span class="label">重建缓存</span>
        <el-button plain :loading="rebuilding" @click="rebuildCache">重新采样</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="canvasHost" class="canvas-host">
        <canvas ref="sliceCanvas" class="slice-canvas"></canvas>
      </div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">服务端切面实验加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadSlice">重试</el-button>
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
          <span>切面法向</span>
          <strong>{{ normalLabel }}</strong>
        </div>
        <div class="chip">
          <span>分辨率</span>
          <strong>{{ sliceResolutionLabel }}</strong>
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
        <span>切面覆盖</span>
        <strong>{{ coverageLabel }}</strong>
      </div>
      <div class="stat">
        <span>切面速度范围</span>
        <strong>{{ sliceSpeedLabel }}</strong>
      </div>
      <div class="stat">
        <span>缓存速度范围</span>
        <strong>{{ globalSpeedLabel }}</strong>
      </div>
      <div class="stat">
        <span>偏移范围</span>
        <strong>{{ offsetRangeLabel }}</strong>
      </div>
      <div class="stat">
        <span>上次请求</span>
        <strong>{{ latencyLabel }}</strong>
      </div>
      <div class="stat">
        <span>缓存构建</span>
        <strong>{{ buildSecondsLabel }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

import { SIMULATION_JET_STOPS, buildColorLookupTable, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const RESOLUTION_PRESETS = {
  low: [160, 120],
  medium: [220, 160],
  high: [300, 220],
};

const colorLookup = buildColorLookupTable(SIMULATION_JET_STOPS, 256);

const canvasHost = ref(null);
const sliceCanvas = ref(null);
const metadata = ref(null);
const sliceData = ref(null);
const loading = ref(false);
const rebuilding = ref(false);
const loadingText = ref('正在构建服务端切面...');
const errorMessage = ref('');
const mode = ref('xy');
const offsetM = ref(0);
const azimuthDeg = ref(35);
const tiltDeg = ref(55);
const resolutionPreset = ref('medium');
const targetCellsPreset = ref('1500000');
const rangeMode = ref('global');
const showVectors = ref(true);
const vectorStride = ref(12);
const requestLatencyMs = ref(0);

let resizeObserver = null;
let loadTimer = null;
let requestSequence = 0;
let currentDrawRect = { x: 0, y: 0, width: 0, height: 0 };

const legendBarStyle = computed(() => ({
  background: buildCssGradient(SIMULATION_JET_STOPS, '90deg'),
}));

const resolution = computed(() => RESOLUTION_PRESETS[resolutionPreset.value] || RESOLUTION_PRESETS.medium);

const sourceLabel = computed(() => {
  const sourceKind = sliceData.value?.sourceKind || metadata.value?.sourceKind;
  if (sourceKind === 'foam') return '.foam / OpenFOAMReader';
  if (sourceKind === 'internal_vtu') return 'internal.vtu';
  return '-';
});

const cacheGridLabel = computed(() => {
  const dims = metadata.value?.dims || sliceData.value?.cacheDims;
  return Array.isArray(dims) && dims.length === 3 ? `${dims[0]} x ${dims[1]} x ${dims[2]}` : '-';
});

const normalLabel = computed(() => {
  const normal = sliceData.value?.plane?.normal;
  if (!Array.isArray(normal) || normal.length !== 3) return '-';
  return normal.map((value) => Number(value).toFixed(2)).join(', ');
});

const sliceResolutionLabel = computed(() => `${resolution.value[0]} x ${resolution.value[1]}`);

const coverageLabel = computed(() => {
  const coverage = Number(sliceData.value?.stats?.coverage ?? 0);
  return `${(coverage * 100).toFixed(1)}%`;
});

const sliceSpeedLabel = computed(() => {
  const min = Number(sliceData.value?.stats?.speedMin ?? 0);
  const max = Number(sliceData.value?.stats?.speedMax ?? 0);
  return `${min.toFixed(2)} ~ ${max.toFixed(2)} m/s`;
});

const globalSpeedLabel = computed(() => {
  const range = metadata.value?.speedRange;
  if (!Array.isArray(range) || range.length !== 2) return '-';
  return `${Number(range[0]).toFixed(2)} ~ ${Number(range[1]).toFixed(2)} m/s`;
});

const offsetRange = computed(() => {
  const bounds = metadata.value?.bounds_m;
  if (!Array.isArray(bounds) || bounds.length !== 6) {
    return { min: -100, max: 100 };
  }

  const center = [
    0.5 * (bounds[0] + bounds[1]),
    0.5 * (bounds[2] + bounds[3]),
    0.5 * (bounds[4] + bounds[5]),
  ];
  const normal = getCurrentNormal();
  const corners = getBoundingCorners(bounds);
  const offsets = corners.map((corner) => (
    (corner[0] - center[0]) * normal[0]
    + (corner[1] - center[1]) * normal[1]
    + (corner[2] - center[2]) * normal[2]
  ));
  return {
    min: Number(Math.min(...offsets).toFixed(1)),
    max: Number(Math.max(...offsets).toFixed(1)),
  };
});

const offsetRangeLabel = computed(() => `${offsetRange.value.min.toFixed(1)} ~ ${offsetRange.value.max.toFixed(1)} m`);

const offsetStep = computed(() => {
  const span = Math.abs(offsetRange.value.max - offsetRange.value.min);
  if (span <= 200) return 1;
  if (span <= 1000) return 5;
  return 10;
});

const latencyLabel = computed(() => requestLatencyMs.value > 0 ? `${requestLatencyMs.value.toFixed(0)} ms` : '-');

const buildSecondsLabel = computed(() => {
  const seconds = Number(metadata.value?.buildSeconds ?? 0);
  return seconds > 0 ? `${seconds.toFixed(2)} s` : '-';
});

const activeColorRange = computed(() => {
  if (rangeMode.value === 'slice') {
    const stats = sliceData.value?.stats;
    const min = Number(stats?.speedMin ?? 0);
    const max = Number(stats?.speedMax ?? 1);
    return sanitizeRange(min, max);
  }
  const globalRange = metadata.value?.speedRange;
  if (Array.isArray(globalRange) && globalRange.length === 2) {
    return sanitizeRange(Number(globalRange[0]), Number(globalRange[1]));
  }
  return sanitizeRange(0, 1);
});

const legendTicks = computed(() => {
  const { min, max } = activeColorRange.value;
  return Array.from({ length: 5 }, (_, index) => (
    (min + ((max - min) * index) / 4).toFixed(2)
  ));
});

function sanitizeRange(min, max) {
  const safeMin = Number.isFinite(min) ? min : 0;
  let safeMax = Number.isFinite(max) ? max : safeMin + 1;
  if (Math.abs(safeMax - safeMin) < 1e-6) safeMax = safeMin + 1;
  return { min: safeMin, max: safeMax };
}

function getBoundingCorners(bounds) {
  const [xmin, xmax, ymin, ymax, zmin, zmax] = bounds.map((value) => Number(value));
  return [
    [xmin, ymin, zmin],
    [xmin, ymin, zmax],
    [xmin, ymax, zmin],
    [xmin, ymax, zmax],
    [xmax, ymin, zmin],
    [xmax, ymin, zmax],
    [xmax, ymax, zmin],
    [xmax, ymax, zmax],
  ];
}

function normalizeVector(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 1e-9) return [0, 0, 1];
  return vector.map((value) => value / length);
}

function getCurrentNormal() {
  if (mode.value === 'xy') return [0, 0, 1];
  if (mode.value === 'xz') return [0, 1, 0];
  if (mode.value === 'yz') return [1, 0, 0];

  const azimuth = (azimuthDeg.value * Math.PI) / 180;
  const tilt = (tiltDeg.value * Math.PI) / 180;
  return normalizeVector([
    Math.sin(tilt) * Math.cos(azimuth),
    Math.sin(tilt) * Math.sin(azimuth),
    Math.cos(tilt),
  ]);
}

function clampOffsetToRange() {
  const { min, max } = offsetRange.value;
  if (!Number.isFinite(offsetM.value)) {
    offsetM.value = 0;
    return;
  }
  offsetM.value = Math.min(max, Math.max(min, offsetM.value));
}

async function loadMetadata(forceRebuild = false) {
  const response = await axios.get(`/api/cases/${props.caseId}/experimental-cfd-metadata`, {
    params: {
      targetCells: Number(targetCellsPreset.value),
      forceRebuild: forceRebuild ? 'true' : undefined,
    },
  });
  metadata.value = response.data?.metadata || null;
  clampOffsetToRange();
}

async function loadSlice() {
  if (!props.caseId) return;
  const myRequestId = ++requestSequence;
  loading.value = true;
  errorMessage.value = '';
  loadingText.value = metadata.value ? '正在提取服务端切面...' : '正在构建服务端缓存...';

  try {
    if (!metadata.value) {
      await loadMetadata(false);
    }

    const startedAt = performance.now();
    const response = await axios.post(`/api/cases/${props.caseId}/experimental-cfd-slice`, {
      mode: mode.value,
      offsetM: offsetM.value,
      azimuthDeg: azimuthDeg.value,
      tiltDeg: tiltDeg.value,
      resolutionX: resolution.value[0],
      resolutionY: resolution.value[1],
      targetCells: Number(targetCellsPreset.value),
    });
    requestLatencyMs.value = performance.now() - startedAt;

    if (myRequestId !== requestSequence) return;

    if (!response.data?.success) {
      throw new Error(response.data?.message || '实验性切面接口返回失败。');
    }

    sliceData.value = response.data;
    await nextTick();
    redraw();
  } catch (error) {
    if (myRequestId !== requestSequence) return;
    errorMessage.value = error?.response?.data?.message || error.message || '加载实验性切面失败';
  } finally {
    if (myRequestId === requestSequence) {
      loading.value = false;
    }
  }
}

function scheduleLoadSlice() {
  if (loadTimer) window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => {
    loadSlice();
  }, 260);
}

async function rebuildCache() {
  rebuilding.value = true;
  try {
    await loadMetadata(true);
    await loadSlice();
    ElMessage.success('服务端矢量体缓存已重建。');
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '重建缓存失败');
  } finally {
    rebuilding.value = false;
  }
}

function redraw() {
  const canvas = sliceCanvas.value;
  const host = canvasHost.value;
  if (!canvas || !host || !sliceData.value) return;
  const speedGrid = sliceData.value.speed;
  const planeU = sliceData.value.planeU;
  const planeV = sliceData.value.planeV;
  const validMask = sliceData.value.validMask;
  if (!Array.isArray(speedGrid) || !speedGrid.length || !Array.isArray(speedGrid[0])) return;

  const rows = speedGrid.length;
  const cols = speedGrid[0].length;
  const rect = host.getBoundingClientRect();
  const cssWidth = Math.max(320, Math.floor(rect.width));
  const cssHeight = Math.max(420, Math.floor(rect.height));
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * pixelRatio);
  canvas.height = Math.floor(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#07111f';
  context.fillRect(0, 0, cssWidth, cssHeight);

  const uAxis = sliceData.value.uAxis_m || [];
  const vAxis = sliceData.value.vAxis_m || [];
  const uSpan = Math.max(1, Math.abs((uAxis[uAxis.length - 1] || cols) - (uAxis[0] || 0)));
  const vSpan = Math.max(1, Math.abs((vAxis[vAxis.length - 1] || rows) - (vAxis[0] || 0)));
  const padding = 28;
  const viewportWidth = cssWidth - padding * 2;
  const viewportHeight = cssHeight - padding * 2;
  const dataAspect = uSpan / vSpan;
  const viewportAspect = viewportWidth / viewportHeight;
  let drawWidth = viewportWidth;
  let drawHeight = viewportHeight;
  if (dataAspect > viewportAspect) {
    drawHeight = drawWidth / dataAspect;
  } else {
    drawWidth = drawHeight * dataAspect;
  }
  const drawX = (cssWidth - drawWidth) / 2;
  const drawY = (cssHeight - drawHeight) / 2;
  currentDrawRect = { x: drawX, y: drawY, width: drawWidth, height: drawHeight };

  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = cols;
  heatCanvas.height = rows;
  const heatContext = heatCanvas.getContext('2d');
  if (!heatContext) return;
  const imageData = heatContext.createImageData(cols, rows);
  const imageBuffer = imageData.data;
  const { min, max } = activeColorRange.value;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 4;
      const valid = Boolean(validMask?.[row]?.[col]);
      if (!valid) {
        imageBuffer[offset] = 14;
        imageBuffer[offset + 1] = 20;
        imageBuffer[offset + 2] = 32;
        imageBuffer[offset + 3] = 255;
        continue;
      }

      const speed = Number(speedGrid[row][col] ?? 0);
      const normalized = Math.max(0, Math.min(1, (speed - min) / Math.max(max - min, 1e-6)));
      const lutIndex = Math.max(0, Math.min(255, Math.round(normalized * 255))) * 4;
      imageBuffer[offset] = colorLookup[lutIndex];
      imageBuffer[offset + 1] = colorLookup[lutIndex + 1];
      imageBuffer[offset + 2] = colorLookup[lutIndex + 2];
      imageBuffer[offset + 3] = 255;
    }
  }

  heatContext.putImageData(imageData, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(heatCanvas, drawX, drawY, drawWidth, drawHeight);

  context.strokeStyle = 'rgba(255,255,255,0.12)';
  context.lineWidth = 1;
  context.strokeRect(drawX, drawY, drawWidth, drawHeight);

  if (showVectors.value) {
    drawVectorGlyphs(context, planeU, planeV, validMask, drawX, drawY, drawWidth, drawHeight);
  }
}

function drawVectorGlyphs(context, planeU, planeV, validMask, drawX, drawY, drawWidth, drawHeight) {
  const rows = planeU.length;
  const cols = planeU[0]?.length || 0;
  if (!rows || !cols) return;

  const step = Math.max(2, Number(vectorStride.value));
  const cellWidth = drawWidth / Math.max(cols - 1, 1);
  const cellHeight = drawHeight / Math.max(rows - 1, 1);
  const arrowScale = Math.min(cellWidth, cellHeight) * 0.7;

  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.75)';
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.lineWidth = 1.15;

  for (let row = 0; row < rows; row += step) {
    for (let col = 0; col < cols; col += step) {
      if (!validMask?.[row]?.[col]) continue;

      const u = Number(planeU[row][col] ?? 0);
      const v = Number(planeV[row][col] ?? 0);
      const length = Math.hypot(u, v);
      if (!Number.isFinite(length) || length < 1e-6) continue;

      const dirX = u / length;
      const dirY = v / length;
      const x = drawX + (col / Math.max(cols - 1, 1)) * drawWidth;
      const y = drawY + (row / Math.max(rows - 1, 1)) * drawHeight;
      const arrowLength = Math.min(arrowScale, 7 + Math.log1p(length) * 6);
      const endX = x + dirX * arrowLength;
      const endY = y + dirY * arrowLength;

      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.stroke();

      const headAngle = Math.atan2(dirY, dirX);
      const headSize = 3.5;
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - Math.cos(headAngle - Math.PI / 6) * headSize,
        endY - Math.sin(headAngle - Math.PI / 6) * headSize,
      );
      context.lineTo(
        endX - Math.cos(headAngle + Math.PI / 6) * headSize,
        endY - Math.sin(headAngle + Math.PI / 6) * headSize,
      );
      context.closePath();
      context.fill();
    }
  }

  context.restore();
}

watch(
  [mode, azimuthDeg, tiltDeg],
  () => {
    clampOffsetToRange();
    scheduleLoadSlice();
  },
);

watch(
  [offsetM, resolutionPreset],
  () => {
    scheduleLoadSlice();
  },
);

watch(targetCellsPreset, () => {
  metadata.value = null;
  sliceData.value = null;
  scheduleLoadSlice();
});

watch([rangeMode, showVectors, vectorStride], () => {
  redraw();
});

watch(() => props.caseId, async () => {
  metadata.value = null;
  sliceData.value = null;
  requestLatencyMs.value = 0;
  clampOffsetToRange();
  await loadSlice();
});

onMounted(async () => {
  resizeObserver = new ResizeObserver(() => {
    redraw();
  });
  if (canvasHost.value) resizeObserver.observe(canvasHost.value);
  await loadSlice();
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (loadTimer) window.clearTimeout(loadTimer);
});
</script>

<style scoped>
.server-slice-viewer {
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

.slice-canvas {
  display: block;
  width: 100%;
  height: 100%;
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
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
  z-index: 2;
  pointer-events: none;
}

.chip {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(7, 18, 31, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(10px);
  box-shadow: 0 16px 32px rgba(2, 8, 23, 0.25);
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
