<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:25:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:51:26
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindMast\WindMastAnalysis.vue
 * @Description: Component to configure and trigger Wind Mast data analysis, with fixes.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="wind-mast-analysis">
    <el-card class="analysis-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>执行测风塔数据分析</span>
          <el-button-group>
            <el-button type="primary" @click="refreshFiles" :loading="store.isLoadingFiles">
              <el-icon><Refresh /></el-icon> 刷新文件列表
            </el-button>
            <el-button type="success" @click="$router.push('/windmast/upload')">
              <el-icon><Upload /></el-icon> 上传新文件
            </el-button>
          </el-button-group>
        </div>
      </template>

      <!-- Analysis Configuration Form -->
      <el-form
        ref="analysisFormRef"
        :model="analysisConfig"
        :rules="analysisFormRules"
        label-width="140px"
        :disabled="store.isPending"
        label-position="top"
      >
        <el-row :gutter="20">
            <el-col :span="12">
                <el-form-item label="分析任务名称" prop="analysisName">
                  <el-input
                    v-model="analysisConfig.analysisName"
                    placeholder="例如：场站A 第一季度分析"
                    maxlength="50"
                    show-word-limit
                    clearable
                  ></el-input>
                </el-form-item>
            </el-col>
            <el-col :span="12">
                <!-- Placeholder for maybe another top-level config -->
            </el-col>
        </el-row>

        <el-form-item label="分析描述 (选填)" prop="description">
          <el-input
            v-model="analysisConfig.description"
            type="textarea"
            placeholder="简要描述本次分析的目的或特殊设置"
            maxlength="200"
            show-word-limit
            rows="2"
          ></el-input>
        </el-form-item>

        <el-form-item label="选择要分析的CSV文件" prop="filesToAnalyze">
          <div class="files-selection">
            <div class="files-selection-header">
               <el-input
                  v-model="fileSearchQuery"
                  placeholder="搜索文件名..."
                  :prefix-icon="Search"
                  clearable
                  style="width: 300px; margin-bottom: 10px;"
                ></el-input>
               <el-checkbox
                  v-model="selectAll"
                  @change="handleSelectAllChange"
                  :indeterminate="isIndeterminate"
                  style="margin-left: auto;"
                >
                  全选 ({{ analysisConfig.filesToAnalyze.length }} / {{ filteredInputFiles.length }})
                </el-checkbox>
            </div>

            <el-scrollbar height="250px" class="file-list-scrollbar">
               <el-alert v-if="store.isLoadingFiles" title="正在加载文件列表..." type="info" :closable="false" show-icon />
               <el-empty v-else-if="store.inputFiles.length === 0" description="没有可用的输入文件。请先上传CSV文件。">
                  <el-button type="primary" @click="$router.push('/windmast/upload')">去上传</el-button>
               </el-empty>
               <el-empty v-else-if="filteredInputFiles.length === 0 && store.inputFiles.length > 0" description="未找到匹配的文件" />
               <el-checkbox-group
                  v-else
                  v-model="analysisConfig.filesToAnalyze"
                  @change="handleSelectedChange"
                >
                <el-checkbox
                  v-for="file in filteredInputFiles"
                  :key="file.filename"
                  :label="file.filename"
                  class="file-checkbox-item"
                  border
                >
                  <div class="file-info">
                    <el-icon><Document /></el-icon>
                    <span class="filename" :title="file.originalName">{{ file.originalName }}</span>
                    <span class="filesize">{{ formatFileSize(file.size) }}</span>
                     <span class="filedate"> {{ formatDate(file.createdAt) }}</span>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
            </el-scrollbar>
          </div>
        </el-form-item>

        <!-- Analysis Parameters Section -->
        <el-divider content-position="left">分析参数配置</el-divider>

        <el-form-item label="数据过滤阈值 (异常值剔除)" prop="threshold">
            <el-slider
              v-model="analysisConfig.threshold"
              :min="0"
              :max="100"
              :step="1"
              show-input
              :disabled="!analysisConfig.enableFiltering"
              style="flex-grow: 1; margin-right: 20px;"
            />
           <el-switch
              v-model="analysisConfig.enableFiltering"
              inline-prompt
              style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
              active-text="启用过滤"
              inactive-text="不过滤"
            />
          <div class="form-item-help">
            <el-icon><InfoFilled /></el-icon>
            <span>
              启用后，可设置过滤强度 (0-100)。值越高，过滤越严格，可能移除更多数据点。
              0 表示启用过滤但强度最低，100 表示最严格过滤。推荐值：50-70。
              <strong v-if="!analysisConfig.enableFiltering">当前已禁用数据过滤。</strong>
            </span>
          </div>
        </el-form-item>


        <el-form-item label="高级参数设置" prop="showAdvanced">
           <el-switch v-model="analysisConfig.showAdvanced"></el-switch>
           <span style="margin-left: 10px; font-size: 12px; color: #909399;">(可选，使用默认值或展开配置)</span>
        </el-form-item>

        <el-collapse-transition>
            <div v-show="analysisConfig.showAdvanced" class="advanced-options">
               <el-row :gutter="20">
                   <el-col :span="12">
                       <el-form-item label="处理方法" prop="method">
                         <el-tooltip content="选择后端处理数据的算法模式" placement="top">
                             <el-select v-model="analysisConfig.method" placeholder="选择数据处理方法">
                               <el-option label="标准处理 (推荐)" value="standard"></el-option>
                               <el-option label="高精度模式 (较慢)" value="high_precision"></el-option>
                               <el-option label="快速模式 (精度较低)" value="fast"></el-option>
                             </el-select>
                         </el-tooltip>
                       </el-form-item>
                   </el-col>
                   <el-col :span="12">
                       <!-- Placeholder for another advanced option -->
                   </el-col>
               </el-row>

              <el-form-item label="要生成的图表类型" prop="chartTypes">
                <el-checkbox-group v-model="analysisConfig.chartTypes">
                  <el-checkbox label="wind_rose" border>风玫瑰图</el-checkbox>
                  <el-checkbox label="wind_frequency" border>风速频率</el-checkbox>
                  <el-checkbox label="wind_energy" border>风能分布</el-checkbox>
                  <el-checkbox label="stability_distribution" border>稳定度分布</el-checkbox>
                  <!-- Add more chart types if backend supports -->
                  <!-- <el-checkbox label="diurnal_pattern" border>日变化模式</el-checkbox> -->
                  <!-- <el-checkbox label="time_series" border>时间序列</el-checkbox> -->
                  <!-- <el-checkbox label="correlation" border>相关性分析</el-checkbox> -->
                </el-checkbox-group>
              </el-form-item>
            </div>
        </el-collapse-transition>
      </el-form>

      <div class="form-actions">
        <el-button
          type="primary"
          @click="startAnalysis"
          :loading="store.isPending"
          :disabled="!canStartAnalysis"
          size="large"
        >
          <el-icon><CaretRight /></el-icon> 开始分析
        </el-button>
         <el-button
          v-if="store.isPending || store.isError"
          type="warning"
          @click="resetAnalysis"
          :disabled="store.isIdle"
          size="large" plain
        >
          <el-icon><RefreshLeft /></el-icon>
           {{ store.isPending ? '取消/重置' : '重置状态' }}
        </el-button>
      </div>
    </el-card>

    <!-- Analysis Progress -->
    <el-card
      v-if="store.analysisStatus !== 'idle'"
      class="progress-card"
      shadow="never"
    >
      <template #header>
        <div class="card-header">
          <span>分析进度 (任务ID: {{ store.currentAnalysisId || 'N/A' }})</span>
          <el-tag :type="statusTagType" size="large" effect="dark">{{ analysisStatusText }}</el-tag>
        </div>
      </template>

      <el-steps v-if="store.isPending" :active="1" finish-status="success" align-center style="margin-bottom: 20px;">
         <el-step title="任务提交"></el-step>
         <el-step title="数据处理中"></el-step>
         <el-step title="生成报告"></el-step>
       </el-steps>

       <el-progress
           v-if="store.isPending"
           :percentage="50"
           :indeterminate="true"
           :stroke-width="10"
           status="primary"
           striped
           striped-flow
           :duration="10"
           style="margin-bottom: 20px;"
       >
           <span>处理中，请稍候...</span>
       </el-progress>


      <div class="log-container" ref="logContainerRef">
        <pre
          v-for="(msg, index) in store.progressMessages"
          :key="index"
          class="log-message"
          :class="{ 'log-error': isErrorMessage(msg), 'log-success': isSuccessMessage(msg) }"
          v-html="formatLogMessage(msg)"
        ></pre>
        <div v-if="store.isPending" class="log-loading">
            <el-icon class="is-loading"><Loading /></el-icon> 等待后端消息...
        </div>
      </div>

      <div class="progress-actions">
         <el-alert
           v-if="store.isError"
           title="分析失败"
           type="error"
           :description="store.errorMessage || '未知错误，请检查日志或联系管理员。'"
           show-icon
           style="margin-bottom: 15px;"
          />
        <el-button
          v-if="store.isSuccess && store.currentAnalysisId"
          type="success"
          size="large"
          @click="viewResults"
        >
          <el-icon><View /></el-icon> 查看分析结果
        </el-button>

        <el-button
          v-if="store.isError"
          type="warning"
          size="large"
          @click="resetAnalysis"
        >
           <el-icon><RefreshLeft /></el-icon> 确认并重置
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import axios from 'axios';
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Refresh, Upload, Document, CaretRight, Search, InfoFilled, Loading, View, RefreshLeft
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useWindMastStore } from '@/store/windMastStore';
import io from 'socket.io-client'; // Import socket.io client

