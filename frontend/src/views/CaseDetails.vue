<!-- frontend/src/views/CaseDetails.vue -->
<template>
  <div class="case-details-container">
  <!-- 子内容区域，用于显示当前路由对应的组件内容 -->
  <div class="sub-main-content">
  <router-view />
  </div>
  </div>
  </template>
  
  <script setup>
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