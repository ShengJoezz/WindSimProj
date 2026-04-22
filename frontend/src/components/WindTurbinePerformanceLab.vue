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

    <el-alert
      v-if="!pageError && !loading"
      type="info"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>实验口径说明</template>
      <template #default>
        立方等效风速指盘面采样风速先做立方平均再开三次方，因为功率对风速近似三次方敏感。
        这一页只做实验对照，不替代原始 Output04/06 页面。
      </template>
    </el-alert>

    <div v-if="!pageError" class="dashboard">
      <div class="stats-card">
        <div class="stats-label">风机数量</div>
        <div class="stats-value">{{ summaryValue(summary?.turbineCount, 0) }}</div>
      </div>
      <div class="stats-card">
        <div class="stats-label">ADJUST总功率</div>
        <div class="stats-value">{{ summaryValue(summary?.totalSolverAdjustedPower, 0) }}</div>
        <div class="stats-label">kW</div>
      </div>
      <div class="stats-card">
        <div class="stats-label">立方等效总功率</div>
        <div class="stats-value">{{ summaryValue(summary?.totalCurvePowerAtRotorEquivalentSpeed, 0) }}</div>
        <div class="stats-label">kW</div>
      </div>
      <div class="stats-card">
        <div class="stats-label">总功率差</div>
        <div class="stats-value" :class="gapClass(totalPowerGap)">{{ formatSigned(totalPowerGap, 0) }}</div>
        <div class="stats-label">kW</div>
      </div>
      <div class="stats-card">
        <div class="stats-label">平均ADJUST风速</div>
        <div class="stats-value">{{ summaryValue(summary?.averageSolverAdjustedSpeed, 2) }}</div>
        <div class="stats-label">m/s</div>
      </div>
      <div class="stats-card">
        <div class="stats-label">平均立方等效风速</div>
        <div class="stats-value">{{ summaryValue(summary?.averageRotorEquivalentSpeedFromField, 2) }}</div>
        <div class="stats-label">m/s</div>
      </div>
    </div>

    <div v-if="!pageError" class="chart-container">
      <h2>总量对照</h2>
      <div class="comparison-strip">
        <div class="comparison-item">
          <span class="comparison-label">原始主口径</span>
          <strong>{{ summaryValue(summary?.totalSolverAdjustedPower, 0) }} kW</strong>
        </div>
        <div class="comparison-item">
          <span class="comparison-label">实验立方等效口径</span>
          <strong>{{ summaryValue(summary?.totalCurvePowerAtRotorEquivalentSpeed, 0) }} kW</strong>
        </div>
        <div class="comparison-item">
          <span class="comparison-label">平均绝对单机功率差</span>
          <strong>{{ summaryValue(summary?.averageAbsolutePowerGap, 1) }} kW</strong>
        </div>
        <div class="comparison-item">
          <span class="comparison-label">平均绝对单机风速差</span>
          <strong>{{ summaryValue(summary?.averageAbsoluteSpeedGap, 2) }} m/s</strong>
        </div>
      </div>
    </div>

    <div v-if="rows.length" class="chart-container">
      <h2>单机实验对照</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>风机</th>
            <th>ADJUST风速</th>
            <th>轮毂点风速</th>
            <th>盘均风速</th>
            <th>立方等效风速</th>
            <th>ADJUST功率</th>
            <th>立方等效功率</th>
            <th>功率差</th>
            <th>功率差 (%)</th>
            <th>盘面非均匀度</th>
            <th>上下半盘差</th>
            <th>覆盖率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td>{{ item.name }}</td>
            <td>{{ formatNumber(item.adjust?.speed, 2) }}</td>
            <td>{{ formatNumber(item.hubSpeedFromField, 2) }}</td>
            <td>{{ formatNumber(item.rotorMeanSpeedFromField, 2) }}</td>
            <td>{{ formatNumber(item.rotorEquivalentSpeedFromField, 2) }}</td>
            <td>{{ formatNumber(item.adjust?.power, 1) }}</td>
            <td>{{ formatNumber(item.curvePowerAtRotorEquivalentSpeed, 1) }}</td>
            <td :class="gapClass(item.powerGapToSolver)">{{ formatSigned(item.powerGapToSolver, 1) }}</td>
            <td :class="gapClass(item.powerGapPercentToSolver)">{{ formatSigned(item.powerGapPercentToSolver, 1) }}</td>
            <td>{{ formatNumber(item.rotorNonUniformityRatio != null ? item.rotorNonUniformityRatio * 100 : null, 1) }}</td>
            <td>{{ formatSigned(item.rotorTopBottomDelta, 2) }}</td>
            <td>{{ formatNumber(item.coverageRatio != null ? item.coverageRatio * 100 : null, 1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="warnings.length" class="chart-container">
      <h2>注意项</h2>
      <div class="warnings-list">
        <div v-for="warning in warnings" :key="warning" class="warning-item">{{ warning }}</div>
      </div>
    </div>

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

const rows = computed(() => {
  const items = experimentalData.value?.turbines || [];
  return [...items].sort((a, b) => {
    const gapA = Math.abs(Number(a?.powerGapToSolver) || 0);
    const gapB = Math.abs(Number(b?.powerGapToSolver) || 0);
    return gapB - gapA;
  });
});

const summary = computed(() => experimentalData.value?.summary || null);
const warnings = computed(() => experimentalData.value?.warnings || []);
const totalPowerGap = computed(() => {
  const solver = Number(summary.value?.totalSolverAdjustedPower);
  const cubic = Number(summary.value?.totalCurvePowerAtRotorEquivalentSpeed);
  if (!Number.isFinite(solver) || !Number.isFinite(cubic)) return null;
  return cubic - solver;
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
  max-width: 1380px;
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
  margin-bottom: 30px;
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
}

.chart-container {
  background-color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

h2 {
  color: #202124;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8eaed;
  font-size: 18px;
  font-weight: 500;
}

.comparison-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.comparison-item {
  padding: 16px 18px;
  border-radius: 10px;
  background: #f7f9fc;
  border: 1px solid #e4e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-label {
  font-size: 13px;
  color: #5f6368;
}

.data-table {
  width: 100%;
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  .stats-value {
    font-size: 24px;
  }

  .comparison-strip {
    grid-template-columns: 1fr;
  }
}
</style>
