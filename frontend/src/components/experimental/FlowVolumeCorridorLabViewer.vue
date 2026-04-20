<template>
  <div class="corridor-viewer">
    <div class="toolbar">
      <div class="toolbar-item toolbar-item--wide">
        <span class="label">高度层</span>
        <el-select
          v-model="selectedHeights"
          class="select"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="4"
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
        <span class="label">体渲染</span>
        <el-radio-group v-model="renderStyle" size="small" @change="handleOptionChange">
          <el-radio-button value="mip">投影</el-radio-button>
          <el-radio-button value="iso">等值体</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">XY 网格</span>
        <el-slider
          v-model="gridCols"
          :min="120"
          :max="240"
          :step="20"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">体积对比</span>
        <el-slider
          v-model="contrast"
          :min="0.7"
          :max="2.4"
          :step="0.05"
          show-input
          input-size="small"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">体积浓度</span>
        <el-slider
          v-model="opacityBoost"
          :min="0.35"
          :max="1.45"
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
          :max="0.92"
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
          :max="4"
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
        <span class="label">真实流线</span>
        <el-switch v-model="showStreamlines" @change="loadScene" />
      </div>

      <div class="toolbar-item">
        <span class="label">自动旋转</span>
        <el-switch v-model="autoRotate" @change="handleAutoRotateChange" />
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">每层流线预算</span>
        <el-slider
          v-model="streamlineBudget"
          :min="4"
          :max="36"
          :step="2"
          show-input
          input-size="small"
          :disabled="!showStreamlines"
          @change="handleOptionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">刷新</span>
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
        <div class="overlay-title">体积风廊实验加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>模式</span>
          <strong>{{ renderStyleLabel }}</strong>
        </div>
        <div class="chip">
          <span>数据链</span>
          <strong>真实 slice.vtp -> 规则重采样 -> 3D texture -> ray-marching</strong>
        </div>
        <div class="chip">
          <span>高度层</span>
          <strong>{{ selectedHeightsLabel }}</strong>
        </div>
        <div class="chip">
          <span>说明</span>
          <strong>不是 PNG，不是假 3D，而是真实切片重建的浏览器体渲染</strong>
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
        <span>体素网格</span>
        <strong>{{ volumeGridLabel }}</strong>
      </div>
      <div class="stat">
        <span>切片层数</span>
        <strong>{{ selectedHeights.length }}</strong>
      </div>
      <div class="stat">
        <span>流线数量</span>
        <strong>{{ displayedLineCount }}</strong>
      </div>
      <div class="stat">
        <span>速度范围</span>
        <strong>{{ speedRangeLabel }}</strong>
      </div>
      <div class="stat">
        <span>有效覆盖</span>
        <strong>{{ coverageLabel }}</strong>
      </div>
      <div class="stat">
        <span>体积风格</span>
        <strong>{{ renderStyle === 'mip' ? '透视投影' : '等值表皮' }}</strong>
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
import { VolumeRenderShader1 } from 'three/examples/jsm/shaders/VolumeShader.js';
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
const renderStyle = ref('mip');
const gridCols = ref(180);
const contrast = ref(1.2);
const opacityBoost = ref(0.92);
const isoThreshold = ref(0.46);
const verticalExaggeration = ref(1.8);
const showTerrain = ref(true);
const showStreamlines = ref(true);
const autoRotate = ref(true);
const streamlineBudget = ref(16);
const loading = ref(false);
const loadingText = ref('正在重建体积风场...');
const errorMessage = ref('');
const speedRange = ref({ min: 0, max: 1 });
const displayedLineCount = ref(0);
const regularGridMeta = ref({ cols: 0, rows: 0, layers: 0, coverage: 0 });

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let orbitControls = null;
let resizeObserver = null;
let animationFrameId = null;
let sceneRoot = null;
let lastFrameTime = performance.now();
let terrainData = null;
let volumeTexture = null;
let colormapTexture = null;
let lineMaterials = [];

const sliceDataMap = new Map();
const streamlineDataMap = new Map();

const legendBarStyle = computed(() => ({
  background: buildCssGradient(SIMULATION_JET_STOPS, '90deg'),
}));

