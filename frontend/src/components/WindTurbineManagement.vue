<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:30:37
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 21:21:44
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindMast\WindMastManagement.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- src/components/WindMast/WindMastManagement.vue -->
<template>
  <div class="wind-mast-management">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- Input Files Tab -->
      <el-tab-pane label="输入文件管理" name="input">
        <div class="tab-header">
          <h3>输入文件管理</h3>
          <el-button-group>
            <el-button type="primary" @click="refreshInputFiles">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
            <el-button type="success" @click="$router.push('/windmast/upload')">
              <el-icon><Upload /></el-icon> 上传文件
            </el-button>
          </el-button-group>
        </div>

        <el-table
          v-loading="store.isLoadingFiles"
          :data="csvInputFiles"
          style="width: 100%"
          empty-text="暂无CSV上传文件"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
        >
          <el-table-column type="expand">
            <template #default="props">
              <div class="file-details">
                <p><strong>文件路径：</strong> {{ props.row.path }}</p>
                <p><strong>原始文件名：</strong> {{ props.row.originalName }}</p>
                <p><strong>创建时间：</strong> {{ formatDate(props.row.createdAt) }}</p>
                <p><strong>修改时间：</strong> {{ formatDate(props.row.modifiedAt) }}</p>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="originalName" label="文件名" sortable min-width="250"></el-table-column>

          <el-table-column prop="size" label="大小" width="120" sortable>
            <template #default="scope">
              {{ formatFileSize(scope.row.size) }}
            </template>
          </el-table-column>

          <el-table-column prop="createdAt" label="上传时间" width="180" sortable>
            <template #default="scope">
              {{ formatDate(scope.row.createdAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button
                type="primary"
                size="small"
                @click="renameFile(scope.row)"
                plain
              >
                重命名
              </el-button>

              <el-button
                type="danger"
                size="small"
                @click="deleteFile(scope.row)"
                plain
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-tab-pane>

        <!-- Analysis Results Tab -->
        <el-tab-pane label="分析结果管理" name="results">
          <div class="tab-header">
            <h3>分析结果管理</h3>
            <el-button-group>
              <el-button type="primary" @click="refreshAnalyses">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
              <el-button type="success" @click="$router.push('/windmast/results')">
                <el-icon><View /></el-icon> 查看结果
              </el-button>
            </el-button-group>
          </div>

          <el-table
            v-loading="store.isLoadingAnalyses"
            :data="store.savedAnalyses"
            style="width: 100%"
            empty-text="暂无分析记录"
            :default-sort="{ prop: 'createdAt', order: 'descending' }"
          >
            <el-table-column prop="name" label="分析名称" min-width="200" sortable></el-table-column>

            <el-table-column prop="createdAt" label="创建时间" width="180" sortable>
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

            <el-table-column label="操作" width="240">
              <template #default="scope">
                <el-button
                  v-if="scope.row.status === 'completed'"
                  type="primary"
                  size="small"
                  @click="$router.push(`/windmast/results/${scope.row.id}`)"
                >
                  查看
                </el-button>

                <el-button
                  type="info"
                  size="small"
                  @click="editAnalysisInfo(scope.row)"
                >
                  编辑信息
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
        </el-tab-pane>

        <!-- Statistics Tab -->
        <el-tab-pane label="存储统计" name="stats">
          <div class="tab-header">
            <h3>存储统计</h3>
            <el-button type="primary" @click="refreshStats">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>

          <el-skeleton :rows="5" animated v-if="isLoadingStats"></el-skeleton>

          <div v-else>
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" :md="8" :lg="8">
                <el-card class="stat-card">
                  <div class="stat-icon">
                    <el-icon><Upload /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.inputSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">输入文件总大小</div>
                  </div>
                </el-card>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8" :lg="8">
                <el-card class="stat-card">
                  <div class="stat-icon">
                    <el-icon><PieChart /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.outputSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">输出文件总大小</div>
                  </div>
                </el-card>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8" :lg="8">
                <el-card class="stat-card">
                  <div class="stat-icon">
                    <el-icon><Stamp /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.totalSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">存储总占用</div>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <div class="storage-chart-container">
              <h4>存储空间分布</h4>
              <div id="storageChart" class="storage-chart"></div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Rename Dialog -->
      <el-dialog
        v-model="renameDialogVisible"
        title="重命名文件"
        width="500px"
        destroy-on-close
      >
        <el-form :model="renameForm" label-width="80px">
          <el-form-item label="当前名称">
            <el-input v-model="renameForm.currentName" disabled></el-input>
          </el-form-item>
          <el-form-item label="新名称">
            <el-input
              v-model="renameForm.newName"
              placeholder="输入新的文件名（不含路径）"
              clearable
            ></el-input>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="renameDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmRename" :loading="isRenaming">
              确认重命名
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- Edit Analysis Dialog -->
      <el-dialog
        v-model="editAnalysisDialogVisible"
        title="编辑分析信息"
        width="500px"
        destroy-on-close
      >
        <el-form :model="editAnalysisForm" label-width="80px">
          <el-form-item label="分析ID">
            <el-input v-model="editAnalysisForm.id" disabled></el-input>
          </el-form-item>
          <el-form-item label="分析名称">
            <el-input
              v-model="editAnalysisForm.name"
              placeholder="输入分析名称"
              clearable
            ></el-input>
          </el-form-item>
          <el-form-item label="分析描述">
            <el-input
              v-model="editAnalysisForm.description"
              type="textarea"
              placeholder="输入分析描述"
              rows="3"
            ></el-input>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="editAnalysisDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmEditAnalysis" :loading="isEditingAnalysis">
              保存信息
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </template>

  <script setup>
  import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import * as echarts from 'echarts';
  import {
    Refresh, Upload, View, PieChart, Stamp
  } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { useWindMastStore } from '@/store/windMastStore';

  const store = useWindMastStore();
  const router = useRouter();
  const activeTab = ref('input');
  const renameDialogVisible = ref(false);
  const editAnalysisDialogVisible = ref(false);
  const isRenaming = ref(false);
  const isEditingAnalysis = ref(false);
  const isLoadingStats = ref(true);
  const storageStats = ref({
    inputSize: 0,
    outputSize: 0,
    totalSize: 0,
    inputFiles: 0,
    outputFiles: 0
  });
  const csvInputFiles = computed(() => store.csvInputFiles);

  let storageChart = null;

  const renameForm = ref({
    currentName: '',
    newName: '',
    filename: ''
  });

  const editAnalysisForm = ref({
    id: '',
    name: '',
    description: '',
    originalData: null
  });

  onMounted(async () => {
    await Promise.all([
      refreshInputFiles(),
      refreshAnalyses()
    ]);
    refreshStats();
  });

  watch(() => activeTab.value, (newVal) => {
    if (newVal === 'stats') {
      refreshStats();
    }
  });

  onUnmounted(() => {
    if (storageChart) {
      storageChart.dispose();
      storageChart = null;
    }
  });

  const refreshInputFiles = async () => {
    await store.scanInputFolder();
  };

  const refreshAnalyses = async () => {
    await store.fetchSavedAnalyses();
  };

  const refreshStats = async () => {
    isLoadingStats.value = true;

    try {
      // In a real application, this would be an API call to get storage statistics
      // For now, we'll calculate based on the data we already have

      let inputSize = 0;
      store.inputFiles.forEach(file => {
        inputSize += file.size;
      });

      // Mock output size for demonstration
      const outputSize = inputSize * 1.5; // Assume output is 1.5x the input size

      storageStats.value = {
        inputSize,
        outputSize,
        totalSize: inputSize + outputSize,
        inputFiles: store.inputFiles.length,
        outputFiles: store.savedAnalyses.length
      };

      // Wait for DOM to update
      setTimeout(() => {
        initStorageChart();
      }, 100);
    } catch (error) {
      console.error('加载存储统计失败:', error);
    } finally {
      isLoadingStats.value = false;
    }
  };

  const initStorageChart = () => {
    const chartDom = document.getElementById('storageChart');
    if (!chartDom) return;

    if (storageChart) {
      storageChart.dispose();
    }

    storageChart = echarts.init(chartDom);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} MB ({d}%)'
      },
      legend: {
        orient: 'horizontal',
        bottom: 'bottom'
      },
      series: [
        {
          name: '存储空间',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            {
              value: (storageStats.value.inputSize / (1024 * 1024)).toFixed(2),
              name: '输入文件'
            },
            {
              value: (storageStats.value.outputSize / (1024 * 1024)).toFixed(2),
              name: '输出文件'
            }
          ]
        }
      ]
    };

    storageChart.setOption(option);

    // Handle resize
    window.addEventListener('resize', () => {
      if (storageChart) {
        storageChart.resize();
      }
    });
  };

  const formatFileSize = (sizeInBytes) => {
    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  const formatDate = (dateString) => {
    // 确保dateString是有效值
    if (!dateString) return '-';

    try {
      const date = new Date(dateString);
      // 检查日期是否有效
      if (isNaN(date.getTime())) return '-';

      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('日期格式化错误:', e);
      return '-';
    }
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

  const renameFile = (file) => {
    renameForm.value = {
      currentName: file.originalName,
      newName: file.originalName,
      filename: file.filename
    };
    renameDialogVisible.value = true;
  };

  const confirmRename = async () => {
    if (!renameForm.value.newName.trim()) {
      ElMessage.warning('请输入有效的文件名');
      return;
    }

    isRenaming.value = true;

    try {
      const success = await store.renameInputFile(
        renameForm.value.filename,
        renameForm.value.newName
      );

      if (success) {
        renameDialogVisible.value = false;
      }
    } finally {
      isRenaming.value = false;
    }
  };

  const deleteFile = async (file) => {
    try {
      await ElMessageBox.confirm(
        `确定要删除文件 "${file.originalName}" 吗？此操作不可恢复。`,
        '删除确认',
        {
          confirmButtonText: '确认删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );

      await store.deleteInputFile(file.filename);
    } catch (error) {
      if (error !== 'cancel') {
        console.error('删除文件时出错:', error);
      }
    }
  };

  const editAnalysisInfo = (analysis) => {
    editAnalysisForm.value = {
      id: analysis.id,
      name: analysis.name,
      description: analysis.description || '',
      originalData: analysis
    };
    editAnalysisDialogVisible.value = true;
  };

  const confirmEditAnalysis = async () => {
    if (!editAnalysisForm.value.name.trim()) {
      ElMessage.warning('请输入有效的分析名称');
      return;
    }

    isEditingAnalysis.value = true;

    try {
      // In a real application, this would be an API call to update the analysis info
      // For now, just implement a mock update in the frontend
      const index = store.savedAnalyses.findIndex(a => a.id === editAnalysisForm.value.id);

      if (index !== -1) {
        // Create a new object to ensure reactivity
        const updatedAnalysis = {
          ...store.savedAnalyses[index],
          name: editAnalysisForm.value.name,
          description: editAnalysisForm.value.description
        };

        // Make a mock API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update in the store (in a real app, the store would be updated via an action)
        store.savedAnalyses[index] = updatedAnalysis;

        ElMessage.success('分析信息已更新');
        editAnalysisDialogVisible.value = false;
      } else {
        ElMessage.error('未找到要更新的分析记录');
      }
    } catch (error) {
      console.error('更新分析信息时出错:', error);
      ElMessage.error('更新分析信息失败');
    } finally {
      isEditingAnalysis.value = false;
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
      refreshStats();
    } catch (error) {
      if (error !== 'cancel') {
        console.error('删除分析时出错:', error);
      }
    }
  };
  </script>

  <style scoped>
  .wind-mast-management {
    max-width: 1400px;
    margin: 0 auto;
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .tab-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #303133;
  }

  .file-details {
    padding: 16px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }

  .file-details p {
    margin: 8px 0;
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

  .storage-chart-container {
    margin-top: 24px;
  }

  .storage-chart {
    height: 400px;
    width: 100%;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  @media (max-width: 768px) {
    .tab-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .stat-card {
      height: auto;
    }
  }
  </style>