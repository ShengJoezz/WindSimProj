<template>
  <div class="speed-lab">
    <el-alert
      v-if="blockingAlert"
      :type="blockingAlert.type"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>{{ blockingAlert.title }}</template>
      <template #default>
        {{ blockingAlert.message }}
        <el-button
          v-if="blockingAlert.actionText"
          type="primary"
          link
          :loading="blockingAlert.loading"
          @click="blockingAlert.action"
        >
          {{ blockingAlert.actionText }}
        </el-button>
      </template>
    </el-alert>

    <template v-if="mainMetadata">
      <section class="control-strip">
        <div class="control-block control-block-height">
          <span class="control-label">高度</span>
          <el-slider
            v-model="currentHeight"
            :min="minHeight"
            :max="maxHeight"
            :step="heightSliderStep"
            show-input
          />
        </div>

        <div class="control-block">
          <span class="control-label">风机</span>
          <el-select
            v-model="selectedTurbine"
            placeholder="选择风机"
            filterable
            clearable
            class="toolbar-select"
          >
            <el-option
              v-for="turbine in mainMetadata.turbines || []"
              :key="turbine.id"
              :label="turbine.name || turbine.id"
              :value="turbine.id"
            />
          </el-select>
        </div>

        <div class="control-block control-block-actions">
          <span class="control-label">操作</span>
          <div class="action-row">
            <el-tooltip content="刷新">
              <el-button :icon="Refresh" circle @click="retryLoad" :loading="loading" />
            </el-tooltip>
            <el-tooltip content="导出当前视图">
              <el-button :icon="Download" circle @click="exportCurrentView" :disabled="!isVisualizationReady" />
            </el-tooltip>
          </div>
        </div>
      </section>

      <div class="workspace-grid">
        <section class="panel map-panel">
          <div class="panel-head">
            <h2>平面风速场</h2>
            <div class="panel-meta">
              <span>{{ formatNumber(currentHeight, 0) }} m</span>
              <span>JET</span>
            </div>
          </div>

          <div
            ref="speedFieldContainer"
            class="map-stage"
            :style="mapStageStyle"
            @click="handleStageClick"
          >
            <div v-if="!isSpeedFieldReady && !chartLoading.speedField" class="empty-state">
              <el-icon><Picture /></el-icon>
              <span>{{ loading ? '加载中...' : '暂无速度场数据' }}</span>
            </div>

            <canvas
              ref="speedFieldCanvas"
              class="speed-field-canvas"
              :class="{
                'speed-field-canvas--visible': isSpeedFieldReady,
              }"
            />

            <button
              v-for="marker in markerItems"
              :key="marker.id"
              type="button"
              class="map-marker"
              :class="{ 'map-marker--active': marker.id === selectedTurbine }"
              :style="marker.style"
              :title="marker.title"
              @click.stop="selectedTurbine = marker.id"
            >
              <span class="map-marker-dot"></span>
              <span class="map-marker-label">{{ marker.name }}</span>
            </button>

            <div v-if="queryMarkerStyle" class="query-marker" :style="queryMarkerStyle"></div>

            <div v-if="chartLoading.speedField" class="panel-overlay">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载速度场...</span>
            </div>
          </div>

          <div class="map-footer">
            <div v-if="isSpeedFieldReady" class="legend-strip">
              <span class="legend-caption">JET</span>
              <div class="legend-bar" :style="speedFieldLegendBarStyle"></div>
              <div class="legend-labels">
                <span v-for="tick in speedFieldLegendTicks" :key="tick">{{ tick }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel side-panel">
          <div class="panel-head">
            <h2>风机剖面与尾流</h2>
            <div class="panel-meta">
              <span>{{ selectedTurbineMeta?.name || '-' }}</span>
            </div>
          </div>

          <div class="detail-strip">
            <div v-for="item in selectedDetailItems" :key="item.label" class="detail-chip">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <div class="point-strip point-strip--side">
            <span class="point-strip-title">单点查询</span>
            <el-input-number
              v-model="pointQuery.x"
              :step="10"
              :precision="1"
              :min="stageDomain?.xMin"
              :max="stageDomain?.xMax"
              controls-position="right"
            />
            <el-input-number
              v-model="pointQuery.y"
              :step="10"
              :precision="1"
              :min="stageDomain?.yMin"
              :max="stageDomain?.yMax"
              controls-position="right"
            />
            <div class="point-chip">
              <span>Z</span>
              <strong>{{ formatNumber(currentHeight, 1) }} m</strong>
            </div>
            <div class="point-chip">
              <span>风速</span>
              <strong>{{ pointSpeedLabel }}</strong>
            </div>
            <el-button :loading="chartLoading.pointQuery" @click="handlePointQuery">更新</el-button>
          </div>

          <div class="chart-stack">
            <section class="chart-block">
              <div class="chart-head">
                <h3>风速廓线</h3>
              </div>
              <div ref="profileChartRef" class="chart-surface"></div>
              <div v-if="chartLoading.profile" class="panel-overlay panel-overlay--surface">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
            </section>

            <section class="chart-block">
              <div class="chart-head">
                <h3>尾流分析</h3>
              </div>
              <div ref="wakeChartRef" class="chart-surface"></div>
              <div v-if="chartLoading.wake" class="panel-overlay panel-overlay--surface">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
            </section>
          </div>
        </section>
      </div>
    </template>

    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>加载速度场分析中...</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { debounce } from 'lodash-es';
import { Download, Loading, Picture, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import {
  clearClientCaseCache,
  findClosestIndex,
  getMetadata,
  getProfileData,
  getVolumeData,
  getWakeData,
} from '@/services/visualizationService';
import { buildColorLookupTable, buildCssGradient, SIMULATION_JET_STOPS } from '@/utils/colormaps';
import { useCaseStore } from '@/store/caseStore';
import { useRouter } from 'vue-router';

const props = defineProps({ caseId: { type: String, required: true } });
const caseStore = useCaseStore();
const router = useRouter();

const MAX_SPEED_FIELD_PIXELS = 950000;
const speedFieldColorLut = buildColorLookupTable(SIMULATION_JET_STOPS);

const loading = ref(false);
const chartLoading = ref({ speedField: false, profile: false, wake: false, pointQuery: false });
const mainMetadata = ref(null);
const currentHeight = ref(10);
const selectedTurbine = ref('');
const profileData = ref(null);
const wakeData = ref(null);
const pointQuery = ref({ x: null, y: null });
const pointQueryResult = ref(null);
const isStartingPrecompute = ref(false);
const isSpeedFieldReady = ref(false);

const speedFieldContainer = ref(null);
const speedFieldCanvas = ref(null);
const profileChartRef = ref(null);
const wakeChartRef = ref(null);

let profileInstance = null;
let wakeInstance = null;
let resizeObserver = null;
const speedFieldVolume = ref(null);
let speedFieldCanvasCtx = null;
let speedFieldImageData = null;
let speedFieldRenderFrameId = null;
let speedFieldXMap = null;
let speedFieldYMap = null;

const formatNumber = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');
const roundPointCoordinate = (value) => (Number.isFinite(Number(value)) ? Number(Number(value).toFixed(1)) : null);
const rotatePointToSolverFrame = (x, y, windAngleDeg) => {
  const numericX = Number(x);
  const numericY = Number(y);
  if (!Number.isFinite(numericX) || !Number.isFinite(numericY)) {
    return { x: null, y: null };
  }
  const angleRad = -(Number(windAngleDeg || 0) + 90) * Math.PI / 180;
  const cosValue = Math.cos(angleRad);
  const sinValue = Math.sin(angleRad);
  return {
    x: numericX * cosValue + numericY * sinValue,
    y: -numericX * sinValue + numericY * cosValue,
  };
};

const minHeight = computed(() => mainMetadata.value?.heightLevels?.[0] ?? 10);
const maxHeight = computed(() => {
  const levels = mainMetadata.value?.heightLevels;
  return levels?.length ? levels[levels.length - 1] : 200;
});
const heightSliderStep = computed(() => {
  const range = maxHeight.value - minHeight.value;
  return Number.isFinite(range) && range > 500 ? 0.5 : 0.1;
});
const isVisualizationReady = computed(() => Boolean(mainMetadata.value && isSpeedFieldReady.value));
const resolvedTurbines = computed(() => {
  const turbines = mainMetadata.value?.turbines || [];
  const windAngle = Number(mainMetadata.value?.windAngle ?? 0);
  const coordinateFrame = String(mainMetadata.value?.turbineCoordinateFrame || '').toLowerCase();

  return turbines.map((turbine) => {
    const solverX = Number(turbine?.solverX);
    const solverY = Number(turbine?.solverY);
    const originalX = Number.isFinite(Number(turbine?.originalX)) ? Number(turbine.originalX) : Number(turbine?.x);
    const originalY = Number.isFinite(Number(turbine?.originalY)) ? Number(turbine.originalY) : Number(turbine?.y);
    const rotated = coordinateFrame === 'solver'
      ? { x: Number(turbine?.x), y: Number(turbine?.y) }
      : rotatePointToSolverFrame(originalX, originalY, windAngle);
    const plotX = Number.isFinite(solverX) ? solverX : rotated.x;
    const plotY = Number.isFinite(solverY) ? solverY : rotated.y;
    return {
      ...turbine,
      originalX,
      originalY,
      plotX,
      plotY,
    };
  });
});
const selectedTurbineMeta = computed(() => resolvedTurbines.value.find((item) => item.id === selectedTurbine.value) || null);
const speedFieldLegendTicks = computed(() => {
  const vmin = Number(mainMetadata.value?.vmin ?? speedFieldVolume.value?.vmin ?? 0);
  const vmax = Number(mainMetadata.value?.vmax ?? speedFieldVolume.value?.vmax ?? 0);
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || Math.abs(vmax - vmin) < 1e-6) return ['0.0'];
  return Array.from({ length: 5 }, (_, index) => (vmin + ((vmax - vmin) * index) / 4).toFixed(1));
});
const speedFieldLegendBarStyle = computed(() => ({ background: buildCssGradient(SIMULATION_JET_STOPS) }));
const stageDomain = computed(() => {
  const extent = speedFieldVolume.value?.extent;
  if (Array.isArray(extent) && extent.length === 4 && extent.every((value) => Number.isFinite(Number(value)))) {
    return {
      xMin: Number(extent[0]),
      xMax: Number(extent[1]),
      yMin: Number(extent[2]),
      yMax: Number(extent[3]),
    };
  }
  if (!speedFieldVolume.value?.xCoords?.length || !speedFieldVolume.value?.yCoords?.length) return null;
  return {
    xMin: speedFieldVolume.value.xCoords[0],
    xMax: speedFieldVolume.value.xCoords[speedFieldVolume.value.xCoords.length - 1],
    yMin: speedFieldVolume.value.yCoords[0],
    yMax: speedFieldVolume.value.yCoords[speedFieldVolume.value.yCoords.length - 1],
  };
});
const mapStageStyle = computed(() => {
  const domain = stageDomain.value;
  if (!domain) return { aspectRatio: '1 / 1' };
  return {
    aspectRatio: `${Math.max(1e-6, domain.xMax - domain.xMin)} / ${Math.max(1e-6, domain.yMax - domain.yMin)}`,
  };
});
const markerItems = computed(() => {
  const domain = stageDomain.value;
  const turbines = resolvedTurbines.value;
  if (!domain || !turbines.length) return [];
  const xSpan = domain.xMax - domain.xMin;
  const ySpan = domain.yMax - domain.yMin;
  return turbines
    .filter((turbine) => Number.isFinite(turbine.plotX) && Number.isFinite(turbine.plotY))
    .map((turbine) => ({
      id: turbine.id,
      name: turbine.name || turbine.id,
      title: `${turbine.name || turbine.id} | X ${formatNumber(turbine.plotX, 1)} m | Y ${formatNumber(turbine.plotY, 1)} m`,
      style: {
        left: `${((turbine.plotX - domain.xMin) / xSpan) * 100}%`,
        top: `${((domain.yMax - turbine.plotY) / ySpan) * 100}%`,
        zIndex: turbine.id === selectedTurbine.value ? 4 : 3,
      },
    }));
});
const queryMarkerStyle = computed(() => {
  const domain = stageDomain.value;
  const x = Number(pointQuery.value.x);
  const y = Number(pointQuery.value.y);
  if (!domain || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const xSpan = domain.xMax - domain.xMin;
  const ySpan = domain.yMax - domain.yMin;
  return {
    left: `${((x - domain.xMin) / xSpan) * 100}%`,
    top: `${((domain.yMax - y) / ySpan) * 100}%`,
  };
});
const selectedDetailItems = computed(() => {
  const turbine = selectedTurbineMeta.value;
  if (!turbine) {
    return [
      { label: '当前高度风速', value: '-' },
      { label: '轮毂高度风速', value: '-' },
      { label: '轮毂高度', value: '-' },
    ];
  }
  const currentSpeed = sampleSpeedFieldAtPoint(turbine.plotX, turbine.plotY, currentHeight.value);
  const hubSpeed = sampleSpeedFieldAtPoint(turbine.plotX, turbine.plotY, turbine.hubHeight);
  return [
    { label: '当前高度风速', value: Number.isFinite(currentSpeed) ? `${formatNumber(currentSpeed, 2)} m/s` : '-' },
    { label: '轮毂高度风速', value: Number.isFinite(hubSpeed) ? `${formatNumber(hubSpeed, 2)} m/s` : '-' },
    { label: '轮毂高度', value: `${formatNumber(turbine.hubHeight, 1)} m` },
  ];
});
const pointSpeedLabel = computed(() => {
  if (!pointQueryResult.value) return '-';
  return pointQueryResult.value.speed == null ? '计算域外' : `${formatNumber(pointQueryResult.value.speed, 3)} m/s`;
});
const blockingAlert = computed(() => {
  if (!props.caseId) return null;
  if (!caseStore.hasFetchedCalculationStatus) return { type: 'info', title: '加载中', message: '正在加载工况状态与速度场缓存...', actionText: '', loading: false, action: () => {} };
  if (caseStore.calculationStatus && caseStore.calculationStatus !== 'completed') {
    return {
      type: 'warning',
      title: '需要先完成主计算',
      message: '速度场分析依赖主计算结果，请先完成计算。',
      actionText: '去计算输出',
      loading: false,
      action: () => router.push({ name: 'CalculationOutput', params: { caseId: props.caseId } }),
    };
  }
  if (!mainMetadata.value) {
    const vizStatus = caseStore.visualizationStatus || 'not_run';
    if (loading.value || chartLoading.value.speedField) return { type: 'info', title: '加载中', message: '正在读取速度场缓存...', actionText: '', loading: false, action: () => {} };
    if (vizStatus === 'starting' || vizStatus === 'running') return { type: 'info', title: '可视化预计算进行中', message: '正在生成速度场缓存，请稍候。', actionText: '', loading: false, action: () => {} };
    if (vizStatus === 'completed') return { type: 'error', title: '可视化缓存异常', message: '状态显示已完成，但未能读取元数据缓存。', actionText: '重新预计算', loading: isStartingPrecompute.value, action: startPrecompute };
    if (vizStatus === 'failed') return { type: 'error', title: '可视化预计算失败', message: caseStore.visualizationLastError || '请重试。', actionText: '重新预计算', loading: isStartingPrecompute.value, action: startPrecompute };
    return { type: 'warning', title: '未找到可视化缓存', message: '此工况尚未生成速度场分析缓存。', actionText: '运行预计算', loading: isStartingPrecompute.value, action: startPrecompute };
  }
  return null;
});

const getAxisBracket = (coords, target) => {
  if (!coords?.length) return null;
  if (coords.length === 1) return { lowerIndex: 0, upperIndex: 0, mix: 0 };
  if (target < coords[0] || target > coords[coords.length - 1]) return null;
  let lowerIndex = 0;
  let upperIndex = coords.length - 1;
  while (upperIndex - lowerIndex > 1) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
    if (coords[middleIndex] <= target) lowerIndex = middleIndex;
    else upperIndex = middleIndex;
  }
  const span = Math.max(1e-6, coords[upperIndex] - coords[lowerIndex]);
  return { lowerIndex, upperIndex, mix: Math.max(0, Math.min(1, (target - coords[lowerIndex]) / span)) };
};
const getBracketFromLevels = (levels, target) => {
  if (!levels?.length) return null;
  if (levels.length === 1) return { lowerIndex: 0, upperIndex: 0, mix: 0 };
  const clamped = Math.min(levels[levels.length - 1], Math.max(levels[0], target));
  for (let i = 0; i < levels.length - 1; i += 1) {
    if (clamped >= levels[i] && clamped <= levels[i + 1]) {
      const span = Math.max(1e-6, levels[i + 1] - levels[i]);
      return { lowerIndex: i, upperIndex: i + 1, mix: Math.max(0, Math.min(1, (clamped - levels[i]) / span)) };
    }
  }
  return { lowerIndex: levels.length - 1, upperIndex: levels.length - 1, mix: 0 };
};
const buildAxisSamplingMap = (targetSize, coords, flip = false) => {
  const lower = new Uint32Array(targetSize);
  const upper = new Uint32Array(targetSize);
  const weight = new Float32Array(targetSize);
  if (!coords?.length) return { lower, upper, weight };
  const denominator = Math.max(1, targetSize - 1);
  const minCoord = coords[0];
  const maxCoord = coords[coords.length - 1];
  for (let i = 0; i < targetSize; i += 1) {
    const normalized = targetSize <= 1 ? 0 : i / denominator;
    const targetCoord = flip ? maxCoord - (maxCoord - minCoord) * normalized : minCoord + (maxCoord - minCoord) * normalized;
    const bracket = getAxisBracket(coords, targetCoord);
    if (!bracket) continue;
    lower[i] = bracket.lowerIndex;
    upper[i] = bracket.upperIndex;
    weight[i] = bracket.mix;
  }
  return { lower, upper, weight };
};
const sampleSpeedFieldAtPoint = (x, y, z) => {
  if (!speedFieldVolume.value) return null;
  const xBracket = getAxisBracket(speedFieldVolume.value.xCoords, x);
  const yBracket = getAxisBracket(speedFieldVolume.value.yCoords, y);
  const zBracket = getBracketFromLevels(speedFieldVolume.value.heightLevels, z);
  if (!xBracket || !yBracket || !zBracket) return null;
  const { values, width, layerSize } = speedFieldVolume.value;
  const lowerBase = zBracket.lowerIndex * layerSize;
  const upperBase = zBracket.upperIndex * layerSize;
  const readPlane = (base, yIndex, xIndex) => values[base + yIndex * width + xIndex];
  const bilerp = (base) => {
    const v00 = readPlane(base, yBracket.lowerIndex, xBracket.lowerIndex);
    const v10 = readPlane(base, yBracket.lowerIndex, xBracket.upperIndex);
    const v01 = readPlane(base, yBracket.upperIndex, xBracket.lowerIndex);
    const v11 = readPlane(base, yBracket.upperIndex, xBracket.upperIndex);
    const top = v00 + (v10 - v00) * xBracket.mix;
    const bottom = v01 + (v11 - v01) * xBracket.mix;
    return top + (bottom - top) * yBracket.mix;
  };
  const lowerValue = bilerp(lowerBase);
  const upperValue = bilerp(upperBase);
  const value = lowerValue + (upperValue - lowerValue) * zBracket.mix;
  return Number.isFinite(value) ? value : null;
};
const ensureSpeedFieldCanvasSize = () => {
  const canvas = speedFieldCanvas.value;
  const container = speedFieldContainer.value;
  if (!canvas || !container || !speedFieldVolume.value) return false;
  const rect = container.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.floor(rect.width));
  const cssHeight = Math.max(1, Math.floor(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
  let pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
  const totalPixels = pixelWidth * pixelHeight;
  if (totalPixels > MAX_SPEED_FIELD_PIXELS) {
    const scale = Math.sqrt(MAX_SPEED_FIELD_PIXELS / totalPixels);
    pixelWidth = Math.max(1, Math.floor(pixelWidth * scale));
    pixelHeight = Math.max(1, Math.floor(pixelHeight * scale));
  }
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || !speedFieldCanvasCtx || !speedFieldImageData || !speedFieldXMap || !speedFieldYMap) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    speedFieldCanvasCtx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    speedFieldImageData = speedFieldCanvasCtx ? speedFieldCanvasCtx.createImageData(pixelWidth, pixelHeight) : null;
    speedFieldXMap = buildAxisSamplingMap(pixelWidth, speedFieldVolume.value.xCoords, false);
    speedFieldYMap = buildAxisSamplingMap(pixelHeight, speedFieldVolume.value.yCoords, true);
  }
  return Boolean(speedFieldCanvasCtx && speedFieldImageData && speedFieldXMap && speedFieldYMap);
};
const renderSpeedField = () => {
  if (!speedFieldVolume.value || !ensureSpeedFieldCanvasSize()) return;
  const { values, width, layerSize, heightLevels, vmin, vmax } = speedFieldVolume.value;
  const levelBracket = getBracketFromLevels(heightLevels, currentHeight.value);
  if (!levelBracket) return;
  const lowerBase = levelBracket.lowerIndex * layerSize;
  const upperBase = levelBracket.upperIndex * layerSize;
  const zMix = levelBracket.mix;
  const valueRange = Math.max(1e-6, vmax - vmin);
  const output = speedFieldImageData.data;
  let outIndex = 0;
  for (let py = 0; py < speedFieldImageData.height; py += 1) {
    const y0 = speedFieldYMap.lower[py];
    const y1 = speedFieldYMap.upper[py];
    const yMix = speedFieldYMap.weight[py];
    const lowerRow0 = lowerBase + y0 * width;
    const lowerRow1 = lowerBase + y1 * width;
    const upperRow0 = upperBase + y0 * width;
    const upperRow1 = upperBase + y1 * width;
    for (let px = 0; px < speedFieldImageData.width; px += 1) {
      const x0 = speedFieldXMap.lower[px];
      const x1 = speedFieldXMap.upper[px];
      const xMix = speedFieldXMap.weight[px];
      const lowerTop = values[lowerRow0 + x0] + (values[lowerRow0 + x1] - values[lowerRow0 + x0]) * xMix;
      const lowerBottom = values[lowerRow1 + x0] + (values[lowerRow1 + x1] - values[lowerRow1 + x0]) * xMix;
      const upperTop = values[upperRow0 + x0] + (values[upperRow0 + x1] - values[upperRow0 + x0]) * xMix;
      const upperBottom = values[upperRow1 + x0] + (values[upperRow1 + x1] - values[upperRow1 + x0]) * xMix;
      const lowerValue = lowerTop + (lowerBottom - lowerTop) * yMix;
      const upperValue = upperTop + (upperBottom - upperTop) * yMix;
      const interpolated = lowerValue + (upperValue - lowerValue) * zMix;
      if (!Number.isFinite(interpolated)) {
        output[outIndex++] = 245;
        output[outIndex++] = 247;
        output[outIndex++] = 250;
        output[outIndex++] = 255;
        continue;
      }
      const normalized = Math.max(0, Math.min(1, (interpolated - vmin) / valueRange));
      const lutIndex = Math.min(255, Math.max(0, Math.floor(normalized * 255))) * 4;
      output[outIndex++] = speedFieldColorLut[lutIndex];
      output[outIndex++] = speedFieldColorLut[lutIndex + 1];
      output[outIndex++] = speedFieldColorLut[lutIndex + 2];
      output[outIndex++] = 255;
    }
  }
  speedFieldCanvasCtx.putImageData(speedFieldImageData, 0, 0);
  isSpeedFieldReady.value = true;
  chartLoading.value.speedField = false;
};
const scheduleSpeedFieldRender = () => {
  if (!speedFieldVolume.value || speedFieldRenderFrameId) return;
  speedFieldRenderFrameId = requestAnimationFrame(() => {
    speedFieldRenderFrameId = null;
    renderSpeedField();
  });
};
const clearSpeedFieldCanvas = () => {
  if (speedFieldRenderFrameId) cancelAnimationFrame(speedFieldRenderFrameId);
  speedFieldRenderFrameId = null;
  speedFieldVolume.value = null;
  speedFieldCanvasCtx = null;
  speedFieldImageData = null;
  speedFieldXMap = null;
  speedFieldYMap = null;
  isSpeedFieldReady.value = false;
};
const updatePointQuery = () => {
  const x = Number(pointQuery.value.x);
  const y = Number(pointQuery.value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    pointQueryResult.value = null;
    return;
  }
  pointQueryResult.value = {
    x: roundPointCoordinate(x),
    y: roundPointCoordinate(y),
    z: currentHeight.value,
    speed: sampleSpeedFieldAtPoint(x, y, currentHeight.value),
  };
};
const fetchMetadata = async () => {
  chartLoading.value.speedField = true;
  mainMetadata.value = await getMetadata(props.caseId);
};
const fetchProfile = async (turbineId) => {
  if (!turbineId) return;
  chartLoading.value.profile = true;
  try {
    profileData.value = (await getProfileData(props.caseId, turbineId))?.profile || null;
    await nextTick();
    renderProfileChart();
  } catch (error) {
    profileData.value = null;
    profileInstance?.clear();
    ElMessage.error(error?.message || '加载风廓线失败');
  } finally {
    chartLoading.value.profile = false;
  }
};
const fetchWake = async (turbineId) => {
  if (!turbineId) return;
  chartLoading.value.wake = true;
  try {
    wakeData.value = (await getWakeData(props.caseId, turbineId))?.wake || null;
    await nextTick();
    renderWakeChart();
  } catch (error) {
    wakeData.value = null;
    wakeInstance?.clear();
    ElMessage.error(error?.message || '加载尾流分析失败');
  } finally {
    chartLoading.value.wake = false;
  }
};
const initCharts = () => {
  if (profileChartRef.value && (!profileInstance || profileInstance.isDisposed())) {
    const rect = profileChartRef.value.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      profileInstance = echarts.init(profileChartRef.value);
    }
  }
  if (wakeChartRef.value && (!wakeInstance || wakeInstance.isDisposed())) {
    const rect = wakeChartRef.value.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      wakeInstance = echarts.init(wakeChartRef.value);
    }
  }
  if (profileData.value) renderProfileChart();
  if (wakeData.value) renderWakeChart();
};
const renderProfileChart = () => {
  if (!profileInstance || !profileData.value?.heights?.length) return;
  const validData = profileData.value.heights
    .map((height, index) => [Number(profileData.value.speeds[index]), Number(height)])
    .filter(([speed, height]) => Number.isFinite(speed) && Number.isFinite(height));
  const option = {
    animation: false,
    grid: { left: 48, right: 18, top: 24, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        const item = params?.[0]?.value;
        return item ? `高度 ${formatNumber(item[1], 1)} m<br>风速 ${formatNumber(item[0], 2)} m/s` : '';
      },
    },
    xAxis: { type: 'value', name: '风速 (m/s)', nameLocation: 'middle', nameGap: 24, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } } },
    yAxis: { type: 'value', name: '高度 (m)', nameLocation: 'middle', nameGap: 42, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } } },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: validData,
      lineStyle: { width: 2.4, color: '#1677ff' },
      areaStyle: { color: 'rgba(22,119,255,0.08)' },
      markLine: { symbol: 'none', lineStyle: { type: 'dashed', color: '#64748b' }, data: [{ yAxis: currentHeight.value, label: { formatter: `${formatNumber(currentHeight.value, 0)} m` } }] },
    }],
  };
  const turbine = selectedTurbineMeta.value;
  if (turbine?.hubHeight != null) {
    const hubIndex = findClosestIndex(profileData.value.heights, turbine.hubHeight);
    if (hubIndex !== -1 && Number.isFinite(profileData.value.speeds[hubIndex])) {
      option.series.push({ type: 'scatter', symbol: 'diamond', symbolSize: 10, data: [[profileData.value.speeds[hubIndex], profileData.value.heights[hubIndex]]], itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 1 } });
    }
  }
  profileInstance.setOption(option, true);
};
const renderWakeChart = () => {
  if (!wakeInstance || !wakeData.value?.distances?.length) return;
  const validData = wakeData.value.distances
    .map((distance, index) => [Number(distance), Number(wakeData.value.speeds[index])])
    .filter(([distance, speed]) => Number.isFinite(distance) && Number.isFinite(speed));
  wakeInstance.setOption({
    animation: false,
    grid: { left: 48, right: 18, top: 24, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        const item = params?.[0]?.value;
        if (!item) return '';
        const prefix = item[0] >= 0 ? '下游' : '上游';
        return `${prefix} ${formatNumber(Math.abs(item[0]), 1)} m<br>风速 ${formatNumber(item[1], 2)} m/s`;
      },
    },
    xAxis: { type: 'value', name: '距离 (m)', nameLocation: 'middle', nameGap: 24, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } } },
    yAxis: { type: 'value', name: '风速 (m/s)', nameLocation: 'middle', nameGap: 42, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } } },
    series: [{ type: 'line', smooth: true, symbol: 'none', data: validData, lineStyle: { width: 2.4, color: '#12b981' }, areaStyle: { color: 'rgba(18,185,129,0.08)' }, markLine: { symbol: 'none', lineStyle: { type: 'dashed', color: '#ef4444' }, data: [{ xAxis: 0 }] } }],
  }, true);
};
const safeResize = () => {
  profileInstance?.resize();
  wakeInstance?.resize();
};
const handleResize = debounce(() => {
  scheduleSpeedFieldRender();
  safeResize();
}, 160);
const setupResizeObserver = () => {
  const elements = [profileChartRef.value, wakeChartRef.value, speedFieldContainer.value].filter(Boolean);
  if (!elements.length || typeof ResizeObserver === 'undefined') return;
  if (!resizeObserver) resizeObserver = new ResizeObserver(handleResize);
  else resizeObserver.disconnect();
  elements.forEach((element) => resizeObserver.observe(element));
};
const handleStageClick = (event) => {
  if (!stageDomain.value || !speedFieldContainer.value) return;
  const rect = speedFieldContainer.value.getBoundingClientRect();
  const relativeX = (event.clientX - rect.left) / rect.width;
  const relativeY = (event.clientY - rect.top) / rect.height;
  if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) return;
  pointQuery.value = {
    x: roundPointCoordinate(stageDomain.value.xMin + (stageDomain.value.xMax - stageDomain.value.xMin) * relativeX),
    y: roundPointCoordinate(stageDomain.value.yMax - (stageDomain.value.yMax - stageDomain.value.yMin) * relativeY),
  };
  updatePointQuery();
};
const handlePointQuery = async () => {
  const x = Number(pointQuery.value.x);
  const y = Number(pointQuery.value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    ElMessage.warning('请输入有效的 X/Y 坐标。');
    return;
  }
  chartLoading.value.pointQuery = true;
  try {
    updatePointQuery();
  } finally {
    chartLoading.value.pointQuery = false;
  }
};
const exportCurrentView = () => {
  if (!isVisualizationReady.value) return;
  const filenameBase = `WindSim_${props.caseId}_${selectedTurbine.value || 'field'}_H${formatNumber(currentHeight.value, 0)}`;
  if (speedFieldCanvas.value) {
    const link = document.createElement('a');
    link.href = speedFieldCanvas.value.toDataURL('image/png');
    link.download = `${filenameBase}_field.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  const chartExports = [
    { instance: profileInstance, suffix: 'profile' },
    { instance: wakeInstance, suffix: 'wake' },
  ];
  chartExports.forEach(({ instance, suffix }) => {
    if (!instance || instance.isDisposed()) return;
    const link = document.createElement('a');
    link.href = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    link.download = `${filenameBase}_${suffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
};
const startPrecompute = async () => {
  if (!props.caseId || isStartingPrecompute.value) return;
  try {
    isStartingPrecompute.value = true;
    await caseStore.startVisualizationPrecompute();
    ElMessage.success('已开始预计算。');
  } catch (error) {
    ElMessage.error(error?.message || '预计算启动失败');
  } finally {
    isStartingPrecompute.value = false;
  }
};
const ensureCaseLoaded = async (id) => {
  if (!id) return false;
  try {
    if (caseStore.caseId !== id || caseStore.currentCaseId !== id) await caseStore.initializeCase(id);
    else if (typeof caseStore.fetchCalculationStatus === 'function') await caseStore.fetchCalculationStatus();
    return true;
  } catch (error) {
    ElMessage.error(error?.message || '初始化工况失败');
    return false;
  }
};
const resetState = () => {
  loading.value = false;
  chartLoading.value = { speedField: false, profile: false, wake: false, pointQuery: false };
  mainMetadata.value = null;
  currentHeight.value = 10;
  selectedTurbine.value = '';
  profileData.value = null;
  wakeData.value = null;
  pointQuery.value = { x: null, y: null };
  pointQueryResult.value = null;
  clearSpeedFieldCanvas();
  profileInstance?.clear();
  wakeInstance?.clear();
};
const loadPageData = async () => {
  if (!props.caseId) return;
  if (caseStore.calculationStatus && caseStore.calculationStatus !== 'completed') {
    resetState();
    return;
  }
  loading.value = true;
  profileData.value = null;
  wakeData.value = null;
  clearSpeedFieldCanvas();
  try {
    await fetchMetadata();
    speedFieldVolume.value = await getVolumeData(props.caseId, mainMetadata.value);
    if (!Number.isFinite(currentHeight.value) || currentHeight.value < minHeight.value || currentHeight.value > maxHeight.value) currentHeight.value = minHeight.value;
    await nextTick();
    renderSpeedField();
    const availableTurbines = mainMetadata.value?.turbines || [];
    const hasActiveTurbine = availableTurbines.some((turbine) => turbine.id === selectedTurbine.value);
    if (!hasActiveTurbine) selectedTurbine.value = availableTurbines[0]?.id || '';
    if (selectedTurbineMeta.value && (!Number.isFinite(pointQuery.value.x) || !Number.isFinite(pointQuery.value.y))) {
      pointQuery.value = {
        x: roundPointCoordinate(selectedTurbineMeta.value.plotX),
        y: roundPointCoordinate(selectedTurbineMeta.value.plotY),
      };
      updatePointQuery();
    }
    if (hasActiveTurbine && selectedTurbine.value) {
      await Promise.allSettled([fetchProfile(selectedTurbine.value), fetchWake(selectedTurbine.value)]);
    }
    await nextTick();
    initCharts();
    setupResizeObserver();
  } catch (error) {
    resetState();
    ElMessage.error(error?.message || '加载速度场分析失败');
  } finally {
    loading.value = false;
  }
};
const retryLoad = async () => {
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadPageData();
};

watch(selectedTurbine, async (newValue) => {
  if (!newValue) {
    profileData.value = null;
    wakeData.value = null;
    profileInstance?.clear();
    wakeInstance?.clear();
    return;
  }
  await Promise.allSettled([fetchProfile(newValue), fetchWake(newValue)]);
});
watch(currentHeight, () => {
  scheduleSpeedFieldRender();
  renderProfileChart();
  updatePointQuery();
});
watch(() => props.caseId, async (newValue, oldValue) => {
  if (oldValue) clearClientCaseCache(oldValue);
  resetState();
  if (!newValue) return;
  const ok = await ensureCaseLoaded(newValue);
  if (ok) await loadPageData();
});
watch(() => caseStore.visualizationStatus, async (status) => {
  if (status === 'completed' && props.caseId) await loadPageData();
});

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await nextTick();
  if (!props.caseId) return;
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadPageData();
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  resizeObserver?.disconnect();
  clearSpeedFieldCanvas();
  if (profileInstance && !profileInstance.isDisposed()) profileInstance.dispose();
  if (wakeInstance && !wakeInstance.isDisposed()) wakeInstance.dispose();
  profileInstance = null;
  wakeInstance = null;
});
</script>

