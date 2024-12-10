// frontend/src/store/mapStore.js

import { defineStore } from 'pinia';
import axios from 'axios';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

export const useMapStore = defineStore('mapStore', () => {
  // 现有状态
  const parameters = ref({});
  const results = ref({});
  const windTurbines = ref([]);

  // 新增 info.json 是否存在的状态
  const infoExists = ref(false);

  // 现有 Actions
  const setParameters = (params) => {
    parameters.value = params;
  };

  const setResults = (res) => {
    results.value = res;
  };

  // 新增 Actions
  const checkInfoExists = async (caseId) => {
    try {
      const response = await axios.get(`/api/cases/${caseId}/info-exists`);
      infoExists.value = response.data.exists;
    } catch (error) {
      console.error('检查 info.json 失败:', error);
      ElMessage.error('检查 info.json 失败');
    }
  };

  const loadWindTurbines = async (caseId) => {
    try {
      const response = await axios.get(`/api/cases/${caseId}/wind-turbines/list`);
      windTurbines.value = response.data.windTurbines || [];
    } catch (error) {
      console.error('加载风机数据失败:', error);
      windTurbines.value = [];
      ElMessage.error('加载风机数据失败');
    }
  };

  const generateInfoJson = async (caseId) => {
    try {
      const response = await axios.post(`/api/cases/${caseId}/info`, {
        parameters: parameters.value,
        windTurbines: windTurbines.value
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'info.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // 释放内存
      ElMessage.success("info.json 生成成功并已下载");

      // 更新 infoExists 为 true
      infoExists.value = true;

    } catch (error) {
      console.error('生成 info.json 失败:', error);
      ElMessage.error("生成 info.json 失败");
    }
  };

  const downloadInfoJson = async (caseId) => {
    try {
      const response = await axios.get(`/api/cases/${caseId}/info-download`, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'info.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // 释放内存
      ElMessage.success("info.json 已下载");

    } catch (error) {
      console.error('下载 info.json 失败:', error);
      ElMessage.error("下载 info.json 失败");
    }
  };

  return {
    parameters,
    results,
    windTurbines,
    infoExists,
    setParameters,
    setResults,
    loadWindTurbines,
    generateInfoJson,
    checkInfoExists,
    downloadInfoJson
  };
});