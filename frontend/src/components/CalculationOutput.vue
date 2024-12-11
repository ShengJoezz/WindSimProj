<!-- 在 CalculationOutput.vue 的 <div class="logs"> 包裹一个带有 ref 的父级容器 -->
  <template>
    <div>
      <h3>计算输出</h3>
      <el-button type="primary" @click="startComputation" :disabled="isCalculating || completed">
        {{ isCalculating ? '计算中...' : '开始计算' }}
      </el-button>
      
      <el-progress 
        v-if="isCalculating" 
        :percentage="progress" 
        :status="progress < 100 ? 'active' : 'success'"
        style="margin-top: 20px;"
        animated
      >
        <div slot="format">
          {{ progress }}%
        </div>
      </el-progress>
      
      <div v-if="computationMessage" 
           :class="{'info-message': isCalculating, 'success-message': completed, 'error-message': computationError}" 
           style="margin-top: 20px;">
        {{ computationMessage }}
      </div>
      
      <div v-if="logs.length" class="log-container">
        <h4>计算日志</h4>
        <div class="logs" ref="logBox">
          <pre>{{ formattedLogs }}</pre>
        </div>
      </div>
      
      <el-button v-if="completed" type="success" @click="viewResults" style="margin-top: 20px;">查看结果</el-button>
    </div>
  </template>
  
  <script setup>
  import { ref, onBeforeUnmount, computed, watch, nextTick } from 'vue';
  import { ElMessage } from 'element-plus';
  import axios from 'axios';
  import { useRoute, useRouter } from 'vue-router';
  import { useCaseStore } from '../store/caseStore'; // 使用 caseStore
  import { io } from 'socket.io-client';
  
  const route = useRoute();
  const router = useRouter();
  const store = useCaseStore();
  
  const caseId = route.params.caseId;
  
  // 状态变量
  const isCalculating = ref(false);
  const progress = ref(0);
  const computationMessage = ref('');
  const computationError = ref(false);
  const completed = ref(false);
  
  // 日志相关
  const logs = ref([]); // 存储日志消息
  const formattedLogs = computed(() => logs.value.join('\n')); // 格式化日志以显示在 <pre> 标签中
  
  const logBox = ref(null); // Ref 用于滚动到最新日志
  
  // 监听 formattedLogs 变化，自动滚动到底部
  watch(formattedLogs, async () => {
    await nextTick(); // 确保 DOM 更新
    if (logBox.value) {
      logBox.value.scrollTop = logBox.value.scrollHeight;
    }
  });
  
  // WebSocket 连接
  let socket;
  
  // 启动计算
  const startComputation = async () => {
    if (isCalculating.value || completed.value) return;
    
    try {
      isCalculating.value = true;
      progress.value = 0;
      computationMessage.value = '计算开始...';
      computationError.value = false;
      completed.value = false;
      logs.value = []; // 清空之前的日志
  
      // 提交参数
      const saveParamsResponse = await store.submitParameters();
  
      if (saveParamsResponse !== undefined && saveParamsResponse !== false) { // 确认保存成功
        ElMessage.success('参数已保存，开始计算');
  
        // 连接到 Socket.io 并加入案例房间
        socket = io('http://localhost:5000'); // 确保端口正确
        socket.emit('joinCase', caseId);
  
        // 监听计算进度
        socket.on('calculationProgress', (p) => {
          progress.value = p;
          computationMessage.value = `计算中... (${p}%)`;
        });
  
        // 监听计算完成
        socket.on('calculationCompleted', (res) => {
          progress.value = 100;
          computationMessage.value = '计算完成';
          isCalculating.value = false;
          completed.value = true;
          store.setResults(res);
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
  
        socket.on('calculationFailed', (err) => {
          computationMessage.value = err.message || '计算失败';
          computationError.value = true;
          isCalculating.value = false;
          ElMessage.error(computationMessage.value);
          socket.disconnect();
        });
  
        // 监听日志消息
        socket.on('log', (msg) => {
          logs.value.push(msg); // 追加日志消息
        });
  
        // 启动计算任务
        const runResponse = await axios.post(`/api/cases/${caseId}/run`);
  
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
  
  // 查看结果
  const viewResults = () => {
    router.push({ name: 'ResultsDisplay', params: { caseId } });
  };
  
  // 清理 WebSocket 连接
  onBeforeUnmount(() => {
    if (socket) {
      socket.disconnect();
    }
  });
  </script>
  
  <style scoped>
  .success-message {
    color: green;
  }
  .error-message {
    color: red;
  }
  .info-message {
    color: blue;
  }
  .log-container {
    margin-top: 20px;
  }
  
  .logs {
    border: 1px solid #dcdfe6;
    padding: 10px;
    height: 200px; /* 可根据需要调整高度 */
    overflow-y: auto;
    background-color: #f5f7fa;
    white-space: pre-wrap; /* 保留空格和换行 */
    font-family: monospace; /* 使用等宽字体显示日志 */
  }
  </style>