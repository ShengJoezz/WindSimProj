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
  <div class="wind-performance">
    <header class="header">
      <h1>风机性能数据分析</h1>
    </header>
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
            <h2>前后施加力对比</h2>
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
                <th>风机编号</th>
                <th>MPI节点</th>
                <th>Dxy (m)</th>
                <th>X (m)</th>
                <th>Y (m)</th>
                <th>Z (m)</th>
                <th>真实高度 (m)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in realHighData" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.node }}</td>
                <td>{{ item.dxy.toFixed(2) }}</td>
                <td>{{ item.x.toFixed(1) }}</td>
                <td>{{ item.y.toFixed(1) }}</td>
                <td>{{ item.z.toFixed(2) }}</td>
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
                <th>风机编号</th>
                <th>风速 (m/s)</th>
                <th>功率 (kW)</th>
                <th>推力系数</th>
                <th>施加力 (N/m²)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in combinedData" :key="`init-${item.id}`">
                <td>{{ item.id }}</td>
                <td>{{ item.initSpeed.toFixed(1) }}</td>
                <td>{{ item.initPower.toFixed(1) }}</td>
                <td>{{ item.initCt.toFixed(3) }}</td>
                <td>{{ item.initFn.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chart-container">
          <h2>性能数据</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>风机编号</th>
                <th>风速 (m/s)</th>
                <th>功率 (kW)</th>
                <th>推力系数</th>
                <th>施加力 (N/m²)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in combinedData" :key="`adj-${item.id}`">
                <td>{{ item.id }}</td>
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
import { useWindTurbineStore } from '@/store/windTurbineStore'; // 引入 Pinia Store

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

// 定义三个数据的响应式变量
const realHighData = ref([]);
const initPerfData = ref([]);
const adjPerfData = ref([]);

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
const config=ref(null);

// 图表实例
let charts = {
  speedComparisonOverview: null,
  powerComparisonOverview: null,
  speedComparison: null,
  powerComparison: null,
  ctComparison: null,
  fnComparison: null
};

// 获取 Pinia Store 实例
const windTurbineStore = useWindTurbineStore();

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

  lines.forEach(line => {
    const tokens = line.trim().split(/\s+/);
    let id, node, dxy, x, y, z, height;

    if (tokens.length >= 7) {
      // 尝试匹配格式: "WT-1 on Node-0 0.5 10.0 100.0 0.2 100.2"
      const idNodeMatch = line.match(/^([\w-]+)\s+on\s+([\w-]+)/);

      if (idNodeMatch) {
        // 格式匹配成功，提取ID和Node
        id = idNodeMatch[1];
        node = idNodeMatch[2];

        // 提取后面的数值
        const values = line.replace(idNodeMatch[0], '').trim().split(/\s+/);
        if (values.length >= 5) {
          dxy = parseFloat(values[0]);
          x = parseFloat(values[1]);
          y = parseFloat(values[2]);
          z = parseFloat(values[3]);
          height = parseFloat(values[4]);
        }
      } else {
        // 如果不匹配上面的格式，尝试直接按顺序解析
        id = tokens[0];
        node = tokens[1];
        dxy = parseFloat(tokens[2]);
        x = parseFloat(tokens[3]);
        y = parseFloat(tokens[4]);
        z = parseFloat(tokens[5]);
        height = parseFloat(tokens[6]);
      }

      // 确保所有数值都是有效的
      if (!isNaN(dxy) && !isNaN(x) && !isNaN(y) && !isNaN(z) && !isNaN(height)) {
        data.push({ id, node, dxy, x, y, z, height });
      }
    }
  });

  return data;
}

// 解析性能数据（INIT 与 ADJUST文件格式：四个数字）
function parsePerformance(content) {
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map(line => {
    const tokens = line.trim().split(/\s+/);
    return {
      speed: parseFloat(tokens[0]),
      power: parseFloat(tokens[1]),
      ct: parseFloat(tokens[2]),
      fn: parseFloat(tokens[3])
    };
  });
}

// 计算组合数据（以 realHighData 为基准，假设三组数据行数一致）
const combinedData = computed(() => {
  if (realHighData.value.length && initPerfData.value.length && adjPerfData.value.length) {
    return realHighData.value.map((item, i) => {
      const init = i < initPerfData.value.length ? initPerfData.value[i] : { speed: 0, power: 0, ct: 0, fn: 0 };
      const adj = i < adjPerfData.value.length ? adjPerfData.value[i] : { speed: 0, power: 0, ct: 0, fn: 0 };

      return {
        ...item,
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
const turbineCount = computed(() => realHighData.value.length || 0);
const avgSpeed = computed(() => {
  if (adjPerfData.value.length === 0) return "-";
  const sum = adjPerfData.value.reduce((acc, cur) => acc + cur.speed, 0);
  return (sum / adjPerfData.value.length).toFixed(1);
});
const totalPower = computed(() => {
  if (adjPerfData.value.length === 0) return "-";
  return adjPerfData.value.reduce((acc, cur) => acc + cur.power, 0).toFixed(0);
});
const avgCt = computed(() => {
  if (adjPerfData.value.length === 0) return "-";
  const sum = adjPerfData.value.reduce((acc, cur) => acc + cur.ct, 0);
  return (sum / adjPerfData.value.length).toFixed(3);
});

// 调用API获取数据
async function fetchData() {
  loading.value = true;
  try {
    console.log(`开始获取风机数据，caseId: ${props.caseId}`); // 调试信息

    // 并行请求获取数据，**移除 config 参数，避免 "config is not defined" 错误**
    const [realHighRes, initRes, adjustRes] = await Promise.all([
      axios.get(`/api/cases/${props.caseId}/output-file/Output02-realHigh`),
      axios.get(`/api/cases/${props.caseId}/output-file/Output04-U-P-Ct-fn(INIT)`),
      axios.get(`/api/cases/${props.caseId}/output-file/Output06-U-P-Ct-fn(ADJUST)`)
    ]);

    console.log("数据请求成功"); // 调试信息

    // 解析数据
    realHighData.value = parseRealHigh(realHighRes.data.content);
    initPerfData.value = parsePerformance(initRes.data.content);
    adjPerfData.value = parsePerformance(adjustRes.data.content);

    // 确保数据长度一致
    const minLength = Math.min(
      realHighData.value.length,
      initPerfData.value.length,
      adjPerfData.value.length
    );

    if (minLength < realHighData.value.length) realHighData.value = realHighData.value.slice(0, minLength);
    if (minLength < initPerfData.value.length) initPerfData.value = initPerfData.value.slice(0, minLength);
    if (minLength < adjPerfData.value.length) adjPerfData.value = adjPerfData.value.slice(0, minLength);

    console.log(`数据加载完成，风机数量: ${realHighData.value.length}`); // 调试信息

    // 立即更新store中的数据
    windTurbineStore.setTurbineData({
      combinedData: combinedData.value,
      realHighData: realHighData.value,
      turbineCount: turbineCount.value,
      avgSpeed: avgSpeed.value,
      totalPower: totalPower.value,
      avgCt: avgCt.value,
      caseId: props.caseId
    });

    await nextTick();
    renderCharts();
  } catch (error) {
    console.error("Error fetching wind turbine output data:", error);
    // 详细错误信息输出
    if (error.response) {
      console.error("服务器响应错误:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("请求未收到响应:", error.request);
    } else {
      console.error("请求设置错误:", error.message);
    }
  } finally {
    loading.value = false;
  }
}

// 添加对caseId变化的监听
watch(() => props.caseId, (newValue) => {
  if (newValue) {
    fetchData();
  }
});

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
  console.log("开始渲染图表..."); // 调试信息
  // 清除旧图表
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });

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

console.log("combinedData.value:", combinedData.value);
console.log("入流风速数据:", combinedData.value.map(item => item.initSpeed));
console.log("计算风速数据:", combinedData.value.map(item => item.adjSpeed));

  charts.speedComparisonOverview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: combinedData.value.map(item => item.id),
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
  suggestedMin: 9,  // Set slightly below your constant initial wind speed (10)
  suggestedMax: Math.max(...combinedData.value.map(item => item.adjSpeed)) + 2 // Set based on the maximum adjusted wind speed, plus a small buffer
},
x: { title: { display: true, text: '风机编号' } }
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
      labels: combinedData.value.map(item => item.id),
      datasets: [
        {
          label: '入流功率 (kW/100)',
          data: combinedData.value.map(item => item.initPower / 100),
          backgroundColor: chartColors.initPower,
          borderColor: 'rgba(234, 67, 53, 1)',
          borderWidth: 1
        },
        {
          label: '计算功率 (kW/100)',
          data: combinedData.value.map(item => item.adjPower / 100),
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
                // 显示实际功率值（乘以100）
                const actualValue = context.parsed.y * 100;
                label += actualValue.toFixed(0) + ' kW';
              }
              return label;
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: { display: true, text: '功率 (kW/100)' }
          },
          x: { title: { display: true, text: '风机编号' } }
        }
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
    y: combinedData.value.map(item => item.adjPower / 100), // 功率除以100进行绘图
    text: combinedData.value.map(item => item.id),
    marker: {
      size: combinedData.value.map(item => Math.max(item.adjCt * 50, 12)), // 确保点的最小大小
      color: combinedData.value.map(item => item.height),
      colorscale: [
        [0, 'rgb(66, 133, 244)'],   // 蓝色
        [0.5, 'rgb(52, 168, 83)'],  // 绿色
        [1, 'rgb(234, 67, 53)']     // 红色
      ],
      showscale: true,
      colorbar: { title: '高度 (m)', thickness: 20 }
    },
    hovertemplate: '<b>%{text}</b><br>' +
      '风速: %{x:.1f} m/s<br>' +
      '功率: %{customdata[0]:.1f} kW<br>' + // 直接使用原始功率值
      '推力系数: %{customdata[1]:.3f}<br>' + // 新增推力系数显示
      '高度: %{marker.color:.1f} m<br>' +
      '<extra></extra>',
      customdata: combinedData.value.map(item => [
    item.adjPower,  // 原始功率值（未除以100）
    item.adjCt      // 原始推力系数值（未乘以50）
  ]) // 存储原始功率值用于悬停显示
  }];

  const layout = {
    title: { text: '风机性能综合分析', font: { size: 16 } },
    autosize: true,
    margin: { l: 50, r: 50, b: 50, t: 50 },
    xaxis: { title: '风速 (m/s)' },
    yaxis: { title: '功率 (kW/100)' },
    hovermode: 'closest',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(245,245,247,0.5)',
    font: { family: 'Arial, sans-serif' }
  };

  const config = { responsive: true };

  Plotly.newPlot(performanceOverviewChart.value, data, layout, config);
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
      x: combinedData.value.map(item => item.x),
      y: combinedData.value.map(item => item.y),
      z: combinedData.value.map(item => item.height),
      text: combinedData.value.map(item => item.id),
      marker: {
        size: 8,
        color: combinedData.value.map(item => item.adjPower),
        colorscale: [
          [0, 'rgb(66, 133, 244)'],   // 蓝色
          [0.5, 'rgb(52, 168, 83)'],  // 绿色
          [1, 'rgb(234, 67, 53)']     // 红色
        ],
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
      title: { text: '风机三维空间分布', font: { size: 16 } },
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

    Plotly.newPlot(spatialDistribution3DChart.value, data3D, layout3D, { responsive: true });
  }

  // 二维空间分布图
  if (spatialDistribution2DChart.value) {
    // 添加data-plotly属性以便于外部识别
    spatialDistribution2DChart.value.setAttribute('data-plotly', 'spatialDistribution2DChart');

    const data2D = [{
      type: 'scatter',
      mode: 'markers',
      x: combinedData.value.map(item => item.x),
      y: combinedData.value.map(item => item.y),
      text: combinedData.value.map(item => item.id),
      marker: {
        size: 12,
        color: combinedData.value.map(item => item.adjPower),
        colorscale: [
          [0, 'rgb(66, 133, 244)'],   // 蓝色
          [0.5, 'rgb(52, 168, 83)'],  // 绿色
          [1, 'rgb(234, 67, 53)']     // 红色
        ],
        showscale: true,
        colorbar: { title: '功率 (kW)', thickness: 20 }
      },
      hovertemplate: '<b>%{text}</b><br>' +
        'X: %{x:.1f} m<br>' +
        'Y: %{y:.1f} m<br>' +
        '风速: %{customdata[0]:.1f} m/s<br>' +
        '功率: %{marker.color:.1f} kW<br>' +
        '推力系数: %{customdata[1]:.3f}<br>' +
        '施加力: %{customdata[2]:.1f} N/m²<br>' +
        '<extra></extra>',
      customdata: combinedData.value.map(item => [item.adjSpeed, item.adjCt, item.adjFn])
    }];

    const layout2D = {
      title: { text: '风机平面位置分布', font: { size: 16 } },
      autosize: true,
      xaxis: { title: 'X坐标 (m)' },
      yaxis: { title: 'Y坐标 (m)' },
      hovermode: 'closest',
      margin: { l: 50, r: 50, b: 50, t: 50 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(245,245,247,0.5)',
      font: { family: 'Arial, sans-serif' }
    };

    Plotly.newPlot(spatialDistribution2DChart.value, data2D, layout2D, { responsive: true });
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
      x: combinedData.value.map(item => item.id),
      y: combinedData.value.map(item => item.speedChange),
      marker: { color: 'rgba(66, 133, 244, 0.8)' }
    },
    {
      type: 'bar',
      name: '功率变化率 (%)',
      x: combinedData.value.map(item => item.id),
      y: combinedData.value.map(item => item.powerChange),
      marker: { color: 'rgba(234, 67, 53, 0.8)' }
    },
    {
      type: 'bar',
      name: '推力系数变化率 (%)',
      x: combinedData.value.map(item => item.id),
      y: combinedData.value.map(item => item.ctChange),
      marker: { color: 'rgba(52, 168, 83, 0.8)' }
    },
    {
      type: 'bar',
      name: '施加力变化率 (%)',
      x: combinedData.value.map(item => item.id),
      y: combinedData.value.map(item => item.fnChange),
      marker: { color: 'rgba(251, 188, 5, 0.8)' }
    }
  ];

  const layout = {
    title: { text: '各风机性能变化率', font: { size: 16 } },
    autosize: true,
    xaxis: { title: '风机编号' },
    yaxis: { title: '变化率 (%)' },
    barmode: 'group',
    bargap: 0.15,
    bargroupgap: 0.1,
    margin: { l: 50, r: 50, b: 50, t: 50 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(245,245,247,0.5)',
    font: { family: 'Arial, sans-serif' }
  };

  Plotly.newPlot(performanceChangeChart.value, data, layout, config);
}

// 渲染对比图表
function renderComparisonCharts() {
  // 风速对比图
  const speedCtx = speedComparisonChart.value?.getContext('2d');
  if (speedCtx) {
    charts.speedComparison = new Chart(speedCtx, {
      type: 'bar',
      data: {
        labels: combinedData.value.map(item => item.id),
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
  suggestedMin: 9,  // Set slightly below your constant initial wind speed (10)
  suggestedMax: Math.max(...combinedData.value.map(item => item.adjSpeed)) + 2 // Set based on the maximum adjusted wind speed, plus a small buffer
},
x: { title: { display: true, text: '风机编号' } }
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
        labels: combinedData.value.map(item => item.id),
        datasets: [
          {
            label: '初始功率 (kW/100)',
            data: combinedData.value.map(item => item.initPower / 100),
            backgroundColor: chartColors.initPower,
            borderColor: 'rgba(234, 67, 53, 1)',
            borderWidth: 1
          },
          {
            label: '调整后功率 (kW/100)',
            data: combinedData.value.map(item => item.adjPower / 100),
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
                  // 显示实际功率值（乘以100）
                  const actualValue = context.parsed.y * 100;
                  label += actualValue.toFixed(0) + ' kW';
                }
                return label;
              }
            }
          },
          scales: {
            y: { beginAtZero: false, title: { display: true, text: '功率 (kW/100)' } },
            x: { title: { display: true, text: '风机编号' } }
          }
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
        labels: combinedData.value.map(item => item.id),
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
          x: { title: { display: true, text: '风机编号' } }
        }
      }
    });
  }

  // 施加力对比图
  const fnCtx = fnComparisonChart.value?.getContext('2d');
  if (fnCtx) {
    charts.fnComparison = new Chart(fnCtx, {
      type: 'bar',
      data: {
        labels: combinedData.value.map(item => item.id),
        datasets: [
          {
            label: '初始施加力 (N/m²)',
            data: combinedData.value.map(item => item.initFn),
            backgroundColor: chartColors.initFn,
            borderColor: 'rgba(251, 188, 5, 1)',
            borderWidth: 1
          },
          {
            label: '调整后施加力 (N/m²)',
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
          y: { beginAtZero: false, title: { display: true, text: '施加力 (N/m²)' } },
          x: { title: { display: true, text: '风机编号' } }
        }
      }
    });
  }
}

