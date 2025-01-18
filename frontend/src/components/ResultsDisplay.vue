<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-13 10:00:54
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-13 10:03:05
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ResultsDisplay.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
<!-- ResultsDisplay.vue -->
<template>
  <div class="case-viewer">
    <VTKViewer 
      v-if="caseStore.currentCaseId" 
      :vtk-file-url="`/api/cases/${caseStore.currentCaseId}/processed-vtk/block_0.vtp`"
    />
  </div>
</template>

<script setup>
import VTKViewer from '@/components/VTKViewer.vue';
import { useCaseStore } from '@/store/caseStore';

const caseStore = useCaseStore();
</script>