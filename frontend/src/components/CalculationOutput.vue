<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 17:27:19
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 17:35:55
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\CalculationOutput.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="calculation-output-container">
    <div class="calculation-header">
      <h2>计算输出</h2>
      <!-- 顶部按钮：仅当状态为 not_started 时可点击 -->
      <el-button
        type="primary"
        @click="startComputation"
        :disabled="buttonDisabled"
        class="start-button"
        :class="{'pulse-button': getCalculationStatus() === 'not_started'}"
      >
        <template v-if="getCalculationStatus() === 'running'">
          <el-icon class="rotating-icon"><Loading /></el-icon> 计算中...
        </template>
        <span v-else-if="getCalculationStatus() === 'completed'">
          <el-icon><Check /></el-icon> 计算完成
        </span>
        <span v-else>
          <el-icon><i class="el-icon-play"></i></el-icon> 开始计算
        </span>
      </el-button>
    </div>

    <!-- 计算完成提示 -->
    <div v-if="getCalculationStatus() === 'completed'" class="calculation-complete-message">
      <el-alert title="计算已完成。无需重新计算。" type="success" show-icon :closable="false" />
    </div>

    <div class="flex-layout" v-if="getCalculationStatus() !== 'not_started'">
      <!-- 任务列表和终端输出并排显示 -->
      <div class="side-by-side-container">
        <!-- 任务列表区域 -->
        <div class="task-list-section">
          <h3><i class="fas fa-tasks"></i> 执行步骤</h3>
          <ul class="task-list">
            <li
              v-for="task in tasks"
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

        <!-- 终端输出区域 - 放在右侧 -->
        <div class="openfoam-output">
          <h3><i class="fas fa-terminal"></i> 终端输出</h3>
          <div class="terminal-header">
            <div class="terminal-dots">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <div class="terminal-title">OpenFOAM 输出</div>
          </div>
          <el-scrollbar ref="outputScrollbar" height="500px" class="terminal-content">
            <pre class="output-content">{{ openfoamOutput }}</pre>
          </el-scrollbar>
        </div>
      </div>

      <!-- 进度条区域 - 放在下方 -->
      <div class="progress-section">
        <h3><i class="fas fa-chart-line"></i> 计算进度</h3>
        <el-progress
          :percentage="overallProgress"
          :status="progressStatus()"
          :stroke-width="15"
          :text-inside="true"
          striped
          :striped-flow="getCalculationStatus() === 'running'"
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
        <div class="eta-display" v-if="showEta()">
          <el-tag type="info" size="small">
            <i class="far fa-clock"></i> 预计剩余时间: {{ eta }} 秒
          </el-tag>
        </div>
      </div>

      <!-- 提示信息和按钮保持不变 -->
      <div v-if="computationMessage" :class="['message-display', messageClass()]" role="alert">
        <i class="fas" :class="messageIconClass()"></i> {{ computationMessage }}
      </div>

      <div class="actions">
        <el-button
          v-if="getCalculationStatus() === 'completed'"
          type="success"
          @click="viewResults"
          class="view-results-button"
        >
          <i class="fas fa-chart-bar"></i> 查看结果
        </el-button>
        <el-button
          type="warning"
          @click="resetComputation"
          class="reset-button"
        >
          <i class="fas fa-redo"></i> 重置
        </el-button>
      </div>
    </div>

    <!-- 未开始计算时的空状态 -->
    <div v-if="getCalculationStatus() === 'not_started'" class="empty-state">
      <div class="empty-state-icon">
        <i class="fas fa-wind fa-3x"></i>
      </div>
      <div class="empty-state-text">
        点击"开始计算"按钮启动风场模拟计算过程
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onBeforeUnmount, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading, Check, Close } from '@element-plus/icons-vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { useCaseStore } from '../store/caseStore';
import { knownTasks } from '../utils/tasks';

const route = useRoute();
const router = useRouter();
const store = useCaseStore();
const caseId = route.params.caseId;

