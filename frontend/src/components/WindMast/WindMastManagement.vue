<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:30:37
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-06-19 17:35:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindMast\WindMastManagement.vue
 * @Description: Wind Mast data and analysis management component with fixes (including HTML structure).
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="wind-mast-management">
      <el-tabs v-model="activeTab" type="border-card">
        <!-- Input Files Tab -->
        <el-tab-pane label="输入文件管理" name="input">
          <div class="tab-header">
            <h3>输入文件管理 (仅显示 CSV 文件)</h3>
            <el-button-group>
              <el-button type="primary" @click="refreshInputFiles" :loading="store.isLoadingFiles">
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
                  <p><strong>内部文件名：</strong> {{ props.row.filename }}</p>
                  <p><strong>创建时间：</strong> {{ formatDate(props.row.createdAt) }}</p>
                  <p><strong>修改时间：</strong> {{ formatDate(props.row.modifiedAt) }}</p>
                  <p><strong>大小：</strong> {{ formatFileSize(props.row.size) }}</p>
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
                <el-tooltip content="重命名文件" placement="top">
                  <el-button
                    type="primary"
                    :icon="Edit"
                    size="small"
                    @click="renameFile(scope.row)"
                    circle
                    plain
                  />
                </el-tooltip>
                <el-tooltip content="删除文件" placement="top">
                   <el-button
                    type="danger"
                    :icon="Delete"
                    size="small"
                    @click="deleteFile(scope.row)"
                    circle
                    plain
                  />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- Analysis Results Tab -->
        <el-tab-pane label="分析结果管理" name="results">
          <div class="tab-header">
            <h3>分析结果管理</h3>
            <el-button-group>
              <el-button type="primary" @click="refreshAnalyses" :loading="store.isLoadingAnalyses">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
              <el-button type="success" @click="$router.push('/windmast/analysis')">
                <el-icon><Plus /></el-icon> 新建分析
              </el-button>
              <el-button type="info" @click="$router.push('/windmast/results')">
                <el-icon><View /></el-icon> 最新结果
              </el-button>
            </el-button-group>
          </div>

          <el-table
            v-loading="store.isLoadingAnalyses"
            :data="store.savedAnalyses"
            style="width: 100%"
            empty-text="暂无分析记录 (请尝试刷新或检查后端输出目录)"
            :default-sort="{ prop: 'createdAt', order: 'descending' }"
          >
             <el-table-column type="expand">
              <template #default="props">
                <div class="analysis-details">
                  <p><strong>分析ID:</strong> {{ props.row.id }}</p>
                  <p><strong>分析名称:</strong> {{ props.row.name }}</p>
                  <p><strong>创建时间:</strong> {{ formatDate(props.row.createdAt) }}</p>
                  <p><strong>状态:</strong> {{ getStatusText(props.row.status) }}</p>
                  <p><strong>包含文件数:</strong> {{ props.row.files?.length || 0 }}</p>
                  <p><strong>描述:</strong> {{ props.row.description || '无' }}</p>
                   <!-- Corrected HTML structure below: Changed <p> to <div> -->
                   <div v-if="props.row.files && props.row.files.length > 0">
                      <strong>涉及文件:</strong>
                      <ul>
                          <li v-for="file in props.row.files.slice(0, 5)" :key="file">{{ file }}</li>
                          <li v-if="props.row.files.length > 5">...等 {{ props.row.files.length }} 个文件</li>
                      </ul>
                   </div>
                   <!-- End Corrected HTML structure -->
                </div>
              </template>
            </el-table-column>

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
                  effect="light"
                >
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="files" label="文件数" width="100" align="center">
              <template #default="scope">
                {{ scope.row.files?.length || 0 }}
              </template>
            </el-table-column>

            <el-table-column label="操作" width="180" align="center">
              <template #default="scope">
                <el-tooltip content="查看结果详情" placement="top">
                    <el-button
                        v-if="scope.row.status === 'completed'"
                        type="primary"
                        :icon="View"
                        size="small"
                        @click="$router.push(`/windmast/results/${scope.row.id}`)"
                        circle
                    />
                </el-tooltip>
                <el-tooltip content="编辑分析信息" placement="top">
                    <el-button
                        type="info"
                        :icon="Edit"
                        size="small"
                        @click="editAnalysisInfo(scope.row)"
                        circle
                        plain
                    />
                 </el-tooltip>
                 <el-tooltip content="删除分析记录" placement="top">
                    <el-button
                        type="danger"
                        :icon="Delete"
                        size="small"
                        @click="deleteAnalysis(scope.row.id)"
                        circle
                        plain
                    />
                 </el-tooltip>
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
	             <el-alert
	                title="提示：存储统计来自后端扫描"
	                type="info"
	                show-icon
	                :closable="false"
	                style="margin-bottom: 20px;"
	              >
	                统计结果会随文件数量增长而略有延迟；如需最新数据可点击“刷新”。
	              </el-alert>

              <el-alert
                v-if="storageStatsWarning"
                :title="storageStatsWarning"
                type="warning"
                show-icon
                :closable="false"
                style="margin-bottom: 20px;"
              />
	            <el-row :gutter="24">
	              <el-col :xs="24" :sm="12" :md="8" :lg="8">
	                <el-card class="stat-card">
	                  <div class="stat-icon input-icon">
                    <el-icon><FolderOpened /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.inputSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">输入文件总大小 ({{ storageStats.inputFiles }}个文件)</div>
                  </div>
                </el-card>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8" :lg="8">
                <el-card class="stat-card">
                  <div class="stat-icon output-icon">
                    <el-icon><DataAnalysis /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.outputSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">输出文件总大小 ({{ storageStats.outputFiles }}个分析)</div>
                  </div>
                </el-card>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8" :lg="8">
                <el-card class="stat-card">
                  <div class="stat-icon total-icon">
                    <el-icon><Coin /></el-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ (storageStats.totalSize / (1024 * 1024)).toFixed(2) }} MB</div>
                    <div class="stat-label">存储总占用 (估算)</div>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <div class="storage-chart-container">
              <h4>存储空间分布 (估算)</h4>
              <div id="storageChart" ref="storageChartRef" class="storage-chart"></div>
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
        append-to-body
      >
        <el-form :model="renameForm" label-width="80px" ref="renameFormRef">
          <el-form-item label="当前名称">
            <el-input v-model="renameForm.currentName" disabled></el-input>
          </el-form-item>
          <el-form-item
             label="新名称"
             prop="newName"
             :rules="[{ required: true, message: '请输入新的文件名', trigger: 'blur' }]"
           >
            <el-input
              v-model="renameForm.newName"
              placeholder="输入新的文件名 (不含路径, 含扩展名)"
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
        append-to-body
      >
        <el-form :model="editAnalysisForm" label-width="80px" ref="editAnalysisFormRef">
          <el-form-item label="分析ID">
            <el-input v-model="editAnalysisForm.id" disabled></el-input>
          </el-form-item>
          <el-form-item
             label="分析名称"
             prop="name"
             :rules="[{ required: true, message: '请输入分析名称', trigger: 'blur' }]"
            >
            <el-input
              v-model="editAnalysisForm.name"
              placeholder="输入分析名称"
              clearable
            ></el-input>
          </el-form-item>
          <el-form-item label="分析描述" prop="description">
            <el-input
              v-model="editAnalysisForm.description"
              type="textarea"
              placeholder="输入分析描述 (选填)"
              rows="3"
              maxlength="200"
              show-word-limit
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
import { ref, onMounted, watch, onUnmounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
// Use named imports for ECharts components
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
// Use named imports for Element Plus icons
import {
  Refresh, Upload, View, Edit, Delete, Plus, FolderOpened, DataAnalysis, Coin
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useWindMastStore } from '@/store/windMastStore';
import axios from 'axios';

// Register ECharts components
echarts.use([PieChart, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const store = useWindMastStore();
const router = useRouter();
const activeTab = ref('input');
const renameDialogVisible = ref(false);
const editAnalysisDialogVisible = ref(false);
const isRenaming = ref(false);
	const isEditingAnalysis = ref(false);
	const isLoadingStats = ref(true);
  const storageStatsWarning = ref('');
	const storageStats = ref({
	  inputSize: 0,
	  outputSize: 0,
	  totalSize: 0,
	  inputFiles: 0,
  outputFiles: 0
});

const storageChartRef = ref(null); // Ref for the chart DOM element
let storageChartInstance = null; // To hold the ECharts instance

const renameFormRef = ref(null); // Ref for rename form validation
const editAnalysisFormRef = ref(null); // Ref for edit analysis form validation

const renameForm = ref({
  currentName: '',
  newName: '',
  filename: '' // Internal filename used for API calls
});

const editAnalysisForm = ref({
  id: '',
  name: '',
  description: '',
  originalData: null // Store original data for comparison or backend update
});

// Computed property to filter only CSV files for the input table
const csvInputFiles = computed(() => {
  // Added check for store.inputFiles being an array and file.originalName being string
  if (!Array.isArray(store.inputFiles)) return [];
  return store.inputFiles.filter(file =>
    file.originalName && typeof file.originalName === 'string' && file.originalName.toLowerCase().endsWith('.csv')
  );
});

onMounted(async () => {
  // Fetch data concurrently
  refreshInputFiles();
  refreshAnalyses();
  // Wait for DOM and potentially for data fetches if stats depend heavily on them
  await nextTick();
  refreshStats(); // Initial stats load
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (storageChartInstance) {
    storageChartInstance.dispose();
    storageChartInstance = null;
  }
  window.removeEventListener('resize', handleResize);
});

// Watch the active tab to refresh stats and potentially redraw chart
watch(activeTab, async (newVal) => {
  if (newVal === 'stats') {
    await refreshStats(); // Refresh data first
    await nextTick(); // Wait for DOM update if skeleton was shown
    initStorageChart(); // Re-initialize or update chart
  }
});

// Watch for changes in stats data to update the chart
 watch(storageStats, async () => { // Removed 'newStats' as it's not needed directly
   if (activeTab.value === 'stats' && storageChartRef.value) {
     await nextTick(); // Ensure DOM is ready
     initStorageChart();
   }
 }, { deep: true });


const handleResize = () => {
    if (storageChartInstance && activeTab.value === 'stats') {
         try { // Add try-catch for potential resize errors
             storageChartInstance.resize();
         } catch(e) {
             console.error("Error resizing chart:", e);
         }
    }
}

const refreshInputFiles = async () => {
  await store.scanInputFolder();
};

const refreshAnalyses = async () => {
  await store.fetchSavedAnalyses();
};

const refreshStats = async () => {
  isLoadingStats.value = true;
  storageStatsWarning.value = '';
  try {
    const response = await axios.get('/api/windmast/stats');
    if (response.data?.success && response.data?.stats) {
      storageStats.value = response.data.stats;
      storageStatsWarning.value = response.data?.warning || '';
    } else {
      throw new Error(response.data?.message || '获取统计信息失败');
    }

  } catch (error) {
    console.error('加载存储统计失败:', error);
    const apiMessage = error?.response?.data?.message;
    ElMessage.error(apiMessage ? `加载存储统计失败: ${apiMessage}` : '加载存储统计信息时出错');
    // Reset stats on error
     storageStats.value = { inputSize: 0, outputSize: 0, totalSize: 0, inputFiles: 0, outputFiles: 0 };
  } finally {
    isLoadingStats.value = false;
  }
};

const initStorageChart = () => {
  // Check if the chart element is available and the tab is active
  if (!storageChartRef.value || activeTab.value !== 'stats') {
    // console.log("Chart init skipped: Not on stats tab or element not ready.");
    return;
  }
  // Dispose existing instance if it exists
  if (storageChartInstance) {
      storageChartInstance.dispose();
  }

  try { // Add try-catch around chart initialization
      // Initialize ECharts instance
      storageChartInstance = echarts.init(storageChartRef.value);

      const inputMB = (storageStats.value.inputSize / (1024 * 1024));
      const outputMB = (storageStats.value.outputSize / (1024 * 1024));

      // Prepare chart data, ensuring values are numbers and filtering zero values
      const chartDataRaw = [
          { value: parseFloat(inputMB.toFixed(2)), name: '输入文件', itemStyle: { color: '#5470c6' } },
          { value: parseFloat(outputMB.toFixed(2)), name: '输出文件', itemStyle: { color: '#91cc75' } }
      ];

      const chartData = chartDataRaw.filter(item => !isNaN(item.value) && item.value > 0);

      // Handle case where both values are zero or invalid
      if (chartData.length === 0) {
          chartData.push({ value: 0, name: '无数据', itemStyle: { color: '#ccc' } });
      }

      const option = {
        // title option removed as h4 tag is used above chart
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} MB ({d}%)'
        },
        legend: {
          orient: 'horizontal',
          bottom: '5%',
          left: 'center',
          data: chartData.map(d => d.name), // Dynamically generate legend data
          itemGap: 20
        },
        series: [
          {
            name: '存储空间',
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'], // Ensure centered
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 8,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: { // Show label in center on hover
                show: true,
                fontSize: 18,
                fontWeight: 'bold',
                formatter: '{b}\n{c} MB ({d}%)' // Show name, value, and percentage
              }
            },
            labelLine: {
              show: false
            },
            data: chartData // Use the filtered data
          }
        ]
      };

      storageChartInstance.setOption(option);

  } catch(e) {
       console.error("Error initializing chart:", e);
       ElMessage.error('图表加载失败');
       // Clean up failed instance
       if (storageChartInstance) {
           storageChartInstance.dispose();
           storageChartInstance = null;
       }
  }
};


