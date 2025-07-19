<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 18:59:56
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-06-19 17:35:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\ControlPanel.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- Dashboard.vue -->
<template>
  <el-drawer
    v-model="localVisible"
    direction="rtl"
    size="350px"
    :with-header="false"
    custom-class="control-sidebar-drawer"
    :before-close="handleClose"
  >
    <div class="control-sidebar-container">
      <div class="control-header">
        <h2 class="control-title">控制面板</h2>
        <el-button 
          class="close-button" 
          circle 
          icon="el-icon-close" 
          @click="handleClose"
          size="small"
        ></el-button>
      </div>
      
      <el-collapse v-model="activeSections" accordion class="custom-collapse">
        <!-- 地形显示控制 -->
        <el-collapse-item name="terrainControl" class="collapse-section">
          <template #title>
            <div class="section-header">
              <i class="el-icon-map-location"></i> 
              <span>地形显示</span>
            </div>
          </template>
          
          <div class="control-section">
            <el-button-group class="control-buttons">
              <el-button
                type="primary"
                @click="$emit('reset-camera')"
                icon="el-icon-refresh"
                aria-label="重置视角"
                class="action-button"
              >
                重置视角
              </el-button>
              <el-button
                :type="wireframe ? 'warning' : 'primary'"
                @click="$emit('toggle-wireframe')"
                icon="el-icon-s-grid"
                :aria-pressed="wireframe"
                aria-label="切换网格显示"
                class="action-button"
              >
                {{ wireframe ? '隐藏网格' : '显示网格' }}
              </el-button>
            </el-button-group>
          </div>
        </el-collapse-item>

        <!-- 风机动画控制 -->
        <el-collapse-item name="windControl" class="collapse-section">
          <template #title>
            <div class="section-header">
              <i class="el-icon-wind-power"></i> 
              <span>风机动画</span>
            </div>
          </template>
          
          <div class="control-section">
            <div class="animation-control-row">
              <div class="control-label">叶片旋转：</div>
              <el-switch
                v-model="bladeRotationComputed"
                active-color="#409EFF"
                inactive-color="#909399"
                aria-label="控制叶片旋转"
                role="switch"
                :aria-checked="bladeRotationComputed"
              />
            </div>
            
            <div class="speed-control">
              <div class="control-label">旋转速度：</div>
              <el-slider
                v-model="rotationSpeedComputed"
                :min="0.1"
                :max="2"
                :step="0.1"
                :format-tooltip="value => `${value}x`"
                aria-label="调节旋转速度"
                class="custom-slider"
              />
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
      
      <div class="control-footer">
        <div class="footer-info">
          <div class="info-icon"><i class="el-icon-info"></i></div>
          <div class="info-text">使用控制面板调整视图参数和风机动画效果</div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
/**
 * ControlPanel.vue
 *
 * 右侧抽屉面板，包含地形显示和风机动画的控制。
 */

import { ref, watch, computed } from "vue"; // Removed nextTick as it's not used

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  wireframe: {
    type: Boolean,
    required: true,
  },
  bladeRotation: {
    type: Boolean,
    required: true,
  },
  rotationSpeed: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits([
  "update:visible",
  "toggle-wireframe",
  "reset-camera",
  "update-blade-rotation",
  "update-rotation-speed",
]);

const localVisible = ref(props.visible);
const activeSections = ref("terrainControl"); // Default to first section, accordion takes string for single active

// 确保正确响应 visible 的变化
watch(
  () => props.visible,
  (newVal) => {
    localVisible.value = newVal;
  },
  { immediate: true }
);

// 同时监听 localVisible 的变化
watch(
  () => localVisible.value,
  (newVal) => {
    emit("update:visible", newVal);
  }
);

const bladeRotationComputed = computed({
  get: () => props.bladeRotation,
  set: (val) => emit('update-blade-rotation', val)
});

