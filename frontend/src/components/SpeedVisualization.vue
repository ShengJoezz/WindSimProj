<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-02 20:23:20
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 20:30:40
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\SpeedVisualization.vue
 * @Description:
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
              <el-button :icon="Download" circle @click="exportCharts"></el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </template>

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
                @change="handleHeightChange"
              />
            </div>
          </el-col>
          <el-col :xs="24" :md="8">
            <div class="control-item">
              <span class="label">选择风机:</span>
              <el-select v-model="selectedTurbine" placeholder="选择风机" filterable clearable style="width: 100%">
                <el-option
                  v-for="turbine in turbines"
                  :key="turbine.id"
                  :label="turbine.name || turbine.id"
                  :value="turbine.id"
                />
              </el-select>
            </div>
          </el-col>
        </el-row>
      </div>

      <div class="main-content">
        <!-- 左侧 - 风速场图片 -->
        <div class="speed-field-section">
          <div class="visualization-wrapper">
            <div class="speed-field-container" ref="speedFieldContainer">
              <!-- 添加背景指示器，在图片加载前显示 -->
              <div v-if="!currentSliceImageUrl" class="no-image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>请选择高度查看风场</span>
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
              <div v-if="chartLoading.speedFieldImage" class="image-loading-overlay">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>加载图像...</span>
              </div>
              <canvas ref="turbineOverlayCanvas" class="turbine-overlay-canvas"></canvas>
            </div>
            <div v-if="chartLoading.speedField" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
          </div>
        </div>

        <!-- 右侧 - 图表区域 -->
        <div class="charts-section">
          <div class="chart-wrapper">
            <div class="chart-header">
              <h4>风速廓线</h4>
              <span v-if="selectedTurbine" class="subtitle">{{ getTurbineName(selectedTurbine) }}</span>
            </div>
            <div ref="profileChart" class="chart"></div>
            <div v-if="chartLoading.profile" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
          </div>

          <div class="chart-wrapper">
            <div class="chart-header">
              <h4>尾流分析</h4>
              <span v-if="selectedTurbine" class="subtitle">{{ getTurbineName(selectedTurbine) }}</span>
            </div>
            <div ref="wakeChart" class="chart"></div>
            <div v-if="chartLoading.wake" class="chart-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
          </div>

          <!-- 风机详情面板（移到图表区域内） -->
          <div v-if="selectedTurbine && turbineDetails" class="turbine-details">
            <h4>风机详情</h4>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="ID">{{ turbineDetails.id }}</el-descriptions-item>
              <el-descriptions-item label="坐标">{{ turbineDetails.coordinates }}</el-descriptions-item>
              <el-descriptions-item label="轮毂高度">{{ turbineDetails.hubHeight }} m</el-descriptions-item>
              <el-descriptions-item label="叶轮直径">{{ turbineDetails.rotorDiameter }} m</el-descriptions-item>
              <el-descriptions-item label="当前高度风速">{{ turbineDetails.currentSpeed }} m/s</el-descriptions-item>
              <el-descriptions-item label="轮毂高度风速">{{ turbineDetails.hubSpeed }} m/s</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Refresh, Download, Loading, Picture } from '@element-plus/icons-vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { debounce } from 'lodash-es';
import { ElMessage, ElSlider, ElSelect, ElOption, ElCard, ElIcon, ElCheckbox, ElButtonGroup, ElTooltip, ElRow, ElCol, ElDescriptions, ElDescriptionsItem, ElCheckboxGroup } from 'element-plus';
import { getMetadata, getSliceData, getProfileData, getWakeData, findClosestIndex } from '@/services/visualizationService'; // 引入 service

// 配色方案
const colorScheme = {
  primary: '#409EFF',
  success: '#67C23A',
  warning: '#E6A23C',
  danger: '#F56C6C',
  info: '#909399',
  background: '#F5F7FA',
  text: '#303133',
  border: '#DCDFE6',
  chartColors: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
};

// 定义组件属性
const props = defineProps({
  caseId: {
    type: String,
    required: true
  }
});

// 状态变量
const loading = ref(false);
const chartLoading = ref({
  speedField: false,
  speedFieldImage: false,
  profile: false,
  wake: false
});
const metadata = ref(null);
const turbines = ref([]);
const currentHeight = ref(10);
const selectedTurbine = ref(null);
const displayOptions = ref(['contours']); // 保留但不再显示
const currentSliceImageUrl = ref(null);
const currentExtentKm = ref(null);
const profileData = ref(null);
const wakeData = ref(null);
const turbineDetails = ref(null);
const imageLoaded = ref(false); // 新增状态跟踪图像是否已加载

// Refs for new elements
const speedFieldContainer = ref(null);
const speedFieldImage = ref(null);
const turbineOverlayCanvas = ref(null);
let turbineOverlayCtx = null; // Canvas 2D context

