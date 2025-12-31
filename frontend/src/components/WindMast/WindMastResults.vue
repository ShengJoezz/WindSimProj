<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:26:23
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-03 18:17:41
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\WindMastResults.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- src/views/WindMast/WindMastResults.vue -->
<template>
    <div class="wind-mast-results">
      <el-card class="results-card">
        <template #header>
          <div class="card-header">
            <span>测风塔数据分析结果</span>
            <el-button-group>
              <el-button type="primary" @click="refreshAnalyses">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
              <el-button type="success" @click="$router.push('/windmast/analysis')">
                <el-icon><Plus /></el-icon> 新建分析
              </el-button>
            </el-button-group>
          </div>
        </template>
        
        <!-- Results Filter -->
        <div class="filter-container">
          <el-input
            v-model="searchQuery"
            placeholder="搜索分析名称"
            prefix-icon="Search"
            clearable
            style="width: 300px"
          ></el-input>
          
          <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px">
            <el-option label="全部" value=""></el-option>
            <el-option label="已完成" value="completed"></el-option>
            <el-option label="处理中" value="pending"></el-option>
            <el-option label="失败" value="failed"></el-option>
          </el-select>
          
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :clearable="true"
          ></el-date-picker>
        </div>
        
        <!-- Results Table -->
        <el-table
          v-loading="store.isLoadingAnalyses"
          :data="paginatedAnalyses"
          style="width: 100%"
          empty-text="暂无分析记录"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
        >
          <!-- 展开列：查看本次分析所用文件 -->
          <el-table-column type="expand">
            <template #default="scope">
              <div class="analysis-detail-expand">
                <p>
                  <strong>分析描述：</strong>{{ scope.row.description || '无' }}
                </p>
                <p>
                  <strong>文件数：</strong>{{ scope.row.files?.length || 0 }}
                </p>
                <div v-if="scope.row.files?.length">
                  <p><strong>文件列表：</strong></p>
                  <ul class="analysis-file-list">
                    <li
                      v-for="(file, idx) in scope.row.files"
                      :key="idx"
                    >
                      {{ file }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="name" label="分析名称" min-width="200" sortable>
            <template #default="scope">
              <!-- 调试信息 -->
              <div style="font-size: 12px; color: #999; margin-bottom: 4px;" v-if="false">
                状态: {{ scope.row.status }} | ID: {{ scope.row.id }}
              </div>
              
              <el-link 
                type="primary" 
                @click="handleResultClick(scope.row)"
                :disabled="!canViewResult(scope.row)"
              >
                {{ scope.row.name }}
              </el-link>
            </template>
          </el-table-column>
          
          <el-table-column prop="createdAt" label="创建时间" width="180" sortable>
            <template #default="scope">
              {{ formatDate(scope.row.createdAt) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="completedAt" label="完成时间" width="180" sortable>
            <template #default="scope">
              {{ scope.row.completedAt ? formatDate(scope.row.completedAt) : '-' }}
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="120">
            <template #default="scope">
              <el-tag 
                :type="getStatusType(scope.row.status)" 
                size="small"
              >
                {{ getStatusText(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="files" label="文件数" width="100">
            <template #default="scope">
              {{ scope.row.files?.length || 0 }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button 
                v-if="scope.row.status === 'completed'"
                type="primary" 
                size="small" 
                @click="$router.push(`/windmast/results/${scope.row.id}`)"
              >
                查看结果
              </el-button>
              
              <el-button 
                v-if="scope.row.status === 'pending'"
                type="warning" 
                size="small" 
                disabled
              >
                处理中
              </el-button>
              
              <el-button 
                type="danger" 
                size="small" 
                @click="deleteAnalysis(scope.row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="filteredAnalyses.length"
          />
        </div>
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Refresh, Plus, Search } from '@element-plus/icons-vue';
  import { ElMessageBox, ElMessage } from 'element-plus';
  import { useWindMastStore } from '@/store/windMastStore';
  import axios from 'axios';
  const store = useWindMastStore();
  const router = useRouter();
  const searchQuery = ref('');
  const statusFilter = ref('');
  const dateRange = ref([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  
  onMounted(() => {
    refreshAnalyses();
  });
  
  const refreshAnalyses = async () => {
  console.log('手动刷新分析列表 - 强制扫描目录');
  
  // 先尝试强制扫描
  try {
    const scanResponse = await axios.get('/api/windmast/analyses/scan');
    if (scanResponse.data.success) {
      store.savedAnalyses = scanResponse.data.analyses || [];
      console.log(`强制扫描获取到 ${store.savedAnalyses.length} 条记录`);
      ElMessage.success(`刷新完成，找到 ${store.savedAnalyses.length} 条分析记录`);
      return;
    }
  } catch (scanError) {
    console.error('强制扫描失败:', scanError);
  }
  
  // 扫描失败则回退到普通刷新
  await store.fetchSavedAnalyses();
};

onMounted(async () => {
  console.log('WindMastResults 页面加载，当前分析数量:', store.savedAnalyses.length);
  await refreshAnalyses();
  console.log('刷新后分析数量:', store.savedAnalyses.length);
});

// 在 WindMastResults.vue 中添加临时调试信息
onMounted(async () => {
  console.log('WindMastResults 页面加载，当前分析数量:', store.savedAnalyses.length);
  await refreshAnalyses();
  console.log('刷新后分析数量:', store.savedAnalyses.length);
});
  
  const filteredAnalyses = computed(() => {
    let result = [...store.savedAnalyses];
    
    // Apply search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter((analysis) => {
        const nameMatch = (analysis.name || '').toLowerCase().includes(query);
        const files = Array.isArray(analysis.files) ? analysis.files : [];
        const filesMatch = files.some((f) =>
          (f || '').toLowerCase().includes(query)
        );
        return nameMatch || filesMatch;
      });
    }
    
    // Apply status filter
    if (statusFilter.value) {
      result = result.filter(analysis => analysis.status === statusFilter.value);
    }
    
    // Apply date range filter
    if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
      const startDate = new Date(dateRange.value[0]);
      const endDate = new Date(dateRange.value[1]);
      endDate.setHours(23, 59, 59, 999); // End of the day
      
      result = result.filter(analysis => {
        const analysisDate = new Date(analysis.createdAt);
        return analysisDate >= startDate && analysisDate <= endDate;
      });
    }
    
    return result;
  });
  
  const paginatedAnalyses = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredAnalyses.value.slice(start, end);
  });
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getStatusType = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'info';
    }
  };
  
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'pending': return '处理中';
      case 'failed': return '失败';
      default: return '未知';
    }
  };
  
  const deleteAnalysis = async (analysisId) => {
    try {
      await ElMessageBox.confirm(
        '确定要删除此分析记录吗？此操作不可恢复。',
        '删除确认',
        {
          confirmButtonText: '确认删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
      
      await store.deleteAnalysis(analysisId);
    } catch (error) {
      if (error !== 'cancel') {
        console.error('删除分析时出错:', error);
      }
    }
  };

  const canViewResult = (row) => {
    // 更宽松的条件：只要有ID且状态不是pending就允许查看
    return row.id && row.status && row.status !== 'pending' && row.status !== 'running';
  };

  const handleResultClick = (row) => {
    console.log('点击结果行:', row); // 调试用
    if (canViewResult(row)) {
      router.push(`/windmast/results/${row.id}`);
    } else {
      ElMessage.warning(`分析状态为 ${row.status}，暂时无法查看详细结果`);
    }
  };
  </script>
  
  <style scoped>
  .wind-mast-results {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .results-card {
    margin-bottom: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .filter-container {
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }
  
  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .analysis-detail-expand {
    padding: 10px 20px;
    font-size: 13px;
    line-height: 1.6;
  }

  .analysis-file-list {
    margin: 6px 0 0;
    padding-left: 18px;
    max-height: 150px;
    overflow-y: auto;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
  }
  
  @media (max-width: 768px) {
    .filter-container {
      flex-direction: column;
      align-items: stretch;
    }
    
    .filter-container .el-input,
    .filter-container .el-select,
    .filter-container .el-date-picker {
      width: 100% !important;
    }
  }
  </style>
