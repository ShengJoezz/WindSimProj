<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 19:11:25
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-03 19:26:31
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\views\Cases.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="page-container">
    <div class="content-wrapper">
      <div class="header">
        <h2>工况列表</h2>
        <p class="subtitle">查看和管理您的所有风场工况</p>
        
        <div class="actions">
          <el-button type="primary" @click="router.push('/new')" class="create-button" :icon="Plus">
            新建工况
          </el-button>
        </div>
      </div>

      <el-card class="table-card">
        <el-table 
          :data="cases" 
          style="width: 100%" 
          :header-cell-style="{ background: '#f5f7fa', color: '#333', fontWeight: 'bold', fontSize: '15px' }"
          :cell-style="{ padding: '16px 0' }" 
          :border="true"
          v-loading="loading"
        >
          <el-table-column prop="caseName" label="工况名称" min-width="180" sortable>
            <template #default="scope">
              <span class="case-name">{{ scope.row.caseName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250">
            <template #default="scope">
              <div class="actions-container">
                <el-button 
                  type="primary" 
                  :icon="View"
                  size="small" 
                  @click="showCaseDetails(scope.row.caseName)"
                  class="action-button"
                >
                  查看详情
                </el-button>
                <el-popconfirm 
                  :title="`确定要删除工况 '${scope.row.caseName}' 吗？`" 
                  @confirm="deleteCase(scope.row.caseName)"
                  confirm-button-type="danger"
                  cancel-button-type="info"
                  :icon="WarningFilled"
                  icon-color="#f56c6c"
                >
                  <template #reference>
                    <el-button 
                      type="danger" 
                      :icon="Delete"
                      size="small" 
                      class="action-button"
                    >
                      删除
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
            </template>
          </el-table-column>
        </el-table>
        
        <div v-if="cases.length === 0 && !loading" class="empty-state">
          <el-icon class="empty-icon"><WindPower /></el-icon>
          <p>暂无工况数据</p>
          <el-button type="primary" @click="router.push('/new')">创建第一个工况</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { Plus, View, Delete, WarningFilled, WindPower } from '@element-plus/icons-vue';

const router = useRouter();
const cases = ref([]);
const loading = ref(false);

const loadCases = async () => {
  loading.value = true;
  try {
    const response = await axios.get('/api/cases');
    cases.value = response.data.cases.map(caseName => ({ caseName }));
  } catch (error) {
    console.error('加载工况列表失败:', error);
    ElMessage.error('加载工况列表失败');
  } finally {
    loading.value = false;
  }
};

const deleteCase = async (caseName) => {
  try {
    const response = await axios.delete(`/api/cases/${caseName}`);
    if (response.data.success) {
      ElMessage({
        message: response.data.message,
        type: 'success',
        duration: 2000
      });
      await loadCases();
    } else {
      ElMessage.error(response.data.message);
    }
  } catch (error) {
    console.error('删除工况失败:', error);
    ElMessage.error('删除工况失败');
  }
};

const showCaseDetails = (caseName) => {
  router.push(`/cases/${caseName}/terrain`);
};

onMounted(loadCases);
</script>

<style scoped>
.page-container {
  font-family: 'Arial', sans-serif;
  min-height: 100vh;
  background: linear-gradient(135deg, #e1e8f0, #f5f8fa);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 20px;
}

.content-wrapper {
  width: 100%;
  max-width: 1000px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h2 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  font-size: 16px;
  margin-bottom: 24px;
}

.actions {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.create-button {
  min-width: 150px;
  padding: 12px 20px;
  font-size: 16px;
  border-radius: 4px;
  transition: all 0.3s;
}

.create-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

.table-card {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.case-name {
  font-weight: 600;
  color: #2980b9;
}

.actions-container {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.action-button {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 20px;
  color: #c0c4cc;
}

.empty-state p {
  font-size: 18px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .page-container {
    padding: 20px 10px;
  }
  
  .actions-container {
    flex-direction: column;
    gap: 8px;
  }
  
  .action-button {
    width: 100%;
  }
}
</style>