const renderStyleLabel = computed(() => (
  renderStyle.value === 'iso' ? 'ISO 等值体' : 'MIP 体积投影'
));

const selectedHeightsLabel = computed(() => (
  selectedHeights.value.length ? selectedHeights.value.map((value) => `${value}m`).join(', ') : '-'
));

const volumeGridLabel = computed(() => {
  const { cols, rows, layers } = regularGridMeta.value;
  if (!cols || !rows || !layers) return '-';
  return `${cols} x ${rows} x ${layers}`;
});

const coverageLabel = computed(() => `${(Number(regularGridMeta.value.coverage ?? 0) * 100).toFixed(1)}%`);

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
  const maxRaw = Number(range?.[1] ?? (min + 1));
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
  lineMaterials = [];
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

function ensurePointSpeedMagnitude(dataSet, vectorName = 'U') {
  const pointData = dataSet?.getPointData?.();
  const pointVectors = pointData?.getArrayByName?.('pointSpeedMagnitude')
    ? pointData?.getArrayByName?.(vectorName)
    : pointData?.getArrayByName?.(vectorName);
  const existing = pointData?.getArrayByName?.('pointSpeedMagnitude');
  if (existing) return normalizeRange(existing.getRange());
  if (!pointData || !pointVectors) return { min: 0, max: 1 };

  const values = pointVectors.getData();
  const tupleCount = Number(pointVectors.getNumberOfTuples?.() ?? 0);
  const compCount = Number(pointVectors.getNumberOfComponents?.() ?? 3);
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
    name: 'pointSpeedMagnitude',
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

function ensureGridPointVectors(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();
  const points = dataSet?.getPoints?.();
  if (!pointData || !points) return { vectorName: null, range: { min: 0, max: 1 } };

  let vectorName = 'U';
  let pointVectors = pointData.getArrayByName(vectorName);

  if (!pointVectors) {
    const cached = pointData.getArrayByName('gridVectors');
    if (cached) {
      pointVectors = cached;
      vectorName = 'gridVectors';
    }
  }

  if (!pointVectors) {
    const cellVectors = cellData?.getArrayByName?.('U');
    const pointTotal = Number(points.getNumberOfPoints?.() ?? 0);
    if (!cellVectors || !pointTotal) return { vectorName: null, range: { min: 0, max: 1 } };

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
      name: 'gridVectors',
      values: pointSums,
      numberOfComponents: 3,
    });
    pointData.addArray(pointVectors);
    if (pointData.setVectors) pointData.setVectors(pointVectors);
    vectorName = 'gridVectors';
  }

  const range = ensurePointSpeedMagnitude(dataSet, vectorName);
  return { vectorName, range };
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

