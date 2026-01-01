<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-25 20:17:05
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-26 01:15:00 (Removed turbine overlay canvas and logic)
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\SpeedVisualization.vue
 * @Description: 风场可视化组件，去除了风机点位在图上的覆盖显示。
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="advanced-visualization-container">
    <el-card class="visualization-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h3>风场可视化</h3>
          <el-button-group>
            <el-tooltip content="刷新数据">
              <el-button :icon="Refresh" circle @click="fetchAllData" :loading="loading"></el-button>
            </el-tooltip>
            <el-tooltip content="导出图表">
              <el-button :icon="Download" circle @click="exportCharts" :disabled="!isVisualizationReady"></el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </template>

      <el-alert
        v-if="blockingAlert"
        :type="blockingAlert.type"
        show-icon
        :closable="false"
        class="precompute-alert"
      >
        <template #title>{{ blockingAlert.title }}</template>
        <template #default>
          {{ blockingAlert.message }}
          <el-button
            v-if="blockingAlert.actionText"
            type="primary"
            link
            @click="blockingAlert.action"
            :loading="blockingAlert.loading"
          >
            {{ blockingAlert.actionText }}
          </el-button>
        </template>
      </el-alert>

      <div v-if="showPrecomputeLog" class="precompute-log">
        <div class="precompute-log-header">
          <span class="precompute-log-title">预计算日志</span>
          <el-button type="info" link size="small" @click="clearPrecomputeLog">清空</el-button>
        </div>
        <div ref="precomputeLogRef" class="precompute-log-content">
          <pre>{{ precomputeLogText }}</pre>
        </div>
      </div>

      <div class="viz-controls">
        <el-row :gutter="20">
          <el-col :xs="24" :md="16">
            <div class="control-item">
              <span class="label">高度 (m):</span>
              <el-slider
                v-model="currentHeight"
                :min="minHeight"
                :max="maxHeight"
                :step="heightStep"
                show-input
                :disabled="!mainMetadata || !mainMetadata.heightLevels || mainMetadata.heightLevels.length === 0"
                @change="handleHeightChangeDebounced"
              />
            </div>
          </el-col>
          <el-col :xs="24" :md="8">
            <div class="control-item">
              <span class="label">选择风机:</span>
              <el-select
                v-model="selectedTurbine"
                placeholder="选择风机"
                filterable
                clearable
                style="width: 100%"
                :disabled="!mainMetadata || !mainMetadata.turbines || mainMetadata.turbines.length === 0">
                <!-- 使用可选链和空数组后备 -->
                <el-option
                  v-for="turbine in mainMetadata?.turbines || []"
                  :key="turbine.id"
                  :label="turbine.name || turbine.id"
                  :value="turbine.id"
                />
              </el-select>
            </div>
          </el-col>
        </el-row>
        <!-- 新增：单点查询功能 -->
        <el-row :gutter="20" class="point-query-section">
          <el-col :span="24">
            <div class="control-item point-query-item">
              <span class="label">单点查询 (m):</span>
              <el-input-number v-model="queryPoint.x" placeholder="X" size="small" controls-position="right" class="query-input"></el-input-number>
              <el-input-number v-model="queryPoint.y" placeholder="Y" size="small" controls-position="right" class="query-input"></el-input-number>
              <el-input-number v-model="queryPoint.z" placeholder="Z" size="small" controls-position="right" class="query-input"></el-input-number>
              <el-button type="primary" size="small" @click="handlePointQuery" :loading="chartLoading.pointQuery">查询</el-button>
              <div v-if="pointQueryResult" class="query-result">
                查询结果: <strong>{{ pointQueryResult }}</strong>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>

      <div class="main-content">
        <!-- 左侧 - 风速场图片 -->
        <div class="speed-field-section">
          <div class="visualization-wrapper">
            <div class="speed-field-container" ref="speedFieldContainer">
              <div v-if="!currentSliceImageUrl && !chartLoading.speedFieldImage" class="no-image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>{{ mainMetadata ? '请选择高度查看风场' : '加载元数据中...' }}</span>
              </div>
              <img
                v-if="currentSliceImageUrl"
                :src="currentSliceImageUrl"
                alt="Wind Speed Field"
                class="speed-field-image"
                ref="speedFieldImage"
                @load="onImageLoad"
                @error="onImageError"
              />
              <!-- 图片加载指示器 -->
              <div v-if="chartLoading.speedFieldImage" class="image-loading-overlay">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>加载图像...</span>
              </div>
              <!-- 风机覆盖层 Canvas (已移除) -->
              <!-- <canvas ref="turbineOverlayCanvas" class="turbine-overlay-canvas"></canvas> -->
            </div>
            <!-- 整体加载指示器 (可选) -->
            <div v-if="chartLoading.speedField && !chartLoading.speedFieldImage" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>处理中...</span>
            </div>
          </div>
        </div>

        <!-- 右侧 - 图表区域 -->
        <div class="charts-section">
          <div class="chart-wrapper">
            <div class="chart-header">
              <h4>风速廓线</h4>
              <div class="header-right">
                <span v-if="selectedTurbine" class="subtitle">{{ getTurbineName(selectedTurbine) }}</span>
                <span v-else class="subtitle-placeholder">请选择风机</span>
                <el-tooltip content="下载廓线数据 (CSV)">
                  <el-button :icon="Document" size="small" circle @click="downloadProfileData" :disabled="!profileData"></el-button>
                </el-tooltip>
              </div>
            </div>
            <div ref="profileChart" class="chart"></div>
            <div v-if="chartLoading.profile" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
          </div>

          <div class="chart-wrapper">
            <div class="chart-header">
              <h4>尾流分析</h4>
              <div class="header-right">
                <span v-if="selectedTurbine" class="subtitle">{{ getTurbineName(selectedTurbine) }}</span>
                <span v-else class="subtitle-placeholder">请选择风机</span>
                <el-tooltip content="下载尾流数据 (CSV)">
                  <el-button :icon="Document" size="small" circle @click="downloadWakeData" :disabled="!wakeData"></el-button>
                </el-tooltip>
              </div>
            </div>
            <div ref="wakeChart" class="chart"></div>
            <div v-if="chartLoading.wake" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
          </div>

          <div v-if="selectedTurbine && turbineDetails" class="turbine-details">
            <h4>风机详情</h4>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ turbineDetails.id }}</el-descriptions-item>
              <el-descriptions-item label="坐标 (km)">{{ turbineDetails.coordinates }}</el-descriptions-item>
              <el-descriptions-item label="轮毂高度 (m)">{{ turbineDetails.hubHeight }}</el-descriptions-item>
              <el-descriptions-item label="叶轮直径 (m)">{{ turbineDetails.rotorDiameter }}</el-descriptions-item>
              <el-descriptions-item label="当前高度风速 (m/s)">{{ turbineDetails.currentSpeed }}</el-descriptions-item>
              <el-descriptions-item label="轮毂高度风速 (m/s)">{{ turbineDetails.hubSpeed }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <!-- Placeholder when no turbine selected -->
          <div v-else-if="!selectedTurbine && mainMetadata && mainMetadata.turbines && mainMetadata.turbines.length > 0" class="turbine-details-placeholder">
             <el-icon><InfoFilled /></el-icon>
            <span>选择一个风机查看详细信息和图表</span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Refresh, Download, Loading, Picture, InfoFilled, Document } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { debounce } from 'lodash-es';
