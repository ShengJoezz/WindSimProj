<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 19:01:39
 * @LastEditors: AI Assistant
 * @LastEditTime: 2026-02-03
 * @Description: 紧凑型风机悬停提示框 - 优化 z-index 和定位
-->

<template>
  <Teleport to="body">
    <div
      v-if="turbine"
      class="turbine-tooltip"
      :style="tooltipStyle"
    >
      <div class="tooltip-header">
        <span class="turbine-icon">🌬️</span>
        <span class="turbine-name">{{ turbine.name ?? 'N/A' }}</span>
      </div>
      <div class="tooltip-body">
        <div class="info-row">
          <span class="label">坐标</span>
          <span class="value">{{ formatCoord(turbine.longitude) }}, {{ formatCoord(turbine.latitude) }}</span>
        </div>
        <div class="info-row">
          <span class="label">轮毂高度</span>
          <span class="value">{{ turbine.hubHeight ?? 'N/A' }}m</span>
        </div>
        <div class="info-row">
          <span class="label">叶轮直径</span>
          <span class="value">⌀{{ turbine.rotorDiameter ?? 'N/A' }}m</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';

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

const formatCoord = (val) => {
  if (val === undefined || val === null) return 'N/A';
  return val.toFixed(4) + '°';
};

// 计算 tooltip 样式，确保不超出屏幕
const tooltipStyle = computed(() => {
  const tooltipWidth = 180;
  const tooltipHeight = 110;
  let x = props.position.x + 10;
  let y = props.position.y + 10;
  
  // 右边界检测
  if (x + tooltipWidth > window.innerWidth - 20) {
    x = props.position.x - tooltipWidth - 10;
  }
  // 下边界检测
  if (y + tooltipHeight > window.innerHeight - 20) {
    y = props.position.y - tooltipHeight - 10;
  }
  
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});
</script>

<style scoped>
.turbine-tooltip {
  position: fixed;
  background: rgba(25, 30, 38, 0.94);
  backdrop-filter: blur(10px);
  padding: 10px 12px;
  border-radius: 8px;
  color: #ffffff;
  pointer-events: none;
  z-index: 9999;  /* 最高层级，确保始终可见 */
  min-width: 150px;
  max-width: 200px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  animation: tooltipIn 0.12s ease-out;
}

@keyframes tooltipIn {
  from { 
    opacity: 0; 
    transform: scale(0.96) translateY(3px); 
  }
  to { 
    opacity: 1; 
    transform: scale(1) translateY(0); 
  }
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 6px;
}

.turbine-icon {
  font-size: 12px;
}

.turbine-name {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.info-row .label {
  color: rgba(255, 255, 255, 0.55);
}

.info-row .value {
  color: #fff;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  font-size: 10px;
}
</style>