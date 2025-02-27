<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-27 11:23:29
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-27 11:24:14
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
        <component :is="Component" :caseId="currentCaseId" />
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCaseStore } from '@/store/caseStore';

const caseStore = useCaseStore();
const currentCaseId = computed(() => caseStore.currentCaseId);
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