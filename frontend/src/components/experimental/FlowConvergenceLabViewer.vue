<template>
  <div class="convergence-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">收敛</span>
        <el-button type="primary" plain :loading="loading" @click="loadConvergence">刷新</el-button>
      </div>
    </div>

    <div v-if="errorMessage" class="error-box">
      <strong>收敛数据加载失败</strong>
      <span>{{ errorMessage }}</span>
    </div>

    <div class="stats">
      <div class="stat">
        <span>时间步数</span>
        <strong>{{ countLabel }}</strong>
      </div>
      <div class="stat">
        <span>末时间</span>
        <strong>{{ latestTimeLabel }}</strong>
      </div>
      <div class="stat">
        <span>末累计误差</span>
        <strong>{{ latestValueLabel }}</strong>
      </div>
      <div class="stat">
        <span>误差范围</span>
        <strong>{{ rangeLabel }}</strong>
      </div>
      <div class="stat">
        <span>漂移</span>
        <strong>{{ driftLabel }}</strong>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">累计连续性误差</div>
      <div v-if="hasChart" class="chart-shell">
        <svg class="chart-svg" viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="cumulative continuity error chart">
          <line
            v-for="tick in yTicks"
            :key="`y-${tick.value}`"
            x1="56"
            :y1="tick.y"
            x2="972"
            :y2="tick.y"
            class="grid-line"
          />
          <polyline :points="polylinePoints" class="trend-line" />
          <circle
            v-for="point in chartPoints"
            :key="`${point.x}-${point.y}`"
            :cx="point.x"
            :cy="point.y"
            r="3.4"
            class="trend-point"
          />
          <text x="18" y="26" class="axis-label">误差</text>
          <text x="928" y="306" class="axis-label">时间</text>
        </svg>
      </div>
      <div v-else class="empty-box">无收敛数据</div>
    </div>

    <div class="lower-grid">
      <div class="panel">
        <div class="panel-title">工况</div>
        <div class="kv-grid">
          <div class="kv">
            <span>入口风速</span>
            <strong>{{ windSpeedLabel }}</strong>
          </div>
          <div class="kv">
            <span>风向角</span>
            <strong>{{ windAngleLabel }}</strong>
          </div>
          <div class="kv">
            <span>域尺度 Lt</span>
            <strong>{{ domainLtLabel }}</strong>
          </div>
          <div class="kv">
            <span>域高度 H</span>
            <strong>{{ domainHLabel }}</strong>
          </div>
          <div class="kv">
            <span>水平面数</span>
            <strong>{{ numUdhLabel }}</strong>
          </div>
          <div class="kv">
            <span>剖面高度</span>
            <strong>{{ udhLabel }}</strong>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">产物</div>
        <div class="artifact-grid">
          <div
            v-for="artifact in artifactItems"
            :key="artifact.key"
            class="artifact-chip"
            :class="{ 'artifact-chip--on': artifact.value }"
          >
            {{ artifact.label }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const loading = ref(false);
const errorMessage = ref('');
const convergence = ref(null);

const countLabel = computed(() => String(convergence.value?.count ?? '-'));
const latestTimeLabel = computed(() => convergence.value?.latestTime != null ? `${Number(convergence.value.latestTime).toFixed(0)}` : '-');
const latestValueLabel = computed(() => convergence.value?.latestValue != null ? Number(convergence.value.latestValue).toExponential(3) : '-');
const rangeLabel = computed(() => {
  const min = convergence.value?.minValue;
  const max = convergence.value?.maxValue;
  return min != null && max != null ? `${Number(min).toExponential(2)} ~ ${Number(max).toExponential(2)}` : '-';
});
const driftLabel = computed(() => convergence.value?.drift != null ? Number(convergence.value.drift).toExponential(3) : '-');

const windSpeedLabel = computed(() => convergence.value?.inputSummary?.windSpeed ? `${convergence.value.inputSummary.windSpeed} m/s` : '-');
const windAngleLabel = computed(() => convergence.value?.inputSummary?.windAngle != null ? `${convergence.value.inputSummary.windAngle} deg` : '-');
const domainLtLabel = computed(() => convergence.value?.inputSummary?.domainLt ? `${convergence.value.inputSummary.domainLt} m` : '-');
const domainHLabel = computed(() => convergence.value?.inputSummary?.domainH ? `${convergence.value.inputSummary.domainH} m` : '-');
const numUdhLabel = computed(() => convergence.value?.inputSummary?.numUdh != null ? String(convergence.value.inputSummary.numUdh) : '-');
const udhLabel = computed(() => {
  const values = convergence.value?.inputSummary?.udh;
  return Array.isArray(values) && values.length ? values.join(', ') : '-';
});

const artifactItems = computed(() => {
  const artifacts = convergence.value?.artifacts || {};
  return [
    { key: 'sampleDict', label: 'sampleDict', value: Boolean(artifacts.sampleDict) },
    { key: 'streamLines', label: 'streamLines', value: Boolean(artifacts.streamLines) },
    { key: 'profiling', label: 'profiling', value: Boolean(artifacts.profiling) },
    { key: 'vtk', label: 'VTK', value: Boolean(artifacts.vtk) },
    { key: 'postProcessing', label: 'postProcessing', value: Boolean(artifacts.postProcessing) },
  ];
});

const chartPoints = computed(() => {
  const times = convergence.value?.times || [];
  const values = convergence.value?.values || [];
  if (!times.length || times.length !== values.length) return [];

  const minX = Math.min(...times);
  const maxX = Math.max(...times);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const safeMaxX = maxX === minX ? minX + 1 : maxX;
  const safeMaxY = maxY === minY ? minY + 1 : maxY;

  return times.map((time, index) => {
    const x = 56 + (((time - minX) / (safeMaxX - minX)) * 916);
    const y = 280 - (((values[index] - minY) / (safeMaxY - minY)) * 232);
    return { x, y, value: values[index], time };
  });
});

const polylinePoints = computed(() => chartPoints.value.map((point) => `${point.x},${point.y}`).join(' '));
const hasChart = computed(() => chartPoints.value.length > 1);

const yTicks = computed(() => {
  const values = convergence.value?.values || [];
  if (!values.length) return [];
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const safeMaxY = maxY === minY ? minY + 1 : maxY;
  return Array.from({ length: 4 }, (_, index) => {
    const t = index / 3;
    return {
      value: minY + ((safeMaxY - minY) * t),
      y: 280 - (232 * t),
    };
  });
});

async function loadConvergence() {
  if (!props.caseId) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await axios.get(`/api/cases/${props.caseId}/experimental-cfd-convergence`);
    convergence.value = response.data?.convergence || null;
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error.message || '收敛数据加载失败';
  } finally {
    loading.value = false;
  }
}

