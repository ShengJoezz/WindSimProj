<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:45:44
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 20:46:16
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\ErrorBoundary.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div>
      <slot v-if="!hasError" />
      <div v-else class="error-container">
        <el-alert
          title="数据加载错误"
          type="error"
          :description="errorMessage"
          show-icon
          @close="resetError"
        />
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onErrorCaptured } from 'vue';
  
  const hasError = ref(false);
  const errorMessage = ref('');
  
  const resetError = () => {
    hasError.value = false;
    errorMessage.value = '';
  };
  
  onErrorCaptured((error) => {
    hasError.value = true;
    errorMessage.value = error.message;
    return false; // Prevent error propagation
  });
  </script>
  <style>
  </style>