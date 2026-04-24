<template>
  <div class="performance-diagnostic">
    <div class="toolbar">
      <div class="toolbar-main">
        <h1>风机性能诊断</h1>
        <el-select v-model="selectedTurbineId" filterable class="toolbar-select">
          <el-option
            v-for="row in rows"
            :key="row.id"
            :label="row.name"
            :value="row.id"
          />
        </el-select>
        <el-select v-model="sortMode" class="sort-select">
          <el-option label="功率差" value="gap" />
          <el-option label="失配角" value="misalignment" />
          <el-option label="上下半盘差" value="shear" />
          <el-option label="ADJUST功率" value="adjustPower" />
        </el-select>
      </div>

      <el-button :icon="Refresh" :loading="loading" circle @click="loadPageData" />
    </div>

    <el-alert
      v-if="pageError"
      type="error"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>性能诊断加载失败</template>
      <template #default>
        {{ pageError }}
        <el-button type="primary" link @click="loadPageData">重试</el-button>
      </template>
    </el-alert>

    <template v-if="pageReady">
      <section class="kpi-grid">
        <div v-for="card in kpiCards" :key="card.label" class="kpi-card">
          <span>{{ card.label }}</span>
          <strong :class="card.tone ? gapClass(card.toneValue) : ''">{{ card.value }}</strong>
          <em>{{ card.unit }}</em>
        </div>
      </section>

      <section class="main-grid">
        <div class="panel chart-panel">
          <div class="panel-head">
            <h2>总功率口径</h2>
            <span>MW</span>
          </div>
          <div ref="totalChartRef" class="chart-surface"></div>
        </div>

        <div class="panel chart-panel">
          <div class="panel-head">
            <h2>单机功率差</h2>
            <span>{{ rankingLabel }}</span>
          </div>
          <div ref="gapChartRef" class="chart-surface"></div>
        </div>

        <div class="panel focus-panel">
          <div class="panel-head">
            <h2>{{ selectedRow?.name || '-' }}</h2>
            <span>{{ selectedRow?.modelId ? `模型 ${selectedRow.modelId}` : '-' }}</span>
          </div>
          <div class="metric-grid">
            <div v-for="item in selectedMetrics" :key="item.label" class="metric-cell">
              <span>{{ item.label }}</span>
              <strong :class="item.tone ? gapClass(item.toneValue) : ''">{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="panel table-panel">
        <div class="panel-head">
          <h2>机组台账</h2>
          <span>{{ rows.length }} 台</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>风机</th>
                <th>ADJUST U</th>
                <th>ADJUST P</th>
                <th>窗口 Ux</th>
                <th>窗口 P</th>
                <th>功率差</th>
                <th>失配角</th>
                <th>上下半盘差</th>
                <th>覆盖率</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rankingRows"
                :key="row.id"
                :class="{ active: row.id === selectedTurbineId }"
                @click="selectedTurbineId = row.id"
              >
                <td>{{ row.name }}</td>
                <td>{{ formatNumber(row.adjustSpeed, 2) }}</td>
                <td>{{ formatNumber(row.adjustPower, 0) }}</td>
                <td>{{ formatNumber(row.windowUx, 2) }}</td>
                <td>{{ formatNumber(row.windowPower, 0) }}</td>
                <td :class="gapClass(row.windowPowerGap)">{{ formatSigned(row.windowPowerGap, 0) }}</td>
                <td>{{ formatNumber(row.windowMisalignment, 1) }}</td>
                <td>{{ formatSigned(row.diskTopBottomUxDelta, 2) }}</td>
                <td>{{ formatPercent(row.windowCoverageRatio, 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { Loading, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useCaseStore } from '@/store/caseStore';

const props = defineProps({ caseId: { type: String, required: true } });
const caseStore = useCaseStore();

const loading = ref(false);
const pageError = ref('');
const scalarData = ref(null);
const vectorData = ref(null);
const selectedTurbineId = ref('');
const sortMode = ref('gap');
const totalChartRef = ref(null);
const gapChartRef = ref(null);

let totalChart = null;
let gapChart = null;

const formatNumber = (value, digits = 2) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-'
);
const formatSigned = (value, digits = 1) => {
  if (!Number.isFinite(Number(value))) return '-';
  const numeric = Number(value);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)}`;
};
const formatPercent = (value, digits = 0) => (
  Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)}%` : '-'
);
const toMw = (kw) => (Number.isFinite(Number(kw)) ? Number(kw) / 1000 : null);
const subtractIfFinite = (a, b) => (
  Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? Number(a) - Number(b) : null
);
const absNumber = (value) => (Number.isFinite(Number(value)) ? Math.abs(Number(value)) : 0);
const gapClass = (value) => {
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) < 1e-6) return '';
  return Number(value) > 0 ? 'gap-positive' : 'gap-negative';
};

