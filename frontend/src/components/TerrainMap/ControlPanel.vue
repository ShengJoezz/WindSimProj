<!-- frontend/src/components/ControlPanel.vue -->
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
                  <el-button type="primary" @click="$emit('reset-camera')" icon="el-icon-refresh">
                    重置视角
                  </el-button>
                  <el-button
                    :type="wireframe ? 'warning' : 'primary'"
                    @click="$emit('toggle-wireframe')"
                    icon="el-icon-s-grid"
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
                      v-model="localBladeRotation"
                      active-text="叶片旋转"
                      inactive-text="叶片停止"
                      @change="$emit('update-blade-rotation', $event)"
                    />
                  </el-col>
                  <el-col :span="12">
                    <div class="speed-control">
                      <span class="speed-label">旋转速度:</span>
                      <el-slider
                        v-model="localRotationSpeed"
                        :min="0.1"
                        :max="2"
                        :step="0.1"
                        @input="$emit('update-rotation-speed', $event)"
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

import { ref, watch } from "vue";

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

const localBladeRotation = ref(props.bladeRotation);
const localRotationSpeed = ref(props.rotationSpeed);

// 确保正确响应 visible 的变化
watch(() => props.visible, (newVal) => {
  console.log('Visible prop changed:', newVal);
  localVisible.value = newVal;
});

// 同时监听 localVisible 的变化
watch(() => localVisible.value, (newVal) => {
  console.log('Local visible changed:', newVal);
  emit('update:visible', newVal);
});

// 关闭抽屉
const handleClose = () => {
  emit("update:visible", false);
};
</script>

<style scoped>
.sidebar-drawer {
  background: #ffffff;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1); /* 微妙的阴影 */
}

.sidebar-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.el-collapse {
  border: none; /* 移除默认边框 */
}

.el-collapse-item__header {
  background-color: #f5f7fa; /* 浅灰色背景 */
  border-bottom: 1px solid #ebeef5; /* 底部浅灰色边框 */
  padding: 12px 16px;
  border-radius: 4px 4px 0 0; /* 右上和左上圆角 */
}

.el-collapse-item__content {
  padding: 16px;
  border-left: 1px solid #ebeef5;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  border-radius: 0 0 4px 4px; /* 右下和左下圆角 */
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 0;
}

.control-group {
  margin-bottom: 20px;
}

.group-title {
  font-size: 15px;
  font-weight: 600;
  color: #606266; /* 灰色文字 */
  margin-bottom: 12px;
}

.control-buttons {
  display: flex;
  gap: 8px;
}

.animation-controls {
  margin-top: 10px;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 14px;
  color: #606266;
}

.control-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>