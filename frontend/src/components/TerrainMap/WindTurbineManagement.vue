<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 21:52:31
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-01 12:25:25
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\WindTurbineManagement.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- WindTurbineManagement.vue -->
<template>
  <el-drawer
    v-model="localVisible"
    direction="rtl"
    size="450px"
    :with-header="false"
    custom-class="sidebar-drawer"
    :before-close="handleClose"
    aria-labelledby="windTurbineManagementTitle"
  >
    <div class="sidebar-container management-panel">
      <el-collapse v-model="activeSections" accordion>
        <el-collapse-item name="windTurbineManagement">
          <template #title>
            <h3 class="collapse-title" id="windTurbineManagementTitle">
              <i class="el-icon-wind-power"></i> 风机管理
            </h3>
          </template>

          <el-tabs v-model="activeTab" class="management-tabs">
            <!-- Add Turbine Tab -->
            <el-tab-pane label="添加风机" name="add">
              <WindTurbineForm @add-turbine="handleAddTurbine" />
              <UploadComponent @import-turbines="handleBulkImport" />
            </el-tab-pane>

            <!-- Installed Turbines Tab -->
            <el-tab-pane label="已安装风机" name="display">
              <WindTurbineList
                :windTurbines="windTurbines"
                @focus-turbine="focusTurbine"
                @delete-turbine="deleteTurbine"
              />
            </el-tab-pane>
          </el-tabs>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-drawer>
</template>

<script setup>
/**
 * WindTurbineManagement.vue
 *
 * Right sidebar component for managing wind turbines, including adding new turbines and listing existing ones.
 */

import { ref, watch } from "vue";
import WindTurbineForm from "./WindTurbineForm.vue";
import WindTurbineList from "./WindTurbineList.vue";
import UploadComponent from "./UploadComponent.vue";
// REMOVE: import { useCaseStore } from "../../store/caseStore"; // No longer needed here for adding

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  windTurbines: {
    type: Array,
    required: true,
  },
  geographicBounds: {
    type: Object,
    required: true,
  },
});

// MODIFY: Ensure 'add-turbine' and 'import-turbines' are defined
const emit = defineEmits([
  "update:visible",
  "focus-turbine",
  "delete-turbine",
  "add-turbine",       // Keep this
  "import-turbines",   // Keep this
]);

// REMOVE: const store = useCaseStore(); // Remove this line

const localVisible = ref(props.visible);
const activeSections = ref(["windTurbineManagement"]);
const activeTab = ref("add");

// Sync localVisible with prop
watch(
  () => props.visible,
  (newVal) => {
    localVisible.value = newVal;
  },
  { immediate: true }
);

watch(
  () => localVisible.value,
  (newVal) => {
    emit("update:visible", newVal);
  }
);

const handleClose = () => {
  emit("update:visible", false);
};

// MODIFY: handleAddTurbine function
const handleAddTurbine = (turbine) => {
  // REMOVE: store.addWindTurbine(turbine); // Don't call store directly
  console.log('[WindTurbineManagement] Emitting add-turbine:', turbine);
  emit("add-turbine", turbine); // Emit event to parent
};

// MODIFY: handleBulkImport function
const handleBulkImport = (turbines) => {
  // REMOVE: store.addBulkWindTurbines(turbines); // Don't call store directly
  console.log('[WindTurbineManagement] Emitting import-turbines:', turbines?.length);
  emit("import-turbines", turbines); // Emit event to parent
};

// Handle focusing on a turbine
const focusTurbine = (turbine) => {
  emit("focus-turbine", turbine);
};

// Handle deleting a turbine
const deleteTurbine = (turbine) => {
  emit("delete-turbine", turbine);
};
</script>

<style scoped>
.sidebar-drawer {
  background: #ffffff;
  box-shadow: -2px 0 24px rgba(0, 0, 0, 0.15);
  border-radius: 16px 0 0 16px;
}

.sidebar-container {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f9f9f9, #ffffff);
}

.management-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.el-tabs__header) {
  margin-bottom: 20px;
}

:deep(.el-tabs__nav) {
  background: #f2f6fc;
  border-radius: 8px;
  padding: 4px;
}

:deep(.el-tabs__item) {
  height: 40px;
  line-height: 40px;
  font-weight: 500;
  color: #606266;
  transition: all 0.3s ease;
  border-radius: 6px;
}

:deep(.el-tabs__item.is-active) {
  color: #409EFF;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

:deep(.el-tabs__active-bar) {
  display: none;
}

.tab-content-wrapper {
  overflow-y: auto;
  height: calc(100% - 40px);
  padding-right: 10px;
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

/* 美化 collapse 组件 */
:deep(.el-collapse-item__header) {
  background-color: transparent;
  border-bottom: 1px solid #e6e8eb;
  padding: 16px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.el-collapse-item__header:hover) {
  background-color: rgba(64, 158, 255, 0.05);
}

:deep(.el-collapse-item__content) {
  padding: 20px 8px;
  border: none;
}
</style>