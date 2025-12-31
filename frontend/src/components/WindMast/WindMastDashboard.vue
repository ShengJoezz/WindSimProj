<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:23:51
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:23:55
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\WindMastDashboard.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- src/views/WindMast/WindMastDashboard.vue -->
<template>
    <div class="wind-mast-dashboard">
      <el-row :gutter="24">
        <!-- Statistics Cards -->
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="stat-card">
            <div class="stat-icon">
              <el-icon><Files /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalFiles }}</div>
              <div class="stat-label">上传文件数</div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="stat-card">
            <div class="stat-icon">
              <el-icon><DataAnalysis /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalAnalyses }}</div>
              <div class="stat-label">历史分析数</div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="stat-card">
            <div class="stat-icon">
              <el-icon><PieChart /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.completedAnalyses }}</div>
              <div class="stat-label">完成分析</div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="stat-card">
            <div class="stat-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.pendingAnalyses }}</div>
              <div class="stat-label">待处理分析</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- Recent Analyses -->
      <el-card class="recent-analyses">
        <template #header>
          <div class="card-header">
            <span>最近分析</span>
            <el-button type="primary" @click="$router.push('/windmast/results')">
              查看全部
            </el-button>
          </div>
        </template>
        
        <el-table
          v-loading="store.isLoadingAnalyses"
          :data="recentAnalyses"
          style="width: 100%"
          empty-text="暂无分析记录"
        >
          <el-table-column prop="name" label="分析名称" width="220">
            <template #default="scope">
              <el-link 
                type="primary" 
                @click="$router.push(`/windmast/results/${scope.row.id}`)"
              >
                {{ scope.row.name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="180">
            <template #default="scope">
              {{ formatDate(scope.row.createdAt) }}
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
          <el-table-column label="操作">
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
      </el-card>
      
      <!-- Quick Actions -->
      <el-card class="quick-actions">
        <template #header>
          <span>快速操作</span>
        </template>
        
        <div class="actions-container">
          <el-button type="primary" @click="$router.push('/windmast/upload')">
            <el-icon><Upload /></el-icon> 上传文件
          </el-button>
          <el-button type="success" @click="$router.push('/windmast/analysis')">
            <el-icon><DataAnalysis /></el-icon> 开始新分析
          </el-button>
          <el-button type="info" @click="$router.push('/windmast/management')">
            <el-icon><Management /></el-icon> 管理文件
          </el-button>
        </div>
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import { Files, DataAnalysis, PieChart, Warning, Upload, Management } from '@element-plus/icons-vue';
  import { useWindMastStore } from '@/store/windMastStore';
  import { ElMessageBox } from 'element-plus';
  
  const store = useWindMastStore();
  
  onMounted(async () => {
    await Promise.all([
      store.scanInputFolder(),
      store.fetchSavedAnalyses()
    ]);
  });
  
  const stats = computed(() => {
    return {
      totalFiles: store.inputFiles.length,
      totalAnalyses: store.savedAnalyses.length,
      completedAnalyses: store.savedAnalyses.filter(a => a.status === 'completed' || a.status === 'completed_with_warnings').length,
      pendingAnalyses: store.savedAnalyses.filter(a => a.status === 'pending' || a.status === 'running').length
    };
  });
  
  const recentAnalyses = computed(() => {
    return [...store.savedAnalyses]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
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
      case 'completed_with_warnings': return 'warning';
      case 'pending': case 'running': return 'warning';
      case 'failed': return 'danger';
      default: return 'info';
    }
  };
  
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'completed_with_warnings': return '完成(有警告)';
      case 'pending': return '排队中';
      case 'running': return '处理中';
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
  </script>
  
  <style scoped>
  .wind-mast-dashboard {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .el-row {
    margin-bottom: 24px;
  }
  
  .stat-card {
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    height: 120px;
    display: flex;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .stat-icon {
    background-color: #f0f7ff;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20px;
  }
  
  .stat-icon .el-icon {
    font-size: 28px;
    color: #409EFF;
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #303133;
  }
  
  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 5px;
  }
  
  .recent-analyses,
  .quick-actions {
    margin-bottom: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .actions-container {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  
  @media (max-width: 768px) {
    .actions-container {
      flex-direction: column;
    }
    
    .actions-container .el-button {
      width: 100%;
    }
  }
  </style>