import { ElMessage, ElSlider, ElSelect, ElOption, ElCard, ElIcon, ElButtonGroup, ElTooltip, ElRow, ElCol, ElDescriptions, ElDescriptionsItem, ElInputNumber, ElButton, ElAlert } from 'element-plus';
// Import the updated service function
import { getMetadata, getSliceData, getProfileData, getWakeData, findClosestIndex, clearClientCaseCache, getPointWindSpeed } from '@/services/visualizationService';
import { useCaseStore } from '@/store/caseStore';
import { useRouter } from 'vue-router';

// --- Helper for CSV Download ---
function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    ElMessage.warning('没有可下载的数据。');
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  ElMessage.success(`数据已导出为 ${filename}`);
}

// --- Color Scheme ---
const colorScheme = {
  primary: '#409EFF', success: '#67C23A', warning: '#E6A23C', danger: '#F56C6C',
  info: '#909399', background: '#F5F7FA', text: '#303133', border: '#DCDFE6',
  chartColors: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
};

// --- Props ---
const props = defineProps({ caseId: { type: String, required: true } });
const caseStore = useCaseStore();
const router = useRouter();

// --- State Variables ---
const loading = ref(false);
const chartLoading = ref({ speedField: false, speedFieldImage: false, profile: false, wake: false, pointQuery: false });
const mainMetadata = ref(null);
const currentHeight = ref(10);
const selectedTurbine = ref(null);
const currentSliceImageUrl = ref(null);
const currentImageDimensions = ref(null);
// REMOVED: const currentTurbinePixelCoords = ref([]);
const profileData = ref(null);
const wakeData = ref(null);
const turbineDetails = ref(null);
const imageLoaded = ref(false);
const queryPoint = ref({ x: 0, y: 0, z: 100 });
const pointQueryResult = ref(null);

// --- DOM Refs ---
const speedFieldContainer = ref(null);
const speedFieldImage = ref(null);
// REMOVED: const turbineOverlayCanvas = ref(null);
// REMOVED: let turbineOverlayCtx = null;

// --- Chart Instances ---
const profileChart = ref(null);
const wakeChart = ref(null);
let profileInstance = null;
let wakeInstance = null;
let resizeObserver = null;
const precomputeLogRef = ref(null);
const isStartingPrecompute = ref(false);

// --- Computed Properties ---
const minHeight = computed(() => mainMetadata.value?.heightLevels?.[0] ?? 10);
const maxHeight = computed(() => {
    const levels = mainMetadata.value?.heightLevels;
    return levels && levels.length > 0 ? levels[levels.length - 1] : 200;
});
const heightStep = computed(() => {
  if (mainMetadata.value?.heightLevels && mainMetadata.value.heightLevels.length > 1) {
    const sortedHeights = [...mainMetadata.value.heightLevels].sort((a, b) => a - b);
    let minDiff = Infinity;
    for (let i = 1; i < sortedHeights.length; i++) {
        const diff = sortedHeights[i] - sortedHeights[i-1];
        if (diff > 0 && diff < minDiff) { minDiff = diff; }
    }
    return minDiff === Infinity ? 1 : minDiff;
  }
  return 1;
});

const isVisualizationReady = computed(() => {
  return Boolean(mainMetadata.value && currentSliceImageUrl.value);
});

const showPrecomputeLog = computed(() => {
  const status = caseStore.visualizationStatus;
  if (!status) return false;
  if (status === 'completed') return false;
  return (caseStore.visualizationMessages || []).length > 0 || Boolean(caseStore.visualizationLastError);
});

const precomputeLogText = computed(() => {
  const lines = caseStore.visualizationMessages || [];
  const text = lines.join('');
  if (caseStore.visualizationLastError && !text.includes(caseStore.visualizationLastError)) {
    return `${text}\n${caseStore.visualizationLastError}`;
  }
  return text;
});

const blockingAlert = computed(() => {
  if (!props.caseId) return null;

  if (!caseStore.hasFetchedCalculationStatus) {
    return { type: 'info', title: '加载中', message: '正在加载工况状态与可视化信息...', actionText: '', loading: false, action: () => {} };
  }

  if (caseStore.calculationStatus && caseStore.calculationStatus !== 'completed') {
    return {
      type: 'warning',
      title: '需要先完成主计算',
      message: '速度场分析依赖计算结果，请先在“计算输出”完成计算后再查看此页面。',
      actionText: '去计算输出',
      loading: false,
      action: () => router.push({ name: 'CalculationOutput', params: { caseId: props.caseId } }),
    };
  }

  if (!mainMetadata.value) {
    if (loading.value || chartLoading.value.speedField || chartLoading.value.speedFieldImage) {
      return { type: 'info', title: '加载中', message: '正在加载可视化数据...', actionText: '', loading: false, action: () => {} };
    }

    const vizStatus = caseStore.visualizationStatus || 'not_run';
    if (vizStatus === 'starting' || vizStatus === 'running') {
      return { type: 'info', title: '可视化预计算进行中', message: '正在生成速度场切片与分析缓存，请稍候或查看下方日志。', actionText: '', loading: false, action: () => {} };
    }
    if (vizStatus === 'completed') {
      return {
        type: 'error',
        title: '可视化缓存异常',
        message: '状态显示已完成，但未能加载元数据缓存。可尝试重新预计算。',
        actionText: '重新预计算',
        loading: isStartingPrecompute.value,
        action: startPrecompute,
      };
    }
    if (vizStatus === 'failed') {
      return {
        type: 'error',
        title: '可视化预计算失败',
        message: caseStore.visualizationLastError || '请查看下方日志后重试。',
        actionText: '重新预计算',
        loading: isStartingPrecompute.value,
        action: startPrecompute,
      };
    }
    return {
      type: 'warning',
      title: '未找到可视化缓存',
      message: '此工况尚未生成速度场分析缓存，需要先运行“可视化预计算”。',
      actionText: '运行预计算',
      loading: isStartingPrecompute.value,
      action: startPrecompute,
    };
  }

  return null;
});

