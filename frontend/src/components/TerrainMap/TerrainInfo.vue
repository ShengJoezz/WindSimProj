<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 15:19:05
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:18:49
 * @FilePath: \WindSimProj\frontend\src\components\TerrainMap\TerrainInfo.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved. 
-->
<template>
  <div class="terrain-info" role="region" aria-label="Terrain Information">
    <el-card class="info-card">
      <template #header>
        <div class="card-header">
          <span class="info-title">地形信息</span>
        </div>
      </template>
      <div class="info-content">
        <!-- 地形高程 -->
        <div class="legend-section">
          <div class="section-title">地形高程</div>
          <div class="color-scale">
            <div class="gradient-bar"></div>
            <div class="scale-labels" role="list">
              <span
                v-for="label in elevationLabels"
                :key="label"
                class="scale-label"
                role="listitem"
              >
                {{ label }}m
              </span>
            </div>
          </div>
        </div>

        <!-- 地理范围 -->
        <div class="bounds-section">
          <div class="section-title">地理范围</div>
          <table class="bounds-table">
            <tbody>
              <tr class="bounds-table-row">
                <td class="bounds-label">
                  <i class="el-icon-top-left" /> 经度范围
                </td>
                <td class="bounds-value">
                  <span class="value-longitude">{{ geographicBounds.minLon ?? 'N/A' }}°</span>
                  <span class="tilde">~</span>
                  <span class="value-longitude">{{ geographicBounds.maxLon ?? 'N/A' }}°</span>
                </td>
              </tr>
              <tr class="bounds-table-row">
                <td class="bounds-label">
                  <i class="el-icon-bottom-right" /> 纬度范围
                </td>
                <td class="bounds-value">
                  <span class="value-latitude">{{ geographicBounds.minLat ?? 'N/A' }}°</span>
                  <span class="tilde">~</span>
                  <span class="value-latitude">{{ geographicBounds.maxLat ?? 'N/A' }}°</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
  bottom: 20px;
  right: 20px;
  width: 280px;
  z-index: 10;
  
  @media (max-width: 600px) {
    width: 90%;
    right: 5%;
  }
}

.info-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  font-family: "Helvetica Neue", Arial, sans-serif; /* Changed font */
  color: #303133;
}

.info-content {
  padding: 10px;
}

/* Section Styles */
.section-title {
  font-size: 13px; /* Reduced font size */
  font-weight: 600;
  font-family: "Helvetica Neue", Arial, sans-serif; /* Changed font */
  color: #303133;
  margin-bottom: 8px; /* Reduced margin */
}

.color-scale {
  margin-bottom: 8px; /* Reduced margin */
}

.gradient-bar {
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    #193c17 0%,
    #527d54 30%,
    #c4a484 60%,
    #f5f5f5 100%
  );
  margin-bottom: 5px;
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #606266;
}

/* Bounds Section */
.bounds-section {
  margin-top: 2px; /* Further reduced margin */
}

.bounds-table {
  width: 100%;
  border-collapse: collapse;
}

.bounds-table-row {
  border-bottom: 1px dashed #ebeef5;
}

.bounds-label {
  font-size: 12px; /* Reduced font size */
  color: #606266;
  padding: 8px 0;
  width: 30%;
  font-family: "Helvetica Neue", Arial, sans-serif; /* Changed font */
}

.bounds-value {
  font-size: 13px;
  color: #303133;
  font-family: monospace;
  padding: 8px 0;
}

.tilde {
  font-family: monospace;
  padding: 0 2px;
}
</style>