<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-18 19:09:25
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-22 19:25:49
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindTurbineManagement.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div ref="windPerformanceRoot" class="wind-performance">
    <header class="header">
      <h1>风机性能数据分析</h1>
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
      <template #title>无法加载风机性能输出</template>
      <template #default>
        {{ pageError }}
        <el-button type="primary" link @click="retryLoad">重试</el-button>
      </template>
    </el-alert>

    <div class="tab-container">
      <div class="tab-buttons">
        <button class="tab-button" :class="{ active: activeTab === 'overview' }" @click="switchTab('overview')">总览</button>
        <button class="tab-button" :class="{ active: activeTab === 'spatial' }" @click="switchTab('spatial')">空间分布</button>
        <button class="tab-button" :class="{ active: activeTab === 'comparison' }" @click="switchTab('comparison')">初始状态与仿真结果变化</button>
        <button class="tab-button" :class="{ active: activeTab === 'data' }" @click="switchTab('data')">原始数据</button>
      </div>

      <!-- 总览页 -->
      <div v-show="activeTab === 'overview'" class="tab-content">
        <div class="dashboard">
          <div class="stats-card">
            <div class="stats-label">风机数量</div>
            <div class="stats-value">{{ turbineCount }}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">平均风速</div>
            <div class="stats-value">{{ avgSpeed }}</div>
            <div class="stats-label">m/s</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">总功率</div>
            <div class="stats-value">{{ totalPower }}</div>
            <div class="stats-label">kW</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">平均推力系数</div>
            <div class="stats-value">{{ avgCt }}</div>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-container">
            <h2>风速前后对比</h2>
            <div style="height: 350px; position: relative;">
              <canvas ref="speedComparisonOverviewChart"></canvas>
            </div>
          </div>
          <div class="chart-container">
            <h2>功率前后对比</h2>
            <div style="height: 350px; position: relative;">
              <canvas ref="powerComparisonOverviewChart"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-container">
          <h2>风机性能概览</h2>
          <div ref="performanceOverviewChart" style="height: 400px;"></div>
        </div>
      </div>

      <!-- 空间分布页 -->
      <div v-show="activeTab === 'spatial'" class="tab-content">
        <div class="chart-row">
          <div class="chart-container">
            <h2>风机二维空间分布</h2>
            <div ref="spatialDistribution2DChart" style="height: 500px;"></div>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-container">
            <h2>风机三维空间分布</h2>
            <div ref="spatialDistribution3DChart" style="height: 500px;"></div>
          </div>
        </div>
      </div>

      <!-- 调整前后对比页 -->
      <div v-show="activeTab === 'comparison'" class="tab-content">
        <div class="chart-container">
          <h2>前后性能变化率</h2>
          <div ref="performanceChangeChart" style="height: 400px;"></div>
        </div>
        <div class="chart-row">
          <div class="chart-container">
            <h2>前后风速对比</h2>
            <div style="height: 350px; position: relative;">
              <canvas ref="speedComparisonChart"></canvas>
            </div>
          </div>
          <div class="chart-container">
            <h2>前后功率对比</h2>
            <div style="height: 350px; position: relative;">
              <canvas ref="powerComparisonChart"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-container">
            <h2>前后推力系数对比</h2>
            <canvas ref="ctComparisonChart"></canvas>
          </div>
          <div class="chart-container">
            <h2>前后源项系数 fn 对比</h2>
            <canvas ref="fnComparisonChart"></canvas>
          </div>
        </div>
      </div>

      <!-- 原始数据页 -->
      <div v-show="activeTab === 'data'" class="tab-content">
        <div class="chart-container">
          <h2>风机位置与高度数据</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>风机名称</th>
                <th>求解器编号</th>
                <th>MPI节点</th>
                <th>Dxy (m)</th>
                <th>工况X (m)</th>
                <th>工况Y (m)</th>
                <th>求解器X (m)</th>
                <th>求解器Y (m)</th>
                <th>地表Z (m)</th>
                <th>真实轮毂高度 (m)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in realHighData" :key="item.id">
                <td>{{ item.displayName }}</td>
                <td>{{ item.id }}</td>
                <td>{{ item.node }}</td>
                <td>{{ item.dxy.toFixed(2) }}</td>
                <td>{{ formatOptionalNumber(item.caseX, 1) }}</td>
                <td>{{ formatOptionalNumber(item.caseY, 1) }}</td>
                <td>{{ item.solverX.toFixed(1) }}</td>
                <td>{{ item.solverY.toFixed(1) }}</td>
                <td>{{ item.terrainZ.toFixed(2) }}</td>
                <td>{{ item.height.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chart-container">
          <h2>初始性能数据</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>风机名称</th>
                <th>风速 (m/s)</th>
                <th>功率 (kW)</th>
                <th>推力系数</th>
                <th>源项系数 fn</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in combinedData" :key="`init-${item.id}`">
                <td>{{ item.displayName }}</td>
                <td>{{ item.initSpeed.toFixed(1) }}</td>
                <td>{{ item.initPower.toFixed(1) }}</td>
                <td>{{ item.initCt.toFixed(3) }}</td>
                <td>{{ item.initFn.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chart-container">
          <h2>调整后性能数据</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>风机名称</th>
                <th>风速 (m/s)</th>
                <th>功率 (kW)</th>
                <th>推力系数</th>
                <th>源项系数 fn</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in combinedData" :key="`adj-${item.id}`">
                <td>{{ item.displayName }}</td>
                <td>{{ item.adjSpeed.toFixed(1) }}</td>
                <td>{{ item.adjPower.toFixed(1) }}</td>
                <td>{{ item.adjCt.toFixed(3) }}</td>
                <td>{{ item.adjFn.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载数据中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue';
import axios from 'axios';
import Chart from 'chart.js/auto';
import Plotly from 'plotly.js-dist-min';
import { useCaseStore } from '@/store/caseStore';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '@/utils/notify.js';
import { SIMULATION_RAINBOW_STOPS, buildPlotlyColorscale } from '@/utils/colormaps';

// 接收父组件传入的 caseId
const props = defineProps({
  caseId: {
    type: String,
    required: true
  }
});

// 定义状态变量
const activeTab = ref('overview');
const loading = ref(true);
const pageError = ref('');
const windPerformanceRoot = ref(null);

// 定义三个数据的响应式变量
const realHighData = ref([]);
const initPerfData = ref([]);
const adjPerfData = ref([]);
const caseInfo = ref(null);

// 图表引用
const speedComparisonOverviewChart = ref(null);
const powerComparisonOverviewChart = ref(null);
const performanceOverviewChart = ref(null);
const spatialDistribution3DChart = ref(null);
const spatialDistribution2DChart = ref(null);
const performanceChangeChart = ref(null);
const speedComparisonChart = ref(null);
const powerComparisonChart = ref(null);
const ctComparisonChart = ref(null);
const fnComparisonChart = ref(null);

// 图表实例
let charts = {
  speedComparisonOverview: null,
  powerComparisonOverview: null,
  speedComparison: null,
  powerComparison: null,
  ctComparison: null,
  fnComparison: null
};
const plotWheelCleanupHandlers = [];
const simulationRainbowScale = buildPlotlyColorscale(SIMULATION_RAINBOW_STOPS);

const caseStore = useCaseStore();
const router = useRouter();

const getSolverScale = () => {
  const rawScale = Number(caseStore.parameters?.grid?.scale);
  return Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
};

const normalizeSolverLength = (value) => {
  const scale = getSolverScale();
  if (!Number.isFinite(value)) return null;
  return scale === 1 ? value : value / scale;
};

const formatOptionalNumber = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toFixed(digits);
};

const fetchCaseInfo = async () => {
  if (!props.caseId) {
    caseInfo.value = null;
    return;
  }

  try {
    const response = await axios.get(`/uploads/${props.caseId}/info.json`, {
      responseType: 'text',
      transformResponse: [(value) => value],
    });
    const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    caseInfo.value = JSON.parse(raw);
  } catch (error) {
    console.warn('无法直接读取 info.json，将回退到有限的风机信息。', error?.message || error);
    caseInfo.value = null;
  }
};

const getCaseTurbineMeta = (index) => {
  const infoTurbine = caseInfo.value?.turbines?.[index];
  if (infoTurbine) {
    return {
      infoId: infoTurbine.id || null,
      displayName: infoTurbine.name || `WT-${index + 1}`,
      caseX: Number(infoTurbine.x),
      caseY: Number(infoTurbine.y),
      hubHeight: Number(infoTurbine.hub),
      rotorDiameter: Number(infoTurbine.d),
      model: infoTurbine.model ?? null,
    };
  }

  const storeTurbine = caseStore.windTurbines?.[index];
  if (storeTurbine) {
    return {
      infoId: storeTurbine.id || null,
      displayName: storeTurbine.name || `WT-${index + 1}`,
      caseX: null,
      caseY: null,
      hubHeight: Number(storeTurbine.hubHeight),
      rotorDiameter: Number(storeTurbine.rotorDiameter),
      model: storeTurbine.model ?? null,
    };
  }

  return {
    infoId: null,
    displayName: `WT-${index + 1}`,
    caseX: null,
    caseY: null,
    hubHeight: null,
    rotorDiameter: null,
    model: null,
  };
};

const getScrollableParent = () => {
  return windPerformanceRoot.value?.closest('.sub-main-content') || null;
};

const clearPlotWheelPassthrough = () => {
  while (plotWheelCleanupHandlers.length) {
    const cleanup = plotWheelCleanupHandlers.pop();
    try { cleanup?.(); } catch { /* ignore */ }
  }
};

const bindPlotWheelToPageScroll = (element) => {
  if (!element) return;

  const wheelHandler = (event) => {
    const scrollParent = getScrollableParent();
    if (!scrollParent || scrollParent.scrollHeight <= scrollParent.clientHeight + 1) return;
    event.preventDefault();
    scrollParent.scrollTop += event.deltaY;
  };

  const targets = new Set([
    element,
    ...element.querySelectorAll('.plotly, .plot-container, .svg-container, .main-svg, .draglayer, .nsewdrag, .gl-container, canvas'),
  ]);

  targets.forEach((target) => {
    target.addEventListener('wheel', wheelHandler, { passive: false });
  });

  plotWheelCleanupHandlers.push(() => {
    targets.forEach((target) => {
      target.removeEventListener('wheel', wheelHandler);
    });
  });
};

const goToCalculation = () => {
  if (!props.caseId) return;
  router.push({ name: 'CalculationOutput', params: { caseId: props.caseId } });
};

const statusAlert = computed(() => {
  if (!props.caseId) return null;
  if (!caseStore.hasFetchedCalculationStatus) {
    return { type: 'info', title: '加载中', message: '正在加载工况状态与输出信息...', actionText: '', action: () => {} };
  }
  if (caseStore.calculationStatus !== 'completed') {
    return {
      type: 'warning',
      title: '主计算未完成',
      message: '风机性能分析依赖 Output 文件，请先完成计算后再进入此页面。',
      actionText: '去计算输出',
      action: goToCalculation,
    };
  }
  return null;
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
    console.error('WindTurbineManagement 初始化工况失败:', error);
    pageError.value = getApiErrorMessage(error, '初始化工况失败');
    return false;
  }
};

const clearChartsAndPlots = () => {
  clearPlotWheelPassthrough();

  try {
    Object.keys(charts).forEach((key) => {
      const chart = charts[key];
      if (chart) {
        try { chart.destroy(); } catch { /* ignore */ }
        charts[key] = null;
      }
    });
  } catch { /* ignore */ }

  const plotEls = [
    performanceOverviewChart.value,
    spatialDistribution3DChart.value,
    spatialDistribution2DChart.value,
    performanceChangeChart.value,
  ].filter(Boolean);

  for (const el of plotEls) {
    try { Plotly.purge(el); } catch { /* ignore */ }
  }
};

const handleResize = () => {
  Object.values(charts).forEach(chart => {
    if (chart) chart.resize();
  });

  if (performanceOverviewChart.value) Plotly.relayout(performanceOverviewChart.value, { autosize: true });
  if (spatialDistribution3DChart.value) Plotly.relayout(spatialDistribution3DChart.value, { autosize: true });
  if (spatialDistribution2DChart.value) Plotly.relayout(spatialDistribution2DChart.value, { autosize: true });
  if (performanceChangeChart.value) Plotly.relayout(performanceChangeChart.value, { autosize: true });
};

const retryLoad = async () => {
  pageError.value = '';
  clearChartsAndPlots();
  const ok = await ensureCaseLoaded(props.caseId);
  if (ok) await fetchData();
};

// 切换标签页
function switchTab(tab) {
  activeTab.value = tab;

  // 让图表重新调整大小
  nextTick(() => {
    if (tab === 'overview') {
      if (charts.speedComparisonOverview) charts.speedComparisonOverview.resize();
      if (charts.powerComparisonOverview) charts.powerComparisonOverview.resize();
      if (performanceOverviewChart.value) Plotly.relayout(performanceOverviewChart.value, { autosize: true });
    } else if (tab === 'spatial') {
      if (spatialDistribution3DChart.value) Plotly.relayout(spatialDistribution3DChart.value, { autosize: true });
      if (spatialDistribution2DChart.value) Plotly.relayout(spatialDistribution2DChart.value, { autosize: true });
    } else if (tab === 'comparison') {
      if (performanceChangeChart.value) Plotly.relayout(performanceChangeChart.value, { autosize: true });
      if (charts.speedComparison) charts.speedComparison.resize();
      if (charts.powerComparison) charts.powerComparison.resize();
      if (charts.ctComparison) charts.ctComparison.resize();
      if (charts.fnComparison) charts.fnComparison.resize();
    }
  });
}

// 解析 Output02-realHigh 内容
function parseRealHigh(content) {
  const lines = content.trim().split('\n').filter(line => line.trim());
  const data = [];

  lines.forEach((line, index) => {
    const tokens = line.trim().split(/\s+/);
    let id;
    let node;
    let dxy;
    let solverX;
    let solverY;
    let terrainZ;
    let height;

    if (tokens.length >= 7) {
      const idNodeMatch = line.match(/^([\w-]+)\s+on\s+([\w-]+)/);

      if (idNodeMatch) {
        id = idNodeMatch[1];
        node = idNodeMatch[2];

        const values = line.replace(idNodeMatch[0], '').trim().split(/\s+/);
        if (values.length >= 5) {
          dxy = parseFloat(values[0]);
          solverX = parseFloat(values[1]);
          solverY = parseFloat(values[2]);
          terrainZ = parseFloat(values[3]);
          height = parseFloat(values[4]);
        }
      } else {
        id = tokens[0];
        node = tokens[1];
        dxy = parseFloat(tokens[2]);
        solverX = parseFloat(tokens[3]);
        solverY = parseFloat(tokens[4]);
        terrainZ = parseFloat(tokens[5]);
        height = parseFloat(tokens[6]);
      }

      if (![dxy, solverX, solverY, terrainZ, height].some(Number.isNaN)) {
        const meta = getCaseTurbineMeta(index);
        data.push({
          id,
          infoId: meta.infoId,
          displayName: meta.displayName,
          node,
          dxy: normalizeSolverLength(dxy),
          caseX: Number.isFinite(meta.caseX) ? meta.caseX : null,
          caseY: Number.isFinite(meta.caseY) ? meta.caseY : null,
          solverX: normalizeSolverLength(solverX),
          solverY: normalizeSolverLength(solverY),
          terrainZ: normalizeSolverLength(terrainZ),
          height: normalizeSolverLength(height),
          hubHeight: Number.isFinite(meta.hubHeight) ? meta.hubHeight : null,
          rotorDiameter: Number.isFinite(meta.rotorDiameter) ? meta.rotorDiameter : null,
          model: meta.model,
        });
      }
    }
  });

  return data;
}

function parsePerformance(content, sourceName) {
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map((line, index) => {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 4) {
      throw new Error(`${sourceName} 第 ${index + 1} 行列数不足，预期 4 列。`);
    }

    const speed = parseFloat(tokens[0]);
    const power = parseFloat(tokens[1]);
    const ct = parseFloat(tokens[2]);
    const fn = parseFloat(tokens[3]);
    if ([speed, power, ct, fn].some((value) => !Number.isFinite(value))) {
      throw new Error(`${sourceName} 第 ${index + 1} 行包含非法数值。`);
    }

    return { speed, power, ct, fn };
  });
}

// 计算组合数据（仅在三组数据严格对齐时使用）
const combinedData = computed(() => {
  if (realHighData.value.length && initPerfData.value.length && adjPerfData.value.length) {
    return realHighData.value.map((item, i) => {
      const init = i < initPerfData.value.length ? initPerfData.value[i] : { speed: 0, power: 0, ct: 0, fn: 0 };
      const adj = i < adjPerfData.value.length ? adjPerfData.value[i] : { speed: 0, power: 0, ct: 0, fn: 0 };

      return {
        ...item,
        displayName: item.displayName,
        infoId: item.infoId,
        initSpeed: init.speed,
        initPower: init.power,
        initCt: init.ct,
        initFn: init.fn,
        adjSpeed: adj.speed,
        adjPower: adj.power,
        adjCt: adj.ct,
        adjFn: adj.fn,
        speedChange: init.speed ? ((adj.speed - init.speed) / init.speed * 100) : 0,
        powerChange: init.power ? ((adj.power - init.power) / init.power * 100) : 0,
        ctChange: init.ct ? ((adj.ct - init.ct) / init.ct * 100) : 0,
        fnChange: init.fn ? ((adj.fn - init.fn) / init.fn * 100) : 0
      };
    });
  }
  return [];
});

// 统计数据
const turbineCount = computed(() => combinedData.value.length || 0);
const avgSpeed = computed(() => {
  if (combinedData.value.length === 0) return "-";
  const sum = combinedData.value.reduce((acc, cur) => acc + cur.adjSpeed, 0);
  return (sum / combinedData.value.length).toFixed(1);
});
const totalPower = computed(() => {
  if (combinedData.value.length === 0) return "-";
  return combinedData.value.reduce((acc, cur) => acc + cur.adjPower, 0).toFixed(0);
});
const avgCt = computed(() => {
  if (combinedData.value.length === 0) return "-";
  const sum = combinedData.value.reduce((acc, cur) => acc + cur.adjCt, 0);
  return (sum / combinedData.value.length).toFixed(3);
});

const getChartLabels = () => combinedData.value.map((item) => item.displayName || item.id);

const buildAxisBounds = (values, fallbackMin = 0, fallbackMax = 1) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return { suggestedMin: fallbackMin, suggestedMax: fallbackMax };
  }

  const minValue = Math.min(...valid);
  const maxValue = Math.max(...valid);
  const padding = Math.max((maxValue - minValue) * 0.12, 0.5);
  return {
    suggestedMin: minValue - padding,
    suggestedMax: maxValue + padding,
  };
};

// 调用API获取数据
async function fetchData() {
  pageError.value = '';
  loading.value = true;
  try {
    // 如果主计算未完成，则不请求 Output 文件（避免空白+控制台错误）
    if (caseStore.hasFetchedCalculationStatus && caseStore.calculationStatus !== 'completed') {
      realHighData.value = [];
      initPerfData.value = [];
      adjPerfData.value = [];
      return;
    }

    clearChartsAndPlots();
    clearPlotWheelPassthrough();
    await fetchCaseInfo();

    const requests = [
      { name: 'Output02-realHigh', url: `/api/cases/${props.caseId}/output-file/Output02-realHigh` },
      { name: 'Output04-U-P-Ct-fn(INIT)', url: `/api/cases/${props.caseId}/output-file/Output04-U-P-Ct-fn(INIT)` },
      { name: 'Output06-U-P-Ct-fn(ADJUST)', url: `/api/cases/${props.caseId}/output-file/Output06-U-P-Ct-fn(ADJUST)` },
    ];

    const settled = await Promise.allSettled(requests.map(r => axios.get(r.url)));

    const contents = {};
    const missing = [];
    settled.forEach((result, index) => {
      const name = requests[index].name;
      if (result.status === 'rejected') {
        missing.push(name);
        return;
      }
      const data = result.value?.data;
      if (!data?.success || typeof data.content !== 'string') {
        missing.push(name);
        return;
      }
      contents[name] = data.content;
    });

    if (missing.length > 0) {
      realHighData.value = [];
      initPerfData.value = [];
      adjPerfData.value = [];
      pageError.value = `缺少输出文件：${missing.join('、')}。请先完成计算（并确保后处理输出已生成）。`;
      return;
    }

    // 解析数据
    realHighData.value = parseRealHigh(contents['Output02-realHigh']);
    initPerfData.value = parsePerformance(contents['Output04-U-P-Ct-fn(INIT)'], 'Output04-U-P-Ct-fn(INIT)');
    adjPerfData.value = parsePerformance(contents['Output06-U-P-Ct-fn(ADJUST)'], 'Output06-U-P-Ct-fn(ADJUST)');

    const infoTurbineCount = Array.isArray(caseInfo.value?.turbines) ? caseInfo.value.turbines.length : 0;
    if (infoTurbineCount && infoTurbineCount !== realHighData.value.length) {
      pageError.value = `info.json 中风机数量 (${infoTurbineCount}) 与 Output02-realHigh 行数 (${realHighData.value.length}) 不一致，无法安全映射空间位置。`;
      realHighData.value = [];
      initPerfData.value = [];
      adjPerfData.value = [];
      return;
    }

    const lengths = [
      realHighData.value.length,
      initPerfData.value.length,
      adjPerfData.value.length
    ];
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);

    if (minLength === 0) {
      pageError.value = '输出文件为空或解析失败，请检查计算是否完成且 Output 文件格式正确。';
      return;
    }

    if (minLength !== maxLength) {
      realHighData.value = [];
      initPerfData.value = [];
      adjPerfData.value = [];
      pageError.value = '输出文件行数不一致，无法安全对齐风机性能数据。请重新计算，并检查 Output02/04/06 是否完整生成。';
      return;
    }

    await nextTick();
    renderCharts();
  } catch (error) {
    console.error("Error fetching wind turbine output data:", error);
    realHighData.value = [];
    initPerfData.value = [];
    adjPerfData.value = [];
    pageError.value = getApiErrorMessage(error, '加载风机性能输出失败');
  } finally {
    loading.value = false;
  }
}

// 添加对caseId变化的监听
watch(
  () => props.caseId,
  async (newValue, oldValue) => {
    if (!newValue || newValue === oldValue) return;
    pageError.value = '';
    clearChartsAndPlots();
    const ok = await ensureCaseLoaded(newValue);
    if (ok) await fetchData();
  }
);

// 设置颜色数组，确保图表颜色一致且美观
const chartColors = {
  initSpeed: 'rgba(66, 133, 244, 0.6)',
  adjSpeed: 'rgba(66, 133, 244, 1.0)',
  initPower: 'rgba(234, 67, 53, 0.6)',
  adjPower: 'rgba(234, 67, 53, 1.0)',
  initCt: 'rgba(52, 168, 83, 0.6)',
  adjCt: 'rgba(52, 168, 83, 1.0)',
  initFn: 'rgba(251, 188, 5, 0.6)',
  adjFn: 'rgba(251, 188, 5, 1.0)'
};

// 渲染所有图表
function renderCharts() {
  clearChartsAndPlots();
  clearPlotWheelPassthrough();

  renderSpeedComparisonOverviewChart();
  renderPowerComparisonOverviewChart();
  renderPerformanceOverviewChart();
  renderSpatialDistributionCharts();
  renderPerformanceChangeChart();
  renderComparisonCharts();
}

function renderSpeedComparisonOverviewChart() {
const ctx = speedComparisonOverviewChart.value?.getContext('2d');
if (!ctx) return;

  charts.speedComparisonOverview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: getChartLabels(),
      datasets: [
        {
          label: '入流风速 (m/s)',
          data: combinedData.value.map(item => item.initSpeed),
          backgroundColor: chartColors.initSpeed,
          borderColor: 'rgba(66, 133, 244, 1)',
          borderWidth: 1
        },
        {
          label: '计算风速 (m/s)',
          data: combinedData.value.map(item => item.adjSpeed),
          backgroundColor: chartColors.adjSpeed,
          borderColor: 'rgba(66, 133, 244, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: { display: false },
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: '风速 (m/s)' },
          ...buildAxisBounds(combinedData.value.flatMap((item) => [item.initSpeed, item.adjSpeed]), 0, 15),
        },
        x: { title: { display: true, text: '风机名称' } }
      }
    }
  });
}