const pageReady = computed(() => Boolean(scalarData.value?.success && vectorData.value?.success));
const scalarSummary = computed(() => scalarData.value?.summary || {});
const vectorSummary = computed(() => vectorData.value?.summary || {});
const scalarMap = computed(() => new Map((scalarData.value?.turbines || []).map((item) => [item.id, item])));
const vectorMap = computed(() => new Map((vectorData.value?.turbines || []).map((item) => [item.id, item])));

const rows = computed(() => {
  const ids = new Set([...scalarMap.value.keys(), ...vectorMap.value.keys()]);
  return [...ids].map((id) => {
    const scalar = scalarMap.value.get(id) || {};
    const vector = vectorMap.value.get(id) || {};
    const adjustPower = scalar.adjust?.power ?? vector.adjust?.power ?? null;
    const windowPower = vector.curvePowerAtWindowUx ?? null;
    const diskPower = vector.curvePowerAtDiskEquivalentUx ?? null;
    const scalarDiskPower = scalar.curvePowerAtRotorEquivalentSpeed ?? null;
    const scalarWindowPower = scalar.curvePowerAtSolverWindowSpeed ?? null;
    return {
      id,
      name: scalar.name || vector.name || id,
      modelId: scalar.modelId || vector.modelId || null,
      adjustSpeed: scalar.adjust?.speed ?? vector.adjust?.speed ?? null,
      adjustPower,
      windowUx: vector.windowMeanUx ?? null,
      windowPower,
      windowPowerGap: vector.vectorWindowPowerGapToSolver ?? subtractIfFinite(windowPower, adjustPower),
      diskUx: vector.diskEquivalentUx ?? null,
      diskPower,
      diskPowerGap: vector.vectorRotorPowerGapToSolver ?? subtractIfFinite(diskPower, adjustPower),
      scalarWindowSpeed: scalar.solverWindowMeanSpeedFromField ?? null,
      scalarWindowPower,
      scalarWindowPowerGap: scalar.solverWindowPowerGapToSolver ?? subtractIfFinite(scalarWindowPower, adjustPower),
      scalarRotorEquivalentSpeed: scalar.rotorEquivalentSpeedFromField ?? null,
      scalarRotorEquivalentPower: scalarDiskPower,
      scalarRotorEquivalentGap: scalar.powerGapToSolver ?? subtractIfFinite(scalarDiskPower, adjustPower),
      windowMisalignment: vector.windowMisalignmentDeg ?? null,
      diskMisalignment: vector.diskMisalignmentDeg ?? null,
      diskTopBottomUxDelta: vector.diskTopBottomUxDelta ?? scalar.rotorTopBottomDelta ?? null,
      windowReverseFlowRatio: vector.windowReverseFlowRatio ?? null,
      windowCoverageRatio: vector.windowCoverageRatio ?? scalar.solverWindowCoverageRatio ?? null,
      diskCoverageRatio: vector.diskCoverageRatio ?? scalar.coverageRatio ?? null,
    };
  });
});

const sortedRows = computed(() => {
  const list = [...rows.value];
  const sorters = {
    gap: (a, b) => absNumber(b.windowPowerGap) - absNumber(a.windowPowerGap),
    misalignment: (a, b) => absNumber(b.windowMisalignment) - absNumber(a.windowMisalignment),
    shear: (a, b) => absNumber(b.diskTopBottomUxDelta) - absNumber(a.diskTopBottomUxDelta),
    adjustPower: (a, b) => Number(b.adjustPower || 0) - Number(a.adjustPower || 0),
  };
  return list.sort(sorters[sortMode.value] || sorters.gap);
});
const rankingRows = computed(() => sortedRows.value);
const chartRows = computed(() => sortedRows.value.slice(0, 12).reverse());
const selectedRow = computed(() => (
  rows.value.find((item) => item.id === selectedTurbineId.value) || rows.value[0] || null
));
const rankingLabel = computed(() => ({
  gap: '按功率差',
  misalignment: '按失配角',
  shear: '按上下半盘差',
  adjustPower: '按ADJUST功率',
}[sortMode.value] || '按功率差'));

