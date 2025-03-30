<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:04:30
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:08:40
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\AnalysisControls.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="analysis-controls">
    <el-divider />
    <div class="controls-container">
      <div class="main-controls">
        <el-button
          type="primary"
          @click="$emit('startAnalysis')"
          :loading="isPending"
          :disabled="disabled"
          class="start-button"
        >
          <el-icon><caret-right /></el-icon> 开始分析
        </el-button>
        <div class="status-indicator">
          状态:
          <el-tag :type="statusTagType" size="small">{{ statusText }}</el-tag>
        </div>
      </div>
      
      <div class="scenario-controls">
        <el-button
          type="success"
          plain
          :disabled="!hasResults"
          @click="$emit('saveScenario')"
        >
          <el-icon><star /></el-icon> 保存分析
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CaretRight, Star } from '@element-plus/icons-vue';
import { defineProps, defineEmits, computed } from 'vue';
import { useWindMastStore } from '@/store/windMastStore';

const props = defineProps({
  isPending: Boolean,
  disabled: Boolean,
  statusText: String,
  statusTagType: String
});

const emit = defineEmits(['startAnalysis', 'saveScenario']);

const store = useWindMastStore();
const hasResults = computed(() => store.hasResults);
</script>

<style scoped>
.analysis-controls {
  margin-bottom: 20px;
}

.controls-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.main-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.start-button {
  min-width: 120px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scenario-controls {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .controls-container {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>