<style scoped>
.speed-lab{position:relative;display:flex;min-height:100%;flex-direction:column;gap:16px;padding:18px 20px 22px;background:radial-gradient(circle at top left,rgba(22,119,255,.08),transparent 28%),linear-gradient(180deg,#f8fbff 0%,#f3f7fc 100%)}
.status-alert{margin:0}
.control-strip{display:grid;grid-template-columns:minmax(320px,1.8fr) minmax(220px,.9fr) auto;gap:16px}
.control-block{display:flex;min-width:0;flex-direction:column;gap:12px;border-radius:18px;border:1px solid rgba(148,163,184,.16);padding:16px 18px;background:rgba(255,255,255,.88);box-shadow:0 16px 30px rgba(15,23,42,.05)}
.control-label{font-size:.83rem;font-weight:600;letter-spacing:.04em;color:#5d6d88}
.toolbar-select{width:100%}
.control-block-actions{justify-content:space-between;min-width:116px}
.action-row{display:flex;align-items:center;gap:10px}
.workspace-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(360px,.95fr);gap:18px;align-items:stretch;flex:1;min-height:0}
.panel{position:relative;border-radius:22px;border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.9);box-shadow:0 22px 36px rgba(15,23,42,.06);overflow:hidden;min-height:0}
.map-panel,.side-panel{display:flex;flex-direction:column;padding:18px;min-height:0}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.panel-head h2{margin:0;font-size:1.1rem;font-weight:700;color:#15223b}
.panel-meta{display:flex;align-items:center;gap:10px;color:#70809b;font-size:.82rem}
.map-stage{position:relative;overflow:hidden;width:100%;flex:1;min-height:0;border-radius:18px;background:linear-gradient(180deg,rgba(248,250,252,.7),rgba(241,245,249,.9));cursor:crosshair}
.speed-field-canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity .18s ease}
.speed-field-canvas--visible{opacity:1}
.empty-state,.panel-overlay,.loading-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#29405f}
.panel-overlay,.loading-overlay{background:rgba(255,255,255,.72);z-index:8}
.panel-overlay--surface{border-radius:16px}
.map-marker{position:absolute;display:inline-flex;align-items:center;gap:5px;transform:translate(-50%,-50%);border:none;background:transparent;padding:0;cursor:pointer}
.map-marker-dot{width:11px;height:11px;border-radius:999px;border:2px solid rgba(255,255,255,.95);background:#0f172a;box-shadow:0 0 0 2px rgba(15,23,42,.18)}
.map-marker-label{font-size:.72rem;font-weight:600;color:rgba(27,47,74,.78);text-shadow:0 1px 0 rgba(255,255,255,.84);white-space:nowrap}
.map-marker--active .map-marker-dot{background:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.24)}
.query-marker{position:absolute;width:18px;height:18px;transform:translate(-50%,-50%);border-radius:999px;border:2px solid rgba(255,255,255,.96);box-shadow:0 0 0 2px rgba(239,68,68,.24);background:rgba(239,68,68,.2);pointer-events:none;z-index:5}
.query-marker::after{content:'';position:absolute;inset:50% auto auto 50%;width:6px;height:6px;transform:translate(-50%,-50%);border-radius:999px;background:#ef4444}
.map-footer{display:flex;flex-direction:column;gap:12px;margin-top:14px}
.legend-strip{display:flex;align-items:center;gap:12px;margin-top:14px}
.legend-caption{min-width:28px;font-size:.76rem;font-weight:700;color:#4d5b75}
.legend-bar{flex:1;height:14px;border-radius:999px}
.legend-labels{display:flex;min-width:220px;justify-content:space-between;gap:10px;color:#62718b;font-size:.75rem}
.point-strip{display:flex;flex-wrap:wrap;align-items:center;gap:10px;border-radius:16px;border:1px solid rgba(148,163,184,.16);padding:12px 14px;background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(241,245,249,.9))}
.point-strip-title{font-size:.82rem;font-weight:700;color:#15223b}
.point-chip{display:flex;min-width:110px;flex-direction:column;gap:4px;border-radius:12px;padding:9px 12px;background:rgba(255,255,255,.78);border:1px solid rgba(148,163,184,.18)}
.point-chip span{font-size:.72rem;color:#66758e}
.point-chip strong{font-size:.88rem;color:#122038}
.detail-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
.detail-chip{display:flex;min-height:74px;flex-direction:column;justify-content:space-between;gap:8px;border-radius:16px;border:1px solid rgba(148,163,184,.16);padding:14px 15px;background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(241,245,249,.9))}
.detail-chip span{font-size:.78rem;color:#66758e}
.detail-chip strong{font-size:1rem;font-weight:700;color:#122038;line-height:1.35}
.chart-stack{display:grid;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:16px;flex:1;min-height:0}
.chart-block{position:relative;display:flex;min-height:0;flex-direction:column;border-radius:18px;border:1px solid rgba(148,163,184,.16);background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,250,252,.92));padding:14px}
.chart-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.chart-head h3{margin:0;font-size:.95rem;font-weight:700;color:#15223b}
.chart-surface{flex:1;min-height:0;border-radius:14px;background:#fff}
.loading-overlay{backdrop-filter:blur(6px);z-index:20}
.loading-overlay p{margin:0}
@media (max-width:1180px){.control-strip,.workspace-grid{grid-template-columns:1fr}.workspace-grid{flex:none}.chart-stack{grid-template-rows:repeat(2,minmax(220px,1fr))}}
@media (max-width:768px){.speed-lab{padding:14px 14px 20px}.action-row{justify-content:flex-end}.detail-strip{grid-template-columns:1fr}.legend-strip{flex-direction:column;align-items:stretch}.legend-labels{min-width:0}.point-strip{align-items:stretch}.chart-stack{grid-template-rows:repeat(2,minmax(200px,1fr))}}
</style>
