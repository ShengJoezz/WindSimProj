<!-- frontend/src/components/ResultsDisplay.vue -->
<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 19:34:42
 * @LastEditors: joe 您的名字
 * @LastEditTime: 2025-03-17 调整为当前日期
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ResultsDisplay.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- 修改 ResultsDisplay.vue -->
<template>
  <div class="case-viewer">
    <!-- 顶部标题和导出按钮 -->
    <div class="header">
      <h1>仿真结果</h1>
      <div class="export-buttons">
        <button class="export-button" @click="exportGrid">
          <i class="fa fa-download"></i> 导出网格文件
        </button>
        <button class="export-button" @click="exportLayerPhotos">
          <i class="fa fa-image"></i>  导出速度场文件
        </button>
        <!-- 新增PDF报告按钮 - 简化调用，无需传递图表引用 -->
        <button class="export-button pdf-button" @click="generatePdfReport">
          <i class="fa fa-file-pdf"></i>  生成PDF报告
        </button>
      </div>
    </div>

    <!-- 通知组件 -->
    <div v-if="notification.show" :class="['notification', `notification-${notification.type}`]">
      <span class="notification-icon"></span>
      <span class="notification-message">{{ notification.message }}</span>
    </div>

    <!-- 各区域视图 -->
    <div class="viewer-sections">
      <!-- 原有内容保持不变 -->
      <div class="viewer-section">
        <div class="section-header">
          <span>三维模型</span>
        </div>
        <VTKViewer
          v-if="caseStore.currentCaseId"
          :caseId="caseStore.currentCaseId"
          class="vtk-viewer-container"
          ref="vtkViewerRef"
        />
      </div>
      <div class="viewer-section">
        <div class="section-header">
          <span>速度场</span>
        </div>
        <VelocityFieldDisplay
          v-if="caseStore.currentCaseId"
          :caseId="caseStore.currentCaseId"
          class="velocity-display"
          ref="velocityRef"
        />
      </div>
    </div>
    <!-- 添加PDF生成器组件 -->
    <div class="pdf-button-container">
      <PDFReportGenerator
        v-if="caseStore.currentCaseId"
        :caseId="caseStore.currentCaseId"
        ref="pdfGeneratorRef"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import VTKViewer from '@/components/VTKViewer.vue';
import VelocityFieldDisplay from '@/components/VelocityFieldDisplay.vue';
import PDFReportGenerator from '@/components/PDFReportGenerator.vue';
import { useCaseStore } from '@/store/caseStore';
import { useRouter } from 'vue-router'; // 引入 useRouter

const caseStore = useCaseStore();
const router = useRouter(); // 初始化 router

// 用于获取组件实例的引用
const vtkViewerRef = ref(null);
const velocityRef = ref(null);
const pdfGeneratorRef = ref(null);

// 生成PDF报告 - 简化调用，无需传递风机引用，数据由后端服务准备
const generatePdfReport = async () => {
  if (pdfGeneratorRef.value) {
    try {
      showNotification('正在生成PDF报告...', 'info');

      // 直接调用 PDF 生成器，无需传递额外的引用
      await pdfGeneratorRef.value.generatePDF();

      showNotification('PDF报告生成成功', 'success');
    } catch (error) {
      console.error('PDF报告生成失败:', error);
      showNotification('PDF报告生成失败: ' + error.message, 'error');
    }
  } else {
    showNotification('PDF生成器未准备好', 'error');
  }
};

// 通知反馈状态
const notification = ref({
  show: false,
  message: '',
  type: 'info' // 'success', 'error', 'info', 'warning'
});

// 显示通知
const showNotification = (message, type = 'info') => {
  notification.value = {
    show: true,
    message,
    type
  };

  // 自动关闭通知
  setTimeout(() => {
    notification.value.show = false;
  }, 3000);
};

