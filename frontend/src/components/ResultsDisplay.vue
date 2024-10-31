<!-- frontend/src/components/ResultsDisplay.vue -->
<template>
    <div>
      <h3>结果展示</h3>
      <div v-if="results">
        <el-card>
          <h4>计算结果</h4>
          <p><strong>状态：</strong>{{ results.status }}</p>
          <p><strong>时间戳：</strong>{{ results.timestamp }}</p>
          <p><strong>总功率：</strong>{{ results.metrics.totalPower }} MW</p>
          <p><strong>平均风速：</strong>{{ results.metrics.averageWindSpeed }} m/s</p>
        </el-card>
        <!-- 根据实际需要添加更多的结果展示形式，例如图表、可视化等 -->
      </div>
      <div v-else>
        <el-alert title="结果尚未生成" type="info" show-icon></el-alert>
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed, onMounted } from 'vue';
  import { useMapStore } from '../store/mapStore';
  import { useRoute } from 'vue-router';
  import axios from 'axios';
  import { ElMessage } from 'element-plus';
  
  const store = useMapStore();
  const route = useRoute();
  const caseId = route.params.caseId;
  
  const results = computed(() => store.results);
  
  const fetchResults = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId}/results`);
      if (response.data.success) {
        store.setResults(response.data.results);
      } else {
        ElMessage.error(response.data.message || '获取结果失败');
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '获取结果失败');
    }
  };
  
  onMounted(() => {
    if (!results.value || Object.keys(results.value).length === 0) {
      fetchResults();
    }
  });
  </script>
  
  <style scoped>
  .el-card {
    margin-bottom: 20px;
  }
  </style>