const scrollPrecomputeLogToBottom = () => {
  nextTick(() => {
    const el = precomputeLogRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
};

const clearPrecomputeLog = () => {
  caseStore.visualizationMessages = [];
  caseStore.visualizationLastError = '';
};

async function startPrecompute() {
  if (!props.caseId) return;
  if (isStartingPrecompute.value) return;
  try {
    isStartingPrecompute.value = true;
    await caseStore.startVisualizationPrecompute();
    ElMessage.success('已开始预计算，请查看下方日志。');
  } catch (error) {
    ElMessage.error(error?.message || '预计算启动失败');
  } finally {
    isStartingPrecompute.value = false;
    scrollPrecomputeLogToBottom();
  }
}

// --- Methods ---

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
    console.error('SpeedVisualization 初始化工况失败:', error);
    ElMessage.error(error?.message || '初始化工况失败');
    return false;
  }
};

// 1. Reset State
const resetVisualizationState = () => {
  console.log("重置可视化状态...");
  loading.value = false; chartLoading.value = { speedField: false, speedFieldImage: false, profile: false, wake: false, pointQuery: false };
  mainMetadata.value = null; currentHeight.value = 10; selectedTurbine.value = null;
  currentSliceImageUrl.value = null; currentImageDimensions.value = null; // REMOVED: currentTurbinePixelCoords.value = [];
  profileData.value = null; wakeData.value = null; turbineDetails.value = null; imageLoaded.value = false;
  if (profileInstance) { try { profileInstance.dispose(); } catch(e) { console.warn("销毁 profileInstance 失败", e); } profileInstance = null; }
  if (wakeInstance) { try { wakeInstance.dispose(); } catch(e) { console.warn("销毁 wakeInstance 失败", e); } wakeInstance = null; }
  // REMOVED: Canvas clearing logic
};

// 2. Fetch All Data
const fetchAllData = async () => {
  if (!props.caseId) { resetVisualizationState(); return; }
  if (caseStore.calculationStatus && caseStore.calculationStatus !== 'completed') {
    resetVisualizationState();
    return;
  }
  console.log(`为工况 ${props.caseId} 获取所有可视化数据...`);
  loading.value = true;
  // Partial reset
  selectedTurbine.value = null; profileData.value = null; wakeData.value = null;
  imageLoaded.value = false; currentSliceImageUrl.value = null; currentImageDimensions.value = null;
  // REMOVED: currentTurbinePixelCoords.value = [];
  turbineDetails.value = null;
  if (profileInstance) profileInstance.clear(); if (wakeInstance) wakeInstance.clear();
  // REMOVED: Canvas clearing logic

  try {
    await fetchMetadata();
    let initialTurbineId = null;
    if (mainMetadata.value?.turbines?.length > 0) {
        initialTurbineId = mainMetadata.value.turbines[0].id;
        selectedTurbine.value = initialTurbineId;
    }
    if (mainMetadata.value?.heightLevels?.length > 0) {
      if (!currentHeight.value || !mainMetadata.value.heightLevels.includes(currentHeight.value)) {
         currentHeight.value = mainMetadata.value.heightLevels[0];
      }
      // Fetch slice image info (URL, Dimensions - pixel coords ignored)
      await fetchSliceImageInfo(currentHeight.value);
    } else {
      chartLoading.value.speedField = false; chartLoading.value.speedFieldImage = false;
    }
    if (selectedTurbine.value) {
      await Promise.allSettled([fetchProfileData(selectedTurbine.value), fetchWakeData(selectedTurbine.value)]);
    }
  } catch (error) {
    console.error('获取可视化数据失败:', error);
    resetVisualizationState();
  }
  finally { loading.value = false; nextTick(() => { initChartInstances(); }); }
};

// 3. Fetch Main Metadata
const fetchMetadata = async () => {
  console.log(`获取工况 ${props.caseId} 的主元数据...`);
  chartLoading.value.speedField = true;
  try {
    const meta = await getMetadata(props.caseId);
    mainMetadata.value = meta;
    console.log("主元数据加载成功:", meta);
  } catch (error) {
    console.error('获取主元数据失败:', error);
    caseStore.visualizationStatus = error?.response?.data?.visualizationStatus ?? caseStore.visualizationStatus;
    caseStore.visualizationLastError = error?.response?.data?.message || error?.message || caseStore.visualizationLastError;
    mainMetadata.value = null; throw error;
  }
};

// 4. Fetch Slice Image Info (URL, Dimensions - No pixel coord logic)
const fetchSliceImageInfo = async (height) => {
  if (!props.caseId) return;
  console.log(`获取高度 ${height}m 的速度场图像信息...`);
  chartLoading.value.speedField = true; chartLoading.value.speedFieldImage = true;
  currentSliceImageUrl.value = null; imageLoaded.value = false;
  currentImageDimensions.value = null; // REMOVED: currentTurbinePixelCoords.value = [];

  try {
    const data = await getSliceData(props.caseId, height);
    currentSliceImageUrl.value = data.imageUrl;
    currentHeight.value = data.actualHeight;
    currentImageDimensions.value = data.imageDimensions;
    // We get turbinesPixels from the API, but we no longer store or use it here
    // REMOVED: currentTurbinePixelCoords.value = data.turbinesPixels;

    console.log(`高度 ${data.actualHeight}m 的图像 URL: ${data.imageUrl}`);
    console.log(`接收到的图像原始尺寸:`, currentImageDimensions.value);
    // REMOVED: console.log(`接收到的风机像素坐标...`);
    // REMOVED: if (!currentTurbinePixelCoords.value) { console.warn("风机像素坐标数据缺失。"); }

    if (!currentImageDimensions.value) { ElMessage.warning('图像尺寸信息缺失'); }

  } catch (error) {
    console.error(`获取高度 ${height}m 的切片数据时出错:`, error);
    ElMessage.error(`加载高度 ${height}m 的风场图像信息失败。`);
    currentSliceImageUrl.value = null; imageLoaded.value = false; chartLoading.value.speedFieldImage = false;
    currentImageDimensions.value = null; // REMOVED: currentTurbinePixelCoords.value = [];
  }
  // Removed chartLoading.speedField = false from here, it's handled in onImageLoad/Error
};


