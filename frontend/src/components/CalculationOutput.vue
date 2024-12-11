<!-- frontend/src/components/CalculationOutput.vue -->
<template>
  <div>
    <h3>计算输出</h3>
    <el-button type="primary" @click="startComputation" :disabled="isCalculating || completed">
      {{ isCalculating ? '计算中...' : '开始计算' }}
    </el-button>
    
    <el-progress v-if="isCalculating" :percentage="progress" style="margin-top: 20px;"></el-progress>
    
    <div v-if="computationMessage" :class="{'info-message': isCalculating, 'success-message': completed, 'error-message': computationError}" style="margin-top: 20px;">
      {{ computationMessage }}
    </div>
    
    <el-button v-if="completed" type="success" @click="viewResults" style="margin-top: 20px;">查看结果</el-button>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { useMapStore } from '../store/mapStore';
import { io } from 'socket.io-client';

const route = useRoute();
const router = useRouter();
const store = useMapStore();

const caseId = route.params.caseId;

// 状态变量
const isCalculating = ref(false);
const progress = ref(0);
const computationMessage = ref('');
const computationError = ref(false);
const completed = ref(false);

// WebSocket 连接
let socket;

const startComputation = async () => {
  if (isCalculating.value || completed.value) return;
  
  try {
    isCalculating.value = true;
    progress.value = 0;
    computationMessage.value = '计算开始...';
    computationError.value = false;
    completed.value = false;

    // 保存参数（假设 store.parameters 存储了必要的参数）
    const saveParamsResponse = await axios.post(`/api/cases/${caseId}/parameters`, store.parameters);

    if (saveParamsResponse.data.success) {
      ElMessage.success('参数已保存，开始计算');

      // 连接到 Socket.io 并加入案例房间
      socket = io('http://localhost:5000'); // 后端地址，确保端口正确
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
</style>