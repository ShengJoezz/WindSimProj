<template>
  <div class="deck-viewer">
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
        <span class="label">点采样量</span>
        <el-slider
          v-model="pointBudget"
          :min="4000"
          :max="24000"
          :step="1000"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">轮廓层级</span>
        <el-slider
          v-model="contourBandCount"
          :min="3"
          :max="8"
          :step="1"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">流线数量</span>
        <el-slider
          v-model="streamlineBudget"
          :min="40"
          :max="280"
          :step="20"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">点半径 (PX)</span>
        <el-slider
          v-model="pointRadiusPx"
          :min="1"
          :max="6"
          :step="0.5"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">轮廓面</span>
        <el-switch v-model="showContours" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">采样点</span>
        <el-switch v-model="showPoints" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">流线叠加</span>
        <el-switch v-model="showStreamlines" @change="handleOptionChange" />
      </div>

      <div class="toolbar-item">
        <span class="label">重载</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="deckHost" class="deck-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">Deck 实验视图加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>引擎</span>
          <strong>deck.gl OrthographicView</strong>
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
          <span>图层</span>
          <strong>{{ layerSummary }}</strong>
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
        <strong>{{ rawPointCount }}</strong>
      </div>
      <div class="stat">
        <span>采样点数</span>
        <strong>{{ sampledPointCount }}</strong>
      </div>
      <div class="stat">
        <span>流线数量</span>
        <strong>{{ displayedLineCount }}</strong>
      </div>
      <div class="stat">
        <span>轮廓格距</span>
        <strong>{{ contourCellSizeLabel }}</strong>
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
import { COORDINATE_SYSTEM, Deck, OrthographicView } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { ContourLayer } from '@deck.gl/aggregation-layers';

import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const deckHost = ref(null);
const availableHeights = ref([]);
const selectedHeight = ref(null);
const pointBudget = ref(9000);
const contourBandCount = ref(4);
const streamlineBudget = ref(140);
const pointRadiusPx = ref(2.5);
const showContours = ref(true);
const showPoints = ref(false);
const showStreamlines = ref(true);
const loading = ref(false);
const loadingText = ref('正在读取 Deck 实验数据...');
const errorMessage = ref('');
const rawPointCount = ref(0);
const sampledPointCount = ref(0);
const displayedLineCount = ref(0);
const contourCellSize = ref(0);
const speedRange = ref({ min: 0, max: 1 });

let deckInstance = null;
let resizeObserver = null;
let rawSurfaceData = null;
let rawStreamlineData = null;
let scalarSamples = [];
let streamlineSamples = [];
let currentViewState = null;
let currentBounds = null;

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const vectorSourceLabel = computed(() => 'PointData.deckVectors <- CellData.U');

const layerSummary = computed(() => {
  const names = [];
  if (showContours.value) names.push('轮廓面');
  if (showPoints.value) names.push('采样点');
  if (showStreamlines.value) names.push('流线');
  return names.length ? names.join(' + ') : '无图层';
});

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

