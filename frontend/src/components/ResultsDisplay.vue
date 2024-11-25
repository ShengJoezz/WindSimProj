<!-- frontend/src/components/ResultsDisplay.vue -->
<template>
  <div class="results-display">
    <h3>结果展示</h3>
    <div v-if="loading" class="loading-container">
      <el-spin>加载中...</el-spin>
    </div>
    <div v-else-if="error" class="error-container">
      <el-alert
        :title="error"
        type="warning"
        show-icon
      />
    </div>
    <div v-else-if="results && Object.keys(results).length > 0">
      <el-card>
        <h4>计算结果</h4>
        <p><strong>状态：</strong>{{ results.status }}</p>
        <p><strong>时间戳：</strong>{{ results.timestamp }}</p>
        <p><strong>总功率：</strong>{{ results.metrics?.totalPower || 'N/A' }} MW</p>
        <p><strong>平均风速：</strong>{{ results.metrics?.averageWindSpeed || 'N/A' }} m/s</p>
      </el-card>
    </div>
    <div v-else>
      <el-alert
        title="暂无计算结果，请先进行计算"
        type="info"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useMapStore } from '../store/mapStore';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const store = useMapStore();
const route = useRoute();
const caseId = route.params.caseId;

const loading = ref(false);
const error = ref(null);
const results = computed(() => store.results);

const fetchResults = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get(`/api/cases/${caseId}/results`);
    if (response.data.success) {
      store.setResults(response.data.results);
    } else {
      error.value = response.data.message || '暂无计算结果';
    }
  } catch (err) {
    error.value = '获取结果失败，请稍后重试';
    console.error('获取结果失败:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchResults();
});
</script>

<style scoped>
.results-display {
  padding: 20px;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.error-container {
  margin: 20px 0;
}

.el-card {
  margin-top: 20px;
}
</style>