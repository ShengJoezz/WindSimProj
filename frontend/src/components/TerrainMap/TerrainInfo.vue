<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:47:17
 * @LastEditors: AI Assistant
 * @LastEditTime: 2026-02-03
 * @Description: 紧凑型地形信息面板 - 包含高程图例、指北针、比例尺
 * 优化：减小尺寸、添加折叠功能、与Drawer不冲突
-->

<template>
  <div class="terrain-info-wrapper">
    <!-- 指北针 -->
    <div class="compass" title="指北针">
      <div class="compass-arrow">
        <span class="compass-n">N</span>
        <svg viewBox="0 0 24 24" class="compass-icon">
          <path d="M12 2L8 12h8L12 2z" fill="#e53935"/>
          <path d="M12 22l4-10H8l4 10z" fill="#1565c0"/>
        </svg>
      </div>
    </div>

    <!-- 比例尺 -->
    <div class="scale-bar" title="比例尺">
      <div class="scale-line"></div>
      <span class="scale-label">{{ scaleLabel }}</span>
    </div>

    <!-- 信息面板 -->
    <div class="terrain-info" :class="{ collapsed: isCollapsed }">
      <div class="panel-header" @click="toggleCollapse">
        <span class="panel-title">
          <span class="header-icon">▣</span>
          地形信息
        </span>
        <span class="collapse-icon">{{ isCollapsed ? '◀' : '▶' }}</span>
      </div>
      
      <transition name="slide">
        <div v-show="!isCollapsed" class="panel-content">
          <!-- 高程图例 -->
          <div class="section elevation-section">
            <div class="section-label">高程范围</div>
            <div class="gradient-bar"></div>
            <div class="elevation-labels">
              <span>{{ minElevation }}m</span>
              <span>{{ maxElevation }}m</span>
            </div>
          </div>

          <!-- 坐标范围 -->
          <div class="section coords-section">
            <div class="coord-row">
              <span class="coord-label">经度</span>
              <span class="coord-value">{{ formatBound(geographicBounds.minLon) }}° ~ {{ formatBound(geographicBounds.maxLon) }}°</span>
            </div>
            <div class="coord-row">
              <span class="coord-label">纬度</span>
              <span class="coord-value">{{ formatBound(geographicBounds.minLat) }}° ~ {{ formatBound(geographicBounds.maxLat) }}°</span>
            </div>
            <div class="coord-row">
              <span class="coord-label">范围</span>
              <span class="coord-value">{{ formattedGeoSize }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useCaseStore } from '../../store/caseStore';

const props = defineProps({
  elevationLabels: {
    type: Array,
    required: true,
  },
  geographicBounds: {
    type: Object,
    required: true,
  },
  cameraDistance: {
    type: Number,
    default: 1000,
  },
});

const caseStore = useCaseStore();
const isCollapsed = ref(false);

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

// 格式化边界值
const formatBound = (val) => {
  if (val === undefined || val === null) return 'N/A';
  return Number(val).toFixed(4);
};

// 高程范围
const minElevation = computed(() => {
  const sorted = [...props.elevationLabels].sort((a, b) => a - b);
  return sorted[0] ?? 0;
});

const maxElevation = computed(() => {
  const sorted = [...props.elevationLabels].sort((a, b) => a - b);
  return sorted[sorted.length - 1] ?? 0;
});

// 格式化距离
const formatDistance = (meters) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

// 地形尺寸
const formattedGeoSize = computed(() => {
  const size = caseStore.geographicSize;
  if (!size || size.width === 0 || size.height === 0) {
    return "N/A";
  }
  return `${formatDistance(size.width)} × ${formatDistance(size.height)}`;
});

// 动态比例尺 - 基于相机距离
const scaleLabel = computed(() => {
  const size = caseStore.geographicSize;
  if (!size || size.width === 0) {
    return "1 km";
  }
  
  const sceneWidth = 1000;
  const scaleBarPixels = 60;
  const viewportWidth = 800;
  const fovFactor = Math.tan(22.5 * Math.PI / 180);
  const visibleSceneWidth = 2 * props.cameraDistance * fovFactor;
  const scaleBarRatio = scaleBarPixels / viewportWidth;
  const actualDistance = (visibleSceneWidth / sceneWidth) * size.width * scaleBarRatio;
  
  const niceNumbers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  
  if (actualDistance >= 1000) {
    const kmValue = actualDistance / 1000;
    const niceKm = niceNumbers.find(n => n >= kmValue) || Math.ceil(kmValue);
    return `${niceKm} km`;
  } else {
    const niceM = niceNumbers.find(n => n >= actualDistance) || Math.ceil(actualDistance / 100) * 100;
    return `${niceM} m`;
  }
});
</script>

<style scoped>
.terrain-info-wrapper {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 50;  /* 低于 el-drawer 的 2000+ */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;  /* 允许点击穿透到下层 */
}

.terrain-info-wrapper > * {
  pointer-events: auto;  /* 子元素可点击 */
}

/* 指北针 */
.compass {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease;
}

.compass:hover {
  transform: scale(1.05);
}

.compass-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.compass-n {
  font-size: 9px;
  font-weight: 700;
  color: #e53935;
  line-height: 1;
}

.compass-icon {
  width: 18px;
  height: 18px;
}

/* 比例尺 */
.scale-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.scale-line {
  width: 50px;
  height: 3px;
  background: #333;
  position: relative;
}

.scale-line::before,
.scale-line::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 6px;
  background: #333;
  top: -1.5px;
}

.scale-line::before { left: 0; }
.scale-line::after { right: 0; }

.scale-label {
  font-size: 10px;
  font-weight: 600;
  color: #333;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
}

/* 信息面板 */
.terrain-info {
  width: 220px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: width 0.25s ease;
}

.terrain-info.collapsed {
  width: auto;
  min-width: 100px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.03));
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.panel-header:hover {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(64, 158, 255, 0.08));
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 5px;
}

.header-icon {
  font-size: 11px;
}

.collapse-icon {
  font-size: 8px;
  color: #909399;
  transition: transform 0.2s;
}

.panel-content {
  padding: 10px 12px;
}

/* 动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  max-height: 200px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  padding: 0 12px;
  opacity: 0;
}

/* 高程部分 */
.section {
  margin-bottom: 10px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 10px;
  color: #909399;
  margin-bottom: 4px;
  font-weight: 500;
}

.gradient-bar {
  height: 8px;
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
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.elevation-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 9px;
  color: #606266;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
}

/* 坐标部分 */
.coords-section {
  margin-bottom: 0;
}

.coord-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.coord-row:last-child {
  border-bottom: none;
}

.coord-label {
  font-size: 10px;
  color: #909399;
}

.coord-value {
  font-size: 10px;
  color: #303133;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
}

/* 响应式 - 当 Drawer 打开时自动隐藏或缩小 */
@media (max-width: 768px) {
  .terrain-info-wrapper {
    bottom: 8px;
    right: 8px;
  }
  
  .terrain-info {
    width: 180px;
  }
  
  .compass {
    width: 36px;
    height: 36px;
  }
}
</style>