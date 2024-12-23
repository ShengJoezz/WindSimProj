<!-- frontend/src/components/TopToolbar.vue -->
<template>
  <div class="top-toolbar">
    <el-button-group>
      <el-button type="primary" @click="$emit('toggle-sidebar', 'control')" class="toolbar-button">
        <el-icon><Menu /></el-icon>
        控制面板
      </el-button>
      <el-button type="primary" @click="$emit('toggle-sidebar', 'management')" class="toolbar-button">
        <el-icon><Setting /></el-icon>
        风机管理
      </el-button>
      <el-button type="success" @click="$emit('add-turbine')" class="toolbar-button add-turbine-button">
        <el-icon><Plus /></el-icon>
        添加风机
      </el-button>
    </el-button-group>
  </div>
</template>

<script setup>
/**
 * TopToolbar.vue
 * 顶部工具栏，包含控制面板、风机管理和添加风机的按钮。
 */
import { Menu, Setting, Plus } from '@element-plus/icons-vue'

defineEmits(['toggle-sidebar', 'add-turbine'])
</script>

<style scoped>
.top-toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
}

.toolbar-button {
  padding: 12px 20px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.toolbar-button .el-icon {
  margin-right: 5px;
}

.add-turbine-button {
  background-color: #67c23a; /* 添加按钮的绿色 */
  border-color: #67c23a;
}

.add-turbine-button:hover {
  background-color: #85ce61; /* 悬停时稍深的绿色 */
  border-color: #85ce61;
}
</style>