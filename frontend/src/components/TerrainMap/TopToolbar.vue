<!-- frontend/src/components/TopToolbar.vue -->
<template>
  <div class="top-toolbar">
    <el-button-group>
      <el-button type="primary" @click="$emit('toggle-sidebar', 'control')" class="toolbar-button">
        <i class="el-icon-menu"></i> 控制面板
      </el-button>
      <el-button type="primary" @click="$emit('toggle-sidebar', 'management')" class="toolbar-button">
        <i class="el-icon-s-operation"></i> 风机管理
      </el-button>
      <el-button type="success" @click="$emit('add-turbine')" class="toolbar-button add-turbine-button">
        <i class="el-icon-plus"></i> 添加风机
      </el-button>
    </el-button-group>
  </div>
</template>

<script setup>
/**
 * TopToolbar.vue
 *
 * 顶部工具栏，包含控制面板、风机管理和添加风机的按钮。
 */
</script>

<style scoped>
.top-toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10; /* 确保工具栏位于其他元素之上 */
}

.toolbar-button {
  padding: 12px 20px;
  font-size: 14px;
  border-radius: 4px;
  margin-right: 10px;
  background-color: #409eff; /* 主蓝色 */
  border-color: #409eff;
  color: white;
  transition: background-color 0.3s, border-color 0.3s; /* 平滑过渡 */
}

.toolbar-button:hover {
  background-color: #66b1ff; /* 悬停时稍深的蓝色 */
  border-color: #66b1ff;
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