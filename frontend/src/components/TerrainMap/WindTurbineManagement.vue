<!-- frontend/src/components/WindTurbineManagement.vue -->
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

const emit = defineEmits([
  "update:visible",
  "focus-turbine",
  "delete-turbine",
  "add-turbine",
  "import-turbines",
]);

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

// Handle adding a new turbine
const handleAddTurbine = (turbine) => {
  emit("add-turbine", turbine);
};

// Handle bulk import
const handleBulkImport = (turbines) => {
  emit("import-turbines", turbines);
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
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.management-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.management-tabs .el-tabs__header {
  margin-bottom: 10px;
}

.tab-content-wrapper {
  overflow-y: auto;
  height: calc(100% - 40px);
  padding-right: 10px;
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
</style>