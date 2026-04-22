<template>
  <div class="resource-lab">
    <header class="page-header">
      <div class="title-block">
        <div class="eyebrow">WIND RESOURCE LAB</div>
        <h1>风资源评估实验</h1>
        <div class="badge-row">
          <div v-for="badge in headerBadges" :key="badge.label" class="meta-pill">
            <span>{{ badge.label }}</span>
            <strong>{{ badge.value }}</strong>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <el-select v-model="selectedHeight" size="small" class="toolbar-select">
          <el-option
            v-for="height in availableHeights"
            :key="height"
            :label="`${formatNumber(height, 0)} m`"
            :value="height"
          />
        </el-select>

        <el-radio-group v-model="mapMetric" size="small" class="toolbar-group">
          <el-radio-button label="speed">风速</el-radio-button>
          <el-radio-button label="speedup">加速比</el-radio-button>
        </el-radio-group>

        <el-radio-group v-model="rankingMode" size="small" class="toolbar-group">
          <el-radio-button label="risk">风险排序</el-radio-button>
          <el-radio-button label="resource">资源排序</el-radio-button>
          <el-radio-button label="gap">功率差排序</el-radio-button>
        </el-radio-group>

        <el-button size="small" @click="retryLoad">刷新</el-button>
      </div>
    </header>

    <el-alert
      v-if="statusAlert"
      :type="statusAlert.type"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>{{ statusAlert.title }}</template>
      <template #default>
        {{ statusAlert.message }}
        <el-button
          v-if="statusAlert.actionText"
          type="primary"
          link
          @click="statusAlert.action"
        >
          {{ statusAlert.actionText }}
        </el-button>
      </template>
    </el-alert>

    <el-alert
      v-if="pageError"
      type="error"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>实验页加载失败</template>
      <template #default>
        {{ pageError }}
        <el-button type="primary" link @click="retryLoad">重试</el-button>
      </template>
    </el-alert>

    <template v-if="pageReady">
      <div class="stats-grid">
        <div v-for="card in dashboardCards" :key="card.label" class="stats-card">
          <div class="stats-label">{{ card.label }}</div>
          <div class="stats-value" :class="card.tone ? gapClass(card.toneValue) : ''">
            {{ card.value }}
          </div>
          <div class="stats-unit">{{ card.unit }}</div>
        </div>
      </div>

      <div class="workspace-grid">
        <section class="panel map-panel">
          <div class="panel-head">
            <h2>资源平面</h2>
            <div class="panel-head-meta">
              <span>{{ formatNumber(selectedHeight, 0) }} m</span>
              <span>{{ mapMetricLabel }}</span>
            </div>
          </div>

          <div class="map-shell">
            <div class="resource-stage-wrap">
              <div ref="resourceStageRef" class="resource-stage">
                <canvas ref="resourceCanvasRef" class="resource-canvas"></canvas>
                <button
                  v-for="marker in resourceMarkers"
                  :key="marker.id"
                  type="button"
                  class="resource-marker"
                  :class="{ 'resource-marker-active': marker.id === selectedTurbineId }"
                  :style="marker.style"
                  :title="marker.title"
                  @click="selectedTurbineId = marker.id"
                >
                  <span class="resource-marker-dot"></span>
                  <span class="resource-marker-label">{{ marker.name }}</span>
                </button>
              </div>
            </div>
            <div class="map-legend">
              <div class="map-legend-title">{{ mapMetric === 'speedup' ? '加速比' : '风速' }}</div>
              <div class="map-legend-bar" :style="mapLegendStyle"></div>
              <div class="map-legend-ticks">
                <span v-for="tick in mapLegendTicks" :key="tick">{{ tick }}</span>
              </div>
            </div>
            <div v-if="mapLoading" class="panel-overlay">
              <div class="loading-spinner"></div>
            </div>
          </div>

          <div class="quick-band">
            <div class="quick-item">
              <span>层平均</span>
              <strong>{{ formatNumber(resourceStats?.meanSpeed, 2) }}</strong>
            </div>
            <div class="quick-item">
              <span>P95</span>
              <strong>{{ formatNumber(resourceStats?.p95Speed, 2) }}</strong>
            </div>
            <div class="quick-item">
              <span>加速区</span>
              <strong>{{ formatPercentRatio(resourceStats?.strongSpeedupAreaRatio, 1) }}</strong>
            </div>
            <div class="quick-item">
              <span>低速区</span>
              <strong>{{ formatPercentRatio(resourceStats?.deficitAreaRatio, 1) }}</strong>
            </div>
          </div>
        </section>

        <section class="panel focus-panel">
          <div class="panel-head">
            <h2>{{ selectedRow?.name || '-' }}</h2>
            <div class="panel-head-meta">
              <span>{{ selectedRow?.id || '-' }}</span>
            </div>
          </div>

          <div class="focus-grid">
            <div v-for="item in selectedMetrics" :key="item.label" class="focus-metric">
              <span>{{ item.label }}</span>
              <strong :class="item.tone ? gapClass(item.toneValue) : ''">{{ item.value }}</strong>
            </div>
          </div>

          <div class="mini-grid">
            <div class="mini-panel">
              <div class="mini-title">入流扇区</div>
              <div ref="sectorChartRef" class="chart-surface mini-surface"></div>
            </div>
            <div class="mini-panel">
              <div class="mini-title">垂向风廓线</div>
              <div ref="profileChartRef" class="chart-surface mini-surface"></div>
              <div v-if="profileError" class="mini-note">{{ profileError }}</div>
            </div>
          </div>

          <div v-if="selectedFlags.length" class="flag-row">
            <span v-for="flag in selectedFlags" :key="flag" class="flag-pill">{{ flag }}</span>
          </div>
        </section>
      </div>

      <div class="detail-grid">
        <section class="panel table-panel">
          <div class="panel-head">
            <h2>机位排序</h2>
            <div class="panel-head-meta">
              <span>{{ rankingLabel }}</span>
            </div>
          </div>

          <div class="table-scroll">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>风机</th>
                  <th>层风速</th>
                  <th>加速比</th>
                  <th>ADJUST功率</th>
                  <th>矢量窗口 Ux</th>
                  <th>窗口功率差</th>
                  <th>失配角</th>
                  <th>上下半盘差</th>
                  <th>风险分</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rankingRows"
                  :key="row.id"
                  :class="{ 'row-active': row.id === selectedTurbineId }"
                  @click="selectedTurbineId = row.id"
                >
                  <td>{{ row.name }}</td>
                  <td>{{ formatNumber(row.resourceSpeed, 2) }}</td>
                  <td>{{ formatPercentRatio(row.resourceSpeedupRatio, 1) }}</td>
                  <td>{{ formatNumber(row.adjustPower, 1) }}</td>
                  <td>{{ formatNumber(row.vectorWindowUx, 2) }}</td>
                  <td :class="gapClass(row.vectorWindowPowerGap)">{{ formatSigned(row.vectorWindowPowerGap, 1) }}</td>
                  <td>{{ formatNumber(row.vectorWindowMisalignment, 1) }}</td>
                  <td>{{ formatSigned(row.diskTopBottomUxDelta, 2) }}</td>
                  <td>{{ formatNumber(row.combinedRisk, 2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel table-panel">
          <div class="panel-head">
            <h2>口径总表</h2>
          </div>

          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>口径</th>
                  <th>平均风速</th>
                  <th>总功率</th>
                  <th>总功率差</th>
                  <th>平均绝对风速差</th>
                  <th>平均绝对功率差</th>
                  <th>平均覆盖率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in summaryRows" :key="item.id">
                  <td>{{ item.label }}</td>
                  <td>{{ formatNumber(item.averageSpeed, 2) }}</td>
                  <td>{{ formatNumber(item.totalPower, 1) }}</td>
                  <td :class="gapClass(item.totalPowerGap)">{{ formatSigned(item.totalPowerGap, 1) }}</td>
                  <td>{{ formatNumber(item.averageAbsoluteSpeedGap, 2) }}</td>
                  <td>{{ formatNumber(item.averageAbsolutePowerGap, 1) }}</td>
                  <td>{{ formatPercentRatio(item.coverageRatio, 1) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="detail-grid">
        <section class="panel table-panel" v-if="vectorFocusRows.length">
          <div class="panel-head">
            <h2>风向失配台账</h2>
          </div>

          <div class="table-scroll">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>风机</th>
                  <th>窗口 Ux</th>
                  <th>窗口 |U|</th>
                  <th>|U|-Ux</th>
                  <th>窗口失配角</th>
                  <th>逆流</th>
                  <th>盘面等效 Ux</th>
                  <th>上下半盘 Ux差</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in vectorFocusRows"
                  :key="item.id"
                  :class="{ 'row-active': item.id === selectedTurbineId }"
                  @click="selectedTurbineId = item.id"
                >
                  <td>{{ item.name }}</td>
                  <td>{{ formatNumber(item.windowMeanUx, 2) }}</td>
                  <td>{{ formatNumber(item.windowMeanSpeedMag, 2) }}</td>
                  <td>{{ formatNumber(item.windowSpeedMinusUx, 2) }}</td>
                  <td>{{ formatNumber(item.windowMisalignmentDeg, 1) }}</td>
                  <td>{{ formatPercentRatio(item.windowReverseFlowRatio, 1) }}</td>
                  <td>{{ formatNumber(item.diskEquivalentUx, 2) }}</td>
                  <td>{{ formatSigned(item.diskTopBottomUxDelta, 2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel table-panel" v-if="notes.length">
          <div class="panel-head">
            <h2>注意项</h2>
          </div>

          <div class="warnings-list">
            <div v-for="note in notes" :key="note" class="warning-item">{{ note }}</div>
          </div>
        </section>
      </div>
    </template>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载实验工作台中...</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { useCaseStore } from '@/store/caseStore';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '@/utils/notify.js';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const caseStore = useCaseStore();
const router = useRouter();

const loading = ref(true);
const mapLoading = ref(false);
const profileLoading = ref(false);
const pageError = ref('');
const profileError = ref('');
const softWarnings = ref([]);

const experimentalData = ref(null);
const vectorData = ref(null);
const resourceMapData = ref(null);
const rawOverlayData = ref(null);
const profileData = ref(null);

const selectedHeight = ref(120);
const selectedTurbineId = ref('');
const mapMetric = ref('speed');
const rankingMode = ref('risk');
const suppressHeightWatch = ref(false);

const resourceCanvasRef = ref(null);
const resourceStageRef = ref(null);
const sectorChartRef = ref(null);
const profileChartRef = ref(null);

let sectorChart = null;
let profileChart = null;

const goToCalculation = () => {
  if (!props.caseId) return;
  router.push({ name: 'CalculationOutput', params: { caseId: props.caseId } });
};

const statusAlert = computed(() => {
  if (!props.caseId) return null;
  if (!caseStore.hasFetchedCalculationStatus) {
    return { type: 'info', title: '加载中', message: '正在检查工况状态...', actionText: '', action: () => {} };
  }
  if (caseStore.calculationStatus !== 'completed') {
    return {
      type: 'warning',
      title: '主计算未完成',
      message: '实验页依赖 speed.bin、Output 和内部矢量缓存，请先完成计算。',
      actionText: '去计算输出',
      action: goToCalculation,
    };
  }
  return null;
});

const pageReady = computed(() => Boolean(experimentalData.value && resourceMapData.value) && !pageError.value);

const summary = computed(() => experimentalData.value?.summary || null);
const vectorSummary = computed(() => vectorData.value?.summary || null);
const resourceMeta = computed(() => resourceMapData.value?.meta || null);
const resourcePlane = computed(() => resourceMapData.value?.plane || null);
const resourceStats = computed(() => resourcePlane.value?.stats || null);
const rawOverlay = computed(() => rawOverlayData.value?.overlay || null);

const availableHeights = computed(() => {
  const heights = resourceMeta.value?.availableHeights;
  return Array.isArray(heights) && heights.length ? heights : [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
});

const resourceColorStops = ['#00007f', '#001dff', '#00a3ff', '#2dffc4', '#b1ff4a', '#ffe600', '#ff7a00', '#d50000'];

const hexToRgb = (hex) => {
  const normalized = String(hex || '').replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const parsed = Number.parseInt(value, 16);
  if (!Number.isFinite(parsed)) return { r: 0, g: 0, b: 0 };
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const interpolateColor = (value, min, max) => {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return resourceColorStops[0];
  }
  const clamped = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = clamped * (resourceColorStops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(resourceColorStops.length - 1, lowerIndex + 1);
  const weight = scaled - lowerIndex;
  const lower = hexToRgb(resourceColorStops[lowerIndex]);
  const upper = hexToRgb(resourceColorStops[upperIndex]);
  const r = Math.round(lower.r + (upper.r - lower.r) * weight);
  const g = Math.round(lower.g + (upper.g - lower.g) * weight);
  const b = Math.round(lower.b + (upper.b - lower.b) * weight);
  return `rgb(${r}, ${g}, ${b})`;
};

const warnings = computed(() => [
  ...(experimentalData.value?.warnings || []),
  ...(vectorData.value?.warnings || []),
  ...softWarnings.value,
]);

const notes = computed(() => {
  const items = [
    ...(Array.isArray(experimentalData.value?.method?.limitations) ? experimentalData.value.method.limitations : []),
    ...(Array.isArray(vectorData.value?.method?.limitations) ? vectorData.value.method.limitations : []),
    ...(Array.isArray(resourceMapData.value?.method?.limitations) ? resourceMapData.value.method.limitations : []),
    ...warnings.value,
  ];
  return Array.from(new Set(items.filter(Boolean)));
});

const scalarMap = computed(() => new Map((experimentalData.value?.turbines || []).map((item) => [item.id, item])));
const vectorMap = computed(() => new Map((vectorData.value?.turbines || []).map((item) => [item.id, item])));
const resourceTurbineMap = computed(() => new Map((resourceMapData.value?.turbines || []).map((item) => [item.id, item])));

const computeCombinedRisk = (row) => {
  const powerGap = Math.abs(Number(row.vectorWindowPowerGap) || Number(row.scalarWindowPowerGap) || 0);
  const misalignment = Math.abs(Number(row.vectorWindowMisalignment) || 0);
  const topBottom = Math.abs(Number(row.diskTopBottomUxDelta) || 0);
  const reverseFlow = Math.abs(Number(row.windowReverseFlowRatio) || 0);
  const localPenalty = Number.isFinite(row.resourceSpeedupRatio) ? Math.max(0, 1 - row.resourceSpeedupRatio) * 30 : 0;
  return powerGap / 400 + misalignment / 5 + topBottom * 2 + reverseFlow * 40 + localPenalty;
};

const combinedRows = computed(() => {
  const ids = new Set([
    ...scalarMap.value.keys(),
    ...vectorMap.value.keys(),
    ...resourceTurbineMap.value.keys(),
  ]);

  const rows = Array.from(ids).map((id) => {
    const scalar = scalarMap.value.get(id) || null;
    const vector = vectorMap.value.get(id) || null;
    const resource = resourceTurbineMap.value.get(id) || null;

    const row = {
      id,
      name: scalar?.name || vector?.name || resource?.name || id,
      x: vector?.solverX_m ?? scalar?.solverX ?? resource?.solverX ?? scalar?.x ?? resource?.x ?? null,
      y: vector?.solverY_m ?? scalar?.solverY ?? resource?.solverY ?? scalar?.y ?? resource?.y ?? null,
      originalX: scalar?.originalX ?? resource?.originalX ?? null,
      originalY: scalar?.originalY ?? resource?.originalY ?? null,
      adjustPower: scalar?.adjust?.power ?? vector?.adjust?.power ?? null,
      adjustSpeed: scalar?.adjust?.speed ?? vector?.adjust?.speed ?? null,
      resourceSpeed: resource?.localSpeed ?? null,
      resourceSpeedupRatio: resource?.localSpeedupRatio ?? null,
      scalarWindowPowerGap: scalar?.solverWindowPowerGapToSolver ?? null,
      scalarRotorPowerGap: scalar?.powerGapToSolver ?? null,
      scalarRotorNonUniformityRatio: scalar?.rotorNonUniformityRatio ?? null,
      vectorWindowUx: vector?.windowMeanUx ?? null,
      vectorWindowPowerGap: vector?.vectorWindowPowerGapToSolver ?? null,
      vectorWindowMisalignment: vector?.windowMisalignmentDeg ?? null,
      windowReverseFlowRatio: vector?.windowReverseFlowRatio ?? null,
      diskTopBottomUxDelta: vector?.diskTopBottomUxDelta ?? scalar?.rotorTopBottomDelta ?? null,
      diskEquivalentUx: vector?.diskEquivalentUx ?? null,
      actualHubZ: vector?.actualHubZ_m ?? scalar?.actualHubZ ?? null,
      terrainZ: vector?.terrainZ_m ?? scalar?.terrainZ ?? null,
    };

    row.combinedRisk = computeCombinedRisk(row);
    return row;
  });

  const sorters = {
    risk: (a, b) => b.combinedRisk - a.combinedRisk,
    resource: (a, b) => (Number(b.resourceSpeedupRatio) || -Infinity) - (Number(a.resourceSpeedupRatio) || -Infinity),
    gap: (a, b) => Math.abs(Number(b.vectorWindowPowerGap) || Number(b.scalarWindowPowerGap) || 0)
      - Math.abs(Number(a.vectorWindowPowerGap) || Number(a.scalarWindowPowerGap) || 0),
  };

  return rows.sort(sorters[rankingMode.value] || sorters.risk);
});

const rankingRows = computed(() => combinedRows.value.slice(0, 16));

const selectedRow = computed(() => {
  if (!selectedTurbineId.value) return combinedRows.value[0] || null;
  return combinedRows.value.find((item) => item.id === selectedTurbineId.value) || combinedRows.value[0] || null;
});

const vectorRows = computed(() => vectorData.value?.turbines || []);

const getVectorRiskScore = (item) => {
  const speedMinusUx = Math.max(Number(item?.windowSpeedMinusUx) || 0, Number(item?.diskSpeedMinusUx) || 0);
  const misalignment = Math.max(Number(item?.windowMisalignmentDeg) || 0, Number(item?.diskMisalignmentDeg) || 0);
  const reverseFlow = Math.max(Number(item?.windowReverseFlowRatio) || 0, Number(item?.diskReverseFlowRatio) || 0);
  const verticalDelta = Math.abs(Number(item?.diskTopBottomUxDelta) || 0);
  return speedMinusUx + misalignment / 8 + reverseFlow * 20 + verticalDelta / 2;
};

const vectorFocusRows = computed(() => {
  if (!vectorRows.value.length) return [];
  return [...vectorRows.value]
    .sort((a, b) => getVectorRiskScore(b) - getVectorRiskScore(a))
    .slice(0, 10);
});

const subtractIfFinite = (left, right) => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Number(left) - Number(right);
};

const averageAbsoluteGap = (items, getter) => {
  const values = items
    .map(getter)
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(Number(value)));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const averageValue = (items, getter) => {
  const values = items
    .map(getter)
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const solverWindowTotalPowerGap = computed(() =>
  subtractIfFinite(summary.value?.totalCurvePowerAtSolverWindowSpeed, summary.value?.totalSolverAdjustedPower)
);
const rotorEquivalentTotalPowerGap = computed(() =>
  subtractIfFinite(summary.value?.totalCurvePowerAtRotorEquivalentSpeed, summary.value?.totalSolverAdjustedPower)
);
const vectorWindowTotalPowerGap = computed(() =>
  subtractIfFinite(vectorSummary.value?.totalCurvePowerAtWindowUx, summary.value?.totalSolverAdjustedPower)
);
const vectorDiskTotalPowerGap = computed(() =>
  subtractIfFinite(vectorSummary.value?.totalCurvePowerAtDiskEquivalentUx, summary.value?.totalSolverAdjustedPower)
);
const vectorWindowAverageAbsoluteSpeedGap = computed(() =>
  averageAbsoluteGap(vectorRows.value, (item) => subtractIfFinite(item.windowMeanUx, item.adjust?.speed))
);
const vectorDiskAverageAbsoluteSpeedGap = computed(() =>
  averageAbsoluteGap(vectorRows.value, (item) => subtractIfFinite(item.diskEquivalentUx, item.adjust?.speed))
);
const vectorWindowCoverageRatio = computed(() =>
  averageValue(vectorRows.value, (item) => item.windowCoverageRatio)
);
const vectorDiskCoverageRatio = computed(() =>
  averageValue(vectorRows.value, (item) => item.diskCoverageRatio)
);

const summaryRows = computed(() => {
  if (!summary.value) return [];
  const rows = [
    {
      id: 'solver-adjust',
      label: 'ADJUST',
      averageSpeed: summary.value.averageSolverAdjustedSpeed,
      totalPower: summary.value.totalSolverAdjustedPower,
      totalPowerGap: 0,
      averageAbsoluteSpeedGap: null,
      averageAbsolutePowerGap: null,
      coverageRatio: null,
    },
    {
      id: 'scalar-window',
      label: '标量窗口复现',
      averageSpeed: summary.value.averageSolverWindowMeanSpeedFromField,
      totalPower: summary.value.totalCurvePowerAtSolverWindowSpeed,
      totalPowerGap: solverWindowTotalPowerGap.value,
      averageAbsoluteSpeedGap: summary.value.averageAbsoluteSolverWindowSpeedGap,
      averageAbsolutePowerGap: summary.value.averageAbsoluteSolverWindowPowerGap,
      coverageRatio: summary.value.averageSolverWindowCoverageRatio,
    },
    {
      id: 'scalar-disk',
      label: '标量盘面立方等效',
      averageSpeed: summary.value.averageRotorEquivalentSpeedFromField,
      totalPower: summary.value.totalCurvePowerAtRotorEquivalentSpeed,
      totalPowerGap: rotorEquivalentTotalPowerGap.value,
      averageAbsoluteSpeedGap: summary.value.averageAbsoluteRotorEquivalentSpeedGap,
      averageAbsolutePowerGap: summary.value.averageAbsoluteRotorEquivalentPowerGap,
      coverageRatio: summary.value.averageCoverageRatio,
    },
  ];

  if (vectorSummary.value) {
    rows.push(
      {
        id: 'vector-window',
        label: '矢量窗口 Ux',
        averageSpeed: vectorSummary.value.averageWindowMeanUx,
        totalPower: vectorSummary.value.totalCurvePowerAtWindowUx,
        totalPowerGap: vectorWindowTotalPowerGap.value,
        averageAbsoluteSpeedGap: vectorWindowAverageAbsoluteSpeedGap.value,
        averageAbsolutePowerGap: vectorSummary.value.averageAbsoluteWindowPowerGap,
        coverageRatio: vectorWindowCoverageRatio.value,
      },
      {
        id: 'vector-disk',
        label: '矢量盘面立方 Ux',
        averageSpeed: vectorSummary.value.averageDiskEquivalentUx,
        totalPower: vectorSummary.value.totalCurvePowerAtDiskEquivalentUx,
        totalPowerGap: vectorDiskTotalPowerGap.value,
        averageAbsoluteSpeedGap: vectorDiskAverageAbsoluteSpeedGap.value,
        averageAbsolutePowerGap: vectorSummary.value.averageAbsoluteDiskPowerGap,
        coverageRatio: vectorDiskCoverageRatio.value,
      }
    );
  }

  return rows;
});

const headerBadges = computed(() => [
  { label: '工况', value: props.caseId },
  { label: '入口', value: Number.isFinite(resourceMeta.value?.inletWindSpeed) ? `${formatNumber(resourceMeta.value.inletWindSpeed, 1)} m/s` : '-' },
  { label: '风向', value: Number.isFinite(resourceMeta.value?.windAngleDeg) ? `${formatNumber(resourceMeta.value.windAngleDeg, 0)}°` : '-' },
  { label: '层位', value: Number.isFinite(resourceMeta.value?.actualHeight) ? `${formatNumber(resourceMeta.value.actualHeight, 0)} m` : '-' },
]);

const dashboardCards = computed(() => [
  {
    label: '当前层平均风速',
    value: summaryValue(resourceStats.value?.meanSpeed, 2),
    unit: 'm/s',
  },
  {
    label: '当前层 P95',
    value: summaryValue(resourceStats.value?.p95Speed, 2),
    unit: 'm/s',
  },
  {
    label: '加速区面积',
    value: formatPercentRatio(resourceStats.value?.strongSpeedupAreaRatio, 1),
    unit: '%',
  },
  {
    label: '低速区面积',
    value: formatPercentRatio(resourceStats.value?.deficitAreaRatio, 1),
    unit: '%',
  },
  {
    label: 'ADJUST总功率',
    value: summaryValue(summary.value?.totalSolverAdjustedPower, 0),
    unit: 'kW',
  },
  {
    label: '矢量窗口总功率',
    value: summaryValue(vectorSummary.value?.totalCurvePowerAtWindowUx, 0),
    unit: 'kW',
  },
  {
    label: '平均失配角',
    value: summaryValue(vectorSummary.value?.averageWindowMisalignmentDeg, 1),
    unit: 'deg',
  },
  {
    label: '选中机位层风速',
    value: summaryValue(selectedRow.value?.resourceSpeed, 2),
    unit: 'm/s',
  },
]);

const selectedMetrics = computed(() => {
  if (!selectedRow.value) return [];
  return [
    { label: '层风速', value: `${formatNumber(selectedRow.value.resourceSpeed, 2)} m/s` },
    { label: '加速比', value: `${formatPercentRatio(selectedRow.value.resourceSpeedupRatio, 1)} %` },
    { label: 'ADJUST功率', value: `${formatNumber(selectedRow.value.adjustPower, 1)} kW` },
    {
      label: '矢量窗口功率差',
      value: `${formatSigned(selectedRow.value.vectorWindowPowerGap, 1)} kW`,
      tone: true,
      toneValue: selectedRow.value.vectorWindowPowerGap,
    },
    { label: '矢量窗口 Ux', value: `${formatNumber(selectedRow.value.vectorWindowUx, 2)} m/s` },
    { label: '失配角', value: `${formatNumber(selectedRow.value.vectorWindowMisalignment, 1)} deg` },
    { label: '上下半盘差', value: `${formatSigned(selectedRow.value.diskTopBottomUxDelta, 2)} m/s` },
    { label: '风险分', value: formatNumber(selectedRow.value.combinedRisk, 2) },
  ];
});

const selectedFlags = computed(() => {
  if (!selectedRow.value) return [];
  const flags = [];
  if (Number.isFinite(selectedRow.value.resourceSpeedupRatio) && selectedRow.value.resourceSpeedupRatio >= 1.05) flags.push('加速区');
  if (Number.isFinite(selectedRow.value.resourceSpeedupRatio) && selectedRow.value.resourceSpeedupRatio <= 0.95) flags.push('低速区');
  if (Number.isFinite(selectedRow.value.vectorWindowMisalignment) && selectedRow.value.vectorWindowMisalignment >= 10) flags.push('横向流显著');
  if (Number.isFinite(selectedRow.value.diskTopBottomUxDelta) && Math.abs(selectedRow.value.diskTopBottomUxDelta) >= 1) flags.push('垂向剪切强');
  if (Number.isFinite(selectedRow.value.vectorWindowPowerGap) && Math.abs(selectedRow.value.vectorWindowPowerGap) >= 150) flags.push('功率口径偏差大');
  return flags;
});

const mapMetricLabel = computed(() => (mapMetric.value === 'speedup' ? '加速比' : '风速'));
const rankingLabel = computed(() => {
  const labels = {
    risk: '风险分降序',
    resource: '加速比降序',
    gap: '窗口功率差降序',
  };
  return labels[rankingMode.value] || labels.risk;
});

const resourceRenderRange = computed(() => {
  const inlet = Number(resourceMeta.value?.inletWindSpeed);
  const baseMin = Number(rawOverlay.value?.stats?.minSpeed);
  const baseMax = Number(rawOverlay.value?.stats?.maxSpeed);

  if (Number.isFinite(baseMin) && Number.isFinite(baseMax) && baseMax > baseMin) {
    if (mapMetric.value === 'speedup' && Number.isFinite(inlet) && inlet > 0) {
      return {
        min: baseMin / inlet,
        max: baseMax / inlet,
      };
    }
    return {
      min: baseMin,
      max: baseMax,
    };
  }

  const { min, max } = buildResourceHeatmap();
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 1,
  };
});

const mapLegendStyle = computed(() => ({
  background: `linear-gradient(to top, ${resourceColorStops.join(', ')})`,
}));

const mapLegendTicks = computed(() => {
  const { min, max } = resourceRenderRange.value;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ['-', '-', '-'];
  const mid = min + (max - min) / 2;
  const digits = mapMetric.value === 'speedup' ? 2 : 1;
  return [max, mid, min].map((value) => Number(value).toFixed(digits));
});

const resourceMarkers = computed(() => {
  const plane = resourcePlane.value;
  if (!plane) return [];
  const xMin = Number(plane.xMin);
  const xMax = Number(plane.xMax);
  const yMin = Number(plane.yMin);
  const yMax = Number(plane.yMax);
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  if (!(xSpan > 0) || !(ySpan > 0)) return [];

  return combinedRows.value
    .map((item) => {
      const solverX = Number(item.x);
      const solverY = Number(item.y);
      if (![solverX, solverY].every(Number.isFinite)) return null;
      const left = ((solverX - xMin) / xSpan) * 100;
      const top = ((yMax - solverY) / ySpan) * 100;
      return {
        id: item.id,
        name: item.name,
        title: `${item.name} | X ${formatNumber(item.x, 1)} m | Y ${formatNumber(item.y, 1)} m`,
        style: {
          left: `${Math.max(0, Math.min(100, left))}%`,
          top: `${Math.max(0, Math.min(100, top))}%`,
          zIndex: item.id === selectedTurbineId.value ? 4 : 3,
        },
      };
    })
    .filter(Boolean);
});

const ensureCaseLoaded = async (id) => {
  if (!id) return false;
  try {
    if (caseStore.caseId !== id || caseStore.currentCaseId !== id) {
      await caseStore.initializeCase(id);
    } else if (typeof caseStore.fetchCalculationStatus === 'function') {
      await caseStore.fetchCalculationStatus();
    }
    return true;
  } catch (error) {
    pageError.value = getApiErrorMessage(error, '初始化工况失败');
    return false;
  }
};

const pickDefaultTurbineId = () => {
  const rows = [...combinedRows.value].sort((a, b) => b.combinedRisk - a.combinedRisk);
  return rows[0]?.id || '';
};

const loadProfile = async (turbineId) => {
  profileData.value = null;
  profileError.value = '';
  if (!turbineId) return;
  profileLoading.value = true;
  try {
    const response = await axios.get(`/api/cases/${props.caseId}/visualization-profile/${turbineId}`);
    if (!response.data?.success || !response.data?.profile) {
      throw new Error(response.data?.message || '未返回风廓线数据');
    }
    profileData.value = response.data.profile;
  } catch (error) {
    profileError.value = getApiErrorMessage(error, '未找到风廓线缓存');
  } finally {
    profileLoading.value = false;
    await nextTick();
    updateProfileChart();
  }
};

const loadResourceLayer = async (height, { silent = false } = {}) => {
  if (!props.caseId) return;
  if (!silent) mapLoading.value = true;
  try {
    const [resourceResponse, rawOverlayResponse] = await Promise.all([
      axios.get(`/api/cases/${props.caseId}/experimental-wind-resource-map`, {
        params: { height, resolution: 180 },
      }),
      axios.get(`/api/cases/${props.caseId}/experimental-wind-resource-raw-overlay`, {
        params: { height, maxPoints: 180000 },
      }),
    ]);
    if (!resourceResponse.data?.success) {
      throw new Error(resourceResponse.data?.message || '风资源平面层未返回有效数据');
    }
    if (!rawOverlayResponse.data?.success) {
      throw new Error(rawOverlayResponse.data?.message || '原始平面叠加未返回有效数据');
    }
    resourceMapData.value = resourceResponse.data;
    rawOverlayData.value = rawOverlayResponse.data;

    const heights = resourceResponse.data?.meta?.availableHeights || [];
    if (heights.length && !heights.includes(selectedHeight.value)) {
      suppressHeightWatch.value = true;
      selectedHeight.value = resourceResponse.data.meta.nearestNativeHeight ?? heights[0];
      suppressHeightWatch.value = false;
    }
  } catch (error) {
    const message = getApiErrorMessage(error, '风资源平面层加载失败');
    if (!resourceMapData.value) {
      throw new Error(message);
    }
    softWarnings.value.push(message);
  } finally {
    mapLoading.value = false;
  }
};

const loadPageData = async ({ preserveSelection = false } = {}) => {
  pageError.value = '';
  softWarnings.value = [];
  loading.value = true;
  try {
    if (caseStore.hasFetchedCalculationStatus && caseStore.calculationStatus !== 'completed') return;

    const requestedHeight = Number.isFinite(selectedHeight.value) ? selectedHeight.value : 120;
    const [scalarResult, vectorResult, resourceResult, rawOverlayResult] = await Promise.allSettled([
      axios.get(`/api/cases/${props.caseId}/experimental-turbine-performance`),
      axios.get(`/api/cases/${props.caseId}/experimental-turbine-vector-diagnostics`),
      axios.get(`/api/cases/${props.caseId}/experimental-wind-resource-map`, {
        params: { height: requestedHeight, resolution: 180 },
      }),
      axios.get(`/api/cases/${props.caseId}/experimental-wind-resource-raw-overlay`, {
        params: { height: requestedHeight, maxPoints: 180000 },
      }),
    ]);

    if (scalarResult.status !== 'fulfilled' || !scalarResult.value.data?.success) {
      const reason = scalarResult.status === 'fulfilled'
        ? new Error(scalarResult.value.data?.message || '实验风机性能接口未返回有效数据')
        : scalarResult.reason;
      throw reason;
    }

    if (resourceResult.status !== 'fulfilled' || !resourceResult.value.data?.success) {
      const reason = resourceResult.status === 'fulfilled'
        ? new Error(resourceResult.value.data?.message || '实验风资源接口未返回有效数据')
        : resourceResult.reason;
      throw reason;
    }

    experimentalData.value = scalarResult.value.data;
    resourceMapData.value = resourceResult.value.data;
    rawOverlayData.value = rawOverlayResult.status === 'fulfilled' && rawOverlayResult.value.data?.success
      ? rawOverlayResult.value.data
      : null;

    if (vectorResult.status === 'fulfilled' && vectorResult.value.data?.success) {
      vectorData.value = vectorResult.value.data;
    } else if (vectorResult.status === 'fulfilled') {
      vectorData.value = null;
      softWarnings.value.push(vectorResult.value.data?.message || '矢量风机诊断未返回有效数据。');
    } else {
      vectorData.value = null;
      softWarnings.value.push(getApiErrorMessage(vectorResult.reason, '矢量风机诊断加载失败'));
    }

    if (rawOverlayResult.status !== 'fulfilled' || !rawOverlayResult.value.data?.success) {
      softWarnings.value.push(
        rawOverlayResult.status === 'fulfilled'
          ? (rawOverlayResult.value.data?.message || '原始平面叠加加载失败')
          : getApiErrorMessage(rawOverlayResult.reason, '原始平面叠加加载失败')
      );
    }

    const heights = resourceResult.value.data?.meta?.availableHeights || [];
    if (heights.length && !heights.includes(selectedHeight.value)) {
      suppressHeightWatch.value = true;
      selectedHeight.value = resourceResult.value.data.meta.nearestNativeHeight ?? heights[0];
      suppressHeightWatch.value = false;
    }

    if (!preserveSelection || !combinedRows.value.some((item) => item.id === selectedTurbineId.value)) {
      selectedTurbineId.value = pickDefaultTurbineId();
    }

    await loadProfile(selectedTurbineId.value);
    await nextTick();
    updateAllCharts();
  } catch (error) {
    pageError.value = getApiErrorMessage(error, '加载实验工作台失败');
  } finally {
    loading.value = false;
  }
};

const retryLoad = async () => {
  pageError.value = '';
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadPageData();
};

const buildResourceHeatmap = () => {
  const plane = resourcePlane.value;
  const inlet = resourceMeta.value?.inletWindSpeed;
  if (!plane?.nx || !plane?.ny || !Array.isArray(plane.values)) {
    return {
      data: [],
      min: 0,
      max: 1,
      xCoords: [],
      yCoords: [],
      xMinKm: -1,
      xMaxKm: 1,
      yMinKm: -1,
      yMaxKm: 1,
      cellWidthKm: 0.02,
      cellHeightKm: 0.02,
    };
  }

  const data = [];
  const xSpan = plane.xMax - plane.xMin;
  const ySpan = plane.yMax - plane.yMin;
  const metricValues = [];
  const xCoords = Array.from({ length: plane.nx }, (_, ix) => (
    (plane.nx === 1 ? (plane.xMin + plane.xMax) / 2 : plane.xMin + (xSpan * ix) / (plane.nx - 1)) / 1000
  ));
  const yCoords = Array.from({ length: plane.ny }, (_, iy) => (
    (plane.ny === 1 ? (plane.yMin + plane.yMax) / 2 : plane.yMin + (ySpan * iy) / (plane.ny - 1)) / 1000
  ));

  for (let iy = 0; iy < plane.ny; iy += 1) {
    for (let ix = 0; ix < plane.nx; ix += 1) {
      const index = iy * plane.nx + ix;
      const speed = plane.values[index];
      if (!Number.isFinite(speed)) continue;
      const metricValue = mapMetric.value === 'speedup' && Number.isFinite(inlet) && inlet > 0
        ? speed / inlet
        : speed;
      metricValues.push(metricValue);
      data.push([xCoords[ix], yCoords[iy], metricValue]);
    }
  }

  const min = metricValues.length ? Math.min(...metricValues) : 0;
  const max = metricValues.length ? Math.max(...metricValues) : 1;
  return {
    data,
    min,
    max,
    xCoords,
    yCoords,
    xMinKm: xCoords[0] ?? plane.xMin / 1000,
    xMaxKm: xCoords[xCoords.length - 1] ?? plane.xMax / 1000,
    yMinKm: yCoords[0] ?? plane.yMin / 1000,
    yMaxKm: yCoords[yCoords.length - 1] ?? plane.yMax / 1000,
    cellWidthKm: xCoords.length > 1 ? Math.abs(xCoords[1] - xCoords[0]) : Math.abs((plane.xMax - plane.xMin) / 1000) || 0.02,
    cellHeightKm: yCoords.length > 1 ? Math.abs(yCoords[1] - yCoords[0]) : Math.abs((plane.yMax - plane.yMin) / 1000) || 0.02,
  };
};

const buildColorLookup = (steps = 512) => {
  const lookup = new Uint8ClampedArray(Math.max(2, steps) * 3);
  const maxIndex = Math.max(1, steps - 1);
  for (let index = 0; index < steps; index += 1) {
    const color = interpolateColor(index / maxIndex, 0, 1);
    const match = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    const baseOffset = index * 3;
    lookup[baseOffset] = Number(match?.[1] ?? 0);
    lookup[baseOffset + 1] = Number(match?.[2] ?? 0);
    lookup[baseOffset + 2] = Number(match?.[3] ?? 0);
  }
  return lookup;
};

const drawRawOverlayResourceStage = (ctx, width, height) => {
  const overlay = rawOverlay.value;
  const plane = resourcePlane.value;
  const points = Array.isArray(overlay?.points) ? overlay.points : [];
  if (!points.length || !plane) return false;
  const { min, max } = resourceRenderRange.value;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;

  const xMin = Number(overlay?.domain?.xMin ?? plane.xMin);
  const xMax = Number(overlay?.domain?.xMax ?? plane.xMax);
  const yMin = Number(overlay?.domain?.yMin ?? plane.yMin);
  const yMax = Number(overlay?.domain?.yMax ?? plane.yMax);
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  if (!(xSpan > 0) || !(ySpan > 0)) return false;

  const background = { r: 255, g: 255, b: 255 };
  const colorLookup = buildColorLookup(512);
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;
  const inletWindSpeed = Number(resourceMeta.value?.inletWindSpeed);
  const pointRadius = Math.max(1, Math.round(Math.min(width, height) / 360));

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = background.r;
    pixels[offset + 1] = background.g;
    pixels[offset + 2] = background.b;
    pixels[offset + 3] = 255;
  }

  const stampPoint = (px, py, colorOffset) => {
    for (let dy = -pointRadius; dy <= pointRadius; dy += 1) {
      const targetY = py + dy;
      if (targetY < 0 || targetY >= height) continue;
      for (let dx = -pointRadius; dx <= pointRadius; dx += 1) {
        if (dx * dx + dy * dy > pointRadius * pointRadius + 0.2) continue;
        const targetX = px + dx;
        if (targetX < 0 || targetX >= width) continue;
        const offset = (targetY * width + targetX) * 4;
        pixels[offset] = colorLookup[colorOffset];
        pixels[offset + 1] = colorLookup[colorOffset + 1];
        pixels[offset + 2] = colorLookup[colorOffset + 2];
        pixels[offset + 3] = 255;
      }
    }
  };

  points.forEach((point) => {
    const x = Number(point?.[0]);
    const y = Number(point?.[1]);
    const speed = Number(point?.[2]);
    if (![x, y, speed].every(Number.isFinite)) return;

    const metricValue = mapMetric.value === 'speedup' && Number.isFinite(inletWindSpeed) && inletWindSpeed > 0
      ? speed / inletWindSpeed
      : speed;
    const normalized = Math.max(0, Math.min(1, (metricValue - min) / (max - min)));
    const colorIndex = Math.min(511, Math.max(0, Math.round(normalized * 511)));
    const colorOffset = colorIndex * 3;
    const px = Math.round(((x - xMin) / xSpan) * (width - 1));
    const py = Math.round(((yMax - y) / ySpan) * (height - 1));
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    stampPoint(px, py, colorOffset);
  });

  ctx.putImageData(imageData, 0, 0);
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return true;
};

const drawInterpolatedResourceStage = (ctx, width, height) => {
  const plane = resourcePlane.value;
  if (!plane?.nx || !plane?.ny) return;

  const { min, max } = resourceRenderRange.value;
  const inlet = resourceMeta.value?.inletWindSpeed;
  const xSpan = Number(plane.xMax) - Number(plane.xMin);
  const ySpan = Number(plane.yMax) - Number(plane.yMin);
  if (!(xSpan > 0) || !(ySpan > 0)) return;
  const cellWidth = width / Math.max(plane.nx, 1);
  const cellHeight = height / Math.max(plane.ny, 1);

  for (let iy = 0; iy < plane.ny; iy += 1) {
    const py = ((plane.ny - 1 - iy + 0.5) / plane.ny) * height;

    for (let ix = 0; ix < plane.nx; ix += 1) {
      const valueIndex = iy * plane.nx + ix;
      const speed = plane.values[valueIndex];
      if (!Number.isFinite(speed)) continue;

      const px = ((ix + 0.5) / plane.nx) * width;
      const metricValue = mapMetric.value === 'speedup' && Number.isFinite(inlet) && inlet > 0
        ? speed / inlet
        : speed;

      ctx.fillStyle = interpolateColor(metricValue, min, max);
      ctx.fillRect(px - cellWidth / 2, py - cellHeight / 2, cellWidth + 0.8, cellHeight + 0.8);
    }
  }

  ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
};

const drawResourceStage = async () => {
  if (!resourceCanvasRef.value || !pageReady.value) return;
  const canvas = resourceCanvasRef.value;
  const width = 800;
  const height = 800;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  if (drawRawOverlayResourceStage(ctx, width, height)) {
    return;
  }

  drawInterpolatedResourceStage(ctx, width, height);
};

const buildRoseSeries = () => {
  const sectorCount = 16;
  const activeAngle = Number(resourceMeta.value?.windAngleDeg ?? 0);
  const activeIndex = ((Math.round(activeAngle / (360 / sectorCount)) % sectorCount) + sectorCount) % sectorCount;
  const activeValue = Number.isFinite(selectedRow.value?.vectorWindowUx)
    ? Math.max(1, selectedRow.value.vectorWindowUx)
    : Number(resourceMeta.value?.inletWindSpeed ?? 1);

  return Array.from({ length: sectorCount }, (_, index) => ({
    value: index === activeIndex ? activeValue : 0.35,
    name: `${index * 22.5}°`,
    itemStyle: {
      color: index === activeIndex ? '#2563eb' : '#d7e3ff',
    },
  }));
};

const updateSectorChart = () => {
  if (!sectorChartRef.value || !pageReady.value) return;
  if (!sectorChart) {
    sectorChart = echarts.init(sectorChartRef.value);
  }

  sectorChart.setOption({
    animation: false,
    tooltip: { trigger: 'item' },
    polar: {},
    angleAxis: {
      type: 'category',
      data: Array.from({ length: 16 }, (_, index) => `${index * 22.5}°`),
      boundaryGap: false,
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    radiusAxis: {
      min: 0,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)' } },
    },
    series: [
      {
        type: 'bar',
        coordinateSystem: 'polar',
        roundCap: true,
        data: buildRoseSeries(),
        barWidth: '68%',
      },
    ],
  });
};

const updateProfileChart = () => {
  if (!profileChartRef.value || !pageReady.value) return;
  if (!profileChart) {
    profileChart = echarts.init(profileChartRef.value);
  }

  if (!profileData.value?.heights?.length || !profileData.value?.speeds?.length) {
    profileChart.clear();
    return;
  }

  const points = profileData.value.heights.map((height, index) => [profileData.value.speeds[index], height]);

  profileChart.setOption({
    animation: false,
    grid: { left: 44, right: 18, top: 18, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    xAxis: {
      type: 'value',
      name: 'm/s',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
    },
    yAxis: {
      type: 'value',
      name: 'm',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: '#0f766e' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(15, 118, 110, 0.28)' },
            { offset: 1, color: 'rgba(15, 118, 110, 0.03)' },
          ]),
        },
        data: points,
        markLine: {
          symbol: 'none',
          label: { show: false },
          lineStyle: { type: 'dashed', color: '#f97316', width: 1.5 },
          data: [{ yAxis: selectedHeight.value }],
        },
      },
    ],
  });
};

const updateAllCharts = () => {
  drawResourceStage();
  updateSectorChart();
  updateProfileChart();
};

const resizeCharts = () => {
  drawResourceStage();
  sectorChart?.resize();
  profileChart?.resize();
};

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toFixed(digits);
};

const formatSigned = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '-';
  const normalized = Number(value);
  const prefix = normalized > 0 ? '+' : '';
  return `${prefix}${normalized.toFixed(digits)}`;
};

const formatPercentRatio = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '-';
  return (Number(value) * 100).toFixed(digits);
};

const summaryValue = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toFixed(digits);
};

const gapClass = (value) => {
  if (!Number.isFinite(value)) return '';
  if (value > 0) return 'gap-positive';
  if (value < 0) return 'gap-negative';
  return '';
};

watch(
  () => props.caseId,
  async (newValue, oldValue) => {
    if (!newValue || newValue === oldValue) return;
    const ok = await ensureCaseLoaded(newValue);
    if (ok) await loadPageData();
  }
);

watch(selectedHeight, async (newValue, oldValue) => {
  if (!pageReady.value || suppressHeightWatch.value) return;
  if (!Number.isFinite(newValue) || newValue === oldValue) return;
  try {
    await loadResourceLayer(newValue);
    await nextTick();
    drawResourceStage();
  } catch (error) {
    pageError.value = getApiErrorMessage(error, '风资源平面层加载失败');
  }
});

watch(selectedTurbineId, async (newValue, oldValue) => {
  if (!newValue || newValue === oldValue) {
    await nextTick();
    updateAllCharts();
    return;
  }
  await loadProfile(newValue);
  await nextTick();
  updateAllCharts();
});

watch([mapMetric, rankingMode], async () => {
  await nextTick();
  updateAllCharts();
});

watch([resourceMapData, rawOverlayData, vectorData, experimentalData], async () => {
  await nextTick();
  updateAllCharts();
});

onMounted(async () => {
  if (!props.caseId) return;
  window.addEventListener('resize', resizeCharts);
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadPageData();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  sectorChart?.dispose();
  profileChart?.dispose();
  sectorChart = null;
  profileChart = null;
});
</script>

<style scoped>
.resource-lab {
  max-width: 1600px;
  min-height: 100%;
  margin: 0 auto;
  padding: 24px;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #1e293b;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding: 24px 26px;
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 28%),
    linear-gradient(135deg, #f7fbff 0%, #f3f7f1 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.07);
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #2563eb;
  margin-bottom: 8px;
}

.title-block h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 650;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
}