function buildTriangleField(dataSet, vectorName) {
  const pointsArray = dataSet?.getPoints?.()?.getData?.();
  const pointCount = Number(dataSet?.getPoints?.()?.getNumberOfPoints?.() ?? 0);
  const vectorArray = dataSet?.getPointData?.()?.getArrayByName?.(vectorName);
  const vectors = vectorArray?.getData?.();
  const polys = dataSet?.getPolys?.()?.getData?.();
  if (!pointsArray?.length || !vectors?.length || !polys?.length || !pointCount) {
    throw new Error('切片缺少用于体积重建的点或面数据。');
  }

  const bounds = extractBounds2D(dataSet);
  const triangles = [];

  for (let cursor = 0; cursor < polys.length;) {
    const count = Number(polys[cursor++] ?? 0);
    if (count < 3) {
      cursor += count;
      continue;
    }

    const ids = [];
    for (let index = 0; index < count; index += 1) ids.push(Number(polys[cursor + index] ?? -1));
    cursor += count;

    for (let fan = 1; fan < count - 1; fan += 1) {
      const ia = ids[0];
      const ib = ids[fan];
      const ic = ids[fan + 1];
      if (ia < 0 || ib < 0 || ic < 0) continue;

      const aOffset = ia * 3;
      const bOffset = ib * 3;
      const cOffset = ic * 3;
      const ax = Number(pointsArray[aOffset] ?? 0);
      const ay = Number(pointsArray[aOffset + 1] ?? 0);
      const bx = Number(pointsArray[bOffset] ?? 0);
      const by = Number(pointsArray[bOffset + 1] ?? 0);
      const cx = Number(pointsArray[cOffset] ?? 0);
      const cy = Number(pointsArray[cOffset + 1] ?? 0);
      const denominator = ((by - cy) * (ax - cx)) + ((cx - bx) * (ay - cy));
      if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) continue;

      triangles.push({
        ax,
        ay,
        bx,
        by,
        cx,
        cy,
        ux0: Number(vectors[aOffset] ?? 0),
        uy0: Number(vectors[aOffset + 1] ?? 0),
        ux1: Number(vectors[bOffset] ?? 0),
        uy1: Number(vectors[bOffset + 1] ?? 0),
        ux2: Number(vectors[cOffset] ?? 0),
        uy2: Number(vectors[cOffset + 1] ?? 0),
        minX: Math.min(ax, bx, cx),
        maxX: Math.max(ax, bx, cx),
        minY: Math.min(ay, by, cy),
        maxY: Math.max(ay, by, cy),
        denominator,
      });
    }
  }

  if (!triangles.length) throw new Error('切片面没有可用于插值的三角单元。');

  const aspect = bounds.width / bounds.height;
  const baseBins = clamp(Math.round(Math.sqrt(triangles.length / 4)), 24, 84);
  const binsX = clamp(Math.round(Math.sqrt(baseBins * baseBins * aspect)), 24, 96);
  const binsY = clamp(Math.round(binsX / Math.max(aspect, 1e-6)), 24, 96);
  const cellWidth = bounds.width / binsX;
  const cellHeight = bounds.height / binsY;
  const buckets = Array.from({ length: binsX * binsY }, () => []);

  triangles.forEach((triangle, triangleIndex) => {
    const startX = clamp(Math.floor((triangle.minX - bounds.minX) / cellWidth), 0, binsX - 1);
    const endX = clamp(Math.floor((triangle.maxX - bounds.minX) / cellWidth), 0, binsX - 1);
    const startY = clamp(Math.floor((triangle.minY - bounds.minY) / cellHeight), 0, binsY - 1);
    const endY = clamp(Math.floor((triangle.maxY - bounds.minY) / cellHeight), 0, binsY - 1);

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        buckets[(y * binsX) + x].push(triangleIndex);
      }
    }
  });

  return { bounds, triangles, buckets, binsX, binsY, cellWidth, cellHeight };
}

function findContainingTriangle(field, x, y) {
  const { bounds, buckets, binsX, binsY, cellWidth, cellHeight, triangles } = field;
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return null;

  const baseX = clamp(Math.floor((x - bounds.minX) / cellWidth), 0, binsX - 1);
  const baseY = clamp(Math.floor((y - bounds.minY) / cellHeight), 0, binsY - 1);

  for (let radius = 0; radius <= 1; radius += 1) {
    const minX = clamp(baseX - radius, 0, binsX - 1);
    const maxX = clamp(baseX + radius, 0, binsX - 1);
    const minY = clamp(baseY - radius, 0, binsY - 1);
    const maxY = clamp(baseY + radius, 0, binsY - 1);

    for (let bucketY = minY; bucketY <= maxY; bucketY += 1) {
      for (let bucketX = minX; bucketX <= maxX; bucketX += 1) {
        const candidates = buckets[(bucketY * binsX) + bucketX];
        for (let index = 0; index < candidates.length; index += 1) {
          const triangle = triangles[candidates[index]];
          if (
            x < triangle.minX - 1e-9 || x > triangle.maxX + 1e-9 ||
            y < triangle.minY - 1e-9 || y > triangle.maxY + 1e-9
          ) {
            continue;
          }

          const w0 = (((triangle.by - triangle.cy) * (x - triangle.cx)) + ((triangle.cx - triangle.bx) * (y - triangle.cy))) / triangle.denominator;
          const w1 = (((triangle.cy - triangle.ay) * (x - triangle.cx)) + ((triangle.ax - triangle.cx) * (y - triangle.cy))) / triangle.denominator;
          const w2 = 1 - w0 - w1;

          if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) {
            return { triangle, w0, w1, w2 };
          }
        }
      }
    }
  }

  return null;
}