// 5. Fetch Profile Data (No changes needed)
const fetchProfileData = async (turbineId) => {
  if (!turbineId || !props.caseId) return;
  chartLoading.value.profile = true;
  try {
    const response = await getProfileData(props.caseId, turbineId);
    if (response && response.profile && Array.isArray(response.profile.heights) && Array.isArray(response.profile.speeds)) {
       profileData.value = response.profile;
       await nextTick();
       renderProfileChart();
       updateTurbineDetails();
    } else {
       console.error("从 API 获取的风廓线数据格式不正确:", response);
       profileData.value = null;
       if (profileInstance) profileInstance.clear();
    }
  } catch (error) {
    console.error(`获取风机 ${turbineId} 的风廓线数据失败:`, error);
    ElMessage.error(`加载风机 ${getTurbineName(turbineId)} 的风廓线数据失败。`);
    profileData.value = null;
    if (profileInstance) profileInstance.clear();
  } finally { chartLoading.value.profile = false; }
};

// 6. Fetch Wake Data (No changes needed)
const fetchWakeData = async (turbineId) => {
  if (!turbineId || !props.caseId) return;
  chartLoading.value.wake = true;
  try {
    const response = await getWakeData(props.caseId, turbineId);
    if (response && response.wake && Array.isArray(response.wake.distances) && Array.isArray(response.wake.speeds)) {
        wakeData.value = response.wake;
        await nextTick();
        renderWakeChart();
    } else {
        console.error("从 API 获取的尾流数据格式不正确:", response);
        wakeData.value = null;
        if (wakeInstance) wakeInstance.clear();
    }
  } catch (error) {
    console.error(`获取风机 ${turbineId} 的尾流数据失败:`, error);
    ElMessage.error(`加载风机 ${getTurbineName(turbineId)} 的尾流数据失败。`);
    wakeData.value = null;
    if (wakeInstance) wakeInstance.clear();
  } finally { chartLoading.value.wake = false; }
};

// 7. Handle Height Change Debounced
const handleHeightChangeDebounced = debounce(async (newHeight) => {
  console.log(`高度滑块变化 (防抖后): ${newHeight}`);
  try {
    await fetchSliceImageInfo(newHeight);
    if (selectedTurbine.value) { updateTurbineDetails(); }
  } catch (error) { console.error('处理高度变化时出错:', error); }
}, 300);

// 8. Get Turbine Name (No changes needed)
const getTurbineName = (turbineId) => {
  const turbine = mainMetadata.value?.turbines?.find(t => t.id === turbineId);
  return turbine ? (turbine.name || turbine.id) : turbineId;
};

// 9. Update Turbine Details (No changes needed)
const updateTurbineDetails = () => {
  if (!selectedTurbine.value || !mainMetadata.value?.turbines) { turbineDetails.value = null; return; }
  const turbine = mainMetadata.value.turbines.find(t => t.id === selectedTurbine.value);
  if (!turbine) { turbineDetails.value = null; return; }
  let currentHeightSpeed = 'N/A', hubHeightSpeed = 'N/A';
  if (profileData.value && profileData.value.heights && profileData.value.speeds && profileData.value.heights.length === profileData.value.speeds.length) {
    const currentHeightIndex = findClosestIndex(profileData.value.heights, currentHeight.value);
    if (currentHeightIndex !== -1 && profileData.value.speeds[currentHeightIndex] != null) { currentHeightSpeed = profileData.value.speeds[currentHeightIndex].toFixed(2); }
    const hubHeightIndex = findClosestIndex(profileData.value.heights, turbine.hubHeight);
    if (hubHeightIndex !== -1 && profileData.value.speeds[hubHeightIndex] != null) { hubHeightSpeed = profileData.value.speeds[hubHeightIndex].toFixed(2); }
  }
  turbineDetails.value = {
    id: turbine.id, coordinates: `(${turbine.x.toFixed(2)}, ${turbine.y.toFixed(2)})`,
    hubHeight: turbine.hubHeight.toFixed(1), rotorDiameter: turbine.rotorDiameter.toFixed(1),
    currentSpeed: currentHeightSpeed, hubSpeed: hubHeightSpeed
  };
};

// --- New Feature Methods ---
const downloadProfileData = () => {
  if (!profileData.value || !profileData.value.heights || !profileData.value.speeds) {
    ElMessage.warning('没有可下载的风廓线数据。');
    return;
  }
  const dataToExport = profileData.value.heights.map((height, index) => ({
    height_m: height.toFixed(2),
    speed_mps: profileData.value.speeds[index]?.toFixed(3) ?? 'N/A'
  }));
  const filename = `profile_${props.caseId}_${selectedTurbine.value}.csv`;
  downloadCSV(dataToExport, filename);
};

const downloadWakeData = () => {
  if (!wakeData.value || !wakeData.value.distances || !wakeData.value.speeds) {
    ElMessage.warning('没有可下载的尾流数据。');
    return;
  }
  const dataToExport = wakeData.value.distances.map((distance, index) => ({
    distance_km: distance.toFixed(3),
    speed_mps: wakeData.value.speeds[index]?.toFixed(3) ?? 'N/A'
  }));
  const filename = `wake_${props.caseId}_${selectedTurbine.value}.csv`;
  downloadCSV(dataToExport, filename);
};