const store = useWindMastStore();
const router = useRouter();
const logContainerRef = ref(null);
const analysisFormRef = ref(null); // Ref for the form

// Analysis configuration reactive object
const analysisConfig = ref({
  analysisName: `测风分析-${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second:'2-digit' }).replace(/[\/:]/g, '').replace(' ', '_')}`,
  description: '',
  filesToAnalyze: [], // Holds selected internal filenames
  enableFiltering: true, // Filtering enabled by default
  threshold: 60, // Default threshold if filtering is enabled
  showAdvanced: false,
  method: 'standard',
  chartTypes: ['wind_rose', 'wind_frequency', 'wind_energy', 'stability_distribution'] // Default charts
});

// Form validation rules
const analysisFormRules = {
  analysisName: [
    { required: true, message: '请输入分析任务的名称', trigger: 'blur' }
  ],
  filesToAnalyze: [
    { required: true, type: 'array', min: 1, message: '请至少选择一个文件进行分析', trigger: 'change' }
  ],
   chartTypes: [
    { required: true, type: 'array', min: 1, message: '请至少选择一种图表类型', trigger: 'change' }
  ]
  // Add more rules if needed for other fields like method, threshold etc.
};

// File selection management
const selectAll = ref(false);
const isIndeterminate = ref(false);
const fileSearchQuery = ref('');

