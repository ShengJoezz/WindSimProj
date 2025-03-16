<!-- TurbineTooltip.vue -->
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
  background: rgba(40, 44, 52, 0.85);
  backdrop-filter: blur(10px);
  padding: 16px;
  border-radius: 12px;
  color: #ffffff;
  pointer-events: none;
  z-index: 100;
  min-width: 220px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateY(-4px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
}

.tooltip-item .label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.tooltip-item .value {
  color: #ffffff;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
</style>