const handlePointQuery = async () => {
  if (queryPoint.value.x === null || queryPoint.value.y === null || queryPoint.value.z === null) {
    ElMessage.warning('请输入完整的X, Y, Z坐标。');
    return;
  }
  chartLoading.value.pointQuery = true;
  pointQueryResult.value = null;
  try {
    const result = await getPointWindSpeed(props.caseId, queryPoint.value.x, queryPoint.value.y, queryPoint.value.z);
    if (result.speed !== null) {
      pointQueryResult.value = `风速: ${result.speed.toFixed(3)} m/s`;
    } else {
      pointQueryResult.value = '查询点位于计算域之外';
    }
  } catch (error) {
    const message = error?.message || '查询单点风速时出错';
    pointQueryResult.value = message;
    ElMessage.error(message);
  } finally {
    chartLoading.value.pointQuery = false;
  }
};

// 10. mapCoordsToCanvas function (REMOVED) - Was already removed

// 11. Setup Canvas Overlay (REMOVED)
// const setupCanvasOverlay = () => { ... };

// 12. Draw Turbine Overlay (REMOVED)
// const drawTurbineOverlay = () => { ... };

// 13. Image Load Success Handler
const onImageLoad = () => {
  console.log('速度场图像已加载。');
  chartLoading.value.speedFieldImage = false; chartLoading.value.speedField = false; imageLoaded.value = true;
  // REMOVED: nextTick(() => { setTimeout(() => { setupCanvasOverlay(); }, 100); });
  // Maybe trigger chart resize if layout depends on image size? Usually handled by global resize.
  // nextTick(() => { safeResizeCharts(); }); // Optionally resize charts if their container might have changed
};

// 14. Image Load Error Handler
const onImageError = () => {
  console.error('无法从 URL 加载速度场图像:', currentSliceImageUrl.value); ElMessage.error('无法加载风场图像');
  chartLoading.value.speedFieldImage = false; chartLoading.value.speedField = false;
  currentSliceImageUrl.value = null; imageLoaded.value = false;
  // REMOVED: Canvas clearing logic
};

// 15. Handle Canvas Mouse Move (REMOVED)
// const handleCanvasMouseMove = (event) => { ... };

// 16. Handle Canvas Click (REMOVED)
// const handleCanvasClick = (event) => { ... };

// 17. Init ECharts Instances (No changes needed)
const initChartInstances = () => {
  nextTick(() => {
    console.log("尝试初始化图表实例...");
    try {
      if (profileChart.value && (!profileInstance || profileInstance.isDisposed())) {
        const rect = profileChart.value.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { profileInstance = echarts.init(profileChart.value); if (profileData.value) renderProfileChart(); }
      }
      if (wakeChart.value && (!wakeInstance || wakeInstance.isDisposed())) {
        const rect = wakeChart.value.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { wakeInstance = echarts.init(wakeChart.value); if (wakeData.value) renderWakeChart(); }
      }
      setupResizeObserver();
    } catch (err) { console.error("初始化 ECharts 实例时出错:", err); }
  });
};