// 功率调整前后对比图
function renderPowerComparisonOverviewChart() {
  const ctx = powerComparisonOverviewChart.value?.getContext('2d');
  if (!ctx) return;

  charts.powerComparisonOverview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: getChartLabels(),
      datasets: [
        {
          label: '入流功率 (kW)',
          data: combinedData.value.map(item => item.initPower),
          backgroundColor: chartColors.initPower,
          borderColor: 'rgba(234, 67, 53, 1)',
          borderWidth: 1
        },
        {
          label: '计算功率 (kW)',
          data: combinedData.value.map(item => item.adjPower),
          backgroundColor: chartColors.adjPower,
          borderColor: 'rgba(234, 67, 53, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: { display: false },
        legend: { position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(0) + ' kW';
              }
              return label;
            }
          }
        },
        scales: {}
      },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: '功率 (kW)' }
        },
        x: { title: { display: true, text: '风机名称' } }
      }
    }
  });
}

// 风机性能概览图
function renderPerformanceOverviewChart() {
  if (!performanceOverviewChart.value) return;

  const data = [{
    type: 'scatter',
    mode: 'markers',
    name: '风机性能',
    x: combinedData.value.map(item => item.adjSpeed),
    y: combinedData.value.map(item => item.adjPower),
    text: getChartLabels(),
    marker: {
      size: combinedData.value.map(item => Math.max(item.adjCt * 50, 12)), // 确保点的最小大小
      color: combinedData.value.map(item => item.height),
      colorscale: simulationRainbowScale,
      showscale: true,
      colorbar: { title: '真实轮毂高度 (m)', thickness: 20 }
    },
    hovertemplate: '<b>%{text}</b><br>' +
      '风速: %{x:.1f} m/s<br>' +
      '功率: %{customdata[0]:.1f} kW<br>' +
      '推力系数: %{customdata[1]:.3f}<br>' +
      '高度: %{marker.color:.1f} m<br>' +
      '<extra></extra>',
    customdata: combinedData.value.map(item => [
      item.adjPower,
      item.adjCt
    ])
  }];

  const layout = {
    title: { text: '风机性能综合分析', font: { size: 16 } },
    autosize: true,
    margin: { l: 50, r: 50, b: 50, t: 50 },
    xaxis: { title: '风速 (m/s)' },
    yaxis: { title: '功率 (kW)' },
    hovermode: 'closest',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(245,245,247,0.5)',
    font: { family: 'Arial, sans-serif' }
  };

  const config = { responsive: true, scrollZoom: false, displaylogo: false };

  void Plotly.newPlot(performanceOverviewChart.value, data, layout, config)
    .then(() => bindPlotWheelToPageScroll(performanceOverviewChart.value));
}

