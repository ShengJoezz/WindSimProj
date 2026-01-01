<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 20:02:33
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-22 18:02:56
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\CalculationOutput.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="calculation-output-container">
    <div class="calculation-header">
      <h2>计算输出</h2>
      <el-button
        type="primary"
        @click="startComputation"
        :disabled="buttonDisabled"
        class="start-button"
      >
        <template v-if="getCalculationStatus() === 'running'">
          <el-icon class="rotating-icon"><Loading /></el-icon> 计算中...
        </template>
        <span v-else-if="getCalculationStatus() === 'completed'">
          <el-icon><Check /></el-icon> 计算完成
        </span>
        <span v-else>
          <el-icon><VideoPlay /></el-icon> 开始计算
        </span>
      </el-button>
    </div>

    <el-alert
      v-if="initError"
      type="error"
      show-icon
      :closable="false"
      class="calculation-warning"
    >
      <template #title>初始化失败</template>
      <template #default>
        {{ initError }}
        <el-button type="primary" link @click="retryLoad">重试</el-button>
      </template>
    </el-alert>

    <el-alert
      v-else-if="hasLoadedCase && !store.infoExists"
      type="warning"
      show-icon
      :closable="false"
      class="calculation-warning"
    >
      <template #title>尚未生成计算配置（info.json）</template>
      <template #default>
        请先在“参数设置”页面提交参数并生成 <code>info.json</code>，否则无法开始计算。
        <el-button type="primary" link @click="goToParameters">去参数设置</el-button>
      </template>
    </el-alert>

    <div v-if="getCalculationStatus() === 'completed'" class="calculation-complete-message">
      <el-alert title="计算已完成。无需重新计算。" type="success" show-icon :closable="false" />
    </div>

    <div class="flex-layout" v-if="shouldShowDetails">
      <div class="main-content">
        <div class="task-list-section">
          <h3><el-icon class="section-title-icon"><List /></el-icon> 执行步骤</h3>
          <div class="task-list-container">
            <ul class="task-list">
              <li
                v-for="task in tasksList"
                :key="task.id"
                class="task-item"
                :class="{
                  'task-completed': task.status === 'completed',
                  'task-error': task.status === 'error',
                  'task-running': task.status === 'running',
                  'task-pending': task.status === 'pending'
                }"
              >
                <div class="task-icon">
                  <el-icon :color="getIconColor(task.status)">
                    <component :is="getIconComponent(task.status)" :class="{'rotating-icon': task.status === 'running'}" />
                  </el-icon>
                </div>
                <span class="task-name">{{ task.name }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="terminal-section">
          <h3><el-icon class="section-title-icon"><Cpu /></el-icon> 终端输出</h3>
          <div class="terminal-container">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
              </div>
              <div class="terminal-title">OpenFOAM 输出</div>
            </div>
            <div class="terminal-content" ref="terminalContent">
              <pre class="output-content">{{ terminalOutput }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div class="progress-section">
        <h3><el-icon class="section-title-icon"><TrendCharts /></el-icon> 计算进度</h3>
        <el-progress
          :percentage="overallProgress"
          :status="progressStatus()"
          :stroke-width="12"
          :text-inside="true"
          striped
          :striped-flow="getCalculationStatus() === 'running'"
          class="enhanced-progress"
        >
          <template #format>
            <span class="progress-text">{{ overallProgress }}%</span>
          </template>
        </el-progress>
      </div>

      <div v-if="computationMessage" :class="['message-display', messageClass()]">
        <el-icon class="message-icon" :class="{ 'rotating-icon': getCalculationStatus() === 'running' }">
          <component :is="messageIconComponent()" />
        </el-icon>
        {{ computationMessage }}
      </div>

      <div class="actions">
        <el-button
          v-if="getCalculationStatus() === 'completed'"
          type="success"
          @click="viewResults"
          class="action-button success-btn"
        >
          <el-icon><Histogram /></el-icon> 查看结果
        </el-button>
        <el-button
          v-if="getCalculationStatus() === 'running'"
          type="danger"
          :loading="isCanceling"
          @click="cancelComputation"
          class="action-button danger-btn"
        >
          <el-icon><CircleClose /></el-icon> 取消计算
        </el-button>
        <el-button
          v-else
          type="warning"
          @click="resetComputation"
          class="action-button warning-btn"
        >
          <el-icon><RefreshRight /></el-icon> 重置
        </el-button>
      </div>
    </div>

    <div v-if="!shouldShowDetails" class="empty-state">
      <div class="empty-state-icon">
        <el-icon class="empty-state-wind"><WindPower /></el-icon>
      </div>
      <div class="empty-state-text">
        点击"开始计算"按钮启动风场模拟计算过程
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Loading,
  Check,
  Close,
  VideoPlay,
  List,
  Cpu,
  TrendCharts,
  Histogram,
  CircleClose,
  RefreshRight,
  WindPower,
  InfoFilled,
  CircleCheckFilled,
  WarningFilled,
} from '@element-plus/icons-vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { useCaseStore } from '../store/caseStore';
import { knownTasks } from '../utils/tasks';

const route = useRoute();
const router = useRouter();
const store = useCaseStore();
const caseId = computed(() => route.params.caseId);
const hasLoadedCase = ref(false);
const initError = ref('');

const getCalculationStatus = () => {
  if (store && typeof store.calculationStatus !== 'undefined') {
    return store.calculationStatus;
  }
  return 'not_started';
};

const buttonDisabled = computed(() => {
  if (!hasLoadedCase.value) return true;
  if (initError.value) return true;
  const status = getCalculationStatus();
  return status === 'running' || status === 'completed';
});

const computationMessage = computed(() => {
  const status = getCalculationStatus();
  const lastTaskId = store.calculationProgressMeta?.lastTaskId;
  const lastTaskName = lastTaskId ? (knownTasks.find(t => t.id === lastTaskId)?.name || lastTaskId) : '';
  const isTimeout = Boolean(store.calculationProgressMeta?.timeout);
  if (status === 'running') return '计算已启动，正在进行中...';
  if (status === 'completed') return '计算完成';
  if (status === 'error') {
    const prefix = isTimeout ? '计算超时并被终止' : '计算失败';
    return lastTaskName ? `${prefix}（最后步骤：${lastTaskName}），请查看日志` : `${prefix}，请查看日志`;
  }
  if (status === 'canceled') {
    return lastTaskName ? `上次计算已取消（最后步骤：${lastTaskName}），可重新开始` : '上次计算已取消，可重新开始';
  }
  return '';
});

const overallProgress = computed(() => store.overallProgress || 0);

const baseLog = ref('');
const terminalContent = ref(null);
const isCanceling = ref(false);

const tasksList = computed(() => {
  const statusMap = store.tasks || {};
  return knownTasks.map(task => ({
    id: task.id,
    name: task.name,
    status: statusMap[task.id] || 'pending'
  }));
});

// 改进的自动滚动函数
const scrollToBottom = () => {
  nextTick(() => {
    if (terminalContent.value) {
      terminalContent.value.scrollTop = terminalContent.value.scrollHeight;
    }
  });
};

const getIconComponent = (status) => {
  if (status === 'completed') return Check;
  if (status === 'error') return Close;
  if (status === 'running') return Loading;
  return 'span';
};

const getIconColor = (status) => {
  if (status === 'completed') return '#67C23A';
  if (status === 'error') return '#F56C6C';
  if (status === 'running') return '#409EFF';
  return '#909399';
};

const progressStatus = () => {
  const status = getCalculationStatus();
  if (status === 'error') return 'exception';
  if (status === 'canceled') return 'warning';
  if (status === 'completed' || overallProgress.value === 100) return 'success';
  return '';
};

const messageClass = () => {
  const status = getCalculationStatus();
  if (status === 'running')
    return 'info-message';
  if (status === 'completed')
    return 'success-message';
  if (status === 'error')
    return 'error-message';
  if (status === 'canceled')
    return 'warning-message';
  return '';
};

const messageIconComponent = () => {
  const status = getCalculationStatus();
  if (status === 'running') return Loading;
  if (status === 'completed') return CircleCheckFilled;
  if (status === 'error') return WarningFilled;
  if (status === 'canceled') return WarningFilled;
  return InfoFilled;
};

const terminalOutput = computed(() => {
  const outputs = Array.isArray(store.calculationOutputs) ? store.calculationOutputs : [];
  const appended = outputs
    .map(o => {
      const msg = o?.message ?? '';
      if (!msg) return '';
      return msg.endsWith('\n') ? msg : `${msg}\n`;
    })
    .join('');
  if (baseLog.value && appended) return `${baseLog.value}\n${appended}`;
  return baseLog.value || appended || '';
});

const shouldShowDetails = computed(() => {
  const status = getCalculationStatus();
  if (['running', 'completed', 'error', 'canceled'].includes(status)) return true;
  if ((store.overallProgress || 0) > 0) return true;
  if (Array.isArray(store.calculationOutputs) && store.calculationOutputs.length > 0) return true;
  if (baseLog.value && baseLog.value.trim()) return true;
  return false;
});

const loadBaseLog = async (id) => {
  baseLog.value = '';
  if (!id) return;
  try {
    const resp = await axios.get(`/api/cases/${id}/calculation-log`);
    if (typeof resp.data === 'string' && resp.data.trim()) baseLog.value = resp.data;
  } catch (error) {
    console.error("加载终端输出失败:", error);
  }
};

const loadForCaseId = async (id) => {
  hasLoadedCase.value = false;
  initError.value = '';
  baseLog.value = '';
  try {
    if (id && (store.caseId !== id || store.currentCaseId !== id)) {
      await store.initializeCase(id);
    }
    await store.loadCalculationProgress();
    await loadBaseLog(id);
    scrollToBottom();
  } catch (error) {
    console.error("初始化计算组件失败:", error);
    initError.value = error?.message || '初始化失败，请检查网络或刷新页面。';
  } finally {
    hasLoadedCase.value = true;
  }
};

onMounted(async () => {
  await loadForCaseId(caseId.value);
});

watch(
  () => caseId.value,
  async (newId, oldId) => {
    if (!newId || newId === oldId) return;
    await loadForCaseId(newId);
  }
);

watch(
  () => (Array.isArray(store.calculationOutputs) ? store.calculationOutputs.length : 0),
  () => {
    scrollToBottom();
  }
);

const startComputation = async () => {
  const status = getCalculationStatus();
  if (status === 'running' || status === 'completed') {
    ElMessage.warning("计算正在进行中或已完成，不允许重复点击");
    return;
  }

  try {
    if (initError.value) {
      ElMessage.error('页面初始化失败，请先点击“重试”。');
      return;
    }
    if (!store.infoExists) {
      ElMessage.warning('请先在“参数设置”页面生成 info.json 后再开始计算。');
      goToParameters();
      return;
    }
    baseLog.value = '';
    await store.startCalculation();
    ElMessage.success("计算已成功启动");

  } catch (error) {
    console.error("启动计算失败:", error);
    const errorMessage = error?.message || '计算启动失败';
    ElMessage.error(`启动计算失败: ${errorMessage}`);
  }
};

const viewResults = () => {
  router.push({ name: 'ResultsDisplay', params: { caseId: caseId.value } });
};

const resetComputation = async () => {
  try {
    const id = caseId.value;
    if (!id) throw new Error('无效的工况ID');
    await axios.delete(`/api/cases/${id}/calculation-progress`);
    baseLog.value = '';
    store.resetCalculationProgress();
    ElMessage.success("计算已重置");
  } catch (error) {
    console.error("重置计算失败:", error);
    ElMessage.error(`重置计算失败: ${error.response?.data?.message || error.message}`);
  }
};

const cancelComputation = async () => {
  let id = null;
  try {
    id = caseId.value;
    if (!id) throw new Error('无效的工况ID');
    await ElMessageBox.confirm(
      '确定要取消当前计算吗？取消后可以重新开始计算。',
      '取消确认',
      { confirmButtonText: '取消计算', cancelButtonText: '继续运行', type: 'warning' }
    );
    isCanceling.value = true;
    const response = await axios.post(`/api/cases/${id}/cancel`);
    if (!response.data?.success) {
      throw new Error(response.data?.message || '取消计算失败');
    }
    ElMessage.success(response.data.message || '已请求取消，正在终止计算进程...');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(`取消计算失败: ${error.response?.data?.message || error.message}`);
  } finally {
    isCanceling.value = false;
  }
};

const goToParameters = () => {
  if (!caseId.value) return;
  router.push({ name: 'ParameterSettings', params: { caseId: caseId.value } });
};

const retryLoad = async () => {
  await loadForCaseId(caseId.value);
};
</script>

<style scoped>
.calculation-output-container {
  padding: 1.2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calculation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 0.8rem;
  flex-shrink: 0;
}

.calculation-warning {
  margin-bottom: 1rem;
}

h2 {
  color: #2c3e50;
  margin: 0;
  font-weight: 600;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
}

h2::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 16px;
  background: linear-gradient(to bottom, #409eff, #67c23a);
  margin-right: 8px;
  border-radius: 2px;
}

h3 {
  color: #606266;
  font-size: 1rem;
  margin: 0 0 0.8rem 0;
  font-weight: 500;
  display: flex;
  align-items: center;
}

h3 i {
  margin-right: 0.5rem;
  color: #409eff;
  font-size: 0.9rem;
}

.flex-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  gap: 1rem;
}

