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
  import { ref } from 'vue';
  import { ElMessage, ElProgress } from 'element-plus';
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
  
  // 启动计算
  const startComputation = async () => {
    if (isCalculating.value || completed.value) return;
    
    try {
      isCalculating.value = true;
      progress.value = 0;
      computationMessage.value = '计算开始...';
      computationError.value = false;
      completed.value = false;
  
      // 启动计算任务
      const response = await axios.post(`/api/cases/${caseId}/parameters`);
      
      if (response.data.success) {
        ElMessage.success('计算已开始');
        
        // 连接到 WebSocket 并加入工况房间
        socket = io('http://localhost:3000'); // 替换为您的后端地址
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
      } else {
        throw new Error(response.data.message || '计算启动失败');
      }
    } catch (error) {
      isCalculating.value = false;
      computationMessage.value = error.response?.data?.message || '计算启动失败';
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
  import { onBeforeUnmount } from 'vue';
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