// 图表实例
const profileChart = ref(null);
const wakeChart = ref(null);
let profileInstance = null;
let wakeInstance = null;

// 计算属性
const minHeight = computed(() => {
  if (metadata.value?.heightLevels && metadata.value.heightLevels.length > 0) {
    return Math.min(...metadata.value.heightLevels);
  }
  return 10;
});

const maxHeight = computed(() => {
  if (metadata.value?.heightLevels && metadata.value.heightLevels.length > 0) {
    return Math.max(...metadata.value.heightLevels);
  }
  return 200;
});

const heightStep = computed(() => {
  if (metadata.value?.heightLevels && metadata.value.heightLevels.length > 1) {
    const sorted = [...metadata.value.heightLevels].sort((a, b) => a - b);
    return sorted[1] - sorted[0];
  }
  return 10;
});

// 方法
const fetchAllData = async () => {
  loading.value = true;
  // Reset relevant state for full refresh
  selectedTurbine.value = null; // Reset selection before fetching
  profileData.value = null;
  wakeData.value = null;
  imageLoaded.value = false; // 重置图像加载状态
  if (profileInstance) profileInstance.clear();
  if (wakeInstance) wakeInstance.clear();
  turbineDetails.value = null;
  // Clear canvas before new image loads
  if (turbineOverlayCtx) {
    try {
      const canvas = turbineOverlayCanvas.value;
      if (canvas && canvas.width && canvas.height) {
        turbineOverlayCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      console.warn('Error clearing canvas:', err);
    }
  }

  try {
    await fetchMetadata(); // Fetches metadata and populates turbines.value

    // *** Select the first turbine by default ***
    let initialTurbineId = null;
    if (turbines.value && turbines.value.length > 0) {
      initialTurbineId = turbines.value[0].id;
      selectedTurbine.value = initialTurbineId; // Set the selectedTurbine ref
      console.log(`Default turbine selected: ${initialTurbineId}`);
    } else {
      console.log("No turbines found in metadata for default selection.");
    }
    // *** End default selection ***

    // Fetch initial slice image info (using the first height level found in metadata)
    if (metadata.value?.heightLevels?.length > 0) {
      // If currentHeight wasn't set by user interaction, use the first level
      if (!currentHeight.value || !metadata.value.heightLevels.includes(currentHeight.value)) {
        currentHeight.value = metadata.value.heightLevels[0];
      }
      await fetchSpeedImageInfo(currentHeight.value);
    } else {
      console.warn("No height levels found, cannot fetch initial slice image.");
      // Handle case where no heights exist - maybe show placeholder?
      chartLoading.value.speedField = false;
      chartLoading.value.speedFieldImage = false;
    }

    // Fetch profile and wake data IF a turbine is selected (either default or pre-existing)
    // The watcher on selectedTurbine will typically handle this when it's set above,
    // but fetching explicitly ensures it happens during the initial load sequence.
    if (selectedTurbine.value) { // Use the potentially updated selectedTurbine value
      console.log(`Fetching profile/wake for selected turbine: ${selectedTurbine.value}`);
      // Use Promise.allSettled to avoid one failure stopping the other
      const results = await Promise.allSettled([
        fetchProfileData(selectedTurbine.value),
        fetchWakeData(selectedTurbine.value)
      ]);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to fetch ${index === 0 ? 'profile' : 'wake'} data on initial load:`, result.reason);
        }
      });
    }

  } catch (error) {
    console.error('Failed to fetch visualization data:', error);
    // Avoid showing generic error if specific errors were already shown by sub-functions
    // ElMessage.error('加载可视化数据失败，请稍后重试');
  } finally {
    loading.value = false;
  }
};

const fetchMetadata = async () => {
  try {
    const meta = await getMetadata(props.caseId); // 使用 service
    metadata.value = meta;
    turbines.value = meta.turbines || [];
    currentExtentKm.value = meta.extentKm || meta.extent; // 保存 extent

    if (meta.heightLevels && meta.heightLevels.length > 0) {
      // currentHeight.value = meta.heightLevels[0]; // 初始化高度在 fetchAllData 中设置
    }
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    throw error;
  }
};

// 修改 fetchSpeedData 为 fetchSpeedImageInfo，获取 image URL
const fetchSpeedImageInfo = async (height) => {
  if (!props.caseId) return;
  chartLoading.value.speedField = true;
  chartLoading.value.speedFieldImage = true; // Image loading starts
  currentSliceImageUrl.value = null; // 清空之前的 image URL
  imageLoaded.value = false; // 重置图像加载状态

  try {
    const data = await getSliceData(props.caseId, height); // 使用 service 获取 image URL
    currentSliceImageUrl.value = data.imageUrl; // 设置 image URL
    currentHeight.value = data.actualHeight;
    turbines.value = data.turbines; // 更新 turbines 数据
    currentExtentKm.value = data.extentKm;

    console.log(`Image URL set for height ${data.actualHeight}: ${data.imageUrl}`);

  } catch (error) {
    console.error(`Failed to fetch speed image info for height ${height}:`, error);
    ElMessage.error(`加载高度 ${height.toFixed(1)}m 图像信息失败`);
    currentSliceImageUrl.value = null; // 确保错误时清空 URL
    imageLoaded.value = false;
    chartLoading.value.speedFieldImage = false; // Stop image loading indicator on error
  } finally {
    chartLoading.value.speedField = false;
  }
};

const fetchProfileData = async (turbineId) => {
  if (!turbineId) return;

  chartLoading.value.profile = true;
  try {
    const response = await getProfileData(props.caseId, turbineId); // 使用 service
    if (response.success) {
      profileData.value = response.profile;
      await nextTick();
      renderProfileChart();
      updateTurbineDetails();
    }
  } catch (error) {
    console.error(`Failed to fetch profile data for turbine ${turbineId}:`, error);
    throw error;
  } finally {
    chartLoading.value.profile = false;
  }
};

const fetchWakeData = async (turbineId) => {
  if (!turbineId) return;

  chartLoading.value.wake = true;
  try {
    const response = await getWakeData(props.caseId, turbineId); // 使用 service
    if (response.success) {
      wakeData.value = response.wake;
      await nextTick();
      renderWakeChart();
    }
  } catch (error) {
    console.error(`Failed to fetch wake data for turbine ${turbineId}:`, error);
    throw error;
  } finally {
    chartLoading.value.wake = false;
  }
};

// 处理高度变更
const handleHeightChange = debounce(async (newHeight) => {
  try {
    await fetchSpeedImageInfo(newHeight); // 获取 slice image URL
    // 如果有选中的风机，更新其在当前高度的信息
    if (selectedTurbine.value) {
      updateTurbineDetails();
    }
  } catch (error) {
    console.error('Error handling height change:', error);
  }
}, 300);

// 获取风机名称
const getTurbineName = (turbineId) => {
  const turbine = turbines.value.find(t => t.id === turbineId);
  return turbine ? (turbine.name || turbine.id) : turbineId;
};

// 更新风机详情
const updateTurbineDetails = () => {
  if (!selectedTurbine.value || !profileData.value) {
    turbineDetails.value = null;
    return;
  }

  const turbine = turbines.value.find(t => t.id === selectedTurbine.value);
  if (!turbine) {
    turbineDetails.value = null;
    return;
  }

  // 找到当前高度和轮毂高度的风速
  let currentHeightSpeed = null;
  let hubHeightSpeed = null;

  if (profileData.value.heights && profileData.value.speeds) {
    // 当前高度风速
    const currentHeightIndex = findClosestIndex(profileData.value.heights, currentHeight.value);
    if (currentHeightIndex !== -1) {
      currentHeightSpeed = profileData.value.speeds[currentHeightIndex];
    }

    // 轮毂高度风速
    const hubHeightIndex = findClosestIndex(profileData.value.heights, turbine.hubHeight);
    if (hubHeightIndex !== -1) {
      hubHeightSpeed = profileData.value.speeds[hubHeightIndex];
    }
  }

  turbineDetails.value = {
    id: turbine.id,
    coordinates: `(${turbine.x.toFixed(2)}, ${turbine.y.toFixed(2)})`,
    hubHeight: turbine.hubHeight.toFixed(1),
    rotorDiameter: turbine.rotorDiameter.toFixed(1),
    currentSpeed: currentHeightSpeed !== null ? currentHeightSpeed.toFixed(2) : 'N/A',
    hubSpeed: hubHeightSpeed !== null ? hubHeightSpeed.toFixed(2) : 'N/A'
  };
};

/* Canvas overlay functions */

// 改进后的 setupCanvasOverlay 函数 - 添加了更多错误检查
const setupCanvasOverlay = () => {
  // 确保只在图像加载完成后设置 canvas
  if (!imageLoaded.value) {
    console.log("setupCanvasOverlay: Image not loaded yet");
    return;
  }

  if (!turbineOverlayCanvas.value || !speedFieldImage.value) {
    console.warn("setupCanvasOverlay: Refs for canvas or image not ready");
    return;
  }

  try {
    const canvas = turbineOverlayCanvas.value;
    const imgEl = speedFieldImage.value;

    // 确保图像元素已完全渲染
    if (!imgEl.complete) {
      console.log("Image not complete yet, deferring canvas setup");
      return;
    }

    const imgRect = imgEl.getBoundingClientRect();

    if (imgRect.width <= 0 || imgRect.height <= 0) {
      console.warn("Image has invalid dimensions, deferring canvas setup");
      return;
    }

    console.log(`Setting up canvas with dimensions: ${imgRect.width} x ${imgRect.height}`);

    // 设置 canvas 与图片显示区域尺寸一致
    canvas.width = imgRect.width;
    canvas.height = imgRect.height;

    // 定位 canvas 与图片重合
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = `${imgRect.width}px`;
    canvas.style.height = `${imgRect.height}px`;

    if (!turbineOverlayCtx) {
      turbineOverlayCtx = canvas.getContext('2d');
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.addEventListener('mousemove', handleCanvasMouseMove);
      canvas.addEventListener('click', handleCanvasClick);
      console.log("Canvas listeners attached.");
    } else {
      turbineOverlayCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    console.log(`Canvas overlay setup/resized: ${canvas.width} x ${canvas.height}`);
    drawTurbineOverlay();
  } catch (err) {
    console.error("Error in setupCanvasOverlay:", err);
  }
};

// 改进坐标映射函数，考虑matplotlib图像的实际比例和边距
const mapCoordsToCanvas = (xKm, yKm) => {
  if (!currentExtentKm.value || !turbineOverlayCanvas.value || !turbineOverlayCtx) {
    console.warn("mapCoordsToCanvas: Missing extent, canvas, or context");
    return null;
  }

  try {
    const [minX, maxX, minY, maxY] = currentExtentKm.value;
    const canvas = turbineOverlayCanvas.value;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      console.warn("Invalid canvas dimensions in mapCoordsToCanvas");
      return null;
    }

    // 计算图像内部的数据区域（考虑matplotlib的默认边距）
    // 典型的matplotlib图像有约10%的边距用于坐标轴和标签
    const plotMarginLeft = 0.12 * canvasWidth;   // 左边距略大，考虑Y轴标签
    const plotMarginRight = 0.05 * canvasWidth;  // 右边距略小
    const plotMarginBottom = 0.12 * canvasHeight; // 底部边距，考虑X轴标签
    const plotMarginTop = 0.08 * canvasHeight;    // 顶部边距略小

    // 计算实际数据区域尺寸
    const plotWidth = canvasWidth - plotMarginLeft - plotMarginRight;
    const plotHeight = canvasHeight - plotMarginBottom - plotMarginTop;

    // 归一化坐标（考虑坐标系方向：Y轴在matplotlib中是从下到上）
    const normalizedX = (xKm - minX) / (maxX - minX);
    const normalizedY = (yKm - minY) / (maxY - minY);

    // 转换为canvas像素坐标
    // X方向：从左到右
    // Y方向：从上到下（注意canvas的Y轴方向与数学坐标系相反）
    const pixelX = plotMarginLeft + normalizedX * plotWidth;
    const pixelY = canvasHeight - plotMarginBottom - normalizedY * plotHeight;

    return { x: pixelX, y: pixelY };
  } catch (err) {
    console.error("Error in mapCoordsToCanvas:", err);
    return null;
  }
};

// 修改绘制函数，使用加粗、更明显的标记
const drawTurbineOverlay = () => {
  if (!turbineOverlayCtx || !turbines.value || turbines.value.length === 0 || !currentExtentKm.value) {
    console.log("Cannot draw turbine overlay: context, turbines, or extent missing.");
    return;
  }

  try {
    const ctx = turbineOverlayCtx;
    const canvas = turbineOverlayCanvas.value;

    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      console.warn("Invalid canvas in drawTurbineOverlay");
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    turbines.value.forEach(turbine => {
      const pos = mapCoordsToCanvas(turbine.x, turbine.y);
      if (!pos) return;

      const isSelected = turbine.id === selectedTurbine.value;
      const radius = isSelected ? 8 : 6;  // 增大风机标记尺寸

      // 先绘制外圈（选中状态用亮黄色，未选中用白色）
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      // 绘制内圈（红色或选中色）
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#FF4500' : '#F56C6C';
      ctx.fill();

      // 添加边框，增强可见性
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // 为选中的风机添加标签
      if (isSelected) {
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#000000';
        // 在风机上方绘制ID标签
        ctx.fillText(turbine.id, pos.x, pos.y - radius - 5);
      }
    });
  } catch (err) {
    console.error("Error in drawTurbineOverlay:", err);
  }
};

const onImageLoad = () => {
  console.log('Speed field image loaded.');
  chartLoading.value.speedFieldImage = false;
  imageLoaded.value = true;

  // 使用 nextTick 确保 DOM 已更新
  nextTick(() => {
    // 延迟一点点时间确保图像尺寸已计算
    setTimeout(() => {
      setupCanvasOverlay();
    }, 100);
  });
};

const onImageError = () => {
  console.error('Failed to load speed field image from URL:', currentSliceImageUrl.value);
  ElMessage.error('无法加载风场图像');
  chartLoading.value.speedFieldImage = false;
  currentSliceImageUrl.value = null;
  imageLoaded.value = false;

  if (turbineOverlayCtx && turbineOverlayCanvas.value) {
    try {
      turbineOverlayCtx.clearRect(0, 0, turbineOverlayCanvas.value.width, turbineOverlayCanvas.value.height);
    } catch (err) {
      console.warn("Error clearing canvas:", err);
    }
  }
};

let hoveredTurbineId = null;
const handleCanvasMouseMove = (event) => {
  if (!turbineOverlayCtx || !turbines.value || !turbineOverlayCanvas.value) return;

  try {
    const canvas = turbineOverlayCanvas.value;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    let foundTurbine = null;
    let minDistSq = 10 * 10;

    turbines.value.forEach(turbine => {
      const pos = mapCoordsToCanvas(turbine.x, turbine.y);
      if (!pos) return;
      const dx = mouseX - pos.x;
      const dy = mouseY - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        foundTurbine = turbine.id;
      }
    });

    if (foundTurbine !== hoveredTurbineId) {
      hoveredTurbineId = foundTurbine;
      canvas.style.cursor = foundTurbine ? 'pointer' : 'default';
    }
  } catch (err) {
    console.warn("Error in handleCanvasMouseMove:", err);
  }
};

const handleCanvasClick = (event) => {
  if (hoveredTurbineId) {
    selectedTurbine.value = hoveredTurbineId;
    console.log("Turbine selected:", hoveredTurbineId);
  }
};

// 修改图表初始化函数
const initChartInstances = () => {
  try {
    // 使用 setTimeout 确保容器已经布局好
    setTimeout(() => {
      nextTick(() => {
        if (profileChart.value) {
          // 检查容器尺寸
          const profileRect = profileChart.value.getBoundingClientRect();
          if (profileRect.width > 0 && profileRect.height > 0) {
            console.log(`Initializing profile chart: ${profileRect.width} x ${profileRect.height}`);
            profileInstance = echarts.init(profileChart.value, null, { renderer: 'canvas' });
            // 如果已有数据，立即渲染
            if (profileData.value) {
              renderProfileChart();
            }
          } else {
            console.warn("Profile chart container has zero dimensions");
          }
        }

        if (wakeChart.value) {
          // 检查容器尺寸
          const wakeRect = wakeChart.value.getBoundingClientRect();
          if (wakeRect.width > 0 && wakeRect.height > 0) {
            console.log(`Initializing wake chart: ${wakeRect.width} x ${wakeRect.height}`);
            wakeInstance = echarts.init(wakeChart.value, null, { renderer: 'canvas' });
            // 如果已有数据，立即渲染
            if (wakeData.value) {
              renderWakeChart();
            }
          } else {
            console.warn("Wake chart container has zero dimensions");
          }
        }
      });
    }, 200); // 延迟一点时间确保布局已完成
  } catch (err) {
    console.error("Error initializing chart instances:", err);
  }
};

// 修改 renderProfileChart 函数
const renderProfileChart = () => {
  if (!profileChart.value || !profileData.value) return;

  try {
    // 确保图表实例已初始化
    if (!profileInstance) {
      const rect = profileChart.value.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        profileInstance = echarts.init(profileChart.value, null, { renderer: 'canvas' });
      } else {
        console.warn("Profile chart container has zero dimensions, deferring init");
        // 在下一个布局周期重试
        setTimeout(() => renderProfileChart(), 100);
        return;
      }
    }

    const { heights, speeds } = profileData.value;
    const validData = [];
    for (let i = 0; i < heights.length; i++) {
      if (speeds[i] !== null) {
        validData.push([speeds[i], heights[i]]);
      }
    }

    const option = {
      title: {
        text: '风速廓线',
        textStyle: { fontSize: 14, fontWeight: 'normal', color: colorScheme.text }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const data = params[0];
          return `高度: ${data.value[1].toFixed(1)} m<br>风速: ${data.value[0].toFixed(2)} m/s`;
        },
        axisPointer: { type: 'cross' }
      },
      grid: { top: 50, right: 20, bottom: 40, left: 60 },
      xAxis: {
        type: 'value',
        name: '风速 (m/s)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { lineStyle: { color: colorScheme.border } },
        splitLine: { lineStyle: { color: 'rgba(220, 223, 230, 0.5)' } }
      },
      yAxis: {
        type: 'value',
        name: '高度 (m)',
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: { lineStyle: { color: colorScheme.border } },
        splitLine: { lineStyle: { color: 'rgba(220, 223, 230, 0.5)' } }
      },
      series: [
        {
          name: '风速廓线',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: validData,
          itemStyle: { color: colorScheme.primary },
          lineStyle: { width: 3 }
        }
      ]
    };

    if (currentHeight.value) {
      option.series.push({
        name: '当前高度',
        type: 'line',
        markLine: {
          symbol: 'none',
          label: { formatter: `当前高度: ${currentHeight.value.toFixed(1)}m`, position: 'middle' },
          lineStyle: { type: 'dashed', color: colorScheme.info },
          data: [{ yAxis: currentHeight.value }]
        }
      });
    }

    const selectedTurbineObj = turbines.value.find(t => t.id === selectedTurbine.value);
    if (selectedTurbineObj) {
      const hubHeightIndex = findClosestIndex(heights, selectedTurbineObj.hubHeight);
      if (hubHeightIndex !== -1 && speeds[hubHeightIndex] !== null) {
        option.series.push({
          name: '轮毂高度',
          type: 'scatter',
          symbolSize: 12,
          symbol: 'diamond',
          itemStyle: {
            color: colorScheme.warning,
            borderColor: '#fff',
            borderWidth: 2
          },
          data: [[speeds[hubHeightIndex], heights[hubHeightIndex]]],
          label: {
            show: true,
            position: 'top',
            formatter: `轮毂高度 (${selectedTurbineObj.hubHeight}m)`,
            color: colorScheme.text
          }
        });
      }
    }

    console.log("Setting profile chart option");
    profileInstance.setOption(option, true);

    // 手动调整图表大小
    profileInstance.resize();
  } catch (err) {
    console.error("Error rendering profile chart:", err);
  }
};

// 修改 renderWakeChart 函数 (类似于 renderProfileChart 的修改)
const renderWakeChart = () => {
  if (!wakeChart.value || !wakeData.value) return;

  try {
    // 确保图表实例已初始化
    if (!wakeInstance) {
      const rect = wakeChart.value.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        wakeInstance = echarts.init(wakeChart.value, null, { renderer: 'canvas' });
      } else {
        console.warn("Wake chart container has zero dimensions, deferring init");
        // 在下一个布局周期重试
        setTimeout(() => renderWakeChart(), 100);
        return;
      }
    }

    const { distances, speeds, hubHeightUsed } = wakeData.value;
    const validData = [];
    for (let i = 0; i < distances.length; i++) {
      if (speeds[i] !== null) {
        validData.push([distances[i], speeds[i]]);
      }
    }

    const option = {
      title: {
        text: `尾流分析 (高度: ${hubHeightUsed.toFixed(1)}m)`,
        textStyle: { fontSize: 14, fontWeight: 'normal', color: colorScheme.text }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const data = params[0];
          const distance = data.value[0];
          const formattedDist = distance >= 0
            ? `下游 ${distance.toFixed(2)} km`
            : `上游 ${Math.abs(distance).toFixed(2)} km`;
          return `${formattedDist}<br>风速: ${data.value[1].toFixed(2)} m/s`;
        },
        axisPointer: { type: 'cross' }
      },
      grid: { top: 50, right: 20, bottom: 50, left: 60 }, // 增加底部空间
      xAxis: {
        type: 'value',
        name: '距离 (km) [下游为正]',
        nameLocation: 'middle',
        nameGap: 35, // 增加名称间距
        axisLine: { lineStyle: { color: colorScheme.border } },
        splitLine: { lineStyle: { color: 'rgba(220, 223, 230, 0.5)' } }
      },
      yAxis: {
        type: 'value',
        name: '风速 (m/s)',
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: { lineStyle: { color: colorScheme.border } },
        splitLine: { lineStyle: { color: 'rgba(220, 223, 230, 0.5)' } }
      },
      series: [
        {
          name: '风速',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: validData,
          markArea: {
            itemStyle: { color: 'rgba(255, 173, 177, 0.2)' },
            data: [[{ xAxis: 0 }, { xAxis: Math.max(...distances) }]]
          },
          markLine: {
            symbol: 'none',
            lineStyle: { type: 'solid', color: colorScheme.danger },
            data: [{ xAxis: 0, label: { formatter: '风机位置', position: 'start' } }]
          },
          itemStyle: { color: colorScheme.success },
          lineStyle: { width: 3 }
        }
      ]
    };

    console.log("Setting wake chart option");
    wakeInstance.setOption(option, true);

    // 手动调整图表大小
    wakeInstance.resize();
  } catch (err) {
    console.error("Error rendering wake chart:", err);
  }
};

// 手动触发图表重渲染的辅助函数
const forceChartsRender = () => {
  nextTick(() => {
    if (profileInstance) {
      profileInstance.resize();
      if (profileData.value) {
        renderProfileChart();
      }
    } else if (profileChart.value && profileData.value) {
      renderProfileChart();
    }

    if (wakeInstance) {
      wakeInstance.resize();
      if (wakeData.value) {
        renderWakeChart();
      }
    } else if (wakeChart.value && wakeData.value) {
      renderWakeChart();
    }
  });
};

// 改进现有的 resize 处理函数
const handleResize = debounce(() => {
  console.log("Resize detected");

  if (imageLoaded.value) {
    setupCanvasOverlay();
    drawTurbineOverlay();
  }

  // 先尝试重设大小
  safeResizeCharts();

  // 如果实例不存在，尝试重新初始化
  if (!profileInstance && profileChart.value) {
    renderProfileChart();
  }
  if (!wakeInstance && wakeChart.value) {
    renderWakeChart();
  }
}, 200);

// 对已有的 onMounted 钩子进行修改
onMounted(() => {
  window.addEventListener('resize', handleResize);

  // 添加 200ms 延迟确保布局稳定后再初始化和加载数据
  setTimeout(() => {
    fetchAllData();
    initChartInstances();

    // 添加额外的图表可见性检查
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          console.log("Charts are now visible, triggering resize");
          safeResizeCharts();
        }
      });
    });

    if (profileChart.value) {
      visibilityObserver.observe(profileChart.value);
    }
    if (wakeChart.value) {
      visibilityObserver.observe(wakeChart.value);
    }

    return () => {
      visibilityObserver.disconnect();
    };
  }, 200);
});

// 添加 DOM 更新后的渲染触发器
watch(
  () => [profileChart.value, wakeChart.value],
  () => {
    console.log("Chart containers updated, triggering renderers");
    if (profileChart.value && profileData.value && !profileInstance) {
      setTimeout(() => renderProfileChart(), 100);
    }
    if (wakeChart.value && wakeData.value && !wakeInstance) {
      setTimeout(() => renderWakeChart(), 100);
    }
  }
);


const exportCharts = () => {
  try {
    if (selectedTurbine.value) {
      if (profileInstance) {
        const dataURL = profileInstance.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' });
        const link = document.createElement('a');
        link.download = `风廓线_${getTurbineName(selectedTurbine.value)}.png`;
        link.href = dataURL;
        link.click();
      }
      if (wakeInstance) {
        const dataURL = wakeInstance.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' });
        const link = document.createElement('a');
        link.download = `尾流分析_${getTurbineName(selectedTurbine.value)}.png`;
        link.href = dataURL;
        link.click();
      }
    } else {
      ElMessage.info('请先选择一个风机以导出其廓线和尾流图表。');
    }
    if (currentSliceImageUrl.value) {
      const link = document.createElement('a');
      link.href = currentSliceImageUrl.value;
      link.download = `风速场_高度${currentHeight.value.toFixed(1)}m.png`;
      link.click();
    }
  } catch (err) {
    console.error("Error exporting charts:", err);
    ElMessage.error('导出图表失败');
  }
};


// 安全的重绘函数
const safeResizeCharts = () => {
  try {
    if (profileInstance) {
      profileInstance.resize();
    }
    if (wakeInstance) {
      wakeInstance.resize();
    }
  } catch (err) {
    console.warn("Error resizing charts:", err);
  }
};

watch(selectedTurbine, async (newVal, oldVal) => {
  console.log(`Watcher: Selected turbine changed from ${oldVal} to ${newVal}`);
  if (newVal) {
    if (!profileData.value || profileData.value.id !== newVal) {
      console.log(`Watcher: Fetching profile for ${newVal}`);
      await fetchProfileData(newVal);
    } else {
      console.log(`Watcher: Profile data for ${newVal} likely already loaded, skipping fetch.`);
      if (profileInstance && profileData.value) renderProfileChart();
    }
    if (!wakeData.value || wakeData.value.id !== newVal) {
      console.log(`Watcher: Fetching wake for ${newVal}`);
      await fetchWakeData(newVal);
    } else {
      console.log(`Watcher: Wake data for ${newVal} likely already loaded, skipping fetch.`);
      if (wakeInstance && wakeData.value) renderWakeChart();
    }
  } else {
    profileData.value = null;
    wakeData.value = null;
    turbineDetails.value = null;
    if (profileInstance) profileInstance.clear();
    if (wakeInstance) wakeInstance.clear();
  }
  drawTurbineOverlay();
});

watch(() => props.caseId, (newVal) => {
  if (newVal) {
    console.log("Case ID changed, fetching all data for:", newVal);
    currentSliceImageUrl.value = null;
    selectedTurbine.value = null;
    metadata.value = null;
    turbines.value = [];
    currentExtentKm.value = null;
    profileData.value = null;
    wakeData.value = null;
    turbineDetails.value = null;
    imageLoaded.value = false;

    if (profileInstance) {
      try {
        profileInstance.clear();
      } catch (err) {
        console.warn("Error clearing profile chart:", err);
      }
    }

    if (wakeInstance) {
      try {
        wakeInstance.clear();
      } catch (err) {
        console.warn("Error clearing wake chart:", err);
      }
    }

    if (turbineOverlayCtx && turbineOverlayCanvas.value) {
      try {
        turbineOverlayCtx.clearRect(0, 0, turbineOverlayCanvas.value.width, turbineOverlayCanvas.value.height);
      } catch (err) {
        console.warn("Error clearing canvas:", err);
      }
    }

    fetchAllData();
  }
}, { immediate: true });


onUnmounted(() => {
  window.removeEventListener('resize', handleResize);

  if (turbineOverlayCanvas.value) {
    try {
      turbineOverlayCanvas.value.removeEventListener('mousemove', handleCanvasMouseMove);
      turbineOverlayCanvas.value.removeEventListener('click', handleCanvasClick);
    } catch (err) {
      console.warn("Error removing canvas event listeners:", err);
    }
  }

  if (profileInstance) {
    try {
      profileInstance.dispose();
    } catch (err) {
      console.warn("Error disposing profile chart:", err);
    }
    profileInstance = null;
  }

  if (wakeInstance) {
    try {
      wakeInstance.dispose();
    } catch (err) {
      console.warn("Error disposing wake chart:", err);
    }
    wakeInstance = null;
  }
});
</script>
<style scoped>
.advanced-visualization-container {
  width: 100%;
  height: 100%;
  min-height: 700px;
}

.visualization-card {
  height: 100%;
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px; /* 减少顶部高度 */
  border-bottom: 1px solid #ebeef5;
}

.card-header h3 {
  margin: 0;
  font-size: 16px; /* 减小字体大小 */
  font-weight: 600;
  color: #303133;
}

.viz-controls {
  background-color: #fff;
  border-radius: 8px;
  padding: 12px 20px; /* 减少控制栏高度 */
  margin: 10px 15px; /* 减少外边距 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.control-item {
  margin-bottom: 6px;
}

.control-item .label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

/* 主内容区 */
.main-content {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 0 15px;
  gap: 20px;
  margin-bottom: 15px;
  overflow: auto;
}

/* 左侧风速场图片部分 */
.speed-field-section {
  flex: 1;
  min-width: 0;
  max-width: 55%; /* 略微减小左侧宽度 */
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  position: relative;
  display: flex;
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
  padding: 10px;
}

.speed-field-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border-radius: 4px;
}

.speed-field-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  height: auto;
  width: auto;
  object-fit: contain;
}

.no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
  color: #909399;
  font-size: 14px;
  gap: 10px;
}

.no-image-placeholder .el-icon {
  font-size: 48px;
  opacity: 0.5;
}

.turbine-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: auto;
}

/* 右侧图表部分 */
.charts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px; /* 减少间距以适应风机详情面板 */
  min-width: 0;
  min-height: 0;
  max-width: 45%; /* 增加右侧宽度 */
}

.chart-wrapper {
  flex: 1;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px; /* 减少内边距，让图表有更多空间 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  min-height: 200px; /* 确保最小高度 */
  overflow: hidden;
}

.chart {
  flex: 1;
  width: 100%;
  min-height: 150px; /* 明确的最小高度 */
  background-color: #fafafa; /* 添加背景色以便于调试 */
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px; /* 减少标题下方间距 */
  flex-shrink: 0;
}

.chart-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.chart-header .subtitle {
  font-size: 12px;
  color: #909399;
}

.turbine-details {
  flex-shrink: 0;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  margin: 0; /* 取消外边距 */
  max-height: 180px; /* 限制高度 */
}

.turbine-details h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.chart-loading, .image-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.7);
  color: #606266;
}

.image-loading-overlay span {
  margin-top: 10px;
}

/* 响应式布局优化 */
@media (max-width: 1200px) {
  .speed-field-section {
    max-width: 50%;
  }

  .charts-section {
    max-width: 50%;
  }
}

@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    overflow-y: auto;
  }

  .speed-field-section {
    max-width: 100%;
    height: 400px;
  }

  .charts-section {
    max-width: 100%;
  }

  .chart-wrapper {
    min-height: 250px;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 0 10px;
    gap: 15px;
  }

  .speed-field-section {
    height: 350px;
  }

  .charts-section {
    gap: 15px;
  }

  .chart-wrapper {
    padding: 10px;
    min-height: 200px;
  }

  .turbine-details {
    padding: 10px;
  }

  .turbine-details h4 {
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  .viz-controls {
    padding: 8px;
    margin: 8px;
  }

  .main-content {
    padding: 0 8px;
    gap: 10px;
  }

  .speed-field-section {
    height: 300px;
  }

  .chart-wrapper {
    min-height: 180px;
  }
}
</style>