// 使用安全访问方法获取计算状态
const getCalculationStatus = () => {
  if (store && typeof store.calculationStatus !== 'undefined') {
    return store.calculationStatus;
  }
  return 'not_started'; // 默认值
};

// computed 属性：按钮禁用，当状态为 "running" 或 "completed" 时禁用
const buttonDisabled = computed(() => {
  const status = getCalculationStatus();
  return status === 'running' || status === 'completed';
});

// 状态变量
const overallProgress = ref(0);
const eta = ref(null);
const computationMessage = ref('');
const openfoamOutput = ref('');
const outputScrollbar = ref(null);

// 初始化任务列表：按照 knownTasks 顺序，每个任务包含 id、name 以及状态
const tasks = ref(knownTasks.map(task => ({ ...task, status: 'pending' })));

// 辅助函数：返回对应图标组件对象
const getIconComponent = (status) => {
  if (status === 'completed') return Check;
  if (status === 'error') return Close;
  if (status === 'running') return Loading;
  return 'span';  // pending 返回占位 <span>
};

const getIconColor = (status) => {
  if (status === 'completed') return '#67C23A';
  if (status === 'error') return '#F56C6C';
  if (status === 'running') return '#409EFF';
  return '#909399';
};

const progressStatus = () => {
  if (computationMessage.value && computationMessage.value.includes("错误"))
    return 'exception';
  if (overallProgress.value === 100)
    return 'success';
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
  return '';
};

const messageIconClass = () => {
  const status = getCalculationStatus();
  if (status === 'running')
    return 'fa-info-circle';
  if (status === 'completed')
    return 'fa-check-circle';
  if (status === 'error')
    return 'fa-exclamation-circle';
  return 'fa-info-circle';
};

const showEta = () => overallProgress.value >= 5 && eta.value !== null;
const calculateETA = () => {
  if (!store.startTime || overallProgress.value === 0) {
    eta.value = null;
    return;
  }
  const elapsed = (Date.now() - store.startTime) / 1000;
  const estimatedTotal = (elapsed / overallProgress.value) * 100;
  eta.value = Math.max(Math.round(estimatedTotal - elapsed), 0);
};

onMounted(async () => {
  // 确保store初始化完成
  try {
    await store.initializeCase(caseId);
    store.connectSocket(caseId);
    store.listenToSocketEvents();

    // 加载持久化进度
    const savedProgress = await store.loadCalculationProgress();
    if (savedProgress) {
      overallProgress.value = savedProgress.progress || 0;
      if (savedProgress.tasks) {
        tasks.value = knownTasks.map(task => ({
          id: task.id,
          name: task.name,
          status: savedProgress.tasks[task.id] || 'pending'
        }));
      }
      if (savedProgress.outputs) {
        openfoamOutput.value = savedProgress.outputs.join("\n");
      }
      if (savedProgress.completed) {
        if (store && typeof store.calculationStatus !== 'undefined') {
          store.calculationStatus = 'completed';
        }
        overallProgress.value = 100;
      }
    }

    // 加载已有输出
    try {
      const resp = await axios.get(`/api/cases/${caseId}/openfoam-output`);
      if (resp.data.output) {
        openfoamOutput.value = resp.data.output;
      }
    } catch (error) {
      console.error("加载终端输出失败:", error);
    }

    watch(() => overallProgress.value, () => {
      calculateETA();
    });

    // 监听 socket 事件
    if (store.socket) {
      store.socket.on('calculationOutput', (output) => {
        openfoamOutput.value += output + "\n";
        nextTick(() => {
          if (outputScrollbar.value && outputScrollbar.value.wrap) {
            outputScrollbar.value.wrap.scrollTop = outputScrollbar.value.wrap.scrollHeight;
          }
        });
      });

      store.socket.on('taskUpdate', (taskStatuses) => {
        tasks.value = knownTasks.map(task => ({
          id: task.id,
          name: task.name,
          status: taskStatuses[task.id] || 'pending'
        }));
      });

      store.socket.on('calculationProgress', (data) => {
        overallProgress.value = data.progress;
      });

      store.socket.on('calculationCompleted', () => {
        if (store && typeof store.calculationStatus !== 'undefined') {
          store.calculationStatus = 'completed';
        }
        overallProgress.value = 100;
        openfoamOutput.value += "\n计算完成";
        ElMessage.success("计算完成");
      });

      store.socket.on('calculationError', (error) => {
        if (store && typeof store.calculationStatus !== 'undefined') {
          store.calculationStatus = 'error';
        }
        openfoamOutput.value += "\n计算错误: " + (error.message || "未知错误");
        computationMessage.value = error.message || "计算错误";
        ElMessage.error(computationMessage.value);
      });
    }
  } catch (error) {
    console.error("初始化计算组件失败:", error);
    ElMessage.error("初始化计算组件失败");
  }
});