function sampleTriangleField(field, x, y) {
  const hit = findContainingTriangle(field, x, y);
  if (!hit) return null;

  const { triangle, w0, w1, w2 } = hit;
  const vx = (triangle.ux0 * w0) + (triangle.ux1 * w1) + (triangle.ux2 * w2);
  const vy = (triangle.uy0 * w0) + (triangle.uy1 * w1) + (triangle.uy2 * w2);
  const speed = Math.sqrt((vx * vx) + (vy * vy));
  return { vx, vy, speed };
}

function buildRegularGrid(field, targetCols) {
  const cols = clamp(Number(targetCols || 180), 120, 240);
  const rows = clamp(Math.round((field.bounds.height / field.bounds.width) * cols), 96, 260);
  const total = cols * rows;
  const vx = new Float32Array(total);
  const vy = new Float32Array(total);
  const speed = new Float32Array(total);
  const valid = new Uint8Array(total);

  let validCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < rows; row += 1) {
    const y = field.bounds.minY + ((row / Math.max(rows - 1, 1)) * field.bounds.height);
    for (let col = 0; col < cols; col += 1) {
      const x = field.bounds.minX + ((col / Math.max(cols - 1, 1)) * field.bounds.width);
      const index = (row * cols) + col;
      const sample = sampleTriangleField(field, x, y);
      if (!sample) continue;

      vx[index] = sample.vx;
      vy[index] = sample.vy;
      speed[index] = sample.speed;
      valid[index] = 1;
      validCount += 1;
      if (sample.speed < min) min = sample.speed;
      if (sample.speed > max) max = sample.speed;
    }
  }

  return {
    bounds: field.bounds,
    cols,
    rows,
    vx,
    vy,
    speed,
    valid,
    coverage: validCount / Math.max(1, total),
    minSpeed: Number.isFinite(min) ? min : 0,
    maxSpeed: Number.isFinite(max) ? max : 1,
  };
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

function getJetColor(speed) {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const span = Math.max(1e-6, max - min);
  const [r, g, b] = interpolateJetRgb((speed - min) / span);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function buildColormapTexture() {
  const data = new Uint8Array(256 * 4);
  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    const [r, g, b] = interpolateJetRgb(t);
    const alphaUnit = Math.pow(clamp((t - 0.06) / 0.94, 0, 1), 1.15) * opacityBoost.value;
    const offset = index * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = Math.round(clamp(alphaUnit, 0, 1) * 255);
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

function createTerrainWireframe(polyData) {
  const geometry = buildTriangulatedGeometry(polyData);
  if (!geometry) return null;

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xf2f7ff,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    }),
  );
}

