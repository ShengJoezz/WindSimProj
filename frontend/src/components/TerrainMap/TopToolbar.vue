<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:09:42
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:01:26
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TopToolbar.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- TopToolbar.vue -->
<template>
  <div class="top-toolbar" role="toolbar">
    <el-button-group>
      <el-button
        type="primary"
        @click="$emit('toggle-sidebar', 'control')"
        class="toolbar-button"
        aria-label="打开控制面板"
        tabindex="0"
      >
        <el-icon><Menu /></el-icon>
        控制面板
      </el-button>
      <el-button
        type="primary"
        @click="$emit('toggle-sidebar', 'management')"
        class="toolbar-button"
        aria-label="打开风机管理"
        tabindex="0"
      >
        <el-icon><Setting /></el-icon>
        风机管理
      </el-button>
      <el-button
        type="success"
        @click="$emit('add-turbine')"
        class="toolbar-button add-turbine-button"
        aria-label="添加风机"
        tabindex="0"
      >
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
  top: 24px;
  left: 24px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.top-toolbar:hover {
  transform: translateY(2px);
}

.toolbar-button {
  padding: 10px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  height: 40px;
  font-weight: 500;
}

.toolbar-button .el-icon {
  margin-right: 5px;
  font-size: 16px;
}

.add-turbine-button {
  background-color: #67c23a;
  border-color: #67c23a;
  box-shadow: 0 2px 6px rgba(103, 194, 58, 0.2);
}

.add-turbine-button:hover {
  background-color: #85ce61;
  border-color: #85ce61;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
}

.toolbar-button:focus {
  outline: 2px solid var(--accent-blue);
}

.el-button-group {
  display: flex;
  gap: 2px;
}

.el-button-group .el-button {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.el-button-group .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>