// 18. Render Profile Chart (No changes needed relative to overlay removal)
const renderProfileChart = () => {
  if (!profileChart.value || !profileData.value) { console.log("renderProfileChart: 缺少容器或 profileData。"); return; }
  if (!profileData.value.heights || !profileData.value.speeds || profileData.value.heights.length !== profileData.value.speeds.length) {
      console.error("renderProfileChart: profileData 结构无效或长度不匹配。", profileData.value);
      if (profileInstance && !profileInstance.isDisposed()) {
          profileInstance.clear();
          profileInstance.setOption({ title: { text: '风速廓线', subtext: '数据格式错误', left: 'center', top: 'center', textStyle: { color: '#ccc' } } });
      }
      return;
  }
  if (!profileInstance || profileInstance.isDisposed()) { initChartInstances(); nextTick(() => { if (profileInstance && !profileInstance.isDisposed()) renderProfileChart(); }); return; }

  try {
    const { heights, speeds } = profileData.value;
    const validData = [];
    for (let i = 0; i < heights.length; i++) { if (speeds[i] != null && !isNaN(speeds[i]) && heights[i] != null && !isNaN(heights[i])) { validData.push([speeds[i], heights[i]]); } }
    if (validData.length === 0) { profileInstance.clear(); profileInstance.setOption({ title: { text: '风速廓线', subtext: '无有效数据', left: 'center', top: 'center', textStyle: { color: '#ccc' } } }); return; }

    const option = {
      title: { left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal', color: colorScheme.text } },
      tooltip: { trigger: 'axis', formatter: (params) => { const data = params[0]; if (!data || data.value === undefined) return ''; return `高度: ${data.value[1].toFixed(1)} m<br>风速: ${data.value[0].toFixed(2)} m/s`; }, axisPointer: { type: 'cross' } },
      grid: { top: '10%', right: '8%', bottom: '15%', left: '15%' },
      xAxis: { type: 'value', name: '风速 (m/s)', nameLocation: 'middle', nameGap: 25, axisLine: { lineStyle: { color: colorScheme.border } }, splitLine: { show: true, lineStyle: { color: '#eee' } } },
      yAxis: { type: 'value', name: '高度 (m)', nameLocation: 'middle', nameGap: 45, axisLine: { lineStyle: { color: colorScheme.border } }, splitLine: { show: true, lineStyle: { color: '#eee' } } },
      series: [ { name: '风速廓线', type: 'line', smooth: true, symbol: 'none', data: validData, itemStyle: { color: colorScheme.primary }, lineStyle: { width: 2 }, markLine: { data: [] } } ], // Initialize markLine.data
      dataZoom: [ { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }, { type: 'inside', yAxisIndex: 0, filterMode: 'weakFilter' }, { type: 'slider', xAxisIndex: 0, bottom: '2%', filterMode: 'weakFilter' }, { type: 'slider', yAxisIndex: 0, right: '2%', filterMode: 'weakFilter' } ],
    };

    if (currentHeight.value != null && option.series && option.series[0] && option.series[0].markLine && option.series[0].markLine.data) {
         option.series[0].markLine.data.push({
            yAxis: currentHeight.value,
            label: { formatter: `当前: ${currentHeight.value.toFixed(1)}m`, position: 'insideEndTop' },
            lineStyle: { type: 'dashed', color: colorScheme.info }
        });
    }

    const selectedTurbineObj = mainMetadata.value?.turbines?.find(t => t.id === selectedTurbine.value);
    if (selectedTurbineObj?.hubHeight != null) {
       const hubHeightIndex = findClosestIndex(heights, selectedTurbineObj.hubHeight);
       if (hubHeightIndex !== -1 && speeds[hubHeightIndex] != null) {
           if (option.series) {
               option.series.push({
                   name: '轮毂高度', type: 'scatter', symbolSize: 10, symbol: 'diamond',
                   itemStyle: { color: colorScheme.warning, borderColor: '#fff', borderWidth: 1 },
                   data: [[speeds[hubHeightIndex], heights[hubHeightIndex]]],
                   tooltip: { formatter: `轮毂高度 (${heights[hubHeightIndex].toFixed(1)}m): ${speeds[hubHeightIndex].toFixed(2)} m/s` }
               });
           }
       }
    }
    profileInstance.setOption(option, true);

  } catch (err) { console.error("渲染风廓线图表时出错:", err); }
};

// 19. Render Wake Chart (No changes needed relative to overlay removal)
const renderWakeChart = () => {
  if (!wakeChart.value || !wakeData.value) { return; }
   if (!wakeData.value.distances || !wakeData.value.speeds || wakeData.value.distances.length !== wakeData.value.speeds.length) {
       console.error("renderWakeChart: wakeData 结构无效或长度不匹配。", wakeData.value);
       if (wakeInstance && !wakeInstance.isDisposed()) {
           wakeInstance.clear();
           wakeInstance.setOption({ title: { text: '尾流分析', subtext: '数据格式错误', left: 'center', top: 'center', textStyle: { color: '#ccc' } } });
       }
       return;
   }
  if (!wakeInstance || wakeInstance.isDisposed()) { initChartInstances(); nextTick(() => { if (wakeInstance && !wakeInstance.isDisposed()) renderWakeChart(); }); return; }

  try {
    const { distances, speeds } = wakeData.value;
    const validData = [];
    for (let i = 0; i < distances.length; i++) { if (speeds[i] != null && !isNaN(speeds[i]) && distances[i] != null && !isNaN(distances[i])) { validData.push([distances[i], speeds[i]]); } }
    if (validData.length === 0) { wakeInstance.clear(); wakeInstance.setOption({ title: { text: '尾流分析', subtext: '无有效数据', left: 'center', top: 'center', textStyle: { color: '#ccc' } } }); return; }

    const option = {
      title: { left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal', color: colorScheme.text } },
      tooltip: { trigger: 'axis', formatter: (params) => { const data = params[0]; if (!data || data.value === undefined) return ''; const distance = data.value[0]; const formattedDist = distance >= 0 ? `下游 ${distance.toFixed(2)} m` : `上游 ${Math.abs(distance).toFixed(2)} m`; return `${formattedDist}<br>风速: ${data.value[1].toFixed(2)} m/s`; }, axisPointer: { type: 'cross' } },
      grid: { top: '10%', right: '8%', bottom: '15%', left: '15%' },
      xAxis: { type: 'value', name: '下游距离 (km)', nameLocation: 'middle', nameGap: 25, axisLine: { lineStyle: { color: colorScheme.border } }, splitLine: { show: true, lineStyle: { color: '#eee' } } },
      yAxis: { type: 'value', name: '风速 (m/s)', nameLocation: 'middle', nameGap: 45, axisLine: { lineStyle: { color: colorScheme.border } }, splitLine: { show: true, lineStyle: { color: '#eee' } } },
      series: [ { name: '风速', type: 'line', smooth: true, symbol: 'none', data: validData, itemStyle: { color: colorScheme.success }, lineStyle: { width: 2 }, markLine: { symbol: 'none', lineStyle: { type: 'dashed', color: colorScheme.danger }, data: [{ xAxis: 0, label: { formatter: '风机位置', position: 'insideStartTop' } }] } } ],
      dataZoom: [ { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }, { type: 'inside', yAxisIndex: 0, filterMode: 'weakFilter' }, { type: 'slider', xAxisIndex: 0, bottom: '2%', filterMode: 'weakFilter' } ],
    };
    wakeInstance.setOption(option, true);
  } catch (err) { console.error("渲染尾流图表时出错:", err); }
};

// 20. Force Charts Render
const forceChartsRender = () => { nextTick(() => { safeResizeCharts(); }); };

// 21. Handle Resize
const handleResize = debounce(() => {
    // REMOVED: Canvas resize logic
    safeResizeCharts();
}, 200);

// 22. Safe Resize Charts
const safeResizeCharts = () => { try { if (profileInstance && !profileInstance.isDisposed()) profileInstance.resize(); if (wakeInstance && !wakeInstance.isDisposed()) wakeInstance.resize(); } catch (err) { console.warn("调整图表大小时出错:", err); } };

// 23. Setup Resize Observer
const setupResizeObserver = () => {
  const chartElements = [profileChart.value, wakeChart.value].filter(Boolean);
  if (chartElements.length > 0 && typeof ResizeObserver !== 'undefined') {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
    } else {
      resizeObserver.disconnect(); // Disconnect old observers if any
    }
    chartElements.forEach(el => resizeObserver.observe(el));
    // Observe the image container as well if its size changes might affect layout
    if (speedFieldContainer.value) { resizeObserver.observe(speedFieldContainer.value); }
    console.log("ResizeObserver 设置成功");
  } else {
    console.warn("ResizeObserver 不可用或没有图表元素可观察");
  }
};


// 24. Export Charts (No change needed)
const exportCharts = () => {
  const chartsToExport = [
    { instance: profileInstance, name: 'WindProfile' },
    { instance: wakeInstance, name: 'WakeAnalysis' }
  ];
  const filenameBase = `WindSim_${props.caseId}_${selectedTurbine.value || 'Farm'}_H${currentHeight.value}m`;

  chartsToExport.forEach(chartInfo => {
    if (chartInfo.instance && !chartInfo.instance.isDisposed()) {
      try {
        const dataUrl = chartInfo.instance.getDataURL({
          type: 'png',
          pixelRatio: 2, // Higher resolution
          backgroundColor: '#fff'
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${filenameBase}_${chartInfo.name}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error(`导出图表 ${chartInfo.name} 失败:`, e);
        ElMessage.error(`导出图表 ${chartInfo.name} 失败`);
      }
    }
  });

  // Optionally export the main visualization image if needed
  if (currentSliceImageUrl.value && imageLoaded.value) {
     const link = document.createElement('a');
     link.href = currentSliceImageUrl.value; // Use the original URL or create a data URL from the <img> if needed
     link.download = `${filenameBase}_SpeedField.png`; // Adjust extension if needed
     // Note: Downloading cross-origin images might be restricted by CORS policy if not handled properly server-side or via proxy
     // A safer approach might be to fetch the image blob and create an object URL, but direct link is simpler if CORS allows
     try {
       // Attempt direct download
       link.click();
     } catch (e) {
       console.warn("直接下载风场图片可能失败，尝试 fetch:", e);
       // Fallback: Fetch image blob and create object URL (requires async)
       fetch(currentSliceImageUrl.value)
         .then(response => response.blob())
         .then(blob => {
           const objectUrl = URL.createObjectURL(blob);
           const fetchLink = document.createElement('a');
           fetchLink.href = objectUrl;
           fetchLink.download = `${filenameBase}_SpeedField.png`;
           document.body.appendChild(fetchLink);
           fetchLink.click();
           document.body.removeChild(fetchLink);
           URL.revokeObjectURL(objectUrl); // Clean up
         })
         .catch(fetchError => {
           console.error('导出风场图片失败 (Fetch):', fetchError);
           ElMessage.error('导出风场图片失败');
         });
     }
   }
};

// --- Watchers ---
watch(selectedTurbine, async (newVal, oldVal) => {
  console.log(`观察者: 选中风机从 ${oldVal || '无'} 变为 ${newVal || '无'}`);
  if (newVal) {
    const profilePromise = fetchProfileData(newVal);
    const wakePromise = fetchWakeData(newVal);
    await Promise.allSettled([profilePromise, wakePromise]);
    // updateTurbineDetails is called inside fetchProfileData on success
  } else {
    profileData.value = null; wakeData.value = null; turbineDetails.value = null;
    if (profileInstance && !profileInstance.isDisposed()) profileInstance.clear();
    if (wakeInstance && !wakeInstance.isDisposed()) wakeInstance.clear();
  }
  // REMOVED: drawTurbineOverlay();
});

watch(currentHeight, (newVal, oldVal) => {
    if (newVal !== oldVal && selectedTurbine.value) {
        updateTurbineDetails();
        if (profileInstance && !profileInstance.isDisposed() && profileData.value) { renderProfileChart(); }
    }
});

watch(() => props.caseId, (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
        console.log(`观察者: 工况 ID 从 ${oldVal} 变为 ${newVal}, 重新获取所有数据...`);
        if (oldVal) { clearClientCaseCache(oldVal); }
        resetVisualizationState();
        ensureCaseLoaded(newVal).then(() => fetchAllData());
    } else if (!newVal) { resetVisualizationState(); }
});

watch(
  () => caseStore.visualizationStatus,
  async (status) => {
    if (status === 'completed' && props.caseId) {
      await fetchAllData();
    }
    await nextTick();
    scrollPrecomputeLogToBottom();
  }
);

watch(
  () => (caseStore.visualizationMessages || []).length,
  () => {
    scrollPrecomputeLogToBottom();
  }
);

// --- Lifecycle Hooks ---
onMounted(async () => {
  console.log(`SpeedVisualization 已挂载，工况 ID: ${props.caseId}`);
  window.addEventListener('resize', handleResize);

  await nextTick();
  if (!props.caseId) {
    resetVisualizationState();
    return;
  }

  await ensureCaseLoaded(props.caseId);
  await fetchAllData();
});

onUnmounted(() => {
  console.log("SpeedVisualization 即将卸载");
  window.removeEventListener('resize', handleResize);
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  // REMOVED: Canvas event listener removal logic
  if (profileInstance && !profileInstance.isDisposed()) { try { profileInstance.dispose(); } catch(e){} profileInstance = null; }
  if (wakeInstance && !wakeInstance.isDisposed()) { try { wakeInstance.dispose(); } catch(e){} wakeInstance = null; }
  console.log("SpeedVisualization 已卸载并清理资源。");
});

</script>

<style scoped>
/* Paste your previous CSS styles here, BUT REMOVE the .turbine-overlay-canvas style */
.advanced-visualization-container {
  width: 100%;
  height: 100%; /* 尝试让容器撑满父容器 */
  min-height: 650px; /* 设置最小高度防止塌陷 */
  display: flex; /* 使用 flex 布局 */
  flex-direction: column; /* 垂直排列子元素 */
}

.visualization-card {
  flex: 1; /* 让卡片填满剩余空间 */
  background-color: #f8f9fa;
  border-radius: 8px; /* 统一圆角 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); /* 调整阴影 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止内容溢出卡片 */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px; /* 调整内边距 */
  border-bottom: 1px solid #e9ecef; /* 调整边框颜色 */
  flex-shrink: 0; /* 防止头部被压缩 */
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem; /* 略微增大标题 */
  font-weight: 600;
  color: #343a40; /* 调整标题颜色 */
}

.viz-controls {
  background-color: #ffffff;
  border-radius: 6px; /* 统一圆角 */
  padding: 10px 15px;
  margin: 10px; /* 统一外边距 */
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04); /* 使用内阴影 */
  flex-shrink: 0; /* 防止控制栏被压缩 */
}

.precompute-alert {
  margin: 10px;
}

.precompute-log {
  margin: 0 10px 10px;
  border-radius: 8px;
  background: #0b1220;
  color: #e5e7eb;
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.precompute-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.75);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.precompute-log-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.precompute-log-content {
  max-height: 180px;
  overflow: auto;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.control-item {
  margin-bottom: 8px; /* 减少间距 */
  display: flex; /* 使用 Flex 布局 */
  align-items: center; /* 垂直居中 */
  gap: 10px; /* 增加标签和控件间距 */
}

.control-item .label {
  /* display: block; */ /* 不再需要块级显示 */
  margin-bottom: 0; /* 移除底部外边距 */
  font-size: 0.85rem; /* 标准化字体大小 */
  font-weight: 500;
  color: #495057; /* 调整标签颜色 */
  white-space: nowrap; /* 防止标签换行 */
}

.control-item .el-slider,
.control-item .el-select {
  flex: 1; /* 让控件填满剩余空间 */
  min-width: 150px; /* 确保控件有最小宽度 */
}

/* 主内容区 */
.main-content {
  display: flex;
  flex: 1; /* 让主内容区填满卡片剩余空间 */
  min-height: 0; /* 允许内容区在 flex 容器中收缩 */
  padding: 0 10px 10px 10px; /* 统一内边距 */
  gap: 15px; /* 调整左右间距 */
  overflow: hidden; /* 防止内部元素溢出 */
}

/* 左侧风速场图片部分 */
.speed-field-section {
  flex: 1; /* 占据可用空间 */
  min-width: 40%; /* 设置最小宽度比例 */
  max-width: 60%; /* 设置最大宽度比例 */
  background-color: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  position: relative;
  display: flex; /* 内部也用 flex */
  justify-content: center;
  align-items: center;
}

.visualization-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 5px; /* 减少内边距 */
}

.speed-field-container {
  position: relative; /* 确保 canvas 定位相对于此容器 (虽然 canvas 没了，但 position: relative 无害) */
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 隐藏溢出的部分 */
  border-radius: 4px; /* 轻微圆角 */
}

.speed-field-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  height: auto; /* 保持原始比例 */
  width: auto;  /* 保持原始比例 */
  object-fit: contain; /* 图片缩放以适应容器，保持比例 */
  background-color: #e9ecef; /* 图片加载时显示背景色 */
}