const contourCellSizeLabel = computed(() => (
  contourCellSize.value > 0 ? contourCellSize.value.toFixed(3) : '-'
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

function getJetColor(speed, alpha = 255) {
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
  return [
    Math.round(left[1][0] + ((right[1][0] - left[1][0]) * mix)),
    Math.round(left[1][1] + ((right[1][1] - left[1][1]) * mix)),
    Math.round(left[1][2] + ((right[1][2] - left[1][2]) * mix)),
    alpha,
  ];
}

function ensureCellSpeedMagnitude(dataSet) {
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

function ensurePointSpeedMagnitude(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const existing = pointData?.getArrayByName?.('speedMagnitude');
  if (existing) return normalizeRange(existing.getRange());

  const vectorArray = pointData?.getArrayByName?.('U');
  if (!vectorArray || !pointData) return { min: 0, max: 1 };

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
  pointData.addArray(magnitudeArray);
  if (pointData.setScalars) pointData.setScalars(magnitudeArray);
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

function ensureDeckPointVectors(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();
  const points = dataSet?.getPoints?.();
  if (!pointData || !cellData || !points) return { min: 0, max: 1 };

  let pointVectors = pointData.getArrayByName('deckVectors');
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
      name: 'deckVectors',
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

function extractBounds2D(dataSet) {
  const bounds = dataSet?.getBounds?.();
  const minX = Number(bounds?.[0] ?? -1);
  const maxX = Number(bounds?.[1] ?? 1);
  const minY = Number(bounds?.[2] ?? -1);
  const maxY = Number(bounds?.[3] ?? 1);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1e-6, maxX - minX),
    height: Math.max(1e-6, maxY - minY),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function buildScalarSamples(dataSet) {
  const points = dataSet?.getPoints?.()?.getData?.();
  const pointData = dataSet?.getPointData?.();
  const vectors = pointData?.getArrayByName?.('deckVectors')?.getData?.();
  const speeds = pointData?.getArrayByName?.('pointSpeedMagnitude')?.getData?.();
  if (!points?.length || !vectors?.length || !speeds?.length) return [];

  const totalPoints = Math.min(
    Number(dataSet?.getPoints?.()?.getNumberOfPoints?.() ?? 0),
    Math.floor(points.length / 3),
    Math.floor(vectors.length / 3),
    speeds.length,
  );
  rawPointCount.value = totalPoints;
  if (!totalPoints) return [];

  const threshold = Math.min(1, pointBudget.value / totalPoints);
  const samples = [];
  for (let pointId = 0; pointId < totalPoints; pointId += 1) {
    if (loadHash(pointId) > threshold) continue;
    const pointOffset = pointId * 3;
    const vectorOffset = pointId * 3;
    const speed = Number(speeds[pointId] ?? 0);
    samples.push({
      id: pointId,
      position: [Number(points[pointOffset] ?? 0), Number(points[pointOffset + 1] ?? 0)],
      speed,
      vx: Number(vectors[vectorOffset] ?? 0),
      vy: Number(vectors[vectorOffset + 1] ?? 0),
      color: getJetColor(speed, 160),
    });
  }

  sampledPointCount.value = samples.length;
  return samples;
}

function buildStreamlineSamples(dataSet, maxLines) {
  const lines = dataSet?.getLines?.()?.getData?.();
  const points = dataSet?.getPoints?.()?.getData?.();
  const speeds = dataSet?.getPointData?.()?.getArrayByName?.('speedMagnitude')?.getData?.();
  if (!lines?.length || !points?.length || !speeds?.length) return [];

  let totalLines = 0;
  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1 + count;
    totalLines += 1;
  }

  const keepEvery = Math.max(1, Math.ceil(totalLines / Math.max(1, maxLines)));
  const samples = [];
  let lineIndex = 0;

  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1;
    const ids = lines.slice(cursor, cursor + count);
    cursor += count;

    if (count < 2 || lineIndex % keepEvery !== 0) {
      lineIndex += 1;
      continue;
    }

    const path = [];
    let speedSum = 0;
    let sampledCount = 0;
    const stride = count > 120 ? 8 : 5;
    for (let index = 0; index < ids.length; index += stride) {
      const pointId = Number(ids[index]);
      const pointOffset = pointId * 3;
      path.push([Number(points[pointOffset] ?? 0), Number(points[pointOffset + 1] ?? 0)]);
      speedSum += Number(speeds[pointId] ?? 0);
      sampledCount += 1;
    }

    const lastId = Number(ids[ids.length - 1]);
    const lastPointOffset = lastId * 3;
    const lastPoint = [Number(points[lastPointOffset] ?? 0), Number(points[lastPointOffset + 1] ?? 0)];
    const tail = path[path.length - 1];
    if (!tail || tail[0] !== lastPoint[0] || tail[1] !== lastPoint[1]) {
      path.push(lastPoint);
      speedSum += Number(speeds[lastId] ?? 0);
      sampledCount += 1;
    }

    if (path.length >= 2) {
      const meanSpeed = sampledCount ? speedSum / sampledCount : 0;
      samples.push({
        id: `line-${lineIndex}`,
        path,
        meanSpeed,
        color: getJetColor(meanSpeed, 228),
      });
    }
    lineIndex += 1;
  }

  displayedLineCount.value = samples.length;
  return samples;
}

function computeContourCellSize(bounds) {
  const baseSpan = Math.max(bounds.width, bounds.height);
  return Math.max(baseSpan / 48, 0.03);
}

function buildContourDefinitions() {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const span = Math.max(1e-6, max - min);
  const bands = [];
  const count = contourBandCount.value;

  for (let index = 0; index < count; index += 1) {
    const from = min + ((span * index) / count);
    const to = min + ((span * (index + 1)) / count);
    const mid = (from + to) / 2;
    bands.push({
      threshold: [from, to],
      color: getJetColor(mid, 86),
      zIndex: index,
    });
  }

  for (let index = 1; index < count; index += 1) {
    const threshold = min + ((span * index) / count);
    bands.push({
      threshold,
      color: [255, 255, 255, 210],
      strokeWidth: 1.5,
      zIndex: count + index,
    });
  }

  return bands;
}

function computeFitViewState(bounds) {
  const width = Math.max(1, deckHost.value?.clientWidth || 1);
  const height = Math.max(1, deckHost.value?.clientHeight || 1);
  const zoom = Math.log2(Math.min((width * 0.86) / bounds.width, (height * 0.82) / bounds.height));
  return {
    target: [bounds.centerX, bounds.centerY, 0],
    zoom,
    minZoom: zoom - 4,
    maxZoom: zoom + 8,
  };
}

function buildLayers() {
  const layers = [];

  if (showContours.value && scalarSamples.length) {
    layers.push(new ContourLayer({
      id: 'deck-contours',
      data: scalarSamples,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      gpuAggregation: true,
      aggregation: 'MEAN',
      cellSize: contourCellSize.value,
      contours: buildContourDefinitions(),
      getPosition: (item) => item.position,
      getWeight: (item) => item.speed,
      pickable: true,
      zOffset: 0.002,
    }));
  }

  if (showPoints.value && scalarSamples.length) {
    layers.push(new ScatterplotLayer({
      id: 'deck-points',
      data: scalarSamples,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: (item) => item.position,
      getRadius: pointRadiusPx.value,
      radiusUnits: 'pixels',
      getFillColor: (item) => item.color,
      opacity: 0.36,
      stroked: false,
      pickable: true,
      parameters: { depthTest: false },
      updateTriggers: {
        getRadius: [pointRadiusPx.value],
      },
    }));
  }

  if (showStreamlines.value && streamlineSamples.length) {
    layers.push(new PathLayer({
      id: 'deck-streamlines',
      data: streamlineSamples,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPath: (item) => item.path,
      getColor: (item) => item.color,
      getWidth: 2.25,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      widthMaxPixels: 4,
      jointRounded: true,
      capRounded: true,
      pickable: true,
      parameters: { depthTest: false },
    }));
  }

  return layers;
}

function refreshDeck(resetView = false) {
  if (!deckInstance) return;
  const width = Math.max(1, deckHost.value?.clientWidth || 1);
  const height = Math.max(1, deckHost.value?.clientHeight || 1);
  if (resetView || !currentViewState) {
    currentViewState = currentBounds ? computeFitViewState(currentBounds) : currentViewState;
  }

  deckInstance.setProps({
    width,
    height,
    viewState: currentViewState,
    layers: buildLayers(),
  });
}

function handleOptionChange() {
  if (!rawSurfaceData || !rawStreamlineData) return;
  scalarSamples = buildScalarSamples(rawSurfaceData);
  streamlineSamples = buildStreamlineSamples(rawStreamlineData, streamlineBudget.value);
  refreshDeck(false);
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于 Deck 实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function loadScene() {
  if (!selectedHeight.value || !deckInstance) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的 Deck 切片数据...`;
  errorMessage.value = '';

  try {
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    const streamlineUrl = `/uploads/${props.caseId}/run/VTK/processed/internal_${selectedHeight.value}m_web.vtp`;

    rawSurfaceData = await loadPolyData(surfaceUrl);
    rawStreamlineData = await loadPolyData(streamlineUrl);

    ensureCellSpeedMagnitude(rawSurfaceData);
    speedRange.value = ensureDeckPointVectors(rawSurfaceData);
    ensurePointSpeedMagnitude(rawStreamlineData);

    currentBounds = extractBounds2D(rawSurfaceData);
    contourCellSize.value = computeContourCellSize(currentBounds);
    scalarSamples = buildScalarSamples(rawSurfaceData);
    streamlineSamples = buildStreamlineSamples(rawStreamlineData, streamlineBudget.value);
    currentViewState = computeFitViewState(currentBounds);
    refreshDeck(true);
  } catch (error) {
    console.error('Deck 实验页加载失败:', error);
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initDeck() {
  deckInstance = new Deck({
    parent: deckHost.value,
    views: new OrthographicView({ id: 'slice-view', flipY: false }),
    controller: true,
    parameters: {
      clearColor: [6, 17, 27, 255],
      depthTest: false,
      blend: true,
    },
    getTooltip: ({ object, layer }) => {
      if (!object || !layer) return null;
      if (layer.id === 'deck-streamlines') {
        return {
          html: `<div><strong>流线</strong><br/>平均速度: ${Number(object.meanSpeed ?? 0).toFixed(2)} m/s</div>`,
        };
      }
      if (layer.id === 'deck-points') {
        return {
          html: `<div><strong>采样点</strong><br/>速度: ${Number(object.speed ?? 0).toFixed(2)} m/s</div>`,
        };
      }
      if (layer.id === 'deck-contours') {
        const threshold = object?.contour?.threshold;
        const label = Array.isArray(threshold)
          ? `${Number(threshold[0]).toFixed(2)} ~ ${Number(threshold[1]).toFixed(2)}`
          : Number(threshold ?? 0).toFixed(2);
        return {
          html: `<div><strong>轮廓</strong><br/>阈值: ${label} m/s</div>`,
        };
      }
      return null;
    },
    onViewStateChange: ({ viewState }) => {
      currentViewState = viewState;
    },
    layers: [],
  });

  if (typeof ResizeObserver !== 'undefined' && deckHost.value) {
    resizeObserver = new ResizeObserver(() => refreshDeck(false));
    resizeObserver.observe(deckHost.value);
  }
}

onMounted(async () => {
  await nextTick();
  if (!deckHost.value) return;
  initDeck();

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化 Deck 实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
  deckInstance?.finalize?.();
  deckInstance = null;
  resizeObserver = null;
  rawSurfaceData = null;
  rawStreamlineData = null;
  scalarSamples = [];
  streamlineSamples = [];
  currentViewState = null;
  currentBounds = null;
});
</script>

<style scoped>
.deck-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 26%),
    linear-gradient(180deg, #04101a 0%, #091624 100%);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
}

.deck-host {
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
  background: rgba(248, 250, 252, 0.95);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
  pointer-events: none;
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

@media (max-width: 1360px) {
  .toolbar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .toolbar,
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-item--wide {
    grid-column: span 2;
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
    min-height: 640px;
  }
}
</style>
