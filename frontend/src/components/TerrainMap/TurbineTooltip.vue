<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 15:58:39
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-18 18:47:32
 * @FilePath: <<filepath('relative')>>
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
<!-- frontend/src/components/TurbineTooltip.vue -->
<template>
  <div
    v-if="turbine"
    class="turbine-tooltip"
    :style="{ top: position.y + 'px', left: position.x + 'px' }"
  >
    <div class="tooltip-title">{{ turbine.name ?? 'N/A' }}</div>
    <div class="tooltip-content">
      <div class="tooltip-item">
        <span class="label">经度:</span>
        <span class="value">{{ turbine.longitude !== undefined && turbine.longitude !== null ? turbine.longitude.toFixed(6) + '°' : 'N/A' }}</span>
      </div>
      <div class="tooltip-item"> 
        <span class="label">纬度:</span>
        <span class="value">{{ turbine.latitude !== undefined && turbine.latitude !== null ? turbine.latitude.toFixed(6) + '°' : 'N/A' }}</span>
      </div>
      <div class="tooltip-item">
        <span class="label">桅杆高度:</span>
        <span class="value">{{ turbine.hubHeight ?? 'N/A' }}m</span>
      </div>
      <div class="tooltip-item">
        <span class="label">转子直径:</span>
        <span class="value">{{ turbine.rotorDiameter ?? 'N/A' }}m</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * TurbineTooltip.vue
 *
 * 当鼠标悬停在风机上时显示的信息提示组件。
 */

const props = defineProps({
  turbine: {
    type: Object,
    required: true,
  },
  position: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
.turbine-tooltip {
  position: absolute;
  background: rgba(48, 49, 51, 0.9);
  backdrop-filter: blur(4px);
  padding: 12px;
  border-radius: 8px;
  color: #ffffff;
  pointer-events: none;
  z-index: 100;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.tooltip-item .label {
  color: rgba(255, 255, 255, 0.7);
}

.tooltip-item .value {
  color: #ffffff;
}
</style>