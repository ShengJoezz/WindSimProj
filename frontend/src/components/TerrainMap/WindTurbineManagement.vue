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
import { ElMessage, ElNotification } from 'element-plus';
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

// 添加一个辅助函数来检查边界
const isWithinBounds = (turbine) => {
  const bounds = props.geographicBounds;
  console.log('---边界检查调试---');
  console.log('传入的 turbine 坐标:', turbine.longitude, turbine.latitude);
  console.log('传入的地形边界 props:', bounds);
  console.log('边界值的类型: minLat is a', typeof bounds.minLat);
  console.log('------------------');
  
  // 从用户输入中解析数字
  const lat = parseFloat(turbine.latitude);
  const lon = parseFloat(turbine.longitude);

  // 从 props 中直接获取数字 (无需再解析)
  const { minLat, maxLat, minLon, maxLon } = bounds;

  // 增加一个检查，确保边界数据已经加载
  if (typeof minLat !== 'number' || typeof maxLat !== 'number' || 
      typeof minLon !== 'number' || typeof maxLon !== 'number') {
    console.warn("地形边界数据尚未加载，无法进行校验。");
    // 在边界数据不可用时，可以选择是阻止还是允许。阻止更安全。
    ElMessage.error("地形边界数据未就绪，请稍后再试。");
    return false;
  }

  // 现在这里是纯粹的数字比较，不会有类型错误
  if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
    return true;
  }
  
  return false;
};

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

// 修改您的 handleAddTurbine 函数
const handleAddTurbine = (turbine) => {
  if (!isWithinBounds(turbine)) {
    ElMessage.error(`风机 "${turbine.name}" 的坐标超出了当前地形边界。`);
    return; // 阻止添加
  }
  console.log('[WindTurbineManagement] Emitting add-turbine:', turbine);
  emit("add-turbine", turbine);
};

// 修改您的 handleBulkImport 函数
const handleBulkImport = (turbines) => {
  const validTurbines = [];
  const invalidNames = [];

  for (const turbine of turbines) {
    if (isWithinBounds(turbine)) {
      validTurbines.push(turbine);
    } else {
      // 收集无效风机的名称，如果没有名称则使用通用描述
      invalidNames.push(turbine.name || '一个未命名风机');
    }
  }

  // 1. 如果有无效风机，使用 ElNotification 给出详细警告。
  //    Notification 更适合显示较长的列表信息。
  if (invalidNames.length > 0) {
    ElNotification({
      title: '导入警告',
      message: `以下 ${invalidNames.length} 个风机因坐标超出地形边界而未被导入: ${invalidNames.join(', ')}`,
      type: 'warning',
      duration: 8000, // 持续显示8秒，方便用户阅读
    });
  }

  // 2. 如果有有效的风机，发出事件并给出明确的成功提示。
  if (validTurbines.length > 0) {
    ElMessage.success(`已准备好导入 ${validTurbines.length} 个有效的风机。`);
    emit("import-turbines", validTurbines); // 只发出有效的风机列表
  }
  
  // 3. (可选) 如果所有风机都无效，可以给出一个最终的错误提示。
  if (validTurbines.length === 0 && invalidNames.length > 0) {
     ElMessage.error('本次导入的所有风机均无效，操作已中止。');
  }
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