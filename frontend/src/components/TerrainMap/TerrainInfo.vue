<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:47:17
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:00:44
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
  z-index: 10;
}

.info-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.info-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

.info-content {
  padding: 24px;
}

.section-heading {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-heading::before {
  content: '';
  display: block;
  width: 4px;
  height: 16px;
  background: #409EFF;
  border-radius: 2px;
}

.elevation-section {
  margin-bottom: 28px;
}

.elevation-gradient {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.gradient-bar {
  height: 18px;
  border-radius: 9px;
  background: linear-gradient(
    to right,
    #193c17 0%,
    #2B573A 20%,
    #527D54 40%,
    #C4A484 60%,
    #8B4513 80%,
    #F5F5F5 100%
  );
  margin-bottom: 12px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.elevation-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
}

.elevation-value {
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.bounds-grid {
  display: grid;
  gap: 12px;
}

.bound-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(240, 240, 245, 0.5);
  border-radius: 10px;
  transition: background 0.2s ease;
}

.bound-item:hover {
  background: rgba(230, 230, 235, 0.7);
}

.bound-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.bound-value {
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  font-size: 14px;
  color: #1a1a1a;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
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