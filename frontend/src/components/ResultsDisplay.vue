<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-24 11:02:46
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-24 11:03:52
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ResultsDisplay.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="case-viewer">
    <!-- 顶部标题和导出按钮 -->
    <div class="header">
      <h1>仿真结果</h1>
      <div class="export-buttons">
        <button class="export-button" @click="exportGrid">导出网格</button>
        <button class="export-button" @click="exportLayerPhotos">导出各层级照片</button>
      </div>
    </div>

    <!-- 各区域视图 -->
    <div class="viewer-section">
      <VTKViewer
        v-if="caseStore.currentCaseId"
        :caseId="caseStore.currentCaseId"
        class="vtk-viewer-container"
        ref="vtkViewerRef"
      />
    </div>
    <div class="viewer-section">
      <VelocityFieldDisplay
        v-if="caseStore.currentCaseId"
        :caseId="caseStore.currentCaseId"
        class="velocity-display"
        ref="velocityRef"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import VTKViewer from '@/components/VTKViewer.vue';
import VelocityFieldDisplay from '@/components/VelocityFieldDisplay.vue';
import { useCaseStore } from '@/store/caseStore';

const caseStore = useCaseStore();

// 用于获取子组件实例的引用
const vtkViewerRef = ref(null);
const velocityRef = ref(null);

// 导出网格的逻辑（依赖子组件内部实现）
const exportGrid = () => {
  if (vtkViewerRef.value && typeof vtkViewerRef.value.exportGrid === 'function') {
    vtkViewerRef.value.exportGrid();
  } else {
    console.warn('VTKViewer 组件中未找到导出网格的方法。');
  }
};

// 导出各层级照片的逻辑（依赖子组件内部实现）
const exportLayerPhotos = () => {
  if (velocityRef.value && typeof velocityRef.value.exportLayerPhotos === 'function') {
    velocityRef.value.exportLayerPhotos();
  } else {
    console.warn('VelocityFieldDisplay 组件中未找到导出各层级照片的方法。');
  }
};

// 监听窗口大小变化逻辑（保持原有逻辑）
let resizeTimeout;
const handleResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = setTimeout(() => {
    const event = new Event('resize');
    window.dispatchEvent(event);
  }, 250);
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  console.log('Current Case ID in ResultsDisplay:', caseStore.currentCaseId);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
});

watch(() => caseStore.currentCaseId, (newId) => {
  console.log('currentCaseId updated to:', newId);
});
</script>

<style scoped>
/* 布局容器 */
.case-viewer {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background-color: #f5f5f5;
}

/* 顶部标题及导出按钮 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: linear-gradient(45deg, #4c8bf5, #80c1ff);
  color: #ffffff;
  border-radius: 4px;
}

.header h1 {
  margin: 0;
  font-size: 18px;
}

.export-buttons {
  display: flex;
  gap: 8px;
}

.export-button {
  background: #ffffff;
  color: #4c8bf5;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.export-button:hover {
  background-color: #e6e6e6;
}

/* 视图展示区域 */
.viewer-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #ffffff;
  overflow: hidden;
}

.vtk-viewer-container,
.velocity-display {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .case-viewer {
    height: auto;
    min-height: 100vh;
  }

  .viewer-section {
    min-height: 400px;
  }

  .header h1 {
    font-size: 16px;
  }
}
</style>