// WebSocket and Polling state
let socket = null;
let statusCheckInterval = null;
const POLLING_INTERVAL = 5000; // Check status every 5 seconds

// --- Lifecycle Hooks ---

onMounted(async () => {
  console.log("WindMastAnalysis Mounted");
  await refreshFiles(); // Load files initially
  setupWebSocket();

  // If navigating back to this page and an analysis was running, start checking its status
  if (store.isPending && store.currentAnalysisId) {
    console.log(`检测到正在进行的分析 (ID: ${store.currentAnalysisId}), 开始状态轮询`);
    startStatusChecking();
  } else if (store.analysisStatus !== 'idle' && store.currentAnalysisId) {
    // If page loaded and status is success/error but logs might be missing, fetch results/logs again?
    // Or just trust the existing state? For now, trust existing state.
     console.log(`页面加载时检测到已完成/失败的分析 (ID: ${store.currentAnalysisId}, Status: ${store.analysisStatus})`);
  } else {
      // Reset state if navigating here fresh or after non-pending analysis
      // store.resetState(); // Careful: this might clear intended state if navigating back/forth
      console.log("页面加载时无进行中分析，状态:", store.analysisStatus);
  }
});

onUnmounted(() => {
  console.log("WindMastAnalysis Unmounted");
  cleanupWebSocket();
  stopStatusChecking();
});