// 空间分布图（三维和二维）
function renderSpatialDistributionCharts() {
  // 三维空间分布图
  if (spatialDistribution3DChart.value) {
    // 添加data-plotly属性以便于外部识别
    spatialDistribution3DChart.value.setAttribute('data-plotly', 'spatialDistribution3DChart');

    const data3D = [{
      type: 'scatter3d',
      mode: 'markers',
      x: combinedData.value.map(item => item.caseX ?? item.solverX),
      y: combinedData.value.map(item => item.caseY ?? item.solverY),
      z: combinedData.value.map(item => item.height),
      text: getChartLabels(),
      marker: {
        size: 8,
        color: combinedData.value.map(item => item.adjPower),
        colorscale: simulationRainbowScale,
        showscale: true,
        colorbar: { title: '功率 (kW)', thickness: 20 }
      },
      hovertemplate: '<b>%{text}</b><br>' +
        'X: %{x:.1f} m<br>' +
        'Y: %{y:.1f} m<br>' +
        '高度: %{z:.1f} m<br>' +
        '功率: %{marker.color:.1f} kW<br>' +
        '<extra></extra>'
    }];

    const layout3D = {
      title: { text: '风机三维空间分布（工况坐标系）', font: { size: 16 } },
      autosize: true,
      scene: {
        xaxis: { title: 'X坐标 (m)' },
        yaxis: { title: 'Y坐标 (m)' },
        zaxis: { title: '高度 (m)' },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.2 },
          center: { x: 0, y: 0, z: 0 }
        }
      },
      margin: { l: 0, r: 0, b: 0, t: 50 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Arial, sans-serif' }
    };

    void Plotly.newPlot(spatialDistribution3DChart.value, data3D, layout3D, { responsive: true, scrollZoom: false, displaylogo: false })
      .then(() => bindPlotWheelToPageScroll(spatialDistribution3DChart.value));
  }

  // 二维空间分布图
  if (spatialDistribution2DChart.value) {
    // 添加data-plotly属性以便于外部识别
    spatialDistribution2DChart.value.setAttribute('data-plotly', 'spatialDistribution2DChart');

    const data2D = [{
      type: 'scatter',
      mode: 'markers',
      x: combinedData.value.map(item => item.caseX ?? item.solverX),
      y: combinedData.value.map(item => item.caseY ?? item.solverY),
      text: getChartLabels(),
      marker: {
        size: 12,
        color: combinedData.value.map(item => item.adjPower),
        colorscale: simulationRainbowScale,
        showscale: true,
        colorbar: { title: '功率 (kW)', thickness: 20 }
      },
      hovertemplate: '<b>%{text}</b><br>' +
        'X: %{x:.1f} m<br>' +
        'Y: %{y:.1f} m<br>' +
        '风速: %{customdata[0]:.1f} m/s<br>' +
        '功率: %{marker.color:.1f} kW<br>' +
        '推力系数: %{customdata[1]:.3f}<br>' +
        '源项系数 fn: %{customdata[2]:.1f}<br>' +
        '<extra></extra>',
      customdata: combinedData.value.map(item => [item.adjSpeed, item.adjCt, item.adjFn])
    }];

    const layout2D = {
      title: { text: '风机平面位置分布（工况坐标系）', font: { size: 16 } },
      autosize: true,
      xaxis: { title: 'X坐标 (m)' },
      yaxis: { title: 'Y坐标 (m)' },
      hovermode: 'closest',
      margin: { l: 50, r: 50, b: 50, t: 50 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(245,245,247,0.5)',
      font: { family: 'Arial, sans-serif' }
    };

    void Plotly.newPlot(spatialDistribution2DChart.value, data2D, layout2D, { responsive: true, scrollZoom: false, displaylogo: false })
      .then(() => bindPlotWheelToPageScroll(spatialDistribution2DChart.value));
  }
}