function extractDisplayTrajectories(polyData, maxLines, pointStride = 9) {
  const lines = polyData?.getLines?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  const pointSpeeds = polyData?.getPointData?.()?.getArrayByName?.('speedMagnitude')?.getData?.()
    || polyData?.getPointData?.()?.getArrayByName?.('pointSpeedMagnitude')?.getData?.();
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
    let pathLength = 0;
    let speedSum = 0;

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
        pathLength += distance3(trajectoryPoints[trajectoryPoints.length - 1], point);
      }
      trajectoryPoints.push(point);
      speedSum += speed;
    });

    if (pathLength > 1e-6) {
      trajectories.push({
        points: trajectoryPoints,
        meanSpeed: speedSum / trajectoryPoints.length,
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
    return 0.45 + (0.35 * Math.pow(Math.max(0, bell), 0.9));
  });

  const width = Math.max(1, canvasHost.value?.clientWidth ?? 1);
  const height = Math.max(1, canvasHost.value?.clientHeight ?? 1);
  const headColor = getJetColor(trajectory.meanSpeed);
  const tailColor = headColor.clone().multiplyScalar(0.35);
  const material = new MeshLineMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0.72,
    lineWidth: 2.6,
    color: headColor,
    gradient: [tailColor, headColor],
    useGradient: 1,
    resolution: new THREE.Vector2(width, height),
    sizeAttenuation: 0,
    dashArray: 1.08,
    dashRatio: 0.58,
    dashOffset: 0,
    blending: THREE.AdditiveBlending,
  });

  lineMaterials.push(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function syncRendererSize() {
  if (!threeRenderer || !threeCamera || !canvasHost.value) return;
  const width = Math.max(1, canvasHost.value.clientWidth);
  const height = Math.max(1, canvasHost.value.clientHeight);
  threeRenderer.setSize(width, height, false);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();

  lineMaterials.forEach((material) => {
    material.resolution?.set?.(width, height);
  });
}

function fitCameraToScene(root) {
  if (!root || !threeCamera || !orbitControls) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1e-3);
  const distance = maxSize * 1.65;

  orbitControls.target.copy(center);
  threeCamera.position.set(center.x + distance, center.y - (distance * 1.1), center.z + (distance * 0.7));
  threeCamera.near = Math.max(0.001, distance / 200);
  threeCamera.far = Math.max(200, distance * 30);
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

  lineMaterials.forEach((material, index) => {
    material.dashOffset -= dt * (0.08 + (index % 7) * 0.01);
  });

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

function computeSliceZ(polyData) {
  const bounds = polyData?.getBounds?.();
  return Number((((bounds?.[4] ?? 0) + (bounds?.[5] ?? 0)) / 2) || 0);
}

function createVolumeMesh(volumeData) {
  const {
    textureData,
    cols,
    rows,
    layers,
    bounds,
    minZ,
    maxZ,
  } = volumeData;

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
  uniforms.u_renderthreshold.value = clamp(isoThreshold.value, 0.01, 0.99);

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
  const scaleX = bounds.width / cols;
  const scaleY = bounds.height / rows;
  const zSpan = Math.max(0.02, maxZ - minZ);
  const scaleZ = zSpan / layers;
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.position.set(
    bounds.minX + (scaleX * 0.5),
    bounds.minY + (scaleY * 0.5),
    minZ + (scaleZ * 0.5),
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

function buildVolumeData(sliceEntries) {
  const ranges = sliceEntries.map((entry) => ({
    min: entry.grid.minSpeed,
    max: entry.grid.maxSpeed,
  }));
  const mergedRange = mergeRanges(...ranges);
  speedRange.value = mergedRange;

  const firstGrid = sliceEntries[0]?.grid;
  if (!firstGrid) throw new Error('没有可用于体积重建的规则网格。');

  const cols = firstGrid.cols;
  const rows = firstGrid.rows;
  const layers = sliceEntries.length;
  const textureData = new Uint8Array(cols * rows * layers);

  sliceEntries.forEach((entry, layerIndex) => {
    const { grid } = entry;
    for (let index = 0; index < cols * rows; index += 1) {
      if (!grid.valid[index]) continue;
      const normalized = clamp((grid.speed[index] - mergedRange.min) / Math.max(1e-6, mergedRange.max - mergedRange.min), 0, 1);
      const shaped = Math.pow(normalized, contrast.value);
      textureData[(layerIndex * cols * rows) + index] = Math.round(shaped * 255);
    }
  });

  const zValues = sliceEntries.map((entry) => entry.z);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  regularGridMeta.value = {
    cols,
    rows,
    layers,
    coverage: sliceEntries.reduce((sum, entry) => sum + entry.grid.coverage, 0) / Math.max(1, layers),
  };

  return {
    textureData,
    cols,
    rows,
    layers,
    bounds: firstGrid.bounds,
    minZ,
    maxZ,
  };
}

function rebuildScene(resetCamera = true) {
  if (!threeScene || !selectedHeights.value.length) return;
  clearSceneRoot();
  displayedLineCount.value = 0;

  const heights = [...selectedHeights.value].sort((a, b) => a - b);
  const sliceEntries = heights
    .map((height) => {
      const sliceData = sliceDataMap.get(height);
      if (!sliceData) return null;
      const { vectorName } = ensureGridPointVectors(sliceData);
      if (!vectorName) return null;
      const field = buildTriangleField(sliceData, vectorName);
      return {
        height,
        z: computeSliceZ(sliceData),
        grid: buildRegularGrid(field, gridCols.value),
      };
    })
    .filter(Boolean);

  if (!sliceEntries.length) throw new Error('体积风场缺少可用切片层。');

  const root = new THREE.Group();
  const volume = createVolumeMesh(buildVolumeData(sliceEntries));
  root.add(volume);

  if (showTerrain.value && terrainData) {
    const terrain = createTerrainWireframe(terrainData);
    if (terrain) root.add(terrain);
  }

  if (showStreamlines.value) {
    heights.forEach((height) => {
      const polyData = streamlineDataMap.get(height);
      if (!polyData) return;
      ensurePointSpeedMagnitude(polyData, 'U');
      const trajectories = extractDisplayTrajectories(polyData, streamlineBudget.value, 8);
      if (!trajectories.length) return;
      const group = new THREE.Group();
      trajectories.forEach((trajectory) => group.add(createLineMesh(trajectory)));
      displayedLineCount.value += trajectories.length;
      root.add(group);
    });
  }

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.scale.z = verticalExaggeration.value;
  root.position.z = center.z * (1 - verticalExaggeration.value);

  sceneRoot = root;
  threeScene.add(root);
  syncRendererSize();
  if (resetCamera) fitCameraToScene(root);
  startAnimation();
  renderFrame();
}

function handleOptionChange() {
  try {
    rebuildScene(false);
  } catch (error) {
    console.error('体积风廊重建失败:', error);
    errorMessage.value = error?.message || '体积风场重建失败';
    ElMessage.error(errorMessage.value);
  }
}

function handleAutoRotateChange() {
  if (orbitControls) orbitControls.autoRotate = Boolean(autoRotate.value);
  renderFrame();
}

function sampleDefaultHeights(heights) {
  return [...heights];
}

function sampleDisplayHeights(heights, targetCount = 4) {
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
  if (!heights.length) throw new Error('当前工况没有可用于体积风廊实验的切片文件。');
  if (!selectedHeights.value.length) selectedHeights.value = sampleDefaultHeights(heights);
}

async function loadScene() {
  if (!selectedHeights.value.length || !threeScene) return;
  loading.value = true;
  loadingText.value = '正在重建体积风场...';
  errorMessage.value = '';

  try {
    if (!terrainData) {
      terrainData = await loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/bot.vtp`);
    }

    const heights = [...selectedHeights.value].sort((a, b) => a - b);
    const missingSliceHeights = heights.filter((height) => !sliceDataMap.has(height));
    await Promise.all(missingSliceHeights.map(async (height) => {
      const sliceData = await loadPolyData(`/uploads/${props.caseId}/run/postProcessing/Data/${height}.vtp`);
      sliceDataMap.set(height, sliceData);
    }));

    const streamlineHeights = showStreamlines.value ? sampleDisplayHeights(heights, 4) : [];
    for (const height of streamlineHeights) {
      if (streamlineDataMap.has(height)) continue;
      try {
        const streamlineData = await loadPolyData(`/uploads/${props.caseId}/run/VTK/processed/internal_${height}m_web.vtp`);
        streamlineDataMap.set(height, streamlineData);
      } catch (streamlineError) {
        console.warn(`流线层 ${height}m 读取失败，已跳过:`, streamlineError);
      }
    }

    rebuildScene(true);
  } catch (error) {
    console.error('体积风廊实验加载失败:', error);
    errorMessage.value = error?.message || '体积风场读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initThreeScene() {
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x040912);
  threeScene.fog = new THREE.Fog(0x040912, 10, 30);

  const width = Math.max(1, canvasHost.value?.clientWidth ?? 1);
  const height = Math.max(1, canvasHost.value?.clientHeight ?? 1);
  threeCamera = new THREE.PerspectiveCamera(40, width / height, 0.001, 200);

  threeRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!threeRenderer.capabilities.isWebGL2) {
    throw new Error('当前浏览器不支持 WebGL2，无法进行 3D texture 体渲染。');
  }

  threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.1;
  threeRenderer.setClearColor(0x040912, 1);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  threeRenderer.setSize(width, height, false);
  canvasHost.value?.appendChild(threeRenderer.domElement);

  orbitControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.autoRotate = Boolean(autoRotate.value);
  orbitControls.autoRotateSpeed = 0.65;
  orbitControls.target.set(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xdce8ff, 0.75);
  const key = new THREE.DirectionalLight(0xf4fbff, 1.2);
  key.position.set(5, -6, 9);
  const rim = new THREE.DirectionalLight(0x6cbfff, 0.5);
  rim.position.set(-6, 5, 4);
  threeScene.add(ambient, key, rim);

  resizeObserver = new ResizeObserver(() => {
    syncRendererSize();
    renderFrame();
  });
  resizeObserver.observe(canvasHost.value);
}

onMounted(async () => {
  try {
    await nextTick();
    initThreeScene();
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    console.error('体积风廊初始化失败:', error);
    errorMessage.value = error?.message || '体积风廊初始化失败';
    ElMessage.error(errorMessage.value);
  }
});

onBeforeUnmount(() => {
  stopAnimation();
  resizeObserver?.disconnect?.();
  orbitControls?.dispose?.();
  clearSceneRoot();
  if (threeRenderer?.domElement?.parentNode) {
    threeRenderer.domElement.parentNode.removeChild(threeRenderer.domElement);
  }
  threeRenderer?.dispose?.();
  threeRenderer = null;
  threeScene = null;
  threeCamera = null;
  orbitControls = null;
});
</script>

<style scoped>
.corridor-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(7, 18, 33, 0.96), rgba(4, 10, 21, 0.92));
  border: 1px solid rgba(121, 164, 222, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.toolbar-item--wide {
  min-width: 0;
}

.label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(198, 220, 255, 0.78);
}

.select {
  width: 100%;
}

.viewer-shell {
  position: relative;
  min-height: 680px;
  height: clamp(540px, 72vh, 820px);
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(126, 170, 232, 0.18);
  background:
    radial-gradient(circle at 18% 22%, rgba(17, 71, 131, 0.34), transparent 28%),
    radial-gradient(circle at 82% 18%, rgba(43, 116, 200, 0.22), transparent 30%),
    radial-gradient(circle at 50% 110%, rgba(0, 200, 255, 0.08), transparent 34%),
    linear-gradient(180deg, #06111f 0%, #02060f 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 22px 54px rgba(2, 8, 18, 0.35);
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
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(2, 6, 12, 0.72);
  z-index: 3;
  color: #f8fbff;
}

.overlay--error {
  background: rgba(22, 8, 12, 0.78);
}

.overlay-title {
  font-size: 18px;
  font-weight: 700;
}

.overlay-text {
  max-width: 560px;
  text-align: center;
  color: rgba(225, 237, 255, 0.86);
}

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid rgba(196, 220, 255, 0.18);
  border-top-color: rgba(108, 196, 255, 0.95);
  animation: spin 1s linear infinite;
}

.chip-row {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  z-index: 2;
  pointer-events: none;
}

.chip {
  min-width: 0;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(5, 13, 25, 0.66);
  border: 1px solid rgba(148, 194, 255, 0.18);
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.18);
}

.chip span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(188, 215, 255, 0.68);
}

.chip strong {
  display: block;
  color: #f6fbff;
  font-size: 13px;
  line-height: 1.45;
}

.legend {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: min(560px, calc(100% - 36px));
  padding: 14px 16px 12px;
  border-radius: 18px;
  background: rgba(5, 13, 25, 0.72);
  border: 1px solid rgba(148, 194, 255, 0.18);
  backdrop-filter: blur(14px);
  z-index: 2;
}

.legend-top,
.legend-ticks {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: rgba(219, 233, 255, 0.84);
}

.legend-bar {
  height: 12px;
  margin: 10px 0 8px;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat {
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8, 18, 31, 0.94), rgba(4, 10, 20, 0.9));
  border: 1px solid rgba(124, 170, 232, 0.18);
}

.stat span {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(189, 212, 246, 0.72);
}

.stat strong {
  display: block;
  color: #f5fbff;
  font-size: 15px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 920px) {
  .viewer-shell,
  .canvas-host {
    min-height: 560px;
  }

  .chip-row {
    top: 14px;
    left: 14px;
    right: 14px;
  }

  .legend {
    width: calc(100% - 28px);
    bottom: 14px;
  }
}

@media (max-width: 640px) {
  .toolbar {
    grid-template-columns: 1fr;
  }

  .viewer-shell,
  .canvas-host {
    min-height: 500px;
  }
}
</style>
