<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 21:52:31
 * @LastEditors: AI Assistant
 * @LastEditTime: 2026-02-03
 * @Description: 风机管理面板 - 完全重新设计
-->

<template>
  <el-drawer
    v-model="localVisible"
    direction="rtl"
    size="380px"
    :with-header="false"
    custom-class="turbine-drawer"
    :before-close="handleClose"
  >
    <div class="drawer-container">
      <!-- 头部 -->
      <header class="drawer-header">
        <div class="header-title">
          <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
            <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
          </svg>
          <span>风机管理</span>
        </div>
        <button class="close-btn" @click="handleClose" title="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <!-- 自定义 Tabs -->
      <nav class="tab-nav">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'add' }"
          @click="activeTab = 'add'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          添加风机
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'list' }"
          @click="activeTab = 'list'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
          已安装
          <span v-if="windTurbines.length" class="badge">{{ windTurbines.length }}</span>
        </button>
      </nav>

      <!-- 内容区域 -->
      <main class="drawer-content">
        <!-- 添加风机 -->
        <div v-show="activeTab === 'add'" class="tab-panel">
          <el-alert
            v-if="!boundsReady"
            class="bounds-alert"
            type="warning"
            show-icon
            :closable="false"
            title="地形边界未就绪"
            description="请等待地形加载完成"
          />
          <WindTurbineForm :disabled="!boundsReady" @add-turbine="handleAddTurbine" />
          <UploadComponent :disabled="!boundsReady" @import-turbines="handleBulkImport" />
        </div>

        <!-- 已安装风机列表 -->
        <div v-show="activeTab === 'list'" class="tab-panel">
          <WindTurbineList
            :windTurbines="windTurbines"
            @delete-turbine="deleteTurbine"
          />
        </div>
      </main>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { ElMessage, ElNotification } from 'element-plus';
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

const boundsReady = computed(() => {
  const bounds = props.geographicBounds;
  if (!bounds) return false;
  const { minLat, maxLat, minLon, maxLon } = bounds;
  return [minLat, maxLat, minLon, maxLon].every((v) => typeof v === 'number' && Number.isFinite(v));
});

const isWithinBounds = (turbine) => {
  const bounds = props.geographicBounds;
  if (!boundsReady.value) return false;
  
  const lat = parseFloat(turbine.latitude);
  const lon = parseFloat(turbine.longitude);
  const { minLat, maxLat, minLon, maxLon } = bounds;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
};

const emit = defineEmits([
  "update:visible",
  "delete-turbine",
  "add-turbine",
  "import-turbines",
]);

const localVisible = ref(props.visible);
const activeTab = ref("add");

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

const handleClose = (done) => {
  localVisible.value = false;
  if (typeof done === "function") done();
};

const handleAddTurbine = (turbine) => {
  if (!boundsReady.value) {
    ElMessage.error("地形边界未就绪，暂无法添加风机。");
    return;
  }
  if (!isWithinBounds(turbine)) {
    ElMessage.error(`风机 "${turbine.name}" 的坐标超出了当前地形边界。`);
    return;
  }
  emit("add-turbine", turbine);
};

const handleBulkImport = (turbines) => {
  if (!boundsReady.value) {
    ElMessage.error("地形边界未就绪，暂无法导入风机。");
    return;
  }
  const validTurbines = [];
  const invalidNames = [];

  for (const turbine of turbines) {
    if (isWithinBounds(turbine)) {
      validTurbines.push(turbine);
    } else {
      invalidNames.push(turbine.name || '未命名');
    }
  }

  if (invalidNames.length > 0) {
    ElNotification({
      title: '导入警告',
      message: `${invalidNames.length} 个风机因坐标超出边界而未导入`,
      type: 'warning',
      duration: 5000,
    });
  }

  if (validTurbines.length > 0) {
    ElMessage.success(`已导入 ${validTurbines.length} 个风机`);
    emit("import-turbines", validTurbines);
  }
  
  if (validTurbines.length === 0 && invalidNames.length > 0) {
     ElMessage.error('所有风机均无效');
  }
};

const deleteTurbine = (turbine, done) => {
  emit("delete-turbine", turbine, done);
};
</script>

<style scoped>
/* Drawer 样式 */
.turbine-drawer {
  border-radius: 16px 0 0 16px !important;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12) !important;
}

:deep(.el-drawer__body) {
  padding: 0 !important;
  overflow: hidden !important;
}

/* 容器 */
.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

/* 头部 */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-size: 16px;
  font-weight: 600;
}

.header-icon {
  width: 20px;
  height: 20px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

/* Tab 导航 */
.tab-nav {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn svg {
  width: 16px;
  height: 16px;
}

.tab-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.tab-btn:not(.active) .badge {
  background: #e2e8f0;
  color: #64748b;
}

/* 内容区域 */
.drawer-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}

.tab-panel {
  min-height: 0;
}

/* 警告框 */
.bounds-alert {
  margin-bottom: 12px;
}

:deep(.el-alert) {
  border-radius: 8px;
  padding: 10px 12px;
}

:deep(.el-alert__title) {
  font-size: 13px;
}

:deep(.el-alert__description) {
  font-size: 12px;
  margin-top: 4px;
}

/* 滚动条 */
.drawer-content::-webkit-scrollbar {
  width: 5px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
</style>