.no-image-placeholder, .turbine-details-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-align: center;
  background-color: #f8f9fa; /* 更柔和的背景 */
  color: #6c757d; /* 更柔和的文字颜色 */
  font-size: 0.9rem;
  gap: 10px;
  border-radius: 6px; /* 保持圆角一致 */
}

.no-image-placeholder .el-icon, .turbine-details-placeholder .el-icon {
  font-size: 3rem; /* 调整图标大小 */
  opacity: 0.6;
}

/* REMOVED: .turbine-overlay-canvas style */
/*
.turbine-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: auto;
}
*/

/* 右侧图表部分 */
.charts-section {
  flex: 1; /* 占据可用空间 */
  display: flex;
  flex-direction: column;
  gap: 10px; /* 调整图表间距 */
  min-width: 35%; /* 最小宽度比例 */
  min-height: 0; /* 允许收缩 */
  overflow: hidden; /* 防止内部溢出 */
}

.chart-wrapper {
  flex: 1; /* 每个图表容器平分空间 */
  background-color: #fff;
  border-radius: 6px;
  padding: 8px 12px; /* 调整内边距 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  min-height: 220px; /* 设置合理的最小高度 */
  overflow: hidden; /* 隐藏图表溢出 */
  position: relative; /* 为了加载指示器定位 */
}