// --- WebSocket Handling ---

const setupWebSocket = () => {
  // Connect to the server (adjust URL if needed)
  // Ensure this matches your server configuration
  socket = io({ path: '/socket.io' }); // Use default path or specify if different

  socket.on('connect', () => {
      console.log('WebSocket 连接成功! ID:', socket.id);
      // Optionally join a room specific to this user/session if needed
  });

  socket.on('disconnect', (reason) => {
      console.warn('WebSocket 连接断开:', reason);
      // Optionally try to reconnect or notify user
  });

  socket.on('connect_error', (error) => {
      console.error('WebSocket 连接错误:', error);
      // Handle connection errors (e.g., server down)
      ElMessage.error('无法连接到实时更新服务，请稍后重试。');
  });

  // Listen for analysis progress updates
  socket.on('windmast_progress', (data) => {
      console.log('收到进度消息:', data);
      if (store.currentAnalysisId && data.analysisId === store.currentAnalysisId) {
          store.addProgressMessage(data.message);
      }
  });

  // Listen for analysis completion event (Success or Failure)
  // Ensure this listener is only added once or cleaned up properly
  socket.off('windmast_analysis_complete'); // Remove previous listener first
  socket.on('windmast_analysis_complete', (result) => {
      console.log('收到分析完成事件:', result);
      // Only process if it matches the current analysis ID
      if (store.currentAnalysisId === result.analysisId) {
          console.log(`完成事件匹配当前分析ID (${store.currentAnalysisId})`);
          stopStatusChecking(); // Stop polling once we get a definitive WebSocket message
          if (result.success) {
              store.setAnalysisStatus('success', '分析完成');
              store.addProgressMessage('=> 分析成功完成！');
              ElMessage.success('分析任务已成功完成!');
              // Optionally fetch results immediately after success notification
               store.fetchResults(store.currentAnalysisId);
          } else {
              const errorMessage = result.message || '分析过程中发生未知错误';
              const errorDetails = result.error || '';
              store.setAnalysisStatus('error', errorMessage, errorDetails);
              store.addProgressMessage(`=> 分析失败: ${errorMessage} ${errorDetails}`);
              ElMessage.error(`分析任务失败: ${errorMessage}`);
          }
      } else {
          console.log(`完成事件 (ID: ${result.analysisId}) 与当前分析 (ID: ${store.currentAnalysisId}) 不匹配，忽略`);
           // Optional: Update the status of the completed analysis in the background list?
           store.fetchSavedAnalyses(); // Refresh the list in management view
      }
  });
};

const cleanupWebSocket = () => {
  if (socket) {
    console.log("清理 WebSocket 连接...");
    socket.off('windmast_progress');
    socket.off('windmast_analysis_complete');
    socket.disconnect();
    socket = null;
  }
};

// --- Status Polling Handling ---