const totalWindowGapMw = computed(() => subtractIfFinite(
  toMw(vectorSummary.value.totalCurvePowerAtWindowUx),
  toMw(scalarSummary.value.totalSolverAdjustedPower),
));
const kpiCards = computed(() => [
  { label: 'ADJUST总功率', value: formatNumber(toMw(scalarSummary.value.totalSolverAdjustedPower), 2), unit: 'MW' },
  { label: '窗口Ux总功率', value: formatNumber(toMw(vectorSummary.value.totalCurvePowerAtWindowUx), 2), unit: 'MW' },
  { label: '总功率差', value: formatSigned(totalWindowGapMw.value, 2), unit: 'MW', tone: true, toneValue: totalWindowGapMw.value },
  { label: '单机平均差', value: formatNumber(vectorSummary.value.averageAbsoluteWindowPowerGap, 1), unit: 'kW' },
  { label: '平均失配角', value: formatNumber(vectorSummary.value.averageWindowMisalignmentDeg, 1), unit: 'deg' },
  { label: '高失配机组', value: formatNumber(vectorSummary.value.highWindowMisalignmentCount, 0), unit: '台' },
]);

const selectedMetrics = computed(() => {
  const row = selectedRow.value;
  if (!row) return [];
  return [
    { label: 'ADJUST风速', value: `${formatNumber(row.adjustSpeed, 2)} m/s` },
    { label: 'ADJUST功率', value: `${formatNumber(row.adjustPower, 0)} kW` },
    { label: '窗口Ux', value: `${formatNumber(row.windowUx, 2)} m/s` },
    { label: '窗口Ux功率', value: `${formatNumber(row.windowPower, 0)} kW` },
    { label: '窗口功率差', value: `${formatSigned(row.windowPowerGap, 0)} kW`, tone: true, toneValue: row.windowPowerGap },
    { label: '盘面Ux功率差', value: `${formatSigned(row.diskPowerGap, 0)} kW`, tone: true, toneValue: row.diskPowerGap },
    { label: '标量窗口差', value: `${formatSigned(row.scalarWindowPowerGap, 0)} kW`, tone: true, toneValue: row.scalarWindowPowerGap },
    { label: '标量盘面差', value: `${formatSigned(row.scalarRotorEquivalentGap, 0)} kW`, tone: true, toneValue: row.scalarRotorEquivalentGap },
    { label: '窗口失配角', value: `${formatNumber(row.windowMisalignment, 1)} deg` },
    { label: '盘面失配角', value: `${formatNumber(row.diskMisalignment, 1)} deg` },
    { label: '上下半盘差', value: `${formatSigned(row.diskTopBottomUxDelta, 2)} m/s`, tone: true, toneValue: row.diskTopBottomUxDelta },
    { label: '反流比例', value: formatPercent(row.windowReverseFlowRatio, 2) },
  ];
});

const totalBars = computed(() => [
  { name: 'ADJUST', value: toMw(scalarSummary.value.totalSolverAdjustedPower), color: '#334155' },
  { name: '窗口Ux', value: toMw(vectorSummary.value.totalCurvePowerAtWindowUx), color: '#2563eb' },
  { name: '盘面Ux', value: toMw(vectorSummary.value.totalCurvePowerAtDiskEquivalentUx), color: '#0f9f6e' },
  { name: '标量窗口', value: toMw(scalarSummary.value.totalCurvePowerAtSolverWindowSpeed), color: '#f59e0b' },
  { name: '标量盘面', value: toMw(scalarSummary.value.totalCurvePowerAtRotorEquivalentSpeed), color: '#ef4444' },
].filter((item) => Number.isFinite(item.value)));

const initCharts = () => {
  if (totalChartRef.value && (!totalChart || totalChart.isDisposed())) {
    totalChart = echarts.init(totalChartRef.value);
  }
  if (gapChartRef.value && (!gapChart || gapChart.isDisposed())) {
    gapChart = echarts.init(gapChartRef.value);
  }
  renderCharts();
};

const renderCharts = () => {
  if (totalChart) {
    totalChart.setOption({
      animation: false,
      grid: { left: 42, right: 16, top: 18, bottom: 42 },
      tooltip: { trigger: 'axis', appendToBody: true },
      xAxis: {
        type: 'category',
        data: totalBars.value.map((item) => item.name),
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(148,163,184,.18)' } },
      },
      series: [{
        type: 'bar',
        barWidth: 30,
        data: totalBars.value.map((item) => ({
          value: item.value,
          itemStyle: { color: item.color, borderRadius: [6, 6, 0, 0] },
        })),
      }],
    }, true);
  }

  if (gapChart) {
    gapChart.setOption({
      animation: false,
      grid: { left: 76, right: 30, top: 14, bottom: 26 },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        formatter: (params) => {
          const item = params?.[0];
          if (!item) return '';
          return `${item.name}<br>功率差 ${formatSigned(item.value, 1)} kW`;
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(148,163,184,.18)' } },
      },
      yAxis: {
        type: 'category',
        data: chartRows.value.map((item) => item.name),
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: chartRows.value.map((item) => ({
          value: Number.isFinite(Number(item.windowPowerGap)) ? Number(item.windowPowerGap) : 0,
          itemStyle: {
            color: Number(item.windowPowerGap) >= 0 ? '#d97706' : '#2563eb',
            borderRadius: 5,
          },
        })),
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#94a3b8', type: 'dashed' },
          data: [{ xAxis: 0 }],
        },
      }],
    }, true);
  }
};

