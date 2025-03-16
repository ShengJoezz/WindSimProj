<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 18:59:56
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:00:15
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\ControlPanel.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- Dashboard.vue -->
<template>
  <el-drawer
    v-model="localVisible"
    direction="ltr"
    size="350px"
    :with-header="false"
    custom-class="sidebar-drawer"
    :before-close="handleClose"
  >
    <div class="sidebar-container">
      <el-collapse v-model="activeSections" accordion>
        <el-collapse-item name="controlPanel">
          <template #title>
            <h3 class="collapse-title">
              <i class="el-icon-setting"></i> 控制面板
            </h3>
          </template>
          <el-card class="control-card">
            <div class="card-content">
              <!-- 地形显示控制 -->
              <div class="control-group">
                <div class="group-title">地形显示</div>
                <el-button-group class="control-buttons">
                  <el-button
                    type="primary"
                    @click="$emit('reset-camera')"
                    icon="el-icon-refresh"
                    aria-label="重置视角"
                  >
                    重置视角
                  </el-button>
                  <el-button
                    :type="wireframe ? 'warning' : 'primary'"
                    @click="$emit('toggle-wireframe')"
                    icon="el-icon-s-grid"
                    :aria-pressed="wireframe"
                    aria-label="切换网格显示"
                  >
                    {{ wireframe ? '隐藏网格' : '显示网格' }}
                  </el-button>
                </el-button-group>
              </div>

              <!-- 风机动画控制 -->
              <div class="control-group">
                <div class="group-title">风机动画</div>
                <el-row :gutter="12" class="animation-controls">
                  <el-col :span="12">
                    <el-switch
                      v-model="bladeRotation"
                      active-text="叶片旋转"
                      inactive-text="叶片停止"
                      @change="$emit('update-blade-rotation', $event)"
                      aria-label="控制叶片旋转"
                      role="switch"
                      :aria-checked="bladeRotation"
                    />
                  </el-col>
                  <el-col :span="12">
                    <div class="speed-control">
                      <span class="speed-label">旋转速度:</span>
                      <el-slider
                        v-model="rotationSpeed"
                        :min="0.1"
                        :max="2"
                        :step="0.1"
                        @input="$emit('update-rotation-speed', $event)"
                        aria-label="调节旋转速度"
                      />
                    </div>
                  </el-col>
                </el-row>
              </div>
            </div>
          </el-card>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-drawer>
</template>

<script setup>
/**
 * ControlPanel.vue
 *
 * 左侧抽屉面板，包含地形显示和风机动画的控制。
 */

import { ref, watch, nextTick, computed } from "vue";

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
const activeSections = ref(["controlPanel"]);

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


const bladeRotation = computed({
  get: () => props.bladeRotation,
  set: (val) => emit('update-blade-rotation', val)
});

const rotationSpeed = computed({
  get: () => props.rotationSpeed,
  set: (val) => emit('update-rotation-speed', val)
});

// 关闭抽屉
const handleClose = () => {
  emit("update:visible", false);
};
</script>

<style scoped>
.sidebar-drawer {
  background: #ffffff;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.15);
  border-radius: 0 16px 16px 0;
}

.sidebar-container {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f9f9f9, #ffffff);
}

.el-collapse {
  border: none;
  background: transparent;
}

.el-collapse-item__header {
  background-color: transparent;
  border-bottom: 1px solid #e6e8eb;
  padding: 16px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.el-collapse-item__header:hover {
  background-color: rgba(64, 158, 255, 0.05);
}

.el-collapse-item__content {
  padding: 20px 8px;
  border: none;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.control-group {
  margin-bottom: 24px;
  background: #f9fafc;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.control-group:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.group-title {
  font-size: 16px;
  font-weight: 600;
  color: #409EFF;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.2);
}

.control-buttons {
  display: flex;
  gap: 10px;
  width: 100%;
}

.control-buttons .el-button {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.animation-controls {
  margin-top: 16px;
}

.speed-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.speed-label {
  font-size: 14px;
  color: #5e6d82;
  font-weight: 500;
}

.control-card {
  margin-bottom: 16px;
  border-radius: 12px;
  box-shadow: none;
  background: transparent;
}

.card-content {
  padding: 8px 0;
}

/* 增强开关样式 */
:deep(.el-switch__core) {
  border-radius: 16px;
  height: 22px;
}

:deep(.el-slider__runway) {
  height: 8px;
  border-radius: 4px;
  background-color: #e4e7ed;
}

:deep(.el-slider__bar) {
  height: 8px;
  border-radius: 4px;
  background-color: #409EFF;
}

:deep(.el-slider__button) {
  width: 20px;
  height: 20px;
  border: 2px solid #409EFF;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>