const startStatusChecking = () => {
  stopStatusChecking(); // Ensure no duplicate intervals
  if (!store.currentAnalysisId) return; // Don't start if no ID

  console.log(`启动分析状态轮询 (ID: ${store.currentAnalysisId}), 间隔: ${POLLING_INTERVAL}ms`);

  statusCheckInterval = setInterval(async () => {
    if (store.isPending && store.currentAnalysisId) {
      try {
        console.log(`轮询检查状态 (ID: ${store.currentAnalysisId})...`);
        const response = await axios.get(`/api/windmast/analyses/${store.currentAnalysisId}/status`);

        if (response.data.success) {
          const status = response.data.status;
          console.log(`轮询状态结果: ${status}`);

          if (status === 'completed') {
             console.log("轮询检测到 'completed' 状态");
             ElMessage.success('分析任务已完成 (通过轮询检测)!');
             stopStatusChecking();
             // Update store status *only if* it's still pending (WebSocket might have beaten polling)
             if (store.isPending) {
                 store.setAnalysisStatus('success', '分析完成');
                 store.addProgressMessage('=> 分析成功完成 (轮询检测)！');
                 await store.fetchResults(store.currentAnalysisId); // Fetch results
             }
          } else if (status === 'failed') {
             console.log("轮询检测到 'failed' 状态");
             ElMessage.error('分析任务失败 (通过轮询检测)!');
             stopStatusChecking();
             if (store.isPending) {
                 const errorDetails = response.data.error || '轮询检测到失败状态，无详细错误信息。';
                 store.setAnalysisStatus('error', '分析失败', errorDetails);
                 store.addProgressMessage(`=> 分析失败 (轮询检测): ${errorDetails}`);
             }
          } else if (status === 'pending' || status === 'running') {
              // Still pending, continue polling...
              console.log("轮询状态: 仍在进行中...");
          } else {
              // Unexpected status from API
               console.warn(`轮询收到意外状态: ${status}`);
               // Optionally stop polling or handle differently
          }
        } else {
           console.warn('轮询检查状态API调用失败:', response.data.message);
           // Decide if polling should stop after a few failed attempts
        }
      } catch (error) {
        console.error('轮询检查分析状态时出错:', error);
        // Consider stopping polling after several consecutive errors
        // stopStatusChecking();
        // ElMessage.error('检查分析状态时网络错误，停止自动检查。');
      }
    } else {
      // If status is no longer pending, stop polling
      console.log(`状态不再是 'pending' (${store.analysisStatus}), 停止轮询`);
      stopStatusChecking();
    }
  }, POLLING_INTERVAL);
};

const stopStatusChecking = () => {
  if (statusCheckInterval) {
    console.log("停止分析状态轮询");
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
};

 // Watch for changes in analysis status or ID to manage polling
 watch(() => [store.isPending, store.currentAnalysisId], ([pending, id]) => {
   if (pending && id) {
     startStatusChecking();
   } else {
     stopStatusChecking();
   }
 });


// --- File Selection ---

const refreshFiles = async () => {
  const currentSelected = [...analysisConfig.value.filesToAnalyze]; // Store current selection
  await store.scanInputFolder();
  // Restore selection if files still exist
  analysisConfig.value.filesToAnalyze = currentSelected.filter(filename =>
      store.inputFiles.some(file => file.filename === filename)
  );
  updateSelectionState(); // Recalculate selectAll/indeterminate
};

const filteredInputFiles = computed(() => {
  // Ensure store.inputFiles is an array
  const files = Array.isArray(store.inputFiles) ? store.inputFiles : [];
  // Filter only CSV files first
  const csvFiles = files.filter(file => file.originalName && file.originalName.toLowerCase().endsWith('.csv'));
  // Then apply search query
  if (!fileSearchQuery.value) {
    return csvFiles;
  }
  const query = fileSearchQuery.value.toLowerCase();
  return csvFiles.filter(file =>
    file.originalName.toLowerCase().includes(query)
  );
});

const handleSelectAllChange = (val) => {
  analysisConfig.value.filesToAnalyze = val ? filteredInputFiles.value.map(file => file.filename) : [];
  isIndeterminate.value = false;
};

const handleSelectedChange = (value) => {
   updateSelectionState();
};

// Helper to update selectAll and isIndeterminate state
const updateSelectionState = () => {
    const selectedCount = analysisConfig.value.filesToAnalyze.length;
    const availableCount = filteredInputFiles.value.length; // Use filtered count

    selectAll.value = availableCount > 0 && selectedCount === availableCount;
    isIndeterminate.value = selectedCount > 0 && selectedCount < availableCount;
};

// Watch filtered files to update selection state when search changes
 watch(filteredInputFiles, () => {
     updateSelectionState();
 });

 // Watch input files from store to reset selection if files are removed externally
 watch(() => store.inputFiles, (newFiles) => {
      const existingFilenames = new Set(newFiles.map(f => f.filename));
      const currentSelection = analysisConfig.value.filesToAnalyze;
      const validSelection = currentSelection.filter(f => existingFilenames.has(f));

      if (validSelection.length !== currentSelection.length) {
          console.log("Detected changes in input files, updating selection.");
          analysisConfig.value.filesToAnalyze = validSelection;
      }
      updateSelectionState(); // Always update state after input files change
 }, { deep: true });


// --- Auto-scroll Log ---

watch(() => store.progressMessages.length, async () => {
  await nextTick();
  if (logContainerRef.value) {
    logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
  }
});

// --- Computed Properties ---

const canStartAnalysis = computed(() => {
  // Check form validity (requires form ref and rules to be set up)
  // For now, just check files and name, but ideally use form validation
  return analysisConfig.value.filesToAnalyze.length > 0 &&
         analysisConfig.value.analysisName.trim() !== '' &&
         !store.isPending; // Cannot start if already pending
});

const analysisStatusText = computed(() => {
  switch (store.analysisStatus) {
    case 'idle': return '等待配置';
    case 'pending': return '分析执行中';
    case 'success': return '分析成功';
    case 'error': return '分析失败';
    default: return '未知状态';
  }
});

const statusTagType = computed(() => {
  switch (store.analysisStatus) {
    case 'idle': return 'info';
    case 'pending': return 'primary';
    case 'success': return 'success';
    case 'error': return 'danger';
    default: return 'info';
  }
});

// --- Utility Functions ---

const formatFileSize = (sizeInBytes) => {
  if (sizeInBytes == null || isNaN(sizeInBytes)) return 'N/A';
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  if (sizeInBytes < 1024 * 1024 * 1024) return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Improved formatDate function from suggestion
const formatDate = (dateString) => {
    // Use the same robust function as in Management component for consistency
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
           // Basic check for YYYYMMDDHHMMSS format
           if (typeof dateString === 'string' && dateString.length === 14 && /^\d+$/.test(dateString)) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                const hour = dateString.substring(8, 10);
                const minute = dateString.substring(10, 12);
                const second = dateString.substring(12, 14);
                const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                if (!isNaN(parsedDate.getTime())) {
                     return parsedDate.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
                }
           }
           return '无效日期';
        }
        return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '格式错误'; }
};


