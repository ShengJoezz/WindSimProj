<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:09:05
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:09:08
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\ResultsSummary.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="results-summary">
      <h3>分析结果摘要</h3>
      <el-card class="summary-card">
        <div class="summary-stats">
          <div class="stat-item">
            <el-icon class="stat-icon"><files /></el-icon>
            <div class="stat-content">
              <div class="stat-label">总文件数</div>
              <div class="stat-value">{{ analysisResults.summary?.total_files ?? 'N/A' }}</div>
            </div>
          </div>
          
          <div class="stat-item">
            <el-icon class="stat-icon success-icon"><circle-check /></el-icon>
            <div class="stat-content">
              <div class="stat-label">成功</div>
              <div class="stat-value success-text">{{ analysisResults.summary?.success ?? 'N/A' }}</div>
            </div>
          </div>
          
          <div class="stat-item">
            <el-icon class="stat-icon warning-icon"><warning /></el-icon>
            <div class="stat-content">
              <div class="stat-label">警告</div>
              <div class="stat-value warning-text">{{ analysisResults.summary?.warning ?? 'N/A' }}</div>
            </div>
          </div>
          
          <div class="stat-item">
            <el-icon class="stat-icon error-icon"><circle-close /></el-icon>
            <div class="stat-content">
              <div class="stat-label">失败</div>
              <div class="stat-value error-text">{{ analysisResults.summary?.error ?? 'N/A' }}</div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { Files, CircleCheck, Warning, CircleClose } from '@element-plus/icons-vue';
  import { defineProps } from 'vue';
  
  defineProps({
    analysisResults: Object
  });
  </script>
  
  <style scoped>
  .results-summary {
    margin-bottom: 24px;
  }
  
  .results-summary h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
    font-size: 18px;
  }
  
  .summary-card {
    border-radius: 8px;
    background-color: #fafafa;
  }
  
  .summary-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: space-around;
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
  }
  
  .stat-icon {
    font-size: 24px;
  }
  
  .success-icon {
    color: var(--el-color-success);
  }
  
  .warning-icon {
    color: var(--el-color-warning);
  }
  
  .error-icon {
    color: var(--el-color-danger);
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
  }
  
  .stat-label {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
  
  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .success-text {
    color: var(--el-color-success);
  }
  
  .warning-text {
    color: var(--el-color-warning);
  }
  
  .error-text {
    color: var(--el-color-danger);
  }
  
  @media (max-width: 768px) {
    .summary-stats {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
  }
  </style>