const startComputation = async () => {
  const status = getCalculationStatus();
  if (status === 'running' || status === 'completed') {
    ElMessage.warning("计算正在进行中或已完成，不允许重复点击");
    return;
  }

  try {
    if (store && typeof store.calculationStatus !== 'undefined') {
      store.calculationStatus = 'running';
    }
    overallProgress.value = 0;
    computationMessage.value = '';
    openfoamOutput.value = '';
    tasks.value = knownTasks.map(task => ({ ...task, status: 'pending' }));

    if (store) {
      store.startTime = Date.now();
    }

    eta.value = null;

    if (store && typeof store.saveCalculationProgress === 'function') {
      await store.saveCalculationProgress();
    }

    if (store && typeof store.fetchCalculationStatus === 'function') {
      await store.fetchCalculationStatus();
    }

    const response = await axios.post(`/api/cases/${caseId}/calculate`);
    if (!response.data.success) {
      throw new Error(response.data.message || '启动计算失败');
    }

    ElMessage.success("计算已启动");
  } catch (error) {
    if (store && typeof store.calculationStatus !== 'undefined') {
      store.calculationStatus = 'not_started';
    }
    computationMessage.value = error.response?.data?.message || error.message || '计算启动失败';
    openfoamOutput.value += "\n启动失败: " + computationMessage.value;
    ElMessage.error(computationMessage.value);
  }
};

const viewResults = () => {
  router.push({ name: 'ResultsDisplay', params: { caseId } });
};

const resetComputation = async () => {
  try {
    await axios.delete(`/api/cases/${caseId}/calculation-progress`);

    if (store && typeof store.calculationStatus !== 'undefined') {
      store.calculationStatus = 'not_started';
    }

    overallProgress.value = 0;
    computationMessage.value = '';
    openfoamOutput.value = '';
    eta.value = null;
    tasks.value = knownTasks.map(task => ({ ...task, status: 'pending' }));

    if (store && typeof store.resetCalculationProgress === 'function') {
      store.resetCalculationProgress();
    }

    ElMessage.success("计算已重置");
  } catch (error) {
    ElMessage.error("重置计算失败");
    console.error("重置计算失败:", error);
  }
};

onBeforeUnmount(() => {
  if (store && typeof store.disconnectSocket === 'function') {
    store.disconnectSocket();
  }
});
</script>

<style scoped>
.calculation-output-container {
  padding: 1.5rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.calculation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 0.8rem;
}

h2 {
  color: #2c3e50;
  margin: 0;
  font-weight: 600;
  font-size: 1.5rem;
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
  margin-top: 0;
  margin-bottom: 0.8rem;
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
  gap: 1rem;
  height: 100%;
}

/* 修改相关的样式 */
.side-by-side-container {
  display: flex;
  gap: 1rem;
  height: 600px; /* 大幅度增加 side-by-side-container 的高度 */
  margin-bottom: 1rem;
}

.task-list-section {
  flex: 0.7; /* 执行步骤区域宽度进一步增加到 70% */
  min-width: 0;
  background-color: #f9fafc;
  border-radius: 6px;
  padding: 0.8rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 确保内容超出时不溢出容器 */
}

