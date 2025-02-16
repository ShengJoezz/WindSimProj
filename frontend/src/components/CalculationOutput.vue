<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-15 16:32:45
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 18:54:50
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\CalculationOutput.vue
 * @Description:
 *   计算输出组件：
 *    - 顶部按钮根据 store.calculationStatus 显示“开始计算”、“计算中…”或“计算完成”，
 *      当状态为 "running" 或 "completed" 时禁用按钮，新建工况（"not_started"）时允许点击。
 *    - 任务列表按照 knownTasks 顺序展示，每个任务根据状态显示不同图标：
 *         pending：显示一个占位标签 (<span>),
 *         running：显示 Loading 图标（旋转效果）,
 *         completed：显示 Check 图标 (打勾),
 *         error：显示 Close 图标.
 *    - 终端输出区域实时显示后端 run.sh 传回的输出文本（通过 socket 推送）。
 *
 * 注意：所有对 store.calculationStatus 的更新都使用 .value 操作，
 *       同时 getIconComponent 返回的不是字符串，而是引入的图标组件对象或合法的 HTML 标签名称。
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
<template>
  <div class="calculation-output-container">
    <h2>计算输出</h2>
    <!-- 顶部按钮：仅当状态为 not_started 时可点击 -->
    <el-button
      type="primary"
      @click="startComputation"
      :disabled="buttonDisabled"
      class="start-button"
    >
      <template v-if="store.calculationStatus === 'running'">
        <el-icon><Loading /></el-icon> 计算中...
      </template>
      <span v-else-if="store.calculationStatus === 'completed'">计算完成</span>
      <span v-else>开始计算</span>
    </el-button>

    <!-- 计算完成提示 -->
    <div v-if="store.calculationStatus === 'completed'" class="calculation-complete-message">
      <el-alert title="计算已完成。无需重新计算。" type="success" show-icon />
    </div>

    <!-- 任务列表区域 -->
    <div v-if="store.calculationStatus !== 'not_started'" class="task-list-section">
      <h3>执行步骤</h3>
      <ul class="task-list">
        <li
          v-for="task in tasks"
          :key="task.id"
          class="task-item"
          :class="{
            'task-completed': task.status === 'completed',
            'task-error': task.status === 'error',
            'task-running': task.status === 'running'
          }"
        >
          <el-icon :color="getIconColor(task.status)">
            <!-- 修改处：返回图标组件对象或 HTML 标签 -->
            <component :is="getIconComponent(task.status)" class="icon" />
          </el-icon>
          <span class="task-name">{{ task.name }}</span>
        </li>
      </ul>
    </div>

    <!-- 进度条区域 -->
    <div v-if="store.calculationStatus !== 'not_started'" class="progress-section">
      <el-progress
        :percentage="overallProgress"
        :status="progressStatus()"
        :stroke-width="20"
        :text-inside="true"
        striped
        :striped-flow="store.calculationStatus === 'running'"
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
        预计剩余时间: {{ eta }} 秒
      </div>
    </div>

    <!-- 终端输出区域 -->
    <div class="openfoam-output" v-if="store.calculationStatus !== 'not_started'">
      <h3>终端输出</h3>
      <el-scrollbar ref="outputScrollbar" height="300px">
        <pre class="output-content">{{ openfoamOutput }}</pre>
      </el-scrollbar>
    </div>

    <!-- 提示信息 -->
    <div v-if="computationMessage" :class="messageClass()" class="message-display" role="alert">
      {{ computationMessage }}
    </div>

    <!-- 操作按钮 -->
    <div class="actions" v-if="store.calculationStatus !== 'not_started'">
      <el-button
        v-if="store.calculationStatus === 'completed'"
        type="success"
        @click="viewResults"
        class="view-results-button"
      >
        查看结果
      </el-button>
      <el-button
        v-if="store.calculationStatus !== 'not_started'"
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


// computed 属性：按钮禁用，当状态为 "running" 或 "completed" 时禁用
const buttonDisabled = computed(() =>
  store.calculationStatus === 'running' || store.calculationStatus === 'completed'
);

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
  if (store.calculationStatus === 'running')
    return 'info-message';
  if (store.calculationStatus === 'completed')
    return 'success-message';
  if (store.calculationStatus === 'error')
    return 'error-message';
  return '';
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
      store.calculationStatus = 'completed';
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
      store.calculationStatus = 'completed';
      overallProgress.value = 100;
      openfoamOutput.value += "\n计算完成";
      ElMessage.success("计算完成");
    });
    store.socket.on('calculationError', (error) => {
      store.calculationStatus = 'error';
      openfoamOutput.value += "\n计算错误: " + (error.message || "未知错误");
      computationMessage.value = error.message || "计算错误";
      ElMessage.error(computationMessage.value);
    });
  }
});

const startComputation = async () => {
  if (store.calculationStatus === 'running' || store.calculationStatus === 'completed') {
    ElMessage.warning("计算正在进行中或已完成，不允许重复点击");
    return;
  }
  console.log("Before setting to 'running', store.calculationStatus:", store.calculationStatus);
  console.log("Type of store.calculationStatus:", typeof store.calculationStatus);
  try {
    store.calculationStatus = 'running';
    overallProgress.value = 0;
    computationMessage.value = '';
    openfoamOutput.value = '';
    tasks.value = knownTasks.map(task => ({ ...task, status: 'pending' }));
    store.startTime = Date.now();
    eta.value = null;
    await store.saveCalculationProgress();
    await store.fetchCalculationStatus();
    const response = await axios.post(`/api/cases/${caseId}/calculate`);
    if (!response.data.success) {
      throw new Error(response.data.message || '启动计算失败');
    }
    ElMessage.success("计算已启动");
  } catch (error) {
    store.calculationStatus = 'not_started';
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
    store.calculationStatus = 'not_started';
    overallProgress.value = 0;
    computationMessage.value = '';
    openfoamOutput.value = '';
    eta.value = null;
    tasks.value = knownTasks.map(task => ({ ...task, status: 'pending' }));
    store.resetCalculationProgress();
    ElMessage.success("计算已重置");
  } catch (error) {
    ElMessage.error("重置计算失败");
    console.error("重置计算失败:", error);
  }
};

onBeforeUnmount(() => {
  store.disconnectSocket();
});
</script>

<style scoped>
.calculation-output-container {
  padding: 20px;
  background-color: #fff;
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
.calculation-complete-message {
  margin-top: 20px;
}
.task-list-section {
  margin-top: 20px;
  margin-top: 20px;
}
.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.task-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
  transition: background-color 0.3s;
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
.task-completed {
  background-color: #f0fff4;
  border-left: 4px solid #34d399;
}
.task-error {
  background-color: #fff0f0;
  border-left: 4px solid #f56c6c;
}
.task-running {
  background-color: #f0f5ff;
  border-left: 4px solid #409EFF;
  padding-left: 12px;
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
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
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
.openfoam-output {
  margin-top: 20px;
  padding: 10px;
  background: #1e1e1e;
  color: #fff;
  border-radius: 4px;
}
.output-content {
  font-family: monospace;
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
@media (max-width: 600px) {
  .calculation-output-container {
    padding: 10px;
  }
  .task-item {
    font-size: 0.9em;
  }
  .start-button,
  .view-results-button,
  .reset-button {
    width: 100%;
    min-width: 0;
  }
}
</style>