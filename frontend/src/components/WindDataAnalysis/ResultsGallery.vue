<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:09:13
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:09:16
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\ResultsGallery.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="results-gallery">
      <el-collapse :model-value="activeNames" @change="updateActiveNames" accordion>
        <el-collapse-item
          v-for="fileResult in fileResults"
          :key="fileResult.source_csv_folder"
          :title="formatTitle(fileResult.source_csv_folder)"
          :name="fileResult.source_csv_folder"
        >
          <div v-if="fileResult.plots && fileResult.plots.length > 0" class="gallery-container">
            <el-carousel 
              indicator-position="outside" 
              arrow="always" 
              :autoplay="false" 
              height="550px"
              class="plot-carousel"
            >
              <el-carousel-item v-for="(plot, index) in fileResult.plots" :key="plot.url">
                <div class="plot-container">
                  <h4 class="plot-title">{{ formatPlotName(plot.name) }}</h4>
                  <el-image
                    class="plot-image"
                    :src="plot.url"
                    :preview-src-list="fileResult.plots.map(p => p.url)"
                    :initial-index="index"
                    fit="contain"
                    loading="lazy"
                  >
                    <template #error>
                      <div class="image-slot">
                        <el-icon><picture /></el-icon> 加载失败
                      </div>
                    </template>
                    <template #placeholder>
                      <div class="image-slot">
                        <el-icon><loading /></el-icon> 加载中...
                      </div>
                    </template>
                  </el-image>
                  <div class="plot-controls">
                    <el-button type="primary" plain size="small" @click="downloadImage(plot.url)">
                      <el-icon><download /></el-icon> 下载图片
                    </el-button>
                  </div>
                </div>
              </el-carousel-item>
            </el-carousel>
          </div>
          <el-empty v-else description="未找到此文件的绘图结果"></el-empty>
        </el-collapse-item>
      </el-collapse>
    </div>
  </template>
  
  <script setup>
  import { Picture, Loading, Download } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import { defineProps, defineEmits } from 'vue';
  
  const props = defineProps({
    fileResults: Array,
    activeNames: Array
  });
  
  const emit = defineEmits(['update:activeNames']);
  
  const updateActiveNames = (names) => {
    emit('update:activeNames', names);
  };
  
  const formatTitle = (folderName) => {
    // Remove timestamp prefix if present (e.g., "1647012345-filename.csv" → "filename.csv")
    const cleanName = folderName.replace(/^\d+-/, '');
    return `文件分析结果: ${cleanName}`;
  };
  
  const formatPlotName = (plotName) => {
    // Make plot names more readable by replacing underscores with spaces, etc.
    return plotName
      .replace(/\.png$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };
  
  const downloadImage = (imageUrl) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ElMessage.success('开始下载图片');
  };
  </script>
  
  <style scoped>
  .results-gallery {
    margin-bottom: 24px;
  }
  
  .gallery-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }
  
  .plot-carousel {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
  
  .plot-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 16px;
  }
  
  .plot-title {
    margin-top: 0;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
    font-size: 16px;
    text-align: center;
  }
  
  .plot-image {
    width: auto;
    max-width: 100%;
    height: 450px;
    object-fit: contain;
    border-radius: 4px;
  }
  
  .image-slot {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }
  
  .image-slot .el-icon {
    font-size: 24px;
    margin-right: 8px;
  }
  
  .plot-controls {
    margin-top: 16px;
    display: flex;
    justify-content: center;
  }
  </style>