<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-18 20:59:25
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-16 21:40:35
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ResultsDisplay.vue
 * @Description:
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="case-viewer">
    <VelocityFieldDisplay v-if="caseStore.currentCaseId" :caseId="caseStore.currentCaseId" />
    <!-- Pass caseId instead of vtk-file-url -->
    <!--<VTKViewer 
      v-if="caseStore.currentCaseId" 
      :caseId="caseStore.currentCaseId"
      :key="caseStore.currentCaseId"
    />-->
  </div>
</template>

<script setup>
import VTKViewer from '@/components/VTKViewer.vue';
import VelocityFieldDisplay from '@/components/VelocityFieldDisplay.vue';
import { useCaseStore } from '@/store/caseStore';
import { watch } from 'vue';

const caseStore = useCaseStore();

// Debugging: Ensure currentCaseId is correctly set
console.log('Current Case ID in ResultsDisplay:', caseStore.currentCaseId);

// Optional: Watch for changes in currentCaseId
watch(() => caseStore.currentCaseId, (newId) => {
  console.log('currentCaseId updated to:', newId);
});
</script>
<style scoped>
.case-viewer {
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 500px; /* 设置最小高度 */
}
</style>