.task-list {
  flex: 1;
  padding: 0; /* 移除滚动相关属性 */
  margin: 0;
  list-style: none;
  border-radius: 6px;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.openfoam-output {
  flex: 0.3; /* 终端输出区域宽度减少到 30% */
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.terminal-content {
  flex: 1;
}

.progress-section {
  background-color: #f9fafc;
  border-radius: 6px;
  padding: 0.8rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .side-by-side-container {
    flex-direction: column;
    height: auto; /* 响应式布局下高度自动 */
  }

  .task-list-section,
  .openfoam-output {
    flex: none;
    height: auto; /* 移动端高度也自动，根据内容调整 */
  }

  .task-list {
    max-height: 200px; /* 移动端任务列表可以考虑加回最大高度和滚动 */
    overflow-y: auto;
  }
}

.start-button {
  height: 36px;
  border-radius: 18px;
  font-weight: 500;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to right, #409eff, #36d1dc);
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.start-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(64, 158, 255, 0.3);
}

.calculation-complete-message {
  margin-bottom: 1rem;
}


.task-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.8rem;
  border-bottom: 1px solid #f5f5f5;
  transition: background-color 0.2s;
  font-size: 0.9rem;
}

.task-item:last-child {
  border-bottom: none;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333; /* 加重字体颜色 */
}

.rotating-icon {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.task-completed {
  background-color: #f0fff4;
  border-left: 3px solid #67c23a;
}

.task-error {
  background-color: #fff0f0;
  border-left: 3px solid #f56c6c;
}

.task-running {
  background-color: #f0f8ff;
  border-left: 3px solid #409eff;
  font-weight: 500;
}

.task-pending {
  border-left: 3px solid transparent;
  opacity: 0.7;
}

.enhanced-progress {
  width: 100%;
  margin: 0.5rem 0;
  border-radius: 12px;
  overflow: hidden;
}

.progress-text {
  font-weight: bold;
  font-size: 0.8rem;
}

.eta-display {
  margin-top: 0.5rem;
  font-size: 0.8rem;
}

.openfoam-output {
  flex: 1;
  min-height: 250px;
  display: flex;
  flex-direction: column;
}

.terminal-header {
  display: flex;
  align-items: center;
  background-color: #343a40;
  padding: 0.3rem 0.8rem;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
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
  background-color: #1e1e1e;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  flex: 1;
}

.output-content {
  font-family: 'Consolas', 'Courier New', monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  padding: 0.8rem;
  color: #eaeaea;
  line-height: 1.4;
  font-size: 0.85rem;
}

.message-display {
  padding: 0.8rem;
  border-radius: 6px;
  font-size: 0.95rem;
  text-align: center;
}

.success-message {
  background-color: #f0fff4;
  color: #67c23a;
  border-left: 3px solid #67c23a;
}

.error-message {
  background-color: #fff0f0;
  color: #f56c6c;
  border-left: 3px solid #f56c6c;
}

.info-message {
  background-color: #f4f4f5;
  color: #909399;
  border-left: 3px solid #909399;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.view-results-button {
  background: linear-gradient(to right, #67c23a, #95d475);
  border: none;
  color: white;
  border-radius: 18px;
  padding: 0.6rem 1.2rem;
}

.reset-button {
  background: linear-gradient(to right, #e6a23c, #f8c36d);
  border: none;
  color: white;
  border-radius: 18px;
  padding: 0.6rem 1.2rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: #909399;
  background-color: #f9fafc;
  border-radius: 6px;
  flex: 1;
}

.empty-state-icon {
  margin-bottom: 1rem;
  color: #c0c4cc;
}

.empty-state-text {
  font-size: 0.95rem;
  text-align: center;
  max-width: 250px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .side-by-side-container {
    flex-direction: column;
    height: auto; /* 响应式布局下高度自动 */
  }

  .task-list-section,
  .openfoam-output {
    flex: none;
    height: auto; /* 移动端高度也自动，根据内容调整 */
  }

  .task-list {
    max-height: 200px; /* 移动端任务列表可以考虑加回最大高度和滚动 */
    overflow-y: auto;
  }
}
</style>