// 组件挂载时加载数据
onMounted(() => {
  if (props.caseId) {
    fetchData();
  }

  // 监听窗口大小变化，调整图表大小
  window.addEventListener('resize', () => {
    Object.values(charts).forEach(chart => {
      if (chart) chart.resize();
    });

    // 重新布局Plotly图表
    if (performanceOverviewChart.value) Plotly.relayout(performanceOverviewChart.value, { autosize: true });
    if (spatialDistribution3DChart.value) Plotly.relayout(spatialDistribution3DChart.value, { autosize: true });
    if (spatialDistribution2DChart.value) Plotly.relayout(spatialDistribution2DChart.value, { autosize: true });
    if (performanceChangeChart.value) Plotly.relayout(performanceChangeChart.value, { autosize: true });
  });
});

// 在组件挂载时将数据存入 Pinia Store
onMounted(() => {
  console.log("风机组件已挂载，开始将数据存入 Pinia Store", props.caseId);

  windTurbineStore.setTurbineData({
    combinedData: combinedData.value,
    realHighData: realHighData.value,
    turbineCount: turbineCount.value,
    avgSpeed: avgSpeed.value,
    totalPower: totalPower.value,
    avgCt: avgCt.value,
    caseId: props.caseId
  });

  // 监听关键数据变化，同步更新 Pinia Store
  watch([combinedData, realHighData, turbineCount, avgSpeed, totalPower, avgCt],
    ([newCombinedData, newRealHighData, newTurbineCount, newAvgSpeed, newTotalPower, newAvgCt]) => {
      windTurbineStore.setTurbineData({
        combinedData: newCombinedData,
        realHighData: newRealHighData,
        turbineCount: newTurbineCount,
        avgSpeed: newAvgSpeed,
        totalPower: newTotalPower,
        avgCt: newAvgCt,
        caseId: props.caseId
      });
      console.log("Pinia Store 风机数据已更新");
    },
    { immediate: true } // 首次挂载时立即执行一次，确保初始数据被设置
  );
});

// 组件卸载时清理全局变量，防止内存泄漏和数据混淆
onBeforeUnmount(() => {
  console.log("风机组件即将卸载，但保留 Pinia Store 数据");
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
  background: linear-gradient(135deg, #4285f4, #34a853);
  color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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