const formatFileSize = (sizeInBytes) => {
  // Keep this function as previously corrected
  if (sizeInBytes == null || isNaN(sizeInBytes) || sizeInBytes < 0) return 'N/A';
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  if (sizeInBytes < 1024 * 1024 * 1024) return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};


const formatDate = (dateString) => {
   // Keep this function as previously corrected
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
           if (typeof dateString === 'string' && dateString.length === 14 && /^\d+$/.test(dateString)) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                const hour = dateString.substring(8, 10);
                const minute = dateString.substring(10, 12);
                const second = dateString.substring(12, 14);
                const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`); // Assume UTC if parsed like this
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                }
           }
           return '无效日期';
        }
        // Format valid date using local time zone
        return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '格式错误'; }
};

const getStatusType = (status) => {
  // Keep this function as previously corrected
  switch (status?.toLowerCase()) {
    case 'completed': return 'success';
    case 'completed_with_warnings': return 'warning';
    case 'pending': case 'running': return 'warning';
    case 'failed': case 'error': return 'danger';
    default: return 'info';
  }
};

const getStatusText = (status) => {
  // Keep this function as previously corrected
  switch (status?.toLowerCase()) {
    case 'completed': return '已完成';
    case 'completed_with_warnings': return '完成(有警告)';
    case 'pending': return '排队中';
    case 'running': return '执行中';
    case 'failed': case 'error': return '失败';
    default: return status || '未知';
  }
};

const renameFile = (file) => {
  renameForm.value = {
    currentName: file.originalName,
    newName: file.originalName, // Pre-fill with current name
    filename: file.filename // Use the internal filename for the API call
  };
  renameDialogVisible.value = true;
};

const confirmRename = async () => {
  if (!renameFormRef.value) return;
  try {
      await renameFormRef.value.validate(); // Validate the form first
      isRenaming.value = true;
      // Ensure we are sending the internal filename and the desired new name
      const success = await store.renameInputFile(
          renameForm.value.filename, // Send the internal filename to identify the file
          renameForm.value.newName   // Send the new user-facing name
      );
      if (success) {
          renameDialogVisible.value = false;
          // Success message handled by store action now
      }
  } catch (validationError) {
      console.log('Rename form validation failed (expected if fields are invalid)');
      // No message needed here, validation shows errors in the form UI
  } finally {
      isRenaming.value = false;
  }
};


const deleteFile = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除文件 "${file.originalName}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        draggable: true,
      }
    );
    // Use the internal filename for the delete request
    await store.deleteInputFile(file.filename);
     // Success/error message handled by store action
  } catch (error) {
    // Handle cancellation ('cancel') vs. actual error
    if (error !== 'cancel') {
      console.error('删除文件时出错:', error);
      // Error message is shown in the store action
    }
  }
};

const editAnalysisInfo = (analysis) => {
  editAnalysisForm.value = {
    id: analysis.id,
    name: analysis.name,
    description: analysis.description || '',
    originalData: { ...analysis } // Store a copy of original data
  };
  editAnalysisDialogVisible.value = true;
};

const confirmEditAnalysis = async () => {
  if (!editAnalysisFormRef.value) return;
  try {
      await editAnalysisFormRef.value.validate(); // Validate form
      isEditingAnalysis.value = true;

      const response = await axios.put(`/api/windmast/analyses/${editAnalysisForm.value.id}`, {
        name: editAnalysisForm.value.name,
        description: editAnalysisForm.value.description
      });
      if (response.data.success) {
        ElMessage.success('分析信息已更新');
        editAnalysisDialogVisible.value = false;
        await refreshAnalyses(); // Refresh list from backend
      } else { throw new Error(response.data.message || '更新分析信息失败'); }
  } catch (error) {
      const apiMessage = error?.response?.data?.message;
      if (apiMessage) {
        console.error('更新分析信息失败:', error);
        ElMessage.error(`更新分析信息失败: ${apiMessage}`);
        return;
      }
      if (error && error.message) {
        console.error('更新分析信息时出错:', error);
        ElMessage.error(`更新分析信息失败: ${error.message}`);
        return;
      }
      // Validation errors handled by form UI
  } finally {
      isEditingAnalysis.value = false;
  }
};


const deleteAnalysis = async (analysisId) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分析记录 (ID: ${analysisId}) 及其所有关联的输出文件吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        draggable: true,
      }
    );
    const success = await store.deleteAnalysis(analysisId);
    if (success) {
      await refreshStats(); // Update stats after deletion
    }
     // Success/error message handled by store action
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除分析时出错:', error);
      // Error message shown in store action
    }
  }
};
</script>

<style scoped>
/* Styles from previous answer - kept for consistency */
.wind-mast-management { max-width: 1400px; margin: 20px auto; padding: 15px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1); }
.el-tabs--border-card { border: none; box-shadow: none; }
.el-tabs--border-card > .el-tabs__content { padding: 20px; }
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e4e7ed; }
.tab-header h3 { margin: 0; font-size: 1.3rem; color: #303133; font-weight: 500; }
.el-button .el-icon { margin-right: 5px; }
.el-button--circle { margin: 0 4px; }
.el-table { border-radius: 4px; border: 1px solid #ebeef5; }
.el-table th { background-color: #f8f9fa; color: #606266; font-weight: 500; }
.file-details, .analysis-details { padding: 16px; background-color: #f9fafc; border-radius: 4px; border: 1px solid #eef0f3; margin: 5px 10px; }
/* Applied styles to p and div within details */
.file-details p, .analysis-details p, .analysis-details div { margin: 8px 0; font-size: 13px; color: #555; line-height: 1.5; }
.file-details strong, .analysis-details strong { color: #333; margin-right: 5px; font-weight: 600; }
.analysis-details ul { padding-left: 20px; margin: 5px 0 5px 0; } /* Adjusted margin for ul */
.analysis-details li { list-style-type: disc; font-size: 12px; color: #777; margin-bottom: 3px; }
.stat-card { padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); height: 120px; display: flex; align-items: center; margin-bottom: 24px; border: none; transition: transform 0.2s ease-in-out; }
.stat-card:hover { transform: translateY(-3px); }
.stat-icon { border-radius: 50%; width: 55px; height: 55px; display: flex; align-items: center; justify-content: center; margin-right: 18px; }
.input-icon { background-color: #eef6ff; color: #409EFF; }
.output-icon { background-color: #f0f9eb; color: #67c23a; }
.total-icon { background-color: #fdf6ec; color: #e6a23c; }
.stat-icon .el-icon { font-size: 26px; }
.stat-content { display: flex; flex-direction: column; }
.stat-value { font-size: 26px; font-weight: 600; color: #303133; line-height: 1.2; }
.stat-label { font-size: 13px; color: #777; margin-top: 6px; line-height: 1.4; }
.storage-chart-container { margin-top: 30px; padding: 20px; border: 1px solid #ebeef5; border-radius: 6px; background-color: #fff; }
.storage-chart-container h4 { text-align: center; margin-bottom: 20px; font-weight: 500; color: #303133; }
.storage-chart { height: 380px; width: 100%; min-width: 300px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 12px; padding-top: 10px; }
@media (max-width: 992px) { .stat-card { height: auto; min-height: 110px; } .stat-value { font-size: 24px; } .stat-label { font-size: 12px; } }
@media (max-width: 768px) { .tab-header { flex-direction: column; align-items: stretch; gap: 15px; } .tab-header .el-button-group { width: 100%; display: flex; } .tab-header .el-button-group .el-button { flex-grow: 1; } .el-table-column[label="操作"] { width: 150px; } .stat-card { flex-direction: column; align-items: center; text-align: center; padding: 20px 15px; } .stat-icon { margin-right: 0; margin-bottom: 10px; } .storage-chart { height: 300px; } }
</style>
