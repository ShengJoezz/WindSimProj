// frontend/src/store/mapStore.js
import { defineStore } from 'pinia';
import axios from 'axios';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

export const useMapStore = defineStore('mapStore', () => {
  // Existing State
  const parameters = ref({});
  const results = ref({});

  // New State for Wind Turbines
  const windTurbines = ref([]);

  // Existing Actions
  const setParameters = (params) => {
    parameters.value = params;
  };

  const setResults = (res) => {
    results.value = res;
  };

  // New Action to Load Wind Turbines
  const loadWindTurbines = async (caseId) => {
    try {
      const response = await axios.get(`/api/cases/${caseId}/wind-turbines`);
      // Assuming the response data is an array of turbine objects
      windTurbines.value = response.data;
    } catch (error) {
      console.error('Failed to load wind turbines:', error);
      windTurbines.value = []; // Reset to empty array on failure
      ElMessage.error('加载风机数据失败'); // Notify user of failure
    }
  };

  return {
    parameters,
    results,
    windTurbines,
    setParameters,
    setResults,
    loadWindTurbines,
  };
});