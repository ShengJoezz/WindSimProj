<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 21:24:29
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 21:24:36
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindMast\WindMastImageViewer.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="windmast-image-viewer">
      <div v-if="loadingImages" class="loading-container">
        <el-skeleton :rows="4" animated />
      </div>
  
      <div v-else-if="imageData.imageDetails.length === 0" class="no-images">
        <el-empty description="未找到图表文件" />
      </div>
  
      <template v-else>
        <!-- 图片过滤选项 -->
        <div class="filter-options">
          <el-select v-model="imageFilter.chartType" placeholder="图表类型" clearable>
            <el-option
              v-for="type in availableChartTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
  
          <el-select v-model="imageFilter.height" placeholder="高度" clearable>
            <el-option
              v-for="height in availableHeights"
              :key="height"
              :label="`${height}m`"
              :value="height"
            />
          </el-select>
  
          <el-button @click="clearImageFilters">清除筛选</el-button>
        </div>
  
        <!-- 图表缩略图网格 -->
        <div class="chart-grid">
          <div
            v-for="(image, index) in filteredImages"
            :key="index"
            class="chart-thumbnail"
            @click="showImage(image)"
          >
            <el-image
              :src="image.fullUrl"
              fit="cover"
              lazy
            >
              <template #error>
                <div class="thumbnail-error">
                  <el-icon><PictureFilled /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="thumbnail-info">
              <div class="thumbnail-title">
                {{ getChartTypeText(image.chartType) || '图表' }}
                <span v-if="image.height" class="height-tag">{{ image.height }}m</span>
              </div>
            </div>
            <div class="thumbnail-overlay">
              <el-icon><ZoomIn /></el-icon>
            </div>
          </div>
        </div>
      </template>
  
      <!-- 图片查看器对话框 -->
      <el-dialog
        v-model="showImageViewer"
        title="图表预览"
        width="90%"
        top="5vh"
        fullscreen
      >
        <template #header>
          <div class="dialog-header">
            <h3>{{ selectedImage?.filename || '图表预览' }}</h3>
            <div class="header-actions">
              <span class="image-counter" v-if="filteredViewerImages.length > 0">
                {{ currentImageIndex + 1 }} / {{ filteredViewerImages.length }}
              </span>
              <el-button @click="showImageViewer = false" circle>
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
        </template>
  
        <div v-if="loadingImages" class="loading-container">
          <el-skeleton :rows="5" animated />
        </div>
  
        <div v-else-if="filteredViewerImages.length === 0" class="no-images">
          <el-empty description="未找到图表文件" />
        </div>
  
        <template v-else>
          <!-- 轮播图区域 -->
          <div class="carousel-container">
            <!-- 左箭头 -->
            <div
              class="carousel-arrow left"
              @click="showPreviousImage"
              v-if="filteredViewerImages.length > 1"
            >
              <el-icon><ArrowLeft /></el-icon>
            </div>
  
            <!-- 中央图片区域 -->
            <div class="carousel-image-container">
              <el-image
                v-if="filteredViewerImages.length > 0"
                :src="filteredViewerImages[currentImageIndex].fullUrl"
                fit="contain"
                :preview-src-list="filteredViewerImages.map(img => img.fullUrl)"
                :initial-index="0"
                preview-teleported
                class="carousel-image"
              >
                <template #placeholder>
                  <div class="image-placeholder">
                    <el-icon><Loading /></el-icon>
                    <span>加载中...</span>
                  </div>
                </template>
                <template #error>
                  <div class="image-error">
                    <el-icon><PictureFilled /></el-icon>
                    <span>图片无法加载</span>
                  </div>
                </template>
              </el-image>
            </div>
  
            <!-- 右箭头 -->
            <div
              class="carousel-arrow right"
              @click="showNextImage"
              v-if="filteredViewerImages.length > 1"
            >
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
  
          <!-- 当前图片信息 -->
          <div class="current-image-info" v-if="filteredViewerImages.length > 0">
            <h4>{{ getCurrentImageCaption() }}</h4>
            <el-button
              type="primary"
              @click="downloadCurrentImage"
            >
              <el-icon><Download /></el-icon> 下载图片
            </el-button>
          </div>
  
          <!-- 缩略图导航 -->
          <div class="thumbnail-navigation" v-if="filteredViewerImages.length > 1">
            <div
              v-for="(image, index) in filteredViewerImages"
              :key="index"
              class="thumbnail"
              :class="{ active: index === currentImageIndex }"
              @click="currentImageIndex = index"
            >
              <el-image
                :src="image.fullUrl"
                fit="cover"
                lazy
              >
                <template #error>
                  <div class="thumbnail-error">
                    <el-icon><PictureFilled /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>
          </div>
        </template>
      </el-dialog>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import {
    PictureFilled,
    ArrowLeft, ArrowRight, Close, Loading, ZoomIn
  } from '@element-plus/icons-vue';
  import axios from 'axios';
  
  const route = useRoute();
  
  // Props
  const props = defineProps({
    analysisId: {
      type: String,
      required: true
    }
  });
  
  // 状态变量
  const loadingImages = ref(false);
  const imageData = ref({
    imageDetails: [],
    imagesByFarm: {}
  });
  const showImageViewer = ref(false);
  const selectedImage = ref(null);
  const currentViewerImages = ref([]);
  const currentImageIndex = ref(0);
  const imageFilter = ref({
    chartType: '',
    height: ''
  });
  
  // 计算属性: 可用的图表类型选项
  const availableChartTypes = computed(() => {
    return [
      { value: 'wind_rose', label: '风玫瑰图' },
      { value: 'wind_frequency', label: '风速频率' },
      { value: 'wind_energy', label: '风能分布' },
      { value: 'stability_distribution', label: '稳定度分布' }
    ];
  });
  
  // 计算属性: 可用的高度选项
  const availableHeights = computed(() => {
    // 从当前查看的图片中提取所有高度
    const heightSet = new Set();
    imageData.value.imageDetails.forEach(img => {
      if (img.height) {
        heightSet.add(img.height);
      }
    });
    return Array.from(heightSet).sort((a, b) => parseInt(a) - parseInt(b));
  });
  
  // 计算属性: 过滤后的图片列表 (缩略图网格)
  const filteredImages = computed(() => {
    return imageData.value.imageDetails.filter(img => {
      // 过滤图表类型
      if (imageFilter.value.chartType && img.chartType !== imageFilter.value.chartType) {
        return false;
      }
      // 过滤高度
      if (imageFilter.value.height && img.height !== imageFilter.value.height) {
        return false;
      }
      return true;
    });
  });
  
  // 计算属性: 过滤后的查看器图片 (轮播图)
  const filteredViewerImages = computed(() => {
    // 应用过滤条件
    return currentViewerImages.value.filter(img => {
      // 过滤图表类型
      if (imageFilter.value.chartType && img.chartType !== imageFilter.value.chartType) {
        return false;
      }
      // 过滤高度
      if (imageFilter.value.height && img.height !== imageFilter.value.height) {
        return false;
      }
      return true;
    });
  });
  
  // 组件挂载时获取图片数据
  onMounted(() => {
    fetchImageData();
  });
  
  // 监听 analysisId prop 的变化，重新加载数据
  watch(() => props.analysisId, (newAnalysisId) => {
    if (newAnalysisId) {
      fetchImageData();
    }
  });
  
  
  // 获取图片数据
  const fetchImageData = async () => {
    if (!props.analysisId) return;
  
    loadingImages.value = true;
    try {
      const response = await axios.get(`/api/windmast/scan-images/${props.analysisId}`);
      if (response.data.success) {
        imageData.value = response.data;
        console.log('加载图片数据成功:', imageData.value);
      } else {
        console.warn('加载图片数据失败:', response.data.message);
      }
    } catch (error) {
      console.error('获取图片数据出错:', error);
    } finally {
      loadingImages.value = false;
    }
  };
  
  
  // 显示特定图片
  const showImage = (image) => {
    selectedImage.value = image;
    currentViewerImages.value = filteredImages.value; // 使用当前过滤后的缩略图列表作为查看器图片源
  
    // 找到对应图片的索引
    const index = currentViewerImages.value.findIndex(img => img.filename === image.filename);
    currentImageIndex.value = index >= 0 ? index : 0;
  
    showImageViewer.value = true;
  
    // 根据所选图片设置过滤条件 (可选，如果您希望查看器打开时默认只显示同类型的图片)
    imageFilter.value.chartType = image.chartType || '';
    imageFilter.value.height = image.height || '';
  };
  
  // 清除图片过滤条件
  const clearImageFilters = () => {
    imageFilter.value = {
      chartType: '',
      height: ''
    };
  
    // 重置当前索引
    if (filteredViewerImages.value.length > 0) {
      currentImageIndex.value = 0;
    }
  };
  
  // 显示上一张图片
  const showPreviousImage = () => {
    if (filteredViewerImages.value.length === 0) return;
    currentImageIndex.value = (currentImageIndex.value - 1 + filteredViewerImages.value.length) % filteredViewerImages.value.length;
  };
  
  // 显示下一张图片
  const showNextImage = () => {
    if (filteredViewerImages.value.length === 0) return;
    currentImageIndex.value = (currentImageIndex.value + 1) % filteredViewerImages.value.length;
  };
  
  // 获取当前图片标题
  const getCurrentImageCaption = () => {
    if (filteredViewerImages.value.length === 0 || currentImageIndex.value < 0) {
      return '图表预览';
    }
  
    const image = filteredViewerImages.value[currentImageIndex.value];
    let caption = getChartTypeText(image.chartType) || '图表';
  
    if (image.height) {
      caption += ` (${image.height}m)`;
    }
  
    return caption;
  };
  
  // 图表类型转换为显示文本
  const getChartTypeText = (type) => {
    switch (type) {
      case 'wind_rose': return '风玫瑰图';
      case 'wind_frequency': return '风速频率';
      case 'wind_energy': return '风能分布';
      case 'stability_distribution': return '稳定度分布';
      case 'diurnal_pattern': return '日变化模式';
      case 'time_series': return '时间序列';
      case 'correlation': return '相关性分析';
      default: return type;
    }
  };
  
  // 下载当前图片
  const downloadCurrentImage = () => {
    if (filteredViewerImages.value.length === 0 || currentImageIndex.value < 0) {
      return;
    }
  
    const image = filteredViewerImages.value[currentImageIndex.value];
  
    const link = document.createElement('a');
    link.href = image.fullUrl;
    link.download = image.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  
    ElMessage.success('图片下载中...');
  };
  </script>
  
  <style scoped>
  /* 缩略图网格 */
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }
  
  .chart-thumbnail {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.3s;
    aspect-ratio: 4/3;
  }
  
  .chart-thumbnail:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
  
  .chart-thumbnail .el-image {
    width: 100%;
    height: 100%;
  }
  
  .thumbnail-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 12px;
  }
  
  .thumbnail-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .height-tag {
    background-color: #409eff;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 10px;
  }
  
  .thumbnail-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .chart-thumbnail:hover .thumbnail-overlay {
    opacity: 1;
  }
  
  .thumbnail-overlay .el-icon {
    font-size: 24px;
    color: white;
  }
  
  /* 对话框头部样式 */
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  /* 图片过滤选项 */
  .filter-options {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  
  /* 轮播图区域 */
  .carousel-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    background-color: #f5f7fa;
    border-radius: 4px;
    margin: 16px 0;
  }
  
  .carousel-image-container {
    width: 80%;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    max-height: 65vh;
  }
  
  .carousel-image {
    max-height: 100%;
    width: 100%;
    object-fit: contain;
  }
  
  .carousel-arrow {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 48px;
    height: 48px;
    background-color: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    cursor: pointer;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    transition: all 0.3s;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
  
  .carousel-arrow:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }
  
  .carousel-arrow.left {
    left: 16px;
  }
  
  .carousel-arrow.right {
    right: 16px;
  }
  
  .carousel-arrow .el-icon {
    font-size: 24px;
    color: #606266;
  }
  
  /* 当前图片信息 */
  .current-image-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 16px 0;
  }
  
  .current-image-info h4 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #303133;
  }
  
  /* 缩略图导航 */
  .thumbnail-navigation {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 4px;
  }
  
  .thumbnail {
    width: 80px;
    height: 60px;
    border: 2px solid transparent;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;
    flex-shrink: 0;
  }
  
  .thumbnail.active {
    border-color: #409eff;
    transform: scale(1.05);
  }
  
  .thumbnail-error, .image-error, .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background-color: #f0f0f0;
    color: #909399;
  }
  
  .image-counter {
    text-align: center;
    color: #606266;
    font-size: 14px;
    background-color: #f2f6fc;
    padding: 5px 10px;
    border-radius: 12px;
  }
  
  /* 加载容器 */
  .loading-container {
    padding: 24px;
    background-color: #f5f7fa;
    border-radius: 4px;
  }
  
  /* 没有图片时的样式 */
  .no-images {
    padding: 32px;
    background-color: #f5f7fa;
    border-radius: 4px;
    text-align: center;
  }
  
  
  /* 响应式调整 */
  @media (max-width: 768px) {
    .chart-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }
  
    .carousel-container {
      min-height: 300px;
    }
  
    .carousel-image-container {
      width: 90%;
    }
  
    .carousel-arrow {
      width: 36px;
      height: 36px;
    }
  
    .carousel-arrow .el-icon {
      font-size: 18px;
    }
  
    .thumbnail {
      width: 60px;
      height: 45px;
    }
  
    .filter-options {
      flex-direction: column;
      gap: 8px;
    }
  }
  </style>