<template>
  <div class="calculation-output-container">
  <h2>计算输出</h2>
  <el-button
  type="primary"
  @click="startComputation"
  :disabled="isCalculationCompleted || isCalculating || completed"
  class="start-button"
  >
  <template v-if="isCalculating">
  <el-icon><Loading /></el-icon>
  计算中...
  </template>
  <span v-else-if="isCalculationCompleted">计算完成</span>
  <span v-else>开始计算</span>
  </el-button>
  
  <!-- 计算完成提示 -->
  <div v-if="isCalculationCompleted" class="calculation-complete-message">
  <el-alert
  title="计算已完成。无需重新计算。"
  type="success"
  show-icon
  />
  </div>
  
  <div v-if="isCalculating || completed || isCalculationCompleted" class="task-list-section">
  <h3>执行步骤</h3>
  <ul class="task-list">
  <li
  v-for="task in tasks"
  :key="task.id"
  class="task-item"
  :class="[
  task.status === 'completed' ? 'task-completed' : '',
  task.status === 'error' ? 'task-error' : '',
  task.status === 'running' ? 'task-running' : ''
  ]"
  >
  <el-icon :color="getIconColor(task.status)">
  <component :is="getIconComponent(task.status)" class="icon" />
  </el-icon>
  <span class="task-name">{{ task.name }}</span>
  </li>
  </ul>
  </div>
  
  <div v-if="isCalculating || completed || isCalculationCompleted" class="progress-section">
  <el-progress
  :percentage="overallProgress"
  :status="progressStatus"
  :stroke-width="20"
  :text-inside="true"
  striped
  :striped-flow="isCalculating"
  class="enhanced-progress"
  role="progressbar"
  :aria-valuenow="overallProgress"
  aria-valuemin="0"
  aria-valuemax="100"
  >
  <template #format>
  <span class="progress-text">{{ overallProgress }}%</span>
  </template>
  </el-progress>
  <div class="eta-display" v-if="showEta">
  预计剩余时间: {{ eta }} 秒
  </div>
  </div>
  
  <!-- 统一计算输出框 -->
  <div class="openfoam-output" v-if="isCalculating || completed">
  <h3>CalculationOutput</h3>
  <el-scrollbar ref="outputScrollbar" height="300px">
  <pre class="output-content">{{ openfoamOutput }}</pre>
  </el-scrollbar>
  </div>
  
  <div v-if="computationMessage" :class="messageClass" class="message-display" role="alert">
  {{ computationMessage }}
  </div>
  
  <div class="actions" v-if="isCalculating || completed || isCalculationCompleted">
  <el-button
  v-if="completed"
  type="success"
  @click="viewResults"
  class="view-results-button"
  >
  查看结果
  </el-button>
  <el-button
  v-if="completed"
  type="warning"
  @click="resetComputation"
  class="reset-button"
  >
  重置
  </el-button>
  </div>
  </div>
  </template>
  
  <script setup>
  import { ref, onBeforeUnmount, computed, watch, nextTick, onMounted } from 'vue';
  import { ElMessage, ElAlert, ElTooltip } from 'element-plus';
  import { Loading, Check, Close } from '@element-plus/icons-vue';
  import axios from 'axios';
  import { useRoute, useRouter } from 'vue-router';
  import { useCaseStore } from '../store/caseStore';
  import { io } from 'socket.io-client';
  import { knownTasks } from '../utils/tasks'; // Import the centralized task list
  
  // 引入动态组件方法
  import { defineAsyncComponent } from 'vue';
  
  // 动态导入图标组件
  const components = {
  Check,
  Close,
  Loading,
  // Add other icons if necessary
  };
  
  const calculationOutputScrollbar = ref(null); // Define the ref
  
  const getIconComponent = (status) => {
  switch(status) {
  case 'completed':
  return 'Check';
  case 'error':
  return 'Close';
  case 'running':
  return 'Loading';
  default:
  return 'Loading'; // 使用 Loading 作为默认图标
  }
  };
  
  const getIconColor = (status) => {
  switch(status) {
  case 'completed':
  return '#67C23A'; // Green
  case 'error':
  return '#F56C6C'; // Red
  case 'running':
  return '#409EFF'; // Blue
  default:
  return '#909399'; // Grey
  }
  };
  
  const getTooltipContent = (status) => {
  switch(status) {
  case 'completed':
  return '任务已完成';
  case 'error':
  return '任务出错';
  case 'running':
  return '任务运行中';
  default:
  return '未知状态';
  }
  };
  
  const route = useRoute();
  const router = useRouter();
  const store = useCaseStore();
  const caseId = route.params.caseId;
  
  const isCalculating = ref(false);
  const overallProgress = ref(0);
  const computationMessage = ref('');
  const computationError = ref(false);
  const completed = ref(false);
  const calculationOutputs = ref([]); // Unified output
  const startTime = ref(null);
  const eta = ref(null);
  // const isLogVisible = ref(false); // Remove unused ref
  let socket;
  const openfoamOutput = ref('');
  const outputScrollbar = ref(null);
  
  // 计算是否已完成
  const isCalculationCompleted = computed(() => store.calculationStatus.value === 'completed');
  
  // Use the centralized task list
  const tasks = ref(knownTasks.map(task => ({ ...task, status: 'pending' })));
  
  const progressFormat = () => `${overallProgress.value}%`;
  
  // 修改 progressStatus 计算属性
  const progressStatus = computed(() => {
  if (computationError.value) return 'exception';
  if (overallProgress.value === 100) return 'success';
  return ''; // 不设置 status，使用默认样式
  });
  
  const messageClass = computed(() => {
  if (isCalculating.value) return 'info-message';
  if (completed.value) return 'success-message';
  if (computationError.value) return 'error-message';
  return '';
  });
  
  // Show ETA only after 5% progress
  const showEta = computed(() => {
  return overallProgress.value >= 5 && eta.value !== null;
  });
  
  // 在组件挂载时检查计算状态
  onMounted(async () => {
  console.log("onMounted - route.params:", route.params); // 检查路由参数
  console.log("onMounted - caseId:", caseId);
  await store.fetchCalculationStatus();
  // 加载计算进度
  const savedProgress = await store.loadCalculationProgress();
  if (savedProgress) {
  isCalculating.value = savedProgress.isCalculating || false;
  overallProgress.value = savedProgress.progress || 0;
  tasks.value = savedProgress.tasks || tasks.value;
  calculationOutputs.value = savedProgress.outputs || [];
  // 如果正在计算且没有计算完成，则启动监听
  if (isCalculating.value && store.calculationStatus.value !== 'completed') {
  connectSocket(); // 恢复 socket 连接
  }
  }
  // 加载已有输出
  try {
  const response = await axios.get(`/api/cases/${caseId}/openfoam-output`);
  if (response.data.output) {
  openfoamOutput.value = response.data.output;
  }
  } catch (error) {
  console.error('加载计算输出失败:', error);
  }
  });
  
  // 监听计算状态变化
  watch(() => store.calculationStatus.value, (newStatus) => {
  if (newStatus === 'completed') {
  isCalculationCompleted.value = true;
  completed.value = true;
  isCalculating.value = false;
  // 更新所有任务的状态为已完成
  tasks.value.forEach(task => {
  task.status = 'completed';
  });
  }
  });
  
  const connectSocket = () => {
  socket = io('http://localhost:5000', {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  timeout: 10000,
  });
  socket.on('connect_error', (err) => {
  console.error('Socket连接错误:', err);
  ElMessage.error('实时通信连接失败');
  });
  
  socket.emit("joinCase", caseId);
  console.log("正在发送 joinCase，caseId 为:", caseId); // 检查该值
  socket.on('taskStarted', (taskId) => {
  const task = tasks.value.find(t => t.id === taskId);
  if (task) {
  task.status = 'running';
  calculationOutputs.value.push({ type: 'task', taskName: task.name, message: `${task.name} 启动` });
  }
  });
  
  socket.on('calculationProgress', (data) => {
  overallProgress.value = data.progress;
  computationMessage.value = `计算中... (${data.progress}%)`;
  calculationOutputs.value.push({ type: 'task', taskName: tasks.value.find(t => t.id === data.taskId)?.name || '未知任务', message: `${data.progress}%` });
  updateETA();
  
  // Associate progress with tasks
  if (data.taskId) {
  const task = tasks.value.find(t => t.id === data.taskId);
  if (task) {
  calculationOutputs.value.push({ type: 'task', taskName: task.name, message: `进度: ${data.progress}%` });
  }
  }
  store.saveCalculationProgress(); // 保存进度
  });
  
  socket.on('taskCompleted', (taskId) => {
  const task = tasks.value.find(t => t.id === taskId);
  if (task) {
  task.status = 'completed';
  calculationOutputs.value.push({ type: 'task', taskName: task.name, message: '完成' });
  }
  });
  socket.on('calculationOutput', (output) => {
  openfoamOutput.value += output;
  nextTick(() => {
  const scrollbar = outputScrollbar.value;
  if (scrollbar) {
  scrollbar.setScrollTop(scrollbar.wrap.scrollHeight);
  }
  });
  });
  socket.on('calculationCompleted', (res) => {
  overallProgress.value = 100;
  computationMessage.value = '计算完成';
  isCalculating.value = false;
  completed.value = true;
  store.setResults(res);
  // 标记最后一个任务为完成
  const finalTask = tasks.value.find(t => t.id === 'computation_end');
  if (finalTask && finalTask.status !== 'completed') {
  finalTask.status = 'completed';
  calculationOutputs.value.push({ type: 'task', taskName: finalTask.name, message: '计算完成' });
  }
  ElMessage.success('计算完成');
  socket.disconnect();
  });
  socket.on('calculationError', (err) => {
  computationMessage.value = err.message || '计算过程中出错';
  computationError.value = true;
  isCalculating.value = false;
  calculationOutputs.value.push({ type: 'task', taskName: tasks.value.find(t => t.id === err.taskId)?.name || '未知任务', message: '发生错误' });
  ElMessage.error(computationMessage.value);
  socket.disconnect();
  });
  socket.on('calculationFailed', (err) => {
  computationMessage.value = err.message || '计算失败';
  computationError.value = true;
  isCalculating.value = false;
  calculationOutputs.value.push({ type: 'task', taskName: '计算失败', message: `[失败] ${err.message || '计算失败'}` });
  ElMessage.error(computationMessage.value);
  socket.disconnect();
  });
  };
  
  // 启动计算
  const startComputation = async () => {
  if (isCalculating.value || completed.value || isCalculationCompleted.value) {
  ElMessage.warning('计算已完成或正在进行中');
  return;
  }
  
  try {
  isCalculating.value = true;
  overallProgress.value = 0;
  computationMessage.value = '计算开始...';
  computationError.value = false;
  completed.value = false;
  calculationOutputs.value = [{ type: 'task', taskName: '计算启动', message: '计算启动...' }];
  startTime.value = Date.now();
  eta.value = null;
  
  tasks.value.forEach(task => {
  task.status = 'pending';
  });
  // 保存当前状态
  store.saveCalculationProgress();
  
  // 获取最新计算状态
  await store.fetchCalculationStatus();
  
  if (store.calculationStatus.value === 'completed') {
  throw new Error('该工况的计算已完成，无法重新计算。');
  }
  connectSocket();
  const saveParamsResponse = await axios.post(`/api/cases/${caseId}/parameters`, store.parameters);
  
  if (saveParamsResponse.data.success) {
  ElMessage.success('参数已保存，开始计算');
  
  const runResponse = await axios.post(`/api/cases/${caseId}/calculate`);
  if (!runResponse.data.success) {
  throw new Error(runResponse.data.message || '启动计算失败');
  }
  } else {
  throw new Error(saveParamsResponse.data.message || '参数保存失败');
  }
  } catch (error) {
  isCalculating.value = false;
  computationMessage.value = error.response?.data?.message || error.message || '计算启动失败';
  computationError.value = true;
  calculationOutputs.value.push({ type: 'task', taskName: '启动失败', message: `[启动失败] ${computationMessage.value}` });
  ElMessage.error(computationMessage.value);
  if (socket) socket.disconnect();
  }
  };
  
  const updateETA = () => {
  if (!startTime.value || overallProgress.value === 0) {
  eta.value = null;
  return;
  }
  const elapsed = (Date.now() - startTime.value) / 1000;
  const estimatedTotal = (elapsed / overallProgress.value) * 100;
  const remaining = Math.max(Math.round(estimatedTotal - elapsed), 0);
  eta.value = remaining;
  };
  
  const viewResults = () => {
  router.push({ name: 'ResultsDisplay', params: { caseId } });
  };
  
  const resetComputation = async () => {
  isCalculating.value = false;
  overallProgress.value = 0;
  computationMessage.value = '';
  computationError.value = false;
  completed.value = false;
  calculationOutputs.value = [];
  openfoamOutput.value = '';
  eta.value = null;
  tasks.value.forEach(task => {
  task.status = 'pending';
  });
  
  // 清除 localStorage 保存的计算进度
  localStorage.removeItem(`calculation_${caseId}`);
  try {
  await axios.delete(`/api/cases/${caseId}/calculation-progress`);
  } catch (error) {
  console.error("Failed to clear calculation progress in backend", error);
  }
  
  };
  
  watch(calculationOutputs, () => {
  nextTick(() => {
  if (outputScrollbar.value && outputScrollbar.value.wrap) { // Add a check here
  outputScrollbar.value.setScrollTop(
  outputScrollbar.value.wrap.scrollHeight
  );
  }
  });
  });
  
  onBeforeUnmount(() => {
  if (socket) {
  socket.disconnect();
  }
  });
  </script>
  
  <style scoped>
  .calculation-output-container {
  padding: 20px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  h2 {
  color: #409eff;
  margin-bottom: 20px;
  text-align: center;
  }
  
  .start-button,
  .view-results-button,
  .reset-button {
  width: 150px;
  margin: 10px auto;
  display: block;
  }
  
  /* 计算完成提示 */
  .calculation-complete-message {
  margin-top: 20px;
  }
  
  /* Task List Styling */
  .task-list-section {
  margin-top: 20px;
  }
  
  .task-list {
  list-style: none;
  padding: 0;
  }
  
  .task-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
  transition: background-color 0.3s ease; /* Add transition for smooth effect */
  }
  
  .task-item:last-child {
  border-bottom: none;
  }
  
  .task-name {
  margin-left: 8px;
  flex-grow: 1;
  }
  .icon {
  animation: rotating 2s linear infinite;
  }
  
  @keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
  }
  
  .placeholder-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  }
  
  .task-completed {
  background-color: #f0fff4; /* Light green background */
  }
  
  .task-error {
  background-color: #fff0f0; /* Light red background */
  }
  
  .task-running {
  background-color: #f0f5ff; /* Light blue background */
  border-left: 4px solid #409eff; /* Highlight the running task */
  padding-left: 12px !important;
  font-weight: bold;
  }
  
  .progress-section {
  margin-top: 30px;
  text-align: center;
  }
  
  .enhanced-progress {
  width: 80%;
  margin: 0 auto;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .progress-text {
  font-weight: bold;
  color: #409eff;
  }
  
  .eta-display {
  margin-top: 10px;
  font-size: 14px;
  color: #666;
  }
  
  /* 统一计算输出框样式 */
  .openfoam-output {
  margin-top: 20px;
  padding: 10px;
  background: #1e1e1e;
  border-radius: 4px;
  }
  .output-content {
  font-family: monospace;
  color: #fff;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  padding: 10px;
  }
  
  .message-display {
  margin-top: 20px;
  text-align: center;
  font-size: 16px;
  }
  
  .success-message {
  color: #67c23a;
  }
  
  .error-message {
  color: #f56c6c;
  }
  
  .info-message {
  color: #909399;
  }
  
  .actions {
  margin-top: 20px;
  text-align: center;
  }
  
  /* Media query for smaller screens */
  @media (max-width: 600px) {
  .calculation-output-box {
  max-height: 300px;
  font-size: 0.9em;
  }
  
  .task-item {
  font-size: 0.9em;
  }
  
  .start-button,
  .view-results-button,
  .reset-button {
  width: 100%; /* Full width on small screens */
  min-width: 0;
  }
  }
  </style>