.toolbar-select {
  width: 132px;
}

.toolbar-group {
  flex-wrap: wrap;
}

.status-alert {
  margin-top: 16px;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #1d4f91;
  border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.stats-card,
.panel {
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.stats-card {
  border-radius: 18px;
  padding: 18px 18px 16px;
}

.stats-label,
.stats-unit {
  font-size: 13px;
  color: #64748b;
}

.stats-value {
  margin: 10px 0 8px;
  font-size: 28px;
  font-weight: 650;
  color: #0f172a;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(380px, 0.95fr);
  gap: 18px;
  margin-top: 18px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.panel {
  border-radius: 20px;
  padding: 20px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.panel-head-meta {
  display: flex;
  gap: 10px;
  color: #64748b;
  font-size: 13px;
}

.map-shell,
.mini-panel {
  position: relative;
}

.map-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  margin: 0 auto;
}

.chart-surface {
  width: 100%;
}

.resource-stage-wrap {
  width: min(100%, 860px);
}

.resource-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  min-height: 560px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.resource-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.resource-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.resource-marker-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #1e293b;
  border: 1.5px solid #dbeafe;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
}

.resource-marker-active .resource-marker-dot {
  width: 14px;
  height: 14px;
  background: #ffffff;
  border: 2px solid #f97316;
  box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.14);
}

.resource-marker-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  line-height: 1;
  color: #334155;
  white-space: nowrap;
  pointer-events: none;
}

