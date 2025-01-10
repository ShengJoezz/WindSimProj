<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:16:31
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\App.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 -->
<template>
  <div class="app-container" role="application">
    <Dashboard />
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import Dashboard from './components/Dashboard.vue';
</script>

<style>
:root {
  --app-bg-color: #1a2234;
  --content-bg-color: #1f2937;
}

html, body {
  margin: 0;
  padding: 0;
  background-color: var(--app-bg-color);
}

.app-container {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
  background-color: var(--app-bg-color);
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--content-bg-color);
  position: relative;
  z-index: 1;
  color: #e2e8f0; /* 为深色主题添加浅色文字 */
}

@media (max-width: 768px) {
  .main-content {
    padding: 10px;
  }
}
</style>