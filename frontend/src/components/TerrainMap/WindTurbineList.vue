<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 19:02:30
 * @LastEditors: AI Assistant
 * @LastEditTime: 2026-02-03
 * @Description: 已安装风机列表 - 紧凑现代设计
-->

<template>
  <div class="turbine-list-container">
    <div v-if="windTurbines.length" class="turbine-list">
      <div
        v-for="turbine in windTurbines"
        :key="turbine.id"
        class="turbine-item"
      >
        <!-- 卡片头部 -->
        <div class="item-header">
          <div class="turbine-indicator"></div>
          <span class="turbine-name">{{ turbine.name }}</span>
          <div class="item-actions">
            <button 
              class="action-btn delete-btn" 
              @click="confirmDelete(turbine)"
              :disabled="deletingTurbineId === turbine.id"
              title="删除风机"
            >
              <svg v-if="deletingTurbineId !== turbine.id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span v-else class="loading-spinner"></span>
            </button>
          </div>
        </div>

        <!-- 卡片内容 - 紧凑网格布局 -->
        <div class="item-body">
          <div class="info-grid">
            <div class="info-cell">
              <span class="info-label">经度</span>
              <span class="info-value">{{ formatCoord(turbine.longitude) }}°</span>
            </div>
            <div class="info-cell">
              <span class="info-label">纬度</span>
              <span class="info-value">{{ formatCoord(turbine.latitude) }}°</span>
            </div>
            <div class="info-cell">
              <span class="info-label">轮毂高度</span>
              <span class="info-value">{{ turbine.hubHeight ?? '-' }} m</span>
            </div>
            <div class="info-cell">
              <span class="info-label">叶轮直径</span>
              <span class="info-value">{{ turbine.rotorDiameter ?? '-' }} m</span>
            </div>
          </div>
          <div class="model-tag">
            <span class="tag-label">模型</span>
            <span class="tag-value">{{ getModelId(turbine) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg class="empty-icon" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="28" stroke="#ddd" stroke-width="2" stroke-dasharray="4 4"/>
        <path d="M32 20v24M20 32h24" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-text">暂无已安装的风机</p>
      <p class="empty-hint">请在"添加风机"标签中添加</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessageBox } from 'element-plus';

const props = defineProps({
  windTurbines: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["delete-turbine"]);

const deletingTurbineId = ref(null);

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
    .then(() => {
      deletingTurbineId.value = turbine.id;
      const done = () => {
        if (deletingTurbineId.value === turbine.id) {
          deletingTurbineId.value = null;
        }
      };
      emit("delete-turbine", turbine, done);
    })
    .catch(() => {
      deletingTurbineId.value = null;
    });
};

const formatCoord = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(4) : '-';
};

const getModelId = (turbine) => {
  return turbine.model || turbine.type || '1';
};
</script>

<style scoped>
.turbine-list-container {
  padding: 0;
}

.turbine-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 单个风机卡片 */
.turbine-item {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8eaed;
  overflow: hidden;
  transition: all 0.2s ease;
}

.turbine-item:hover {
  border-color: #409EFF;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.12);
}

/* 卡片头部 */
.item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-bottom: 1px solid #e8eaed;
}

.turbine-indicator {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  flex-shrink: 0;
}

.turbine-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #64748b;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #409EFF;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 卡片内容 */
.item-body {
  padding: 10px 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.info-cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
}

.info-label {
  color: #64748b;
  font-weight: 500;
}

.info-value {
  color: #1e293b;
  font-family: 'SF Mono', Menlo, Monaco, monospace;
  font-weight: 500;
}

/* 模型标签 */
.model-tag {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding: 6px 10px;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border-radius: 6px;
  border: 1px solid #bfdbfe;
}

.tag-label {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 500;
}

.tag-value {
  font-size: 13px;
  font-weight: 600;
  color: #1d4ed8;
  background: #fff;
  padding: 2px 10px;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 4px 0;
}

.empty-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}
</style>