watch(() => props.caseId, async () => {
  convergence.value = null;
  await loadConvergence();
});

onMounted(async () => {
  await loadConvergence();
});
</script>

<style scoped>
.convergence-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label,
.chart-title,
.panel-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #60a5fa;
}

.error-box,
.chart-card,
.panel,
.stat {
  border-radius: 18px;
  border: 1px solid rgba(125, 211, 252, 0.12);
  background: rgba(8, 19, 30, 0.92);
}

.error-box {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #fecaca;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.stat {
  padding: 14px 16px;
}

.stat span,
.kv span {
  display: block;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(125, 211, 252, 0.76);
}

.stat strong,
.kv strong {
  display: block;
  margin-top: 8px;
  color: #eff6ff;
  line-height: 1.5;
}

.chart-card,
.panel {
  padding: 16px;
}

.chart-shell {
  margin-top: 12px;
  height: 320px;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.grid-line {
  stroke: rgba(148, 163, 184, 0.18);
  stroke-width: 1;
}

.trend-line {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend-point {
  fill: #f97316;
}

.axis-label {
  fill: rgba(191, 204, 223, 0.72);
  font-size: 16px;
}

.empty-box {
  margin-top: 12px;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(191, 204, 223, 0.72);
}

.lower-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 12px;
}

.kv-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.artifact-grid {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.artifact-chip {
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: rgba(191, 204, 223, 0.8);
  background: rgba(15, 23, 42, 0.3);
}

.artifact-chip--on {
  border-color: rgba(34, 197, 94, 0.32);
  color: #dcfce7;
  background: rgba(20, 83, 45, 0.32);
}

@media (max-width: 960px) {
  .lower-grid,
  .kv-grid {
    grid-template-columns: 1fr;
  }
}
</style>