.main-content {
  display: flex;
  gap: 1rem;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.task-list-section {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  background-color: #f9fafc;
  border-radius: 6px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.task-list-container {
  flex: 1;
  overflow: hidden;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.task-list {
  padding: 0;
  margin: 0;
  list-style: none;
  height: 100%;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid #f5f5f5;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.task-item:hover {
  background-color: #f8f9fa;
}

.task-item:last-child {
  border-bottom: none;
}

.task-completed {
  background: linear-gradient(135deg, #f0fff4 0%, #e8f5e8 100%);
  border-left: 3px solid #67c23a;
}

.task-error {
  background: linear-gradient(135deg, #fff0f0 0%, #f5e8e8 100%);
  border-left: 3px solid #f56c6c;
}

.task-running {
  background: linear-gradient(135deg, #f0f8ff 0%, #e8f4ff 100%);
  border-left: 3px solid #409eff;
  font-weight: 500;
}

.task-pending {
  background-color: #fafafa;
  opacity: 0.7;
}

.task-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-name {
  margin-left: 0.8rem;
  flex-grow: 1;
}

.terminal-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.terminal-header {
  display: flex;
  align-items: center;
  background-color: #343a40;
  padding: 0.5rem 0.8rem;
  flex-shrink: 0;
}

.terminal-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.red { background-color: #ff6058; }
.yellow { background-color: #ffbd2e; }
.green { background-color: #27c93f; }

.terminal-title {
  color: #fff;
  font-size: 0.75rem;
  margin-left: auto;
  opacity: 0.8;
}

.terminal-content {
  flex: 1;
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  overflow-y: auto;
  overflow-x: hidden;
}

.output-content {
  font-family: 'Fira Code', 'Consolas', 'Courier New', monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  padding: 1rem;
  color: #e8e8e8;
  line-height: 1.5;
  font-size: 0.85rem;
  min-height: 100%;
}

.progress-section {
  background-color: #f9fafc;
  border-radius: 6px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.enhanced-progress {
  width: 100%;
  margin: 0.5rem 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-text {
  font-weight: 600;
  font-size: 0.8rem;
}

.start-button {
  height: 36px;
  border-radius: 18px;
  font-weight: 500;
  min-width: 120px;
  background: linear-gradient(to right, #409eff, #36d1dc);
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: white;
  transition: all 0.3s ease;
}

.start-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(64, 158, 255, 0.3);
}

.calculation-complete-message {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.rotating-icon {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.message-display {
  padding: 0.8rem;
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: center;
  margin: 0.5rem 0;
  border: 1px solid;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.section-title-icon {
  margin-right: 8px;
  vertical-align: -2px;
}

.message-icon {
  margin-right: 8px;
  vertical-align: -2px;
}

.success-message {
  background: linear-gradient(135deg, #f0fff4 0%, #e8f5e8 100%);
  color: #52c41a;
  border-color: #b7eb8f;
}

.error-message {
  background: linear-gradient(135deg, #fff0f0 0%, #f5e8e8 100%);
  color: #ff4d4f;
  border-color: #ffaaa7;
}

.info-message {
  background: linear-gradient(135deg, #f6f7f9 0%, #e8eaed 100%);
  color: #595959;
  border-color: #d9d9d9;
}

.warning-message {
  background: linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%);
  color: #d48806;
  border-color: #ffd591;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
  flex-shrink: 0;
}

.action-button {
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.success-btn {
  background: linear-gradient(to right, #67c23a, #95d475);
  color: white;
}

.warning-btn {
  background: linear-gradient(to right, #e6a23c, #f8c36d);
  color: white;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #909399;
  background-color: #f9fafc;
  border-radius: 6px;
  flex: 1;
}

.empty-state-icon {
  margin-bottom: 1rem;
  color: #c0c4cc;
}

.empty-state-wind {
  font-size: 48px;
}

.empty-state-text {
  font-size: 0.95rem;
  text-align: center;
  max-width: 280px;
}

/* 响应式优化 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    gap: 0.8rem;
  }
  
  .task-list-section {
    flex: 0 0 200px;
  }
  
  .terminal-section {
    flex: 1;
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .calculation-output-container {
    height: calc(100vh - 80px);
    padding: 1rem;
  }
  
  .calculation-header {
    flex-direction: column;
    gap: 0.8rem;
    align-items: stretch;
  }
  
  .main-content {
    gap: 0.5rem;
  }
  
  .task-list-section {
    flex: 0 0 160px;
  }
  
  .terminal-section {
    min-height: 250px;
  }
  
  .task-item {
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
  }
  
  .actions {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .action-button {
    width: 100%;
  }
  
  .start-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .calculation-output-container {
    padding: 0.8rem;
  }
  
  h2 {
    font-size: 1.2rem;
  }
  
  .task-list-section {
    flex: 0 0 140px;
  }
  
  .terminal-section {
    min-height: 200px;
  }
  
  .output-content {
    font-size: 0.8rem;
    padding: 0.8rem;
  }
}
</style>
