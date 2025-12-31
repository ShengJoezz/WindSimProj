<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-27 11:23:29
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 16:26:01
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\views\CaseDetails.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- frontend/src/views/CaseDetails.vue -->
<template>
  <div class="case-details-container">
    <!-- 子内容区域，用于显示当前路由对应的组件内容 -->
    <div class="sub-main-content">
      <!-- 使用 v-slot 获取路由组件，再传入 caseId -->
      <router-view v-slot="{ Component }">
        <component :is="Component" :caseId="routeCaseId" />
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCaseStore } from '@/store/caseStore';
import { notifyError } from '@/utils/notify.js';

const route = useRoute();
const caseStore = useCaseStore();

// 唯一真源：路由参数
const routeCaseId = computed(() => route.params.caseId || null);

const ensureCaseInitialized = async (caseId) => {
  if (!caseId) return;
  // Pinia setup store refs are unwrapped on the store proxy
  if (caseStore.caseId === caseId && caseStore.currentCaseId === caseId) return;
  try {
    await caseStore.initializeCase(caseId);
  } catch (error) {
    console.error('CaseDetails 初始化工况失败:', error);
    notifyError(error, '初始化工况失败，请返回工况列表重试');
  }
};

onMounted(() => ensureCaseInitialized(routeCaseId.value));

watch(
  () => route.params.caseId,
  (newId, oldId) => {
    if (!newId || newId === oldId) return;
    ensureCaseInitialized(newId);
  }
);

onBeforeUnmount(() => {
  // Leaving the case wrapper: disconnect socket and clear listeners.
  if (typeof caseStore.disconnectSocket === 'function') {
    caseStore.disconnectSocket();
  }
});
</script>

<style scoped>
/* 容器样式，用于整个页面的布局 */
.case-details-container {
  display: flex;
  height: 100vh; /* 全屏高度 */
}

/* 子内容区域样式，用于显示路由内容 */
.sub-main-content {
  flex: 1; /* 占据剩余空间 */
  padding: 20px; /* 内边距 */
  overflow-y: auto; /* 垂直滚动条 */
  background-color: rgba(255, 255, 255, 0.8); /* 半透明白色背景 */
  position: relative; /* 相对定位 */
  z-index: 1; /* 层叠顺序 */
}
</style>