// 导出网格的逻辑
const exportGrid = async () => {
  if (!vtkViewerRef.value || typeof vtkViewerRef.value.exportGrid !== 'function') {
    showNotification('VTKViewer 组件中未找到导出网格的方法', 'error');
    return;
  }

  // 显示正在处理的通知
  showNotification('正在准备导出网格...', 'info');

  try {
    const result = await vtkViewerRef.value.exportGrid();
    if (result.success) {
      showNotification(result.message, 'success');
    } else {
      showNotification(result.message, 'error');
    }
  } catch (error) {
    console.error('导出网格出错:', error);
    showNotification(`导出错误: ${error.message}`, 'error');
  }
};

// 导出各层级照片的逻辑
const exportLayerPhotos = async () => {
  if (!velocityRef.value || typeof velocityRef.value.exportLayerPhotos !== 'function') {
    showNotification('VelocityFieldDisplay 组件中未找到导出各层级照片的方法', 'error');
    return;
  }

  // 显示正在处理的通知
  showNotification('正在准备导出速度场图层...', 'info');

  try {
    const result = await velocityRef.value.exportLayerPhotos();
    if (result.success) {
      showNotification(result.message, 'success');
    } else {
      showNotification(result.message, 'error');
    }
  } catch (error) {
    console.error('导出速度场照片出错:', error);
    showNotification(`导出错误: ${error.message}`, 'error');
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
/* 样式部分与之前提供的 ResultsDisplay.vue 相同，并增加了通知样式 */
/* 布局容器 */
.case-viewer {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #f0f2f5;
  color: #333;
  font-family: 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

/* 顶部标题及导出按钮 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(135deg, #1a237e, #3949ab);
  color: #ffffff;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
}

.header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.export-buttons {
  display: flex;
  gap: 12px;
}

.export-button {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.export-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.export-button:active {
  transform: translateY(0);
}

/* 视图容器布局 */
.viewer-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  padding: 0 16px 16px;
  min-height: 0;
  overflow: hidden;
}

/* 视图展示区域 */
.viewer-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background-color: #ffffff;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.viewer-section:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.section-header {
  padding: 12px 16px;
  background-color: #f7f9fc;
  border-bottom: 1px solid #e8eef4;
  font-weight: 600;
  color: #3949ab;
  font-size: 15px;
}

.vtk-viewer-container,
.velocity-display {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}

/* 预留 FontAwesome 图标样式 */
.fa {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.fa-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpolyline points='7 10 12 15 17 10'/%3E%3Cline x1='12' y1='15' x2='12' y2='3'/%3E%3C/svg%3E");
}

.fa-image {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E");
}

/* 响应式布局 */
@media (min-width: 1024px) {
  .viewer-sections {
    flex-direction: row;
  }
}

@media (max-width: 768px) {
  .case-viewer {
    height: auto;
    min-height: 100vh;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  .export-buttons {
    width: 100%;
  }

  .export-button {
    flex: 1;
    justify-content: center;
  }

  .viewer-section {
    min-height: 400px;
  }
}

/* 通知样式 */
.notification {
  position: fixed;
  top: 80px;
  right: 20px;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  z-index: 10000;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  max-width: 350px;
  animation: slideIn 0.3s ease-out;
  transition: all 0.3s ease;
}

.notification-success {
  background-color: #10b981;
}

.notification-error {
  background-color: #ef4444;
}

.notification-info {
  background-color: #3b82f6;
}

.notification-warning {
  background-color: #f59e0b;
}

.notification-icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.notification-success .notification-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E");
}

.notification-error .notification-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E");
}

.notification-info .notification-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E");
}

.notification-warning .notification-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E");
}

.notification-message {
  flex: 1;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .notification {
    width: calc(100% - 40px);
    top: 70px;
  }
}
/* 新增 PDF 按钮样式 */
.pdf-button {
  background: rgba(220, 53, 69, 0.15);
  color: #ffffff;
  border: 1px solid rgba(220, 53, 69, 0.3);
}

.pdf-button:hover {
  background: rgba(220, 53, 69, 0.25);
}

.fa-file-pdf {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3Cpolyline points='10 9 9 9 8 9'/%3E%3C/svg%3E");
}
</style>