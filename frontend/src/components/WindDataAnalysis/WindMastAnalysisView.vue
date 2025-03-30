<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:07:59
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:12:29
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\WindMastAnalysisView.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="wind-mast-analysis">
      <el-card class="main-card">
        <template #header>
          <div class="header-container">
            <h2 class="title">测风塔数据分析</h2>
            <el-dropdown v-if="scenarios.length > 0" @command="handleScenarioCommand">
              <span class="el-dropdown-link">
                已保存分析 <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="scenario in scenarios" :key="scenario.id" :command="scenario.id">
                    {{ scenario.name }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
  
        <!-- File Upload Section -->
        <file-upload-section 
          :uploaded-file-list="uploadedFileList"
          :uploaded-files-info="uploadedFilesInfo"
          @files-uploaded="handleFilesUploaded"
          @clear-uploads="clearUploads"
        />
  
        <!-- Analysis Controls Section -->
        <analysis-controls 
          :is-pending="store.isPending"
          :disabled="store.isPending || uploadedFilesInfo.length === 0"
          :status-text="analysisStatusText"
          :status-tag-type="statusTagType"
          @start-analysis="startAnalysis"
          @save-scenario="saveCurrentScenario"
        />
        
        <el-alert v-if="store.isError" :title="store.errorMessage" type="error" show-icon :closable="false" class="error-alert"/>
  
        <!-- Analysis Progress Section -->
        <analysis-progress-log 
          v-if="store.isPending || store.progressMessages.length > 0"
          :progress-messages="store.progressMessages"
        />
  
        <!-- Results Display Section -->
        <el-divider v-if="store.hasResults || (store.isSuccess && !store.hasResults)"/>
        
        <results-summary v-if="store.hasResults" :analysis-results="store.analysisResults" />
        
        <results-gallery 
          v-if="store.hasResults" 
          :file-results="store.analysisResults.files"
          v-model:active-names="activeResultNames"
        />
        
        <el-empty v-else-if="store.isSuccess && !store.hasResults" description="分析完成，但未生成有效结果。"></el-empty>
        <el-empty v-else-if="store.isIdle && !store.isPending" description="请上传文件并开始分析"></el-empty>
  
        <!-- Scenario Management Dialog -->
        <scenario-dialog
          v-model:visible="scenarioDialogVisible"
          :is-new="isNewScenario"
          :scenario-name="currentScenarioName"
          @save="confirmSaveScenario"
        />
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { ElMessage } from 'element-plus';
  import { ArrowDown } from '@element-plus/icons-vue';
  import { useWindMastStore } from '@/store/windMastStore';
  import { io } from "socket.io-client";
  
  // Import sub-components
  import FileUploadSection from './FileUploadSection.vue';
  import AnalysisControls from './AnalysisControls.vue';
  import AnalysisProgressLog from './AnalysisProgressLog.vue';
  import ResultsSummary from './ResultsSummary.vue';
  import ResultsGallery from './ResultsGallery.vue';
  import ScenarioDialog from './ScenarioDialog.vue';
  
  const store = useWindMastStore();
  
  // Data
  const uploadedFileList = ref([]);
  const uploadedFilesInfo = ref([]);
  const activeResultNames = ref([]);
  const scenarios = ref([]);
  const scenarioDialogVisible = ref(false);
  const currentScenarioName = ref('');
  const currentScenarioId = ref(null);
  const isNewScenario = ref(true);
  
  // Computed properties
  const analysisStatusText = computed(() => {
    switch (store.analysisStatus) {
      case 'idle': return '未开始';
      case 'pending': return '分析中...';
      case 'success': return '分析完成';
      case 'error': return '分析失败';
      default: return '未知';
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
  
  // Lifecycle hooks
  onMounted(() => {
    store.resetState();
    clearUploads();
    store.fetchResults();
    loadScenarios();
  
    // Socket.IO connection for real-time updates
    const socket = io();
  
    socket.on('connect', () => {
      console.log('Socket connected for WindMast');
    });
  
    socket.on('disconnect', () => {
      console.log('Socket disconnected for WindMast');
    });
  
    socket.on('windmast_analysis_progress', (message) => {
      store.addProgressMessage(message);
    });
  
    socket.on('windmast_analysis_error', (errorMessage) => {
      store.setAnalysisStatus('error', '分析出错', errorMessage);
    });
  
    socket.on('windmast_analysis_complete', (result) => {
      if (result.success) {
        store.setAnalysisStatus('success', '分析完成');
        store.fetchResults();
      } else {
        store.setAnalysisStatus('error', result.message || '分析失败', result.error || '');
      }
    });
  
    onUnmounted(() => {
      socket.off('windmast_analysis_progress');
      socket.off('windmast_analysis_error');
      socket.off('windmast_analysis_complete');
      socket.disconnect();
    });
  });
  
  // Methods
  const handleFilesUploaded = (fileList, fileInfo) => {
    uploadedFileList.value = fileList;
    uploadedFilesInfo.value = fileInfo;
  };
  
  const clearUploads = () => {
    uploadedFileList.value = [];
    uploadedFilesInfo.value = [];
  };
  
  const startAnalysis = () => {
    if (uploadedFilesInfo.value.length === 0) {
      ElMessage.warning('请先上传至少一个 CSV 文件');
      return;
    }
    store.triggerAnalysis(uploadedFilesInfo.value);
  };
  
  // Scenario Management
  const loadScenarios = async () => {
    try {
      // Mock implementation - in a real app, you'd fetch from backend
      scenarios.value = JSON.parse(localStorage.getItem('windmast-scenarios') || '[]');
    } catch (error) {
      console.error('Failed to load scenarios:', error);
      ElMessage.error('加载分析场景失败');
    }
  };
  
  const saveCurrentScenario = () => {
    isNewScenario.value = true;
    currentScenarioName.value = `分析场景 ${new Date().toLocaleString()}`;
    scenarioDialogVisible.value = true;
  };
  
  const confirmSaveScenario = async (name) => {
    try {
      const scenario = {
        id: isNewScenario.value ? Date.now().toString() : currentScenarioId.value,
        name: name,
        files: uploadedFilesInfo.value,
        results: store.analysisResults,
        date: new Date().toISOString()
      };
      
      if (isNewScenario.value) {
        scenarios.value.push(scenario);
      } else {
        const index = scenarios.value.findIndex(s => s.id === scenario.id);
        if (index >= 0) {
          scenarios.value[index] = scenario;
        }
      }
      
      // Save to localStorage (or make API call in real app)
      localStorage.setItem('windmast-scenarios', JSON.stringify(scenarios.value));
      
      ElMessage.success(`场景 "${name}" 已保存`);
      scenarioDialogVisible.value = false;
    } catch (error) {
      console.error('Failed to save scenario:', error);
      ElMessage.error('保存分析场景失败');
    }
  };
  
  const handleScenarioCommand = (scenarioId) => {
    const scenario = scenarios.value.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    if (scenario.files) {
      uploadedFilesInfo.value = scenario.files;
      uploadedFileList.value = scenario.files.map(file => ({
        name: file.originalName,
        status: 'success'
      }));
    }
    
    if (scenario.results) {
      store.setAnalysisStatus('success');
      store.analysisResults = scenario.results;
    }
    
    ElMessage.success(`已加载场景: ${scenario.name}`);
  };
  
  </script>
  
  <style scoped>
  .wind-mast-analysis {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .main-card {
    margin-bottom: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--el-color-primary);
  }
  
  .el-dropdown-link {
    cursor: pointer;
    color: var(--el-color-primary);
    display: flex;
    align-items: center;
  }
  
  .error-alert {
    margin-top: 10px;
  }
  </style>