// 性能变化率图表
function renderPerformanceChangeChart() {
  if (!performanceChangeChart.value) return;

  // 添加data-plotly属性以便于外部识别
  performanceChangeChart.value.setAttribute('data-plotly', 'performanceChangeChart');

  const data = [
    {
      type: 'bar',
      name: '风速变化率 (%)',
      x: getChartLabels(),
      y: combinedData.value.map(item => item.speedChange),
      marker: { color: 'rgba(66, 133, 244, 0.8)' }
    },
    {
      type: 'bar',
      name: '功率变化率 (%)',
      x: getChartLabels(),
      y: combinedData.value.map(item => item.powerChange),
      marker: { color: 'rgba(234, 67, 53, 0.8)' }
    },
    {
      type: 'bar',
      name: '推力系数变化率 (%)',
      x: getChartLabels(),
      y: combinedData.value.map(item => item.ctChange),
      marker: { color: 'rgba(52, 168, 83, 0.8)' }
    },
    {
      type: 'bar',
      name: '源项系数 fn 变化率 (%)',
      x: getChartLabels(),
      y: combinedData.value.map(item => item.fnChange),
      marker: { color: 'rgba(251, 188, 5, 0.8)' }
    }
  ];

  const layout = {
    title: { text: '各风机性能变化率', font: { size: 16 } },
    autosize: true,
    xaxis: { title: '风机名称' },
    yaxis: { title: '变化率 (%)' },
    barmode: 'group',
    bargap: 0.15,
    bargroupgap: 0.1,
    margin: { l: 50, r: 50, b: 50, t: 50 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(245,245,247,0.5)',
    font: { family: 'Arial, sans-serif' }
  };

  const config = { responsive: true, scrollZoom: false, displaylogo: false };

  void Plotly.newPlot(performanceChangeChart.value, data, layout, config)
    .then(() => bindPlotWheelToPageScroll(performanceChangeChart.value));
}

// 渲染对比图表
function renderComparisonCharts() {
  // 风速对比图
  const speedCtx = speedComparisonChart.value?.getContext('2d');
  if (speedCtx) {
    charts.speedComparison = new Chart(speedCtx, {
      type: 'bar',
      data: {
        labels: getChartLabels(),
        datasets: [
          {
            label: '初始风速 (m/s)',
            data: combinedData.value.map(item => item.initSpeed),
            backgroundColor: chartColors.initSpeed,
            borderColor: 'rgba(66, 133, 244, 1)',
            borderWidth: 1
          },
          {
            label: '调整后风速 (m/s)',
            data: combinedData.value.map(item => item.adjSpeed),
            backgroundColor: chartColors.adjSpeed,
            borderColor: 'rgba(66, 133, 244, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: { display: false },
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: { display: true, text: '风速 (m/s)' },
            ...buildAxisBounds(combinedData.value.flatMap((item) => [item.initSpeed, item.adjSpeed]), 0, 15),
          },
          x: { title: { display: true, text: '风机名称' } }
        }
      }
    });
  }

  // 功率对比图
  const powerCtx = powerComparisonChart.value?.getContext('2d');
  if (powerCtx) {
    charts.powerComparison = new Chart(powerCtx, {
      type: 'bar',
      data: {
        labels: getChartLabels(),
        datasets: [
          {
            label: '初始功率 (kW)',
            data: combinedData.value.map(item => item.initPower),
            backgroundColor: chartColors.initPower,
            borderColor: 'rgba(234, 67, 53, 1)',
            borderWidth: 1
          },
          {
            label: '调整后功率 (kW)',
            data: combinedData.value.map(item => item.adjPower),
            backgroundColor: chartColors.adjPower,
            borderColor: 'rgba(234, 67, 53, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: { display: false },
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(0) + ' kW';
                }
                return label;
              }
            }
          },
          scales: {}
        },
        scales: {
          y: { beginAtZero: false, title: { display: true, text: '功率 (kW)' } },
          x: { title: { display: true, text: '风机名称' } }
        }
      }
    });
  }

  // 推力系数对比图
  const ctCtx = ctComparisonChart.value?.getContext('2d');
  if (ctCtx) {
    charts.ctComparison = new Chart(ctCtx, {
      type: 'bar',
      data: {
        labels: getChartLabels(),
        datasets: [
          {
            label: '初始推力系数',
            data: combinedData.value.map(item => item.initCt),
            backgroundColor: chartColors.initCt,
            borderColor: 'rgba(52, 168, 83, 1)',
            borderWidth: 1
          },
          {
            label: '调整后推力系数',
            data: combinedData.value.map(item => item.adjCt),
            backgroundColor: chartColors.adjCt,
            borderColor: 'rgba(52, 168, 83, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: { display: false },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: false, title: { display: true, text: '推力系数' } },
          x: { title: { display: true, text: '风机名称' } }
        }
      }
    });
  }

  // 源项系数 fn 对比图
  const fnCtx = fnComparisonChart.value?.getContext('2d');
  if (fnCtx) {
    charts.fnComparison = new Chart(fnCtx, {
      type: 'bar',
      data: {
        labels: getChartLabels(),
        datasets: [
          {
            label: '初始源项系数 fn',
            data: combinedData.value.map(item => item.initFn),
            backgroundColor: chartColors.initFn,
            borderColor: 'rgba(251, 188, 5, 1)',
            borderWidth: 1
          },
          {
            label: '调整后源项系数 fn',
            data: combinedData.value.map(item => item.adjFn),
            backgroundColor: chartColors.adjFn,
            borderColor: 'rgba(251, 188, 5, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: { display: false },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: false, title: { display: true, text: '源项系数 fn' } },
          x: { title: { display: true, text: '风机名称' } }
        }
      }
    });
  }
}

onMounted(async () => {
  if (props.caseId) {
    const ok = await ensureCaseLoaded(props.caseId);
    if (ok) await fetchData();
  }
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  clearPlotWheelPassthrough();
  clearChartsAndPlots();
});

// 将这个方法暴露给外部组件
defineExpose({
  renderCharts,
  fetchData,
  charts // 确保 charts 被暴露，虽然全局变量可能已经足够
});
</script>

<style scoped>
.wind-performance {
  max-width: 1280px;
  min-height: 100%;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #f9f9fb;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  overscroll-behavior: contain;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 24px 0;
  background: linear-gradient(135deg, #4285f4, #34a853);
  color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.status-alert {
  margin: 12px 0;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stats-card {
  background-color: white;
  padding: 24px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
}

.stats-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.stats-value {
  font-size: 32px;
  font-weight: 600;
  color: #4285f4;
  margin: 10px 0;
}

.stats-label {
  color: #5f6368;
  font-size: 14px;
  text-align: center;
}

.chart-container {
  background-color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  min-height: 400px; /* Added min-height */
  overflow: hidden; /* Added overflow: hidden */
}

.chart-container :deep(.js-plotly-plot),
.chart-container :deep(.plot-container) {
  touch-action: pan-y;
}

.chart-container:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

h2 {
  color: #202124;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8eaed;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background-color: white;
}

.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e8eaed;
}

.data-table th {
  background-color: #4285f4;
  color: white;
  font-weight: 500;
  position: sticky;
  top: 0;
}

.data-table td {
  color: #202124;
  font-weight: 400;
}

.data-table tr:nth-child(even) {
  background-color: #f8f9fa;
}

.data-table tr:hover {
  background-color: #e8f0fe;
}

.tab-container {
  margin-bottom: 20px;
}

.tab-buttons {
  display: flex;
  margin-bottom: 24px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.tab-button {
  flex: 1;
  padding: 14px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #5f6368;
  position: relative;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background-color: #f1f3f4;
  color: #4285f4;
}

.tab-button.active {
  color: #4285f4;
  font-weight: 500;
  background-color: rgba(66, 133, 244, 0.08);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: #4285f4;
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
  border-top: 4px solid #4285f4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .chart-row {
    grid-template-columns: 1fr;
  }

  .dashboard {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .tab-button {
    padding: 10px;
    font-size: 14px;
  }

  .stats-value {
    font-size: 24px;
  }
}

/* Ensure canvas has max dimensions */
canvas {
  max-height: 100%;
  max-width: 100%;
}
</style>
