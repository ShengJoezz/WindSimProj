<template>
  <div class="grid-lab-viewer">
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
        <span class="label">规则网格列数</span>
        <el-slider
          v-model="gridResolution"
          :min="120"
          :max="320"
          :step="20"
          show-input
          input-size="small"
          @change="handleGridResolutionChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">粒子数量</span>
        <el-slider
          v-model="particleCount"
          :min="600"
          :max="4200"
          :step="200"
          show-input
          input-size="small"
          @change="handleParticleCountChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">粒子速度</span>
        <el-slider
          v-model="flowSpeed"
          :min="0.4"
          :max="3"
          :step="0.1"
          show-input
          input-size="small"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">尾迹衰减</span>
        <el-slider
          v-model="trailFade"
          :min="0.03"
          :max="0.22"
          :step="0.01"
          show-input
          input-size="small"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">等值线级数</span>
        <el-slider
          v-model="contourLevels"
          :min="4"
          :max="10"
          :step="1"
          show-input
          input-size="small"
          @change="redrawStaticLayers"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">速度底图</span>
        <el-switch v-model="showBackdrop" @change="redrawStaticLayers" />
      </div>

      <div class="toolbar-item">
        <span class="label">等值线</span>
        <el-switch v-model="showContours" @change="redrawStaticLayers" />
      </div>

      <div class="toolbar-item">
        <span class="label">粒子随流</span>
        <el-switch v-model="showParticles" @change="handleParticleToggle" />
      </div>

      <div class="toolbar-item">
        <span class="label">重载</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>
    </div>

    <div ref="viewerShell" class="viewer-shell">
      <canvas ref="backdropCanvas" class="layer-canvas"></canvas>
      <canvas ref="contourCanvas" class="layer-canvas"></canvas>
      <canvas ref="particleCanvas" class="layer-canvas"></canvas>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">规则网格实验视图加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>链路</span>
          <strong>真实切片 -&gt; 规则网格 -&gt; Canvas 粒子</strong>
        </div>
        <div class="chip">
          <span>切片文件</span>
          <strong>{{ surfaceFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>插值方法</span>
          <strong>Barycentric + Bilinear</strong>
        </div>
        <div class="chip">
          <span>显示图层</span>
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
        <span>三角单元</span>
        <strong>{{ rawTriangleCount }}</strong>
      </div>
      <div class="stat">
        <span>规则网格</span>
        <strong>{{ gridShapeLabel }}</strong>
      </div>
      <div class="stat">
        <span>有效覆盖</span>
        <strong>{{ coverageLabel }}</strong>
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
import { contours as createContours } from 'd3-contour';

import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';

import { SIMULATION_JET_STOPS, buildColorLookupTable, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const viewerShell = ref(null);
const backdropCanvas = ref(null);
const contourCanvas = ref(null);
const particleCanvas = ref(null);

const availableHeights = ref([]);
const selectedHeight = ref(null);
const gridResolution = ref(220);
const particleCount = ref(2200);
const flowSpeed = ref(1.4);
const trailFade = ref(0.08);
const contourLevels = ref(7);
const showBackdrop = ref(true);
const showContours = ref(true);
const showParticles = ref(true);
const loading = ref(false);
const loadingText = ref('正在读取规则网格实验数据...');
const errorMessage = ref('');
const rawPointCount = ref(0);
const rawTriangleCount = ref(0);
const validCoverage = ref(0);
const gridShapeLabel = ref('-');
const speedRange = ref({ min: 0, max: 1 });

const jetLookup = buildColorLookupTable(SIMULATION_JET_STOPS, 512);

let resizeObserver = null;
let animationFrameId = 0;
let lastFrameTime = 0;
let meshField = null;
let gridField = null;
let particleState = [];
let viewMetrics = null;
let backdropRasterCanvas = null;

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const layerSummary = computed(() => {
  const names = [];
  if (showBackdrop.value) names.push('平滑底图');
  if (showContours.value) names.push('等值线');
  if (showParticles.value) names.push('粒子随流');
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

const coverageLabel = computed(() => (
  `${(Number(validCoverage.value || 0) * 100).toFixed(1)}%`
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

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
}

function ensurePointSpeedMagnitude(dataSet, vectorName) {
  const pointData = dataSet?.getPointData?.();
  const existing = pointData?.getArrayByName?.('pointSpeedMagnitude');
  if (existing) return normalizeRange(existing.getRange());

  const vectorArray = pointData?.getArrayByName?.(vectorName);
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
    throw new Error('切片缺少用于规则网格重采样的点或面数据。');
  }

  rawPointCount.value = pointCount;
  const bounds = extractBounds2D(dataSet);
  const triangles = [];

  for (let cursor = 0; cursor < polys.length;) {
    const count = Number(polys[cursor++] ?? 0);
    if (count < 3) {
      cursor += count;
      continue;
    }

    const ids = [];
    for (let index = 0; index < count; index += 1) {
      ids.push(Number(polys[cursor + index] ?? -1));
    }
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

  rawTriangleCount.value = triangles.length;
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

  return {
    bounds,
    triangles,
    buckets,
    binsX,
    binsY,
    cellWidth,
    cellHeight,
  };
}

function findContainingTriangle(field, x, y) {
  const { bounds, buckets, binsX, binsY, cellWidth, cellHeight, triangles } = field;
  if (
    x < bounds.minX || x > bounds.maxX ||
    y < bounds.minY || y > bounds.maxY
  ) {
    return null;
  }

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

  return {
    vx,
    vy,
    speed,
  };
}

function buildRegularGrid(field, targetCols) {
  const cols = clamp(Number(targetCols || 220), 120, 360);
  const rows = clamp(Math.round((field.bounds.height / field.bounds.width) * cols), 90, 360);
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

  const safeRange = normalizeRange([min, max]);
  const baseStep = Math.max(field.bounds.width, field.bounds.height) / Math.max(cols, rows);

  return {
    bounds: field.bounds,
    cols,
    rows,
    vx,
    vy,
    speed,
    valid,
    validCount,
    coverage: validCount / Math.max(1, total),
    minSpeed: safeRange.min,
    maxSpeed: safeRange.max,
    baseStep,
  };
}

function sampleGridField(field, x, y) {
  const { bounds, cols, rows, vx, vy, valid } = field;
  const fx = ((x - bounds.minX) / bounds.width) * (cols - 1);
  const fy = ((y - bounds.minY) / bounds.height) * (rows - 1);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  if (fx < 0 || fy < 0 || fx > cols - 1 || fy > rows - 1) return null;

  const x0 = clamp(Math.floor(fx), 0, cols - 1);
  const y0 = clamp(Math.floor(fy), 0, rows - 1);
  const x1 = clamp(x0 + 1, 0, cols - 1);
  const y1 = clamp(y0 + 1, 0, rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const corners = [
    { index: (y0 * cols) + x0, weight: (1 - tx) * (1 - ty) },
    { index: (y0 * cols) + x1, weight: tx * (1 - ty) },
    { index: (y1 * cols) + x0, weight: (1 - tx) * ty },
    { index: (y1 * cols) + x1, weight: tx * ty },
  ];

  let weightSum = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < corners.length; i += 1) {
    const { index, weight } = corners[i];
    if (!valid[index] || weight <= 0) continue;
    weightSum += weight;
    sumX += vx[index] * weight;
    sumY += vy[index] * weight;
  }

  if (weightSum < 0.2) return null;

  const outX = sumX / weightSum;
  const outY = sumY / weightSum;
  return {
    vx: outX,
    vy: outY,
    speed: Math.sqrt((outX * outX) + (outY * outY)),
  };
}

function lookupJetColor(value, alpha = 255) {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const span = Math.max(1e-6, max - min);
  const t = clamp((value - min) / span, 0, 1);
  const colorCount = Math.max(1, (jetLookup.length / 4) - 1);
  const offset = Math.round(t * colorCount) * 4;
  return [
    jetLookup[offset],
    jetLookup[offset + 1],
    jetLookup[offset + 2],
    alpha,
  ];
}

function rgbaString(color, alphaOverride = null) {
  const alpha = alphaOverride == null ? (Number(color[3] ?? 255) / 255) : alphaOverride;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function ensureCanvasSize(canvas) {
  if (!canvas || !viewerShell.value) return false;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(viewerShell.value.clientWidth * dpr));
  const height = Math.max(1, Math.round(viewerShell.value.clientHeight * dpr));
  const changed = canvas.width !== width || canvas.height !== height;

  if (changed) {
    canvas.width = width;
    canvas.height = height;
  }

  return changed;
}

function computeViewMetrics(width, height, bounds) {
  const padding = 26 * (window.devicePixelRatio || 1);
  const usableWidth = Math.max(1, width - (padding * 2));
  const usableHeight = Math.max(1, height - (padding * 2));
  const scale = Math.min(usableWidth / bounds.width, usableHeight / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  return {
    left: (width - drawWidth) / 2,
    top: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    scale,
  };
}

function worldToCanvas(x, y) {
  if (!gridField || !viewMetrics) return [0, 0];
  const px = viewMetrics.left + (((x - gridField.bounds.minX) / gridField.bounds.width) * viewMetrics.width);
  const py = viewMetrics.top + (viewMetrics.height - (((y - gridField.bounds.minY) / gridField.bounds.height) * viewMetrics.height));
  return [px, py];
}

function rebuildBackdropRaster() {
  if (!gridField) return;
  if (!backdropRasterCanvas) backdropRasterCanvas = document.createElement('canvas');

  backdropRasterCanvas.width = gridField.cols;
  backdropRasterCanvas.height = gridField.rows;
  const rasterContext = backdropRasterCanvas.getContext('2d', { alpha: true });
  const imageData = rasterContext.createImageData(gridField.cols, gridField.rows);
  const data = imageData.data;

  for (let row = 0; row < gridField.rows; row += 1) {
    for (let col = 0; col < gridField.cols; col += 1) {
      const sourceIndex = (row * gridField.cols) + col;
      const targetRow = (gridField.rows - 1) - row;
      const pixelIndex = ((targetRow * gridField.cols) + col) * 4;

      if (!gridField.valid[sourceIndex]) {
        data[pixelIndex + 3] = 0;
        continue;
      }

      const color = lookupJetColor(gridField.speed[sourceIndex], 242);
      data[pixelIndex] = color[0];
      data[pixelIndex + 1] = color[1];
      data[pixelIndex + 2] = color[2];
      data[pixelIndex + 3] = color[3];
    }
  }

  rasterContext.putImageData(imageData, 0, 0);
}

function drawBackdrop() {
  const canvas = backdropCanvas.value;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!gridField || !viewMetrics || !showBackdrop.value || !backdropRasterCanvas) return;

  context.save();
  context.imageSmoothingEnabled = true;
  context.drawImage(
    backdropRasterCanvas,
    0,
    0,
    backdropRasterCanvas.width,
    backdropRasterCanvas.height,
    viewMetrics.left,
    viewMetrics.top,
    viewMetrics.width,
    viewMetrics.height,
  );
  context.strokeStyle = 'rgba(226, 232, 240, 0.32)';
  context.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 1.2);
  context.strokeRect(viewMetrics.left, viewMetrics.top, viewMetrics.width, viewMetrics.height);
  context.restore();
}

function buildContourThresholds() {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const span = Math.max(1e-6, max - min);
  return Array.from({ length: contourLevels.value }, (_, index) => (
    min + (((index + 1) / (contourLevels.value + 1)) * span)
  ));
}

function drawContours() {
  const canvas = contourCanvas.value;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!gridField || !viewMetrics || !showContours.value) return;

  const thresholds = buildContourThresholds();
  const values = Array.from(gridField.speed, (value, index) => (
    gridField.valid[index] ? value : Number(speedRange.value.min ?? 0)
  ));

  const contourGenerator = createContours()
    .size([gridField.cols, gridField.rows])
    .smooth(true)
    .thresholds(thresholds);

  const contourShapes = contourGenerator(values);
  context.save();
  context.lineWidth = Math.max(1.1, (window.devicePixelRatio || 1) * 1.15);
  context.lineJoin = 'round';
  context.lineCap = 'round';

  contourShapes.forEach((feature) => {
    const color = lookupJetColor(Number(feature.value ?? 0), 216);
    context.strokeStyle = rgbaString(color, 0.78);

    feature.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        if (!ring.length) return;
        context.beginPath();
        ring.forEach(([gx, gy], ringIndex) => {
          const px = viewMetrics.left + ((gx / Math.max(gridField.cols - 1, 1)) * viewMetrics.width);
          const py = viewMetrics.top + (viewMetrics.height - ((gy / Math.max(gridField.rows - 1, 1)) * viewMetrics.height));
          if (ringIndex === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.closePath();
        context.stroke();
      });
    });
  });

  context.restore();
}

function clearParticleCanvas() {
  const canvas = particleCanvas.value;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function resetParticle(particle) {
  if (!gridField) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const x = gridField.bounds.minX + (Math.random() * gridField.bounds.width);
    const y = gridField.bounds.minY + (Math.random() * gridField.bounds.height);
    if (!sampleGridField(gridField, x, y)) continue;
    particle.x = x;
    particle.y = y;
    particle.age = Math.random() * 120;
    particle.maxAge = 80 + (Math.random() * 140);
    return;
  }

  particle.x = (gridField.bounds.minX + gridField.bounds.maxX) / 2;
  particle.y = (gridField.bounds.minY + gridField.bounds.maxY) / 2;
  particle.age = 0;
  particle.maxAge = 1;
}

function reseedParticles() {
  if (!gridField) return;
  particleState = Array.from({ length: particleCount.value }, () => {
    const particle = { x: 0, y: 0, age: 0, maxAge: 1 };
    resetParticle(particle);
    return particle;
  });
  clearParticleCanvas();
}

function animateParticles(timestamp) {
  if (!showParticles.value || !gridField || !viewMetrics || !particleCanvas.value) return;

  const canvas = particleCanvas.value;
  const context = canvas.getContext('2d');
  const dt = clamp((timestamp - (lastFrameTime || timestamp)) / 1000, 0.008, 0.05);
  lastFrameTime = timestamp;

  context.save();
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = `rgba(0, 0, 0, ${clamp(1 - trailFade.value, 0.05, 0.98)})`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (let index = 0; index < particleState.length; index += 1) {
    const particle = particleState[index];
    particle.age += dt * 60;
    if (particle.age > particle.maxAge) {
      resetParticle(particle);
      continue;
    }

    const sample = sampleGridField(gridField, particle.x, particle.y);
    if (!sample) {
      resetParticle(particle);
      continue;
    }

    const magnitude = Math.sqrt((sample.vx * sample.vx) + (sample.vy * sample.vy));
    if (!Number.isFinite(magnitude) || magnitude < 1e-7) {
      resetParticle(particle);
      continue;
    }

    const normSpeed = clamp(sample.speed / Math.max(gridField.maxSpeed, 1e-6), 0, 1);
    const stepDistance = gridField.baseStep * flowSpeed.value * (0.48 + (1.5 * normSpeed));
    const [startX, startY] = worldToCanvas(particle.x, particle.y);

    particle.x += (sample.vx / magnitude) * stepDistance * dt * 60;
    particle.y += (sample.vy / magnitude) * stepDistance * dt * 60;

    const nextSample = sampleGridField(gridField, particle.x, particle.y);
    if (!nextSample) {
      resetParticle(particle);
      continue;
    }

    const [endX, endY] = worldToCanvas(particle.x, particle.y);
    const color = lookupJetColor(nextSample.speed, 255);
    context.strokeStyle = rgbaString(color, 0.22 + (normSpeed * 0.58));
    context.lineWidth = (window.devicePixelRatio || 1) * (0.7 + (normSpeed * 0.9));
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
  }

  context.restore();
  animationFrameId = window.requestAnimationFrame(animateParticles);
}

function stopParticleAnimation() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}

function startParticleAnimation() {
  stopParticleAnimation();
  clearParticleCanvas();
  if (!showParticles.value || !gridField || !viewMetrics) return;
  if (!particleState.length) reseedParticles();
  lastFrameTime = 0;
  animationFrameId = window.requestAnimationFrame(animateParticles);
}

function redrawStaticLayers() {
  if (!gridField) return;
  drawBackdrop();
  drawContours();
}

function resizeCanvases() {
  if (!viewerShell.value) return;
  const changed = [
    ensureCanvasSize(backdropCanvas.value),
    ensureCanvasSize(contourCanvas.value),
    ensureCanvasSize(particleCanvas.value),
  ].some(Boolean);

  if (!gridField) return;
  const width = backdropCanvas.value?.width || 1;
  const height = backdropCanvas.value?.height || 1;
  viewMetrics = computeViewMetrics(width, height, gridField.bounds);

  if (changed) {
    redrawStaticLayers();
    if (showParticles.value) startParticleAnimation();
  }
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于规则网格实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function rebuildGridField(resetParticles = true) {
  if (!meshField) return;
  loading.value = true;
  loadingText.value = `正在将 ${selectedHeight.value} m 切片重采样到 ${gridResolution.value} 列规则网格...`;
  await nextTick();

  try {
    gridField = buildRegularGrid(meshField, gridResolution.value);
    gridShapeLabel.value = `${gridField.cols} x ${gridField.rows}`;
    speedRange.value = normalizeRange([gridField.minSpeed, gridField.maxSpeed]);
    validCoverage.value = gridField.coverage;
    rebuildBackdropRaster();
    resizeCanvases();
    redrawStaticLayers();

    if (resetParticles) reseedParticles();
    if (showParticles.value) startParticleAnimation();
  } finally {
    loading.value = false;
  }
}

async function loadScene() {
  if (!selectedHeight.value) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的切片数据...`;
  errorMessage.value = '';
  stopParticleAnimation();

  try {
    await nextTick();
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    const surfaceData = await loadPolyData(surfaceUrl);

    loadingText.value = '正在整理点向量并构建三角插值场...';
    await nextTick();

    const { vectorName, range } = ensureGridPointVectors(surfaceData);
    if (!vectorName) throw new Error('切片中没有可用于插值的速度向量。');
    speedRange.value = range;
    meshField = buildTriangleField(surfaceData, vectorName);

    await rebuildGridField(true);
  } catch (error) {
    console.error('规则网格实验页加载失败:', error);
    gridShapeLabel.value = '-';
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

async function handleGridResolutionChange() {
  if (!meshField) return;
  await rebuildGridField(true);
}

function handleParticleCountChange() {
  if (!gridField) return;
  reseedParticles();
  if (showParticles.value) startParticleAnimation();
}

function handleParticleToggle() {
  if (!gridField) return;
  if (!showParticles.value) {
    stopParticleAnimation();
    clearParticleCanvas();
    return;
  }

  reseedParticles();
  startParticleAnimation();
}

onMounted(async () => {
  await nextTick();
  resizeCanvases();

  if (typeof ResizeObserver !== 'undefined' && viewerShell.value) {
    resizeObserver = new ResizeObserver(() => resizeCanvases());
    resizeObserver.observe(viewerShell.value);
  }

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化规则网格实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  stopParticleAnimation();
  resizeObserver?.disconnect?.();
  resizeObserver = null;
  meshField = null;
  gridField = null;
  particleState = [];
  viewMetrics = null;
  backdropRasterCanvas = null;
});
</script>

<style scoped>
.grid-lab-viewer {
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
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.14), transparent 26%),
    radial-gradient(circle at bottom right, rgba(248, 113, 113, 0.12), transparent 24%),
    linear-gradient(180deg, #04101a 0%, #091624 100%);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
}

.layer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
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
  max-width: 460px;
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
  min-width: 176px;
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

@media (max-width: 1400px) {
  .toolbar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-item--wide {
    grid-column: span 2;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .viewer-shell {
    min-height: 620px;
  }
}

@media (max-width: 680px) {
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

  .legend {
    width: calc(100% - 24px);
    bottom: 12px;
  }
}
</style>
