<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 17:32:19
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 20:11:15
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\WindTurbineList.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 -->
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
  height: calc(100% - 40px); /* 根据需要调整高度 */
}

.turbine-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s; /* 平滑过渡 */
}

.turbine-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); /* 悬停时稍深的阴影 */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.turbine-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.turbine-actions {
  display: flex;
  gap: 8px;
}

.turbine-actions .action-button {
  padding: 6px; /* 小按钮填充 */
}

.turbine-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.detail-item .label {
  color: #909399;
}

.detail-item .value {
  color: #303133;
  font-family: monospace;
}
</style>