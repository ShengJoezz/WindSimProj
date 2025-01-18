<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:27:56
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 20:47:17
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TerrainInfo.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
<!-- TerrainInfo.vue -->
<template>
  <div class="terrain-info">
    <el-card class="info-card">
      <div class="info-content">
        <!-- Elevation Section -->
        <section class="elevation-section">
          <h3 class="section-heading">地形高程</h3>
          <div class="elevation-gradient">
            <div class="gradient-bar"></div>
            <div class="elevation-labels">
              <span v-for="label in elevationLabels" 
                    :key="label" 
                    class="elevation-value">
                {{ label }}m
              </span>
            </div>
          </div>
        </section>

        <!-- Geographic Bounds Section -->
        <section class="bounds-section">
          <h3 class="section-heading">地理范围</h3>
          <div class="bounds-grid">
            <div class="bound-item">
              <span class="bound-label">经度范围</span>
              <span class="bound-value">
                {{ geographicBounds.minLon }}° ~ {{ geographicBounds.maxLon }}°
              </span>
            </div>
            <div class="bound-item">
              <span class="bound-label">纬度范围</span>
              <span class="bound-value">
                {{ geographicBounds.minLat }}° ~ {{ geographicBounds.maxLat }}°
              </span>
            </div>
          </div>
        </section>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  elevationLabels: {
    type: Array,
    required: true,
  },
  geographicBounds: {
    type: Object,
    required: true,
  },
});

const elevationLabels = computed(() => {
  const sorted = [...props.elevationLabels].sort((a, b) => a - b);
  return sorted;
});
</script>

<style scoped>
.terrain-info {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 320px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.info-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.info-content {
  padding: 20px;
}

.section-heading {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.elevation-section {
  margin-bottom: 24px;
}

.elevation-gradient {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
}

.gradient-bar {
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    #193c17 0%,
    #2B573A 20%,
    #527D54 40%,
    #C4A484 60%,
    #8B4513 80%,
    #F5F5F5 100%
  );
  margin-bottom: 8px;
}

.elevation-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666666;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
}

.bounds-grid {
  display: grid;
  gap: 12px;
}

.bound-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.bound-label {
  font-size: 13px;
  color: #666666;
}

.bound-value {
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  font-size: 13px;
  color: #1a1a1a;
}

@media (max-width: 768px) {
  .terrain-info {
    width: calc(100% - 48px);
    bottom: 16px;
    right: 24px;
    left: 24px;
  }
}
</style>