// Log formatting/highlighting
const formatLogMessage = (msg) => {
  // Remove ANSI color codes (regex covers common cases)
  // eslint-disable-next-line no-control-regex
  let formattedMsg = msg.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');

  // Basic HTML escaping (optional, depends on source of messages)
  // formattedMsg = formattedMsg.replace(/</g, "<").replace(/>/g, ">");

  // Highlight keywords (case-insensitive)
  formattedMsg = formattedMsg.replace(/(\[.*?\])/g, '<span class="log-timestamp">$1</span>'); // Style timestamps
  formattedMsg = formattedMsg.replace(/(error|错误|失败|failed)/gi, '<span class="highlight-error">$&</span>');
  formattedMsg = formattedMsg.replace(/(warning|警告)/gi, '<span class="highlight-warning">$&</span>');
  formattedMsg = formattedMsg.replace(/(success|成功|完成|completed)/gi, '<span class="highlight-success">$&</span>');
  formattedMsg = formattedMsg.replace(/(ID: \S+)/gi, '<span class="log-id">$&</span>'); // Highlight IDs


  return formattedMsg;
};

const isErrorMessage = (msg) => {
  return /(error|错误|失败|failed)/i.test(msg);
};
 const isSuccessMessage = (msg) => {
  return /(success|成功|完成|completed)/i.test(msg);
};

// --- Action Handlers ---

const startAnalysis = async () => {
  if (!analysisFormRef.value) return;

  try {
    // Validate the form
    await analysisFormRef.value.validate();

    // Check again if analysis can start (e.g., not already pending)
    if (!canStartAnalysis.value) {
        ElMessage.warning('无法启动分析，请检查配置或当前状态。');
        return;
    }

    // Prepare config object for the backend
    const backendConfig = {
        analysisName: analysisConfig.value.analysisName,
        description: analysisConfig.value.description,
        filesToAnalyze: analysisConfig.value.filesToAnalyze,
        parameters: { // Nest parameters
            enableFiltering: analysisConfig.value.enableFiltering,
            threshold: analysisConfig.value.enableFiltering ? analysisConfig.value.threshold : 0, // Send 0 if disabled
            method: analysisConfig.value.method,
            chartTypes: analysisConfig.value.chartTypes
        }
        // Add any other necessary parameters for the backend
    };

    console.log("准备启动分析，发送配置:", backendConfig);

    // Call the store action to trigger the analysis
    const analysisId = await store.triggerAnalysis(backendConfig);

    if (analysisId) {
      // Analysis successfully submitted, polling will start via watcher
      console.log(`分析任务 ${analysisId} 已提交`);
    } else {
       // Error message handled within triggerAnalysis action
       console.error("分析任务提交失败");
    }

  } catch (validationError) {
    console.log('分析表单验证失败:', validationError);
    ElMessage.warning('请检查表单配置是否完整且正确。');
  }
};