const rotationSpeedComputed = computed({
  get: () => props.rotationSpeed,
  set: (val) => emit('update-rotation-speed', val)
});

// 关闭抽屉
const handleClose = () => {
  emit("update:visible", false);
};
</script>

<style scoped>
.control-sidebar-drawer {
  --primary-color: #409EFF;
  --primary-light: rgba(64, 158, 255, 0.1);
  --primary-dark: #337ecc;
  --text-primary: #303133;
  --text-secondary: #606266;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --border-radius: 12px;
  --box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Ensure the drawer itself has the intended border radius and shadow */
:deep(.el-drawer) {
  border-radius: 16px 0 0 16px !important; /* Use !important if necessary to override defaults */
  overflow: hidden !important;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15) !important;
}
/* Or target the specific class if :deep(.el-drawer) isn't specific enough */
.control-sidebar-drawer.el-drawer {
  border-radius: 16px 0 0 16px;
  overflow: hidden;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);
}


.control-sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #f9f9f9, #ffffff);
  padding: 0;
}

/* 控制面板标题 */
.control-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  position: relative;
}

.control-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, 
    rgba(255,255,255,0.5), 
    rgba(255,255,255,0.2) 20%, 
    rgba(255,255,255,0.1) 40%, 
    rgba(255,255,255,0.1) 60%, 
    rgba(255,255,255,0.2) 80%, 
    rgba(255,255,255,0.5)
  );
}

.control-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-button {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  transition: all 0.2s ease;
}
.close-button :deep(i) { /* Target icon color specifically if needed */
    color: white;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

/* 自定义折叠面板 */
.custom-collapse {
  border: none;
  margin: 16px 0;
  background: transparent;
  padding: 0 16px; /* Add padding to align content */
}

:deep(.el-collapse-item__header) {
  padding: 15px 20px;
  font-size: 16px;
  border: none;
  /* margin: 0 16px 4px; */ /* Removed margin to use padding on parent */
  margin-bottom: 8px; /* Space between collapse items */
  border-radius: var(--border-radius);
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

:deep(.el-collapse-item__header:hover) {
  background: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:deep(.el-collapse-item__content) {
  padding: 0; /* Remove default padding, handled by .control-section */
  padding-bottom: 8px; /* Space before next header */
  background: transparent;
  border: none; /* Remove default border */
}
:deep(.el-collapse-item__wrap) {
  border-bottom: none; /* Remove default border from wrapper */
}


.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-weight: 600;
}

.section-header i {
  font-size: 18px;
  color: var(--primary-color);
}

/* 控制部分样式 */
.control-section {
  background: var(--card-bg);
  padding: 16px;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  /* margin: 0 16px; */ /* Removed margin, handled by parent's padding */
}

.control-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.action-button {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.animation-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.control-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  /* margin-bottom: 8px; */ /* Removed, let flex handle alignment */
}

.speed-control {
  margin-top: 16px; /* This can stay if spacing is desired after the row */
}
.speed-control .control-label { /* Add bottom margin only if it's above slider */
    margin-bottom: 8px;
}


/* 自定义滑块 */
:deep(.el-slider__runway) {
  height: 8px;
  border-radius: 4px;
  background-color: #e4e7ed;
}

:deep(.el-slider__bar) {
  height: 8px;
  border-radius: 4px;
  background-color: var(--primary-color);
}

:deep(.el-slider__button) {
  width: 20px;
  height: 20px;
  border: 2px solid var(--primary-color);
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 底部信息 */
.control-footer {
  margin-top: auto;
  padding: 16px 24px;
  background: rgba(64, 158, 255, 0.05);
  border-top: 1px solid rgba(64, 158, 255, 0.1);
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 18px;
}

.info-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* 单独的开关样式调整 */
:deep(.el-switch__core) {
  border-radius: 16px;
  height: 22px;
}

:deep(.el-switch.is-checked .el-switch__core) {
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}
</style>