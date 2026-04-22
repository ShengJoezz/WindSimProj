<template>
  <div class="performance-lab">
    <header class="header">
      <h1>风机性能实验分析</h1>
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
      <template #title>实验分析加载失败</template>
      <template #default>
        {{ pageError }}
        <el-button type="primary" link @click="retryLoad">重试</el-button>
      </template>
    </el-alert>

    <template v-if="!pageError">
      <div v-if="methodBadges.length" class="badge-row">
        <div v-for="badge in methodBadges" :key="badge.label" class="meta-pill">
          <span>{{ badge.label }}</span>
          <strong>{{ badge.value }}</strong>
        </div>
      </div>

      <div class="dashboard">
        <div
          v-for="card in dashboardCards"
          :key="card.label"
          class="stats-card"
        >
          <div class="stats-label">{{ card.label }}</div>
          <div class="stats-value" :class="card.tone ? gapClass(card.toneValue) : ''">
            {{ card.value }}
          </div>
          <div v-if="card.unit" class="stats-label">{{ card.unit }}</div>
        </div>
      </div>

      <div v-if="summaryRows.length" class="chart-container">
        <h2>口径总表</h2>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>口径</th>
                <th>平均风速 (m/s)</th>
                <th>总功率 (kW)</th>
                <th>总功率差 (kW)</th>
                <th>平均绝对风速差 (m/s)</th>
                <th>平均绝对功率差 (kW)</th>
                <th>平均覆盖率 (%)</th>
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
      </div>

      <div v-if="focusRows.length" class="chart-container">
        <h2>重点风机</h2>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>风机</th>
                <th>ADJUST功率</th>
                <th>窗口功率</th>
                <th>窗口功率差</th>
                <th>立方等效功率</th>
                <th>立方功率差</th>
                <th>窗口风速</th>
                <th>立方等效风速</th>
                <th>盘面非均匀度 (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in focusRows" :key="`focus-${item.id}`">
                <td>{{ item.name }}</td>
                <td>{{ formatNumber(item.adjust?.power, 1) }}</td>
                <td>{{ formatNumber(item.curvePowerAtSolverWindowSpeed, 1) }}</td>
                <td :class="gapClass(item.solverWindowPowerGapToSolver)">{{ formatSigned(item.solverWindowPowerGapToSolver, 1) }}</td>
                <td>{{ formatNumber(item.curvePowerAtRotorEquivalentSpeed, 1) }}</td>
                <td :class="gapClass(item.powerGapToSolver)">{{ formatSigned(item.powerGapToSolver, 1) }}</td>
                <td>{{ formatNumber(item.solverWindowMeanSpeedFromField, 2) }}</td>
                <td>{{ formatNumber(item.rotorEquivalentSpeedFromField, 2) }}</td>
                <td>{{ formatPercentRatio(item.rotorNonUniformityRatio, 1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="rows.length" class="chart-container">
        <h2>单机对照</h2>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>风机</th>
                <th>ADJUST风速</th>
                <th>窗口风速</th>
                <th>轮毂点风速</th>
                <th>盘均风速</th>
                <th>立方等效风速</th>
                <th>ADJUST功率</th>
                <th>窗口功率</th>
                <th>立方等效功率</th>
                <th>窗口功率差</th>
                <th>立方功率差</th>
                <th>窗口dx</th>
                <th>窗口覆盖率</th>
                <th>盘面覆盖率</th>
                <th>盘面非均匀度</th>
                <th>上下半盘差</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in rows" :key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ formatNumber(item.adjust?.speed, 2) }}</td>
                <td>{{ formatNumber(item.solverWindowMeanSpeedFromField, 2) }}</td>
                <td>{{ formatNumber(item.hubSpeedFromField, 2) }}</td>
                <td>{{ formatNumber(item.rotorMeanSpeedFromField, 2) }}</td>
                <td>{{ formatNumber(item.rotorEquivalentSpeedFromField, 2) }}</td>
                <td>{{ formatNumber(item.adjust?.power, 1) }}</td>
                <td>{{ formatNumber(item.curvePowerAtSolverWindowSpeed, 1) }}</td>
                <td>{{ formatNumber(item.curvePowerAtRotorEquivalentSpeed, 1) }}</td>
                <td :class="gapClass(item.solverWindowPowerGapToSolver)">{{ formatSigned(item.solverWindowPowerGapToSolver, 1) }}</td>
                <td :class="gapClass(item.powerGapToSolver)">{{ formatSigned(item.powerGapToSolver, 1) }}</td>
                <td>{{ formatNumber(item.solverWindowDxMeters, 1) }}</td>
                <td>{{ formatPercentRatio(item.solverWindowCoverageRatio, 1) }}</td>
                <td>{{ formatPercentRatio(item.coverageRatio, 1) }}</td>
                <td>{{ formatPercentRatio(item.rotorNonUniformityRatio, 1) }}</td>
                <td>{{ formatSigned(item.rotorTopBottomDelta, 2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="notes.length" class="chart-container">
        <h2>注意项</h2>
        <div class="warnings-list">
          <div v-for="note in notes" :key="note" class="warning-item">{{ note }}</div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载实验分析中...</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
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
const pageError = ref('');
const experimentalData = ref(null);

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
      message: '实验分析依赖 speed.bin 和 Output 文件，请先完成计算。',
      actionText: '去计算输出',
      action: goToCalculation,
    };
  }
  return null;
});

const summary = computed(() => experimentalData.value?.summary || null);
const warnings = computed(() => experimentalData.value?.warnings || []);
const method = computed(() => experimentalData.value?.method || null);
const notes = computed(() => {
  const items = [
    ...(Array.isArray(method.value?.limitations) ? method.value.limitations : []),
    ...warnings.value,
  ];
  return Array.from(new Set(items.filter(Boolean)));
});

const getDominantPowerGap = (item) => {
  const windowGap = Math.abs(Number(item?.solverWindowPowerGapToSolver) || 0);
  const rotorGap = Math.abs(Number(item?.powerGapToSolver) || 0);
  return Math.max(windowGap, rotorGap);
};

const rows = computed(() => {
  const items = experimentalData.value?.turbines || [];
  return [...items].sort((a, b) => getDominantPowerGap(b) - getDominantPowerGap(a));
});

const focusRows = computed(() => rows.value.slice(0, 10));

const subtractIfFinite = (left, right) => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Number(left) - Number(right);
};

const solverWindowTotalPowerGap = computed(() =>
  subtractIfFinite(summary.value?.totalCurvePowerAtSolverWindowSpeed, summary.value?.totalSolverAdjustedPower)
);
const rotorEquivalentTotalPowerGap = computed(() =>
  subtractIfFinite(summary.value?.totalCurvePowerAtRotorEquivalentSpeed, summary.value?.totalSolverAdjustedPower)
);

const dashboardCards = computed(() => [
  {
    label: '风机数量',
    value: summaryValue(summary.value?.turbineCount, 0),
    unit: '',
  },
  {
    label: 'ADJUST总功率',
    value: summaryValue(summary.value?.totalSolverAdjustedPower, 0),
    unit: 'kW',
  },
  {
    label: '窗口复现总功率',
    value: summaryValue(summary.value?.totalCurvePowerAtSolverWindowSpeed, 0),
    unit: 'kW',
  },
  {
    label: '立方等效总功率',
    value: summaryValue(summary.value?.totalCurvePowerAtRotorEquivalentSpeed, 0),
    unit: 'kW',
  },
  {
    label: '窗口总功率差',
    value: formatSigned(solverWindowTotalPowerGap.value, 0),
    unit: 'kW',
    tone: true,
    toneValue: solverWindowTotalPowerGap.value,
  },
  {
    label: '立方总功率差',
    value: formatSigned(rotorEquivalentTotalPowerGap.value, 0),
    unit: 'kW',
    tone: true,
    toneValue: rotorEquivalentTotalPowerGap.value,
  },
  {
    label: '窗口平均绝对功率差',
    value: summaryValue(summary.value?.averageAbsoluteSolverWindowPowerGap, 1),
    unit: 'kW',
  },
  {
    label: '立方平均绝对功率差',
    value: summaryValue(summary.value?.averageAbsoluteRotorEquivalentPowerGap, 1),
    unit: 'kW',
  },
  {
    label: '窗口更接近台数',
    value: summaryValue(summary.value?.solverWindowCloserOnPowerCount, 0),
    unit: '台',
  },
  {
    label: '立方更接近台数',
    value: summaryValue(summary.value?.rotorEquivalentCloserOnPowerCount, 0),
    unit: '台',
  },
]);

const methodBadges = computed(() => {
  const badges = [];
  if (Number.isFinite(method.value?.sampleResolution)) {
    badges.push({ label: '采样分辨率', value: String(method.value.sampleResolution) });
  }
  if (Number.isFinite(method.value?.solverWindow?.upstreamOffsetRotorDiameter)) {
    badges.push({ label: '窗口中心', value: `上游 ${method.value.solverWindow.upstreamOffsetRotorDiameter}D` });
  }
  if (Number.isFinite(method.value?.solverWindow?.axialHalfSpanDxMultiplier)) {
    badges.push({ label: '窗口轴向', value: `±${method.value.solverWindow.axialHalfSpanDxMultiplier}dx` });
  }
  if (Number.isFinite(method.value?.solverWindow?.radialFractionOfRotorDiameter)) {
    badges.push({ label: '窗口半径', value: `${(method.value.solverWindow.radialFractionOfRotorDiameter * 100).toFixed(0)}% D` });
  }
  return badges;
});

const summaryRows = computed(() => {
  if (!summary.value) return [];
  return [
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
      id: 'solver-window',
      label: '求解器窗口复现',
      averageSpeed: summary.value.averageSolverWindowMeanSpeedFromField,
      totalPower: summary.value.totalCurvePowerAtSolverWindowSpeed,
      totalPowerGap: solverWindowTotalPowerGap.value,
      averageAbsoluteSpeedGap: summary.value.averageAbsoluteSolverWindowSpeedGap,
      averageAbsolutePowerGap: summary.value.averageAbsoluteSolverWindowPowerGap,
      coverageRatio: summary.value.averageSolverWindowCoverageRatio,
    },
    {
      id: 'rotor-equivalent',
      label: '转子盘立方等效',
      averageSpeed: summary.value.averageRotorEquivalentSpeedFromField,
      totalPower: summary.value.totalCurvePowerAtRotorEquivalentSpeed,
      totalPowerGap: rotorEquivalentTotalPowerGap.value,
      averageAbsoluteSpeedGap: summary.value.averageAbsoluteRotorEquivalentSpeedGap,
      averageAbsolutePowerGap: summary.value.averageAbsoluteRotorEquivalentPowerGap,
      coverageRatio: summary.value.averageCoverageRatio,
    },
  ];
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

const loadData = async () => {
  pageError.value = '';
  experimentalData.value = null;
  loading.value = true;
  try {
    if (caseStore.hasFetchedCalculationStatus && caseStore.calculationStatus !== 'completed') {
      return;
    }
    const response = await axios.get(`/api/cases/${props.caseId}/experimental-turbine-performance`);
    if (!response.data?.success) {
      throw new Error(response.data?.message || '实验分析接口未返回有效数据');
    }
    experimentalData.value = response.data;
  } catch (error) {
    pageError.value = getApiErrorMessage(error, '加载实验分析失败');
  } finally {
    loading.value = false;
  }
};

const retryLoad = async () => {
  pageError.value = '';
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadData();
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
    if (ok) await loadData();
  }
);

onMounted(async () => {
  if (!props.caseId) return;
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await loadData();
});

onBeforeUnmount(() => {
  loading.value = false;
});
</script>

<style scoped>
.performance-lab {
  max-width: 1500px;
  min-height: 100%;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #f9f9fb;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.header {
  text-align: center;
  margin-bottom: 24px;
  padding: 24px 0;
  background: linear-gradient(135deg, #1f4f99, #0f9d58);
  color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
}

.status-alert {
  margin: 12px 0;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0 20px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #edf4ff;
  color: #174a8b;
  border: 1px solid #cfe0fb;
  font-size: 13px;
}

.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stats-card {
  background-color: white;
  padding: 24px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-label {
  color: #5f6368;
  font-size: 14px;
  text-align: center;
}

.stats-value {
  font-size: 30px;
  font-weight: 600;
  color: #1f4f99;
  margin: 10px 0;
  text-align: center;
}

.chart-container {
  background-color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.chart-container h2 {
  color: #202124;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8eaed;
  font-size: 18px;
  font-weight: 500;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  background-color: white;
}

.data-table th,
.data-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #e8eaed;
  white-space: nowrap;
}

.data-table th {
  background-color: #1f4f99;
  color: white;
  position: sticky;
  top: 0;
}

.data-table tr:nth-child(even) {
  background-color: #f8f9fa;
}

.data-table tr:hover {
  background-color: #edf4ff;
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.warning-item {
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff8e6;
  color: #7a4b00;
  border: 1px solid #f1d68a;
}

.gap-positive {
  color: #0f9d58;
  font-weight: 600;
}

.gap-negative {
  color: #d93025;
  font-weight: 600;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1f4f99;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .performance-lab {
    padding: 14px;
  }

  .stats-value {
    font-size: 24px;
  }

  .chart-container {
    padding: 18px;
  }
}
</style>
