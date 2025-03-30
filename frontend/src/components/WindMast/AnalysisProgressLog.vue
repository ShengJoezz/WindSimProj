<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:08:51
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:08:54
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\AnalysisProgressLog.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <el-card class="progress-log">
      <template #header>
        <div class="log-header">
          <span>分析日志</span>
          <div class="log-controls">
            <el-button type="text" size="small" @click="copyLog">
              <el-icon><document-copy /></el-icon> 复制
            </el-button>
            <el-button type="text" size="small" @click="clearLog">
              <el-icon><delete /></el-icon> 清空
            </el-button>
          </div>
        </div>
      </template>
      <div class="log-content" ref="logContainer">
        <pre v-for="(msg, index) in progressMessages" :key="index"
             class="log-message"
             :class="{ 'log-error': isErrorMessage(msg) }"
             v-html="formatLogMessage(msg)"
        ></pre>
      </div>
    </el-card>
  </template>
  
  <script setup>
  import { ref, watch, nextTick, defineProps } from 'vue';
  import { DocumentCopy, Delete } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import { useWindMastStore } from '@/store/windMastStore';
  
  const props = defineProps({
    progressMessages: Array
  });
  
  const store = useWindMastStore();
  const logContainer = ref(null);
  
  // Auto-scroll to the bottom when new messages arrive
  watch(() => props.progressMessages.length, async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
  
  // Format log messages
  const formatLogMessage = (msg) => {
    // Remove ANSI color codes
    // eslint-disable-next-line no-control-regex
    let formattedMsg = msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    
    // Highlight keywords
    formattedMsg = formattedMsg
      .replace(/error|错误|失败/gi, '<span class="highlight-error">$&</span>')
      .replace(/warning|警告/gi, '<span class="highlight-warning">$&</span>')
      .replace(/success|成功|完成/gi, '<span class="highlight-success">$&</span>');
      
    return formattedMsg;
  };
  
  const isErrorMessage = (msg) => {
    return /error|错误|失败/i.test(msg);
  };
  
  const copyLog = () => {
    if (props.progressMessages.length === 0) {
      ElMessage.warning('日志为空，无内容可复制');
      return;
    }
    
    const logText = props.progressMessages.join('\n');
    navigator.clipboard.writeText(logText)
      .then(() => ElMessage.success('日志已复制到剪贴板'))
      .catch(() => ElMessage.error('复制失败，请手动选择并复制'));
  };
  
  const clearLog = () => {
    if (store.isPending) {
      ElMessage.warning('分析正在进行中，不能清空日志');
      return;
    }
    
    store.clearProgressMessages();
    ElMessage.success('日志已清空');
  };
  </script>
  
  <style scoped>
  .progress-log {
    margin-top: 15px;
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .log-controls {
    display: flex;
    gap: 8px;
  }
  
  .log-content {
    max-height: 300px;
    overflow-y: auto;
    background-color: #f8f9fa;
    border-radius: 4px;
    padding: 8px;
  }
  
  .log-message {
    font-family: monospace;
    font-size: 12px;
    margin: 0 0 4px 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.4;
  }
  
  .log-error {
    color: #f56c6c;
  }
  
  :deep(.highlight-error) {
    color: #f56c6c;
    font-weight: bold;
  }
  
  :deep(.highlight-warning) {
    color: #e6a23c;
    font-weight: bold;
  }
  
  :deep(.highlight-success) {
    color: #67c23a;
    font-weight: bold;
  }
  </style>