const handleResize = () => {
  totalChart?.resize();
  gapChart?.resize();
};

const loadPageData = async () => {
  if (!props.caseId) return;
  loading.value = true;
  pageError.value = '';
  try {
    if (caseStore.caseId !== props.caseId || caseStore.currentCaseId !== props.caseId) {
      await caseStore.initializeCase(props.caseId);
    }
    const [scalarResponse, vectorResponse] = await Promise.all([
      axios.get(`/api/cases/${props.caseId}/experimental-turbine-performance`),
      axios.get(`/api/cases/${props.caseId}/experimental-turbine-vector-diagnostics`),
    ]);
    if (!scalarResponse.data?.success) throw new Error(scalarResponse.data?.message || '标量性能接口异常');
    if (!vectorResponse.data?.success) throw new Error(vectorResponse.data?.message || '矢量性能接口异常');
    scalarData.value = scalarResponse.data;
    vectorData.value = vectorResponse.data;
    if (!rows.value.some((item) => item.id === selectedTurbineId.value)) {
      selectedTurbineId.value = sortedRows.value[0]?.id || '';
    }
    await nextTick();
    initCharts();
  } catch (error) {
    pageError.value = error?.response?.data?.message || error?.message || '加载失败';
    ElMessage.error(pageError.value);
  } finally {
    loading.value = false;
  }
};

watch([sortMode, rows], async () => {
  await nextTick();
  renderCharts();
}, { deep: true });

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await loadPageData();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (totalChart && !totalChart.isDisposed()) totalChart.dispose();
  if (gapChart && !gapChart.isDisposed()) gapChart.dispose();
  totalChart = null;
  gapChart = null;
});
</script>

<style scoped>
.performance-diagnostic{position:relative;min-height:100%;padding:22px;background:#f5f8fc;color:#122038}
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
.toolbar-main{display:flex;min-width:0;align-items:center;gap:12px}
.toolbar h1{margin:0 12px 0 0;font-size:1.35rem;font-weight:750;letter-spacing:0;color:#122038}
.toolbar-select{width:220px}
.sort-select{width:150px}
.status-alert{margin-bottom:14px}
.kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}
.kpi-card{display:grid;gap:6px;min-height:86px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:#fff;padding:14px 16px;box-shadow:0 12px 24px rgba(15,23,42,.04)}
.kpi-card span{font-size:.78rem;color:#64748b}
.kpi-card strong{font-size:1.22rem;color:#122038}
.kpi-card em{font-style:normal;font-size:.75rem;color:#7b8aa2}
.main-grid{display:grid;grid-template-columns:1fr 1.1fr 1.05fr;gap:14px;margin-bottom:14px}
.panel{border:1px solid rgba(148,163,184,.2);border-radius:10px;background:#fff;box-shadow:0 14px 28px rgba(15,23,42,.04)}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 8px}
.panel-head h2{margin:0;font-size:1rem;font-weight:750;color:#122038}
.panel-head span{font-size:.78rem;color:#718096}
.chart-panel{min-height:320px;display:flex;flex-direction:column}
.chart-surface{flex:1;min-height:250px}
.focus-panel{min-height:320px}
.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:8px 16px 16px}
.metric-cell{display:grid;gap:6px;border-radius:8px;border:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,#f8fafc,#f1f5f9);padding:11px 12px}
.metric-cell span{font-size:.74rem;color:#64748b}
.metric-cell strong{font-size:.95rem;color:#122038;line-height:1.3}
.table-panel{overflow:hidden}
.table-wrap{max-height:420px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:.84rem}
th,td{padding:10px 12px;border-top:1px solid rgba(148,163,184,.14);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th{position:sticky;top:0;z-index:1;background:#f8fafc;color:#64748b;font-weight:700}
tbody tr{cursor:pointer}
tbody tr:hover,tbody tr.active{background:#eff6ff}
.gap-positive{color:#b45309!important}
.gap-negative{color:#2563eb!important}
.loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.7);z-index:10}
@media (max-width:1280px){
  .kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .main-grid{grid-template-columns:1fr}
  .chart-panel,.focus-panel{min-height:300px}
}
@media (max-width:760px){
  .performance-diagnostic{padding:14px}
  .toolbar,.toolbar-main{align-items:stretch;flex-direction:column}
  .toolbar-select,.sort-select{width:100%}
  .kpi-grid,.metric-grid{grid-template-columns:1fr}
}
</style>
