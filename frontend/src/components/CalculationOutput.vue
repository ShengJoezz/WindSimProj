<!-- frontend/src/components/CalculationOutput.vue -->
<template>
  <div class="calculation-output-container">
    <h2>计算输出</h2>
    <el-button
      type="primary"
      @click="startComputation"
      :disabled="isCalculating || completed"
      class="start-button"
    >
      <template v-if="isCalculating">
        <el-icon><Loading /></el-icon>
        计算中...
      </template>
      <span v-else>开始计算</span>
    </el-button>

    <div v-if="isCalculating || completed" class="progress-section">
      <el-progress
        :percentage="progress"
        :status="progressStatus"
        :stroke-width="20"
        :text-inside="true"
        :format="progressFormat"
        class="enhanced-progress"
      >
        <template #format>
          <span class="progress-text">{{ progress }}%</span>
        </template>
      </el-progress>
      <div class="eta-display" v-if="eta">
        预计剩余时间: {{ eta }} 秒
      </div>
    </div>

    <div v-if="computationMessage" :class="messageClass" class="message-display">
      {{ computationMessage }}
    </div>

    <!-- 实时输出日志框 -->
    <el-dialog
      title="实时输出日志"
      :visible.sync="isLogVisible"
      width="70%"
      :before-close="handleCloseDialog"
    >
      <el-scrollbar ref="logScrollbar" style="height: 400px;">
        <div v-for="(log, index) in outputLogs" :key="index" class="log-entry">
          {{ log }}
        </div>
      </el-scrollbar>
      <div slot="footer" class="dialog-footer">
        <el-button @click="isLogVisible = false">关闭</el-button>
      </div>
    </el-dialog>

    <div class="actions">
      <el-button
        v-if="isCalculating || completed"
        type="info"
        @click="showLogs"
        class="view-logs-button"
      >
        查看日志
      </el-button>
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
import { ref, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue'; // 正确的导入方式
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { useCaseStore } from '../store/caseStore'; // 修正为正确的 Store 导入
import { io } from 'socket.io-client';

// 获取路由和路由器
const route = useRoute();
const router = useRouter();
const store = useCaseStore(); // 使用正确的 Store

// 获取 caseId
const caseId = route.params.caseId;

// 状态变量
const isCalculating = ref(false);
const progress = ref(0);
const computationMessage = ref('');
const computationError = ref(false);
const completed = ref(false);
const outputLogs = ref([]);
const startTime = ref(null);
const eta = ref(null);
const isLogVisible = ref(false);

// Socket.io 连接
let socket;

// 进度条格式化函数
const progressFormat = () => {
  return `${progress.value}%`;
};

// 进度条状态
const progressStatus = computed(() => {
  if (progress.value < 100) return 'active';
  return 'success';
});

// 消息显示的 CSS 类
const messageClass = computed(() => {
  if (isCalculating.value) return 'info-message';
  if (completed.value) return 'success-message';
  if (computationError.value) return 'error-message';
  return '';
});

// 启动计算
const startComputation = async () => {
  if (isCalculating.value || completed.value) return;

  try {
    isCalculating.value = true;
    progress.value = 0;
    computationMessage.value = '计算开始...';
    computationError.value = false;
    completed.value = false;
    outputLogs.value = [];
    startTime.value = Date.now();
    eta.value = null;

    // 保存参数
    const saveParamsResponse = await axios.post(`/api/cases/${caseId}/parameters`, store.parameters);

    if (saveParamsResponse.data.success) {
      ElMessage.success('参数已保存，开始计算');

      // 初始化 Socket.io 连接
      socket = io('http://localhost:5000', {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      // 处理 Socket 连接错误
      socket.on('connect_error', (err) => {
        console.error('Socket连接错误:', err);
        ElMessage.error('实时通信连接失败');
      });

      // 加入案例房间
      socket.emit('joinCase', caseId);

      // 监听进度更新
      socket.on('calculationProgress', (p) => {
        progress.value = p;
        computationMessage.value = `计算中... (${p}%)`;
        updateETA();
      });

      // 监听脚本输出日志
      socket.on('scriptOutput', (log) => {
        outputLogs.value.push(log);
      });

      // 监听计算完成
      socket.on('calculationCompleted', (res) => {
        progress.value = 100;
        computationMessage.value = '计算完成';
        isCalculating.value = false;
        completed.value = true;
        store.setResults(res); // 确保 store.setResults 存在
        ElMessage.success('计算完成');
        socket.disconnect();
      });

      // 监听计算错误
      socket.on('calculationError', (err) => {
        computationMessage.value = err.message || '计算过程中出错';
        computationError.value = true;
        isCalculating.value = false;
        ElMessage.error(computationMessage.value);
        socket.disconnect();
      });

      // 监听计算失败
      socket.on('calculationFailed', (err) => {
        computationMessage.value = err.message || '计算失败';
        computationError.value = true;
        isCalculating.value = false;
        ElMessage.error(computationMessage.value);
        socket.disconnect();
      });

      // 在后端启动计算任务
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
    ElMessage.error(computationMessage.value);
    if (socket) socket.disconnect();
  }
};

// 更新预计剩余时间
const updateETA = () => {
  if (!startTime.value || progress.value === 0) {
    eta.value = null;
    return;
  }
  const elapsed = (Date.now() - startTime.value) / 1000; // 单位：秒
  const estimatedTotal = (elapsed / progress.value) * 100;
  const remaining = Math.max(Math.round(estimatedTotal - elapsed), 0);
  eta.value = remaining;
};

// 查看结果
const viewResults = () => {
  router.push({ name: 'ResultsDisplay', params: { caseId } });
};

// 显示日志对话框
const showLogs = () => {
  isLogVisible.value = true;
};

// 关闭日志对话框
const handleCloseDialog = () => {
  isLogVisible.value = false;
};

// 重置计算状态
const resetComputation = () => {
  isCalculating.value = false;
  progress.value = 0;
  computationMessage.value = '';
  computationError.value = false;
  completed.value = false;
  outputLogs.value = [];
  eta.value = null;
};

// 自动滚动到日志底部
const logScrollbar = ref(null);
watch(outputLogs, () => {
  nextTick(() => {
    if (logScrollbar.value) {
      logScrollbar.value.wrap.scrollTop = logScrollbar.value.wrap.scrollHeight;
    }
  });
});

// 组件卸载时断开 Socket 连接
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
.view-logs-button,
.reset-button {
  width: 150px;
  margin: 10px auto;
  display: block;
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

/* Log Scrollbar Styling */
.log-scrollbar {
  height: 400px;
  overflow-y: auto;
}

.log-entry {
  font-family: monospace;
  font-size: 14px;
  color: #555;
  padding: 2px 0;
}

/* Dialog Footer Styling */
.dialog-footer {
  text-align: right;
}
</style>