.map-legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 56px;
}

.map-legend-title {
  font-size: 12px;
  color: #475569;
}

.map-legend-bar {
  width: 18px;
  height: 240px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.map-legend-ticks {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 240px;
  font-size: 11px;
  color: #64748b;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.mini-panel {
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.14);
  padding: 14px;
}

.mini-title {
  font-size: 13px;
  color: #475569;
  margin-bottom: 10px;
}

.mini-surface {
  height: 220px;
}

.mini-note {
  margin-top: 10px;
  font-size: 12px;
  color: #b45309;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.66);
  border-radius: 16px;
}

.quick-band {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.quick-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.quick-item span,
.focus-metric span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.quick-item strong,
.focus-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  color: #0f172a;
}

.focus-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.focus-metric {
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, #fcfdff 0%, #f7fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.flag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.flag-pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
}

.compact-table {
  min-width: 720px;
}

.data-table th,
.data-table td {
  padding: 11px 12px;
  text-align: left;
  border-bottom: 1px solid #e5edf6;
  white-space: nowrap;
  font-size: 13px;
}

.data-table th {
  position: sticky;
  top: 0;
  background: #eaf2ff;
  color: #163666;
  font-weight: 600;
}

.data-table tbody tr {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.data-table tbody tr:hover {
  background: #f8fbff;
}

.row-active {
  background: #eef6ff !important;
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.warning-item {
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff8e6;
  color: #7a4b00;
  border: 1px solid #f2d084;
  font-size: 13px;
}

.gap-positive {
  color: #0f9d58;
  font-weight: 700;
}

.gap-negative {
  color: #d93025;
  font-weight: 700;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(2px);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(37, 99, 235, 0.18);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.loading-overlay p {
  margin-top: 14px;
  color: #334155;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .workspace-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .resource-lab {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
  }

  .toolbar {
    justify-content: flex-start;
  }

  .quick-band,
  .focus-grid,
  .mini-grid {
    grid-template-columns: 1fr;
  }

  .map-surface {
    min-height: 420px;
  }

  .map-shell {
    flex-direction: column;
  }

  .map-legend {
    flex-direction: row;
    min-width: auto;
  }

  .map-legend-bar {
    width: 220px;
    height: 16px;
    background: linear-gradient(to right, #00007f, #001dff, #00a3ff, #2dffc4, #b1ff4a, #ffe600, #ff7a00, #d50000);
  }

  .map-legend-ticks {
    flex-direction: row;
    width: 220px;
    height: auto;
  }
}
</style>
