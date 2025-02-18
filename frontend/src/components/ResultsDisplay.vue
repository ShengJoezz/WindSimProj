<template>
  <div class="case-viewer">
    <!-- 添加一个包装器div来更好地控制每个组件 -->
    <div class="viewer-section">
      <VTKViewer
        v-if="caseStore.currentCaseId"
        :caseId="caseStore.currentCaseId"
        class="vtk-viewer-container"
      />
    </div>
    <div class="viewer-section">
      <VelocityFieldDisplay
        v-if="caseStore.currentCaseId"
        :caseId="caseStore.currentCaseId"
        class="velocity-display"
      />
    </div>
  </div>
</template>

<script setup>
import VTKViewer from '@/components/VTKViewer.vue';
import VelocityFieldDisplay from '@/components/VelocityFieldDisplay.vue';
import { useCaseStore } from '@/store/caseStore';
import { watch, onMounted, onBeforeUnmount } from 'vue';

const caseStore = useCaseStore();

// 监听窗口大小变化
let resizeTimeout;
const handleResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = setTimeout(() => {
    // 触发组件内部的resize事件
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
.case-viewer {
  width: 100%;
  height: 100vh; /* 使用视口高度 */
  display: flex;
  flex-direction: column;
  gap: 8px; /* 在两个视图之间添加间距 */
  padding: 8px; /* 添加内边距 */
  box-sizing: border-box;
  background-color: #f5f5f5; /* 可选：添加背景色 */
}

.viewer-section {
  flex: 1;
  min-height: 0; /* 重要：允许flex子项收缩 */
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd; /* 可选：添加边框 */
  border-radius: 4px; /* 可选：圆角 */
  background-color: white;
  overflow: hidden; /* 防止内容溢出 */
}

.vtk-viewer-container,
.velocity-display {
  flex: 1;
  min-height: 0; /* 重要：允许内容正确缩放 */
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
}
</style>