const viewResults = () => {
  if (store.currentAnalysisId) {
    router.push(`/windmast/results/${store.currentAnalysisId}`);
  } else {
    ElMessage.warning('没有找到当前分析结果的ID');
    // Optionally navigate to the general results page
    // router.push('/windmast/results');
  }
};

const resetAnalysis = () => {
   if (store.isPending && store.currentAnalysisId) {
        ElMessageBox.confirm(
           `分析任务 (ID: ${store.currentAnalysisId}) 可能仍在后台运行，确定要重置界面状态吗？ (这不会停止后台任务)`,
           '确认重置', {
               confirmButtonText: '确定重置',
               cancelButtonText: '取消',
               type: 'warning',
           }
        ).then(() => {
            store.resetState();
            // Optionally clear the form as well
            // analysisFormRef.value?.resetFields();
            // analysisConfig.value.filesToAnalyze = [];
        }).catch(() => {
            // User cancelled
        });
   } else {
       // If not pending, just reset the state directly
       store.resetState();
       // Optionally clear the form
       // analysisFormRef.value?.resetFields();
       // analysisConfig.value.filesToAnalyze = [];
   }
};

</script>

<style scoped>
.wind-mast-analysis {
  max-width: 1200px;
  margin: 20px auto;
  padding: 15px;
}

.analysis-card,
.progress-card {
  margin-bottom: 24px;
  border: 1px solid #e4e7ed; /* Lighter border */
  border-radius: 6px;
   background-color: #fff; /* Ensure background */
}

/* Override default card header padding */
:deep(.el-card__header) {
    padding: 15px 20px;
    border-bottom: 1px solid #e4e7ed; /* Consistent border */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  font-weight: 500;
}
 .card-header .el-tag {
     font-weight: bold;
 }


/* Form styling */
.el-form {
    padding: 10px 0; /* Add some padding around form */
}
:deep(.el-form-item__label) {
    font-weight: 500; /* Make labels slightly bolder */
    margin-bottom: 4px !important; /* Reduce space below label */
    padding: 0 !important; /* Remove default padding */
    line-height: 1.5;
}
.el-form-item {
    margin-bottom: 18px; /* Adjust spacing between items */
}

/* File Selection Box */
.files-selection {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
  background-color: #fdfdfd; /* Slightly off-white */
}

.files-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px; /* Reduced margin */
  flex-wrap: wrap; /* Allow wrapping on small screens */
  gap: 10px;
}

.file-list-scrollbar {
    border: 1px solid #eef0f3;
    border-radius: 4px;
}
/* Style scrollbar content area */
:deep(.el-scrollbar__view) {
    padding: 10px;
}


.file-checkbox-item {
  display: flex; /* Use flex for alignment */
  width: 100%; /* Make checkbox full width */
  margin: 5px 0 !important; /* Override default margin */
  padding: 8px 12px; /* Adjust padding */
  /* border: 1px solid #dcdfe6; */ /* Remove individual border */
  border-radius: 4px;
  transition: background-color 0.2s ease-in-out;
}
 /* Ensure hover effect covers the whole item */
.file-checkbox-item:hover {
  background-color: #f5f7fa;
}

 /* Align checkbox itself */
:deep(.el-checkbox__input) {
   margin-right: 10px; /* Space between checkbox and label */
}
 /* Allow file info to take full width */
