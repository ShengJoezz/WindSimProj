<!-- WindTurbineList.vue -->
<template>
  <div v-if="windTurbines.length" class="turbine-list">
    <el-card
      v-for="turbine in windTurbines"
      :key="turbine.id"
      class="turbine-card"
    >
      <div class="card-header">
        <span class="turbine-name">{{ turbine.name }}</span>
        <div class="turbine-actions">
          <el-tooltip content="定位风机" placement="top">
            <el-button
              type="text"
              icon="el-icon-aim"
              @click="$emit('focus-turbine', turbine)"
              class="action-button"
            />
          </el-tooltip>
          <el-tooltip content="删除风机" placement="top">
            <el-button
                type="text"
                icon="el-icon-delete"
                @click="confirmDelete(turbine)"
                class="action-button"
                  :loading="deletingTurbineId === turbine.id"
                  :disabled="deletingTurbineId !== null && deletingTurbineId !== turbine.id"
            />
          </el-tooltip>
        </div>
      </div>
      <div class="turbine-details">
        <div class="detail-item">
          <span class="label">经度:</span>
          <span class="value">{{ turbine.longitude?.toFixed(6) ?? 'N/A' }}°</span>
        </div>
        <div class="detail-item">
          <span class="label">纬度:</span>
          <span class="value">{{ turbine.latitude?.toFixed(6) ?? 'N/A' }}°</span>
        </div>
        <div class="detail-item">
          <span class="label">桅杆高度:</span>
          <span class="value">{{ turbine.hubHeight ?? 'N/A' }} m</span>
        </div>
        <div class="detail-item">
          <span class="label">转子直径:</span>
          <span class="value">{{ turbine.rotorDiameter ?? 'N/A' }} m</span>
        </div>
      </div>
    </el-card>
  </div>
  <el-empty v-else description="暂无已安装的风机" />
</template>

<script setup>
/**
 * WindTurbineList.vue
 *
 * 展示已安装风机的列表组件，包含聚焦和删除操作。
 */
import { ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { throttle } from 'lodash';

const props = defineProps({
  windTurbines: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["focus-turbine", "delete-turbine"]);

const deletingTurbineId = ref(null);

const confirmDeleteThrottled = throttle((turbine) => {
  confirmDelete(turbine);
}, 500); // Throttle to 500ms

const confirmDelete = (turbine) => {
  ElMessageBox.confirm(
    `确定要删除风机 "${turbine.name}" 吗？`,
    "删除确认",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }
  )
    .then(async () => {
        deletingTurbineId.value = turbine.id;
        await emit("delete-turbine", turbine);
         deletingTurbineId.value = null;
    })
    .catch(() => {
      deletingTurbineId.value = null;
    });
};
</script>

<style scoped>
.turbine-list {
  padding: 16px;
  overflow-y: auto;
  height: calc(100% - 40px);
}

.turbine-card {
  margin-bottom: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid rgba(235, 238, 245, 0.8);
  overflow: hidden;
}

.turbine-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: rgba(64, 158, 255, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc, #f2f6fc);
  border-bottom: 1px solid #ebeef5;
}

.turbine-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.turbine-name::before {
  content: '';
  display: block;
  width: 10px;
  height: 10px;
  background: #409EFF;
  border-radius: 50%;
}

.turbine-actions {
  display: flex;
  gap: 12px;
}

.turbine-actions .action-button {
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  color: #606266;
}

.turbine-actions .action-button:hover {
  background-color: rgba(64, 158, 255, 0.1);
  color: #409EFF;
}

.turbine-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: #fff;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafc;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.detail-item:hover {
  background: #f2f6fc;
}

.detail-item .label {
  color: #909399;
  font-weight: 500;
  font-size: 13px;
}

.detail-item .value {
  color: #303133;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  font-weight: 500;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* 美化元素空态 */
:deep(.el-empty) {
  padding: 40px 0;
}

:deep(.el-empty__image) {
  opacity: 0.6;
}

:deep(.el-empty__description) {
  margin-top: 20px;
  color: #909399;
}
</style>