.chart {
  flex: 1; /* 图表区域填满剩余空间 */
  width: 100%;
  min-height: 150px; /* 确保图表有最小绘图区域 */
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px; /* 减少标题下方间距 */
  flex-shrink: 0;
}

.chart-header h4 {
  margin: 0;
  font-size: 0.95rem; /* 标准化字体大小 */
  font-weight: 600;
  color: #343a40;
}

.chart-header .subtitle {
  font-size: 0.8rem; /* 减小副标题 */
  color: #6c757d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px; /* 限制最大宽度 */
}
.chart-header .subtitle-placeholder {
    font-size: 0.8rem;
    color: #adb5bd; /* 使用更浅的颜色 */
    font-style: italic;
}


.turbine-details {
  flex-shrink: 0; /* 不压缩详情面板 */
  background-color: #fff;
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05); /* 更轻的阴影 */
  margin: 0;
  max-height: 200px; /* 增加最大高度 */
  overflow-y: auto; /* 内容多时允许滚动 */
}

.turbine-details h4 {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #343a40;
}
/* 调整详情项样式 */
.turbine-details .el-descriptions :deep(.el-descriptions__label) {
    font-size: 0.8rem;
    color: #6c757d;
}
.turbine-details .el-descriptions :deep(.el-descriptions__content) {
    font-size: 0.85rem;
    color: #343a40;
}


/* 加载指示器 */
.chart-loading, .image-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5; /* 确保在内容之上但在控件之下 */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.8); /* 半透明背景 */
  color: #495057;
  border-radius: 6px; /* 匹配容器圆角 */
  pointer-events: none; /* 不阻挡下方元素事件 */
}
.chart-loading .el-icon, .image-loading-overlay .el-icon {
    font-size: 1.5rem; /* 调整加载图标大小 */
}

.image-loading-overlay span, .chart-loading span {
  margin-top: 8px;
  font-size: 0.85rem;
}

/* 响应式布局优化 */
@media (max-width: 1200px) {
   .main-content { gap: 20px; }
   .speed-field-section { min-width: 45%; }
   .charts-section { min-width: 40%; }
}

@media (max-width: 992px) {
  .main-content { flex-direction: column; overflow-y: auto; overflow-x: hidden; padding: 0 10px 10px 10px; }
  .speed-field-section { max-width: 100%; min-width: 100%; height: 45vh; min-height: 350px; max-height: 500px; margin-bottom: 15px; }
  .charts-section { max-width: 100%; min-width: 100%; flex-direction: row; flex-wrap: wrap; overflow: visible; gap: 15px; }
  .chart-wrapper { flex-basis: calc(50% - 8px); min-width: 250px; min-height: 280px; }
   .turbine-details { flex-basis: 100%; margin-top: 5px; }
}

@media (max-width: 768px) {
  .card-header h3 { font-size: 1rem; }
  .control-item .label { font-size: 0.8rem; }
  .speed-field-section { height: 40vh; min-height: 300px; max-height: 400px; }
  .charts-section { flex-direction: column; }
  .chart-wrapper { flex-basis: auto; min-height: 250px; }
  .turbine-details { flex-basis: auto; }
}

@media (max-width: 480px) {
   .control-item { flex-direction: column; align-items: flex-start; gap: 5px; }
   .control-item .el-slider, .control-item .el-select { width: 100%; }
   .speed-field-section { height: 35vh; min-height: 250px; }
   .chart-wrapper { padding: 5px 8px; min-height: 220px; }
   .turbine-details { padding: 8px 10px; }
}
</style>