:deep(.el-checkbox__label) {
    flex-grow: 1;
    padding-left: 0; /* Remove default padding */
    overflow: hidden; /* Prevent overflow issues */
}


.file-info {
  display: flex;
  align-items: center;
  gap: 10px; /* Increased gap */
  width: 100%;
  font-size: 13px; /* Adjust font size */
}

.file-info .el-icon {
  color: #409EFF;
  font-size: 16px; /* Icon size */
}

.filename {
  flex-grow: 1; /* Take available space */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #303133; /* Darker text */
  cursor: default; /* Indicate it's text */
}

.filesize {
  color: #909399;
  font-size: 0.9em;
  margin-left: auto; /* Push size and date to the right */
  padding-left: 15px; /* Add space before size */
  white-space: nowrap;
}
.filedate {
   color: #aab0b8;
   font-size: 0.85em;
   white-space: nowrap;
}

/* Data Filtering Help Text */
.form-item-help {
  margin-top: 5px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: flex-start; /* Align icon with first line */
  gap: 5px;
  line-height: 1.4;
  width: 100%; /* Ensure it takes full width */
}
.form-item-help .el-icon {
   margin-top: 2px; /* Align icon better */
   flex-shrink: 0; /* Prevent icon shrinking */
}
.form-item-help strong {
    color: #f56c6c;
    font-weight: bold;
}


/* Advanced Options Styling */
.advanced-options {
    padding: 15px;
    background-color: #fafafa;
    border: 1px dashed #e4e7ed;
    border-radius: 4px;
    margin-top: -10px; /* Pull closer to the switch */
    margin-bottom: 20px;
}
.el-collapse-transition-enter-active,
.el-collapse-transition-leave-active {
  transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out, border 0.3s ease-in-out;
  overflow: hidden;
}


/* Form Actions */
.form-actions {
  margin-top: 30px; /* Increased margin */
  display: flex;
  justify-content: center;
  gap: 20px; /* Increased gap */
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

/* Progress Card */
.progress-card {
   border-color: #409eff; /* Highlight border when active */
}

/* Log Container */
.log-container {
  max-height: 350px; /* Increased max height */
  overflow-y: auto;
  background-color: #2d3748; /* Dark background */
  color: #e2e8f0; /* Light text */
  border-radius: 4px;
  padding: 15px; /* Increased padding */
  margin-bottom: 16px;
  font-family: 'Consolas', 'Monaco', monospace; /* Monospaced font */
  font-size: 13px; /* Slightly larger font */
  line-height: 1.6; /* Better readability */
}

.log-message {
  margin: 0 0 2px 0; /* Reduced margin */
  white-space: pre-wrap; /* Wrap long lines */
  word-break: break-all; /* Break long words/paths */
}

 /* Log Highlighting Styles */
:deep(.log-timestamp) {
    color: #90cdf4; /* Light blue for timestamps */
    margin-right: 8px;
}
:deep(.highlight-error), .log-error :deep(.highlight-error) {
  color: #fca5a5; /* Lighter red for dark background */
  font-weight: bold;
  background-color: rgba(239, 68, 68, 0.2); /* Subtle red background */
  padding: 0 2px;
  border-radius: 2px;
}
:deep(.highlight-warning) {
  color: #fcd34d; /* Yellow/Orange */
  font-weight: bold;
}
:deep(.highlight-success), .log-success :deep(.highlight-success) {
  color: #86efac; /* Lighter green */
  font-weight: bold;
   background-color: rgba(34, 197, 94, 0.2); /* Subtle green background */
   padding: 0 2px;
   border-radius: 2px;
}
 :deep(.log-id) {
     color: #a78bfa; /* Purple for IDs */
     font-style: italic;
 }

.log-loading {
    display: flex;
    align-items: center;
    color: #a0aec0; /* Grey text for loading */
    margin-top: 10px;
    font-style: italic;
}
.log-loading .el-icon {
    margin-right: 5px;
    font-size: 14px;
}

.progress-actions {
  display: flex;
  justify-content: center;
  align-items: center; /* Align items vertically */
  gap: 16px;
  margin-top: 20px;
}
</style>