<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 16:45:21
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\components\ResultsDisplay.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 -->

<template>
  <div class="results-display">
    <h3>结果展示</h3>
    <div v-if="loading" class="loading-container">
      <el-loading v-if="loading" text="加载中..." fullscreen />
    </div>
    <div v-else-if="error" class="error-container">
      <el-alert :title="error" type="warning" show-icon />
    </div>
    <div v-else-if="results && Object.keys(results).length > 0">
      <el-card>
        <h4>计算结果</h4>
        <p>
          <strong>状态：</strong>{{ results.status ?? "N/A" }}
        </p>
        <p>
          <strong>时间戳：</strong>{{
            results.timestamp ? formatDate(results.timestamp) : "N/A"
          }}
        </p>
        <p>
          <strong>总功率：</strong>{{ results.metrics?.totalPower || "N/A"
          }} MW
        </p>
        <p>
          <strong>平均风速：</strong>{{
            results.metrics?.averageWindSpeed || "N/A"
          }}
          m/s
        </p>
      </el-card>
    </div>
    <div v-else>
      <el-alert title="暂无计算结果，请先进行计算" type="info" show-icon />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useMapStore } from "../store/mapStore";
import { useRoute } from "vue-router";
import axios from "axios";
import { ElMessage, ElAlert, ElLoading } from "element-plus"; // Import ElLoading

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
      error.value = response.data.message || "暂无计算结果";
    }
  } catch (err) {
    error.value = "获取结果失败，请稍后重试";
    console.error("获取结果失败:", err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString(); // Format the date as needed
};

onMounted(() => {
  fetchResults();
});

watch(
  () => route.params.caseId,
  () => {
    fetchResults();
  }
);
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