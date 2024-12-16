// frontend/src/store/caseStore.js

import { defineStore } from 'pinia';
import axios from 'axios';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

export const useCaseStore = defineStore('caseStore', () => {
  // State
  const caseId = ref(null); // 案例的唯一标识符
  const caseName = ref(null); // 案例的显示名称
  const parameters = ref({
    calculationDomain: {
      width: 10000,
      height: 800
    },
    conditions: {
      windDirection: 0,
      inletWindSpeed: 10
    },
    grid: {
      encryptionHeight: 210,
      encryptionLayers: 21,
      gridGrowthRate: 1.2,
      maxExtensionLength: 360,
      encryptionRadialLength: 50,
      downstreamRadialLength: 100,
      encryptionRadius: 200,
      encryptionTransitionRadius: 400,
      terrainRadius: 4000,
      terrainTransitionRadius: 5000,
      downstreamLength: 2000,
      downstreamWidth: 600,
      scale: 0.001
    },
    simulation: {
      cores: 1,
      steps: 100
    },
    postProcessing: {
      resultLayers: 10,
      layerSpacing: 20,
      layerDataWidth: 1000,
      layerDataHeight: 1000
    }
  });
  const windTurbines = ref([]);
  const infoExists = ref(false);
  const results = ref({});

  // Actions

  /**
   * 初始化案例，通过设置 caseId 和 caseName，并加载初始数据。
   * @param {String} id - 案例的唯一标识符。
   * @param {String} name - 案例的名称。
   */
  const initializeCase = async (id, name) => {
    if (!id) {
      ElMessage.error('缺少工况ID');
      return;
    }

    caseId.value = id;
    caseName.value = name || id; // 如果未提供名称，则回退到 id
    await checkInfoExists();
    await fetchParameters();
    await fetchWindTurbines();
  };

  /**
   * 从后端获取并设置仿真参数。
   */
  const fetchParameters = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/parameters`);
      if (response.data && response.data.parameters) {
        parameters.value = response.data.parameters;
      } else {
        ElMessage.warning('未找到工况参数，使用默认值');
      }
    } catch (error) {
      console.error('Error fetching parameters:', error);
      ElMessage.error('获取工况参数失败');
    }
  };

  /**
   * 从后端获取并设置风力涡轮机列表。
   */
  const fetchWindTurbines = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/wind-turbines/list`);
      windTurbines.value = response.data.windTurbines || [];
    } catch (error) {
      console.error('Error fetching wind turbines:', error);
      windTurbines.value = [];
      ElMessage.error('加载风机数据失败');
    }
  };

  /**
   * 检查当前案例是否存在 info.json。
   */
  const checkInfoExists = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/info-exists`);
      infoExists.value = response.data.exists;
    } catch (error) {
      console.error('Error checking info.json existence:', error);
      ElMessage.error('检查 info.json 失败');
    }
  };

  /**
   * 将仿真参数提交到后端。
   */
  const submitParameters = async () => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/parameters`, parameters.value);
      if (response.data.success) {
        ElMessage.success('参数保存成功');
        infoExists.value = false; // 标记需要生成新的 info.json
      } else {
        throw new Error(response.data.message || '参数保存失败');
      }
    } catch (error) {
      console.error('Error submitting parameters:', error);
      ElMessage.error(error.message || '参数提交失败');
      throw error;
    }
  };

  /**
   * 通过向后端发送参数和风力涡轮机来生成 info.json 文件。
   */
  const generateInfoJson = async () => {
    console.log("generateInfoJson called in caseStore!");
    try {
      const payload = {
        parameters: parameters.value,
        windTurbines: windTurbines.value
      };
      const response = await axios.post(`/api/cases/${caseId.value}/info`, payload);
      console.log("Case ID:", caseId.value)

      if (response.data.success) {
        ElMessage.success('info.json 生成成功');
        infoExists.value = true;
      } else {
        throw new Error(response.data.message || '生成 info.json 失败');
      }
    } catch (error) {
      console.error('Error generating info.json:', error);
      ElMessage.error('生成 info.json 失败');
      throw error;
    }
  };

  /**
   * 下载现有的 info.json 文件。
   */
  const downloadInfoJson = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/info-download`, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'info.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // 释放内存

      ElMessage.success('info.json 已下载');
    } catch (error) {
      console.error('Error downloading info.json:', error);
      ElMessage.error('下载 info.json 失败');
    }
  };

  /**
   * 添加新的风力涡轮机，将其保存到后端，并更新 store。
   * @param {Object} turbine - 要添加的风力涡轮机对象。
   */
  const addWindTurbine = async (turbine) => {
    try {
      // 为新涡轮机生成唯一 ID（如果后端需要）
      const newTurbine = { ...turbine, id: Date.now().toString() };
      windTurbines.value.push(newTurbine);
      infoExists.value = false;

      // 保存到后端
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, windTurbines.value);

      if (!response.data.success) {
        throw new Error(response.data.message || '保存风机数据失败');
      }

      ElMessage.success('风力涡轮机添加成功');
    } catch (error) {
      console.error('Error adding wind turbine:', error);
      ElMessage.error('添加风机失败: ' + error.message);
      // 回滚本地更改
      windTurbines.value.pop();
      throw error;
    }
  };

  /**
   * 通过 ID 删除风力涡轮机，更新后端，并更新 store。
   * @param {String|Number} turbineId - 要删除的涡轮机的 ID。
   */
  const removeWindTurbine = async (turbineId) => {
    let removedTurbine = null;
    let index = -1;
    try {
      // 找到要删除的涡轮机
      index = windTurbines.value.findIndex(t => t.id === turbineId);
      if (index === -1) {
        throw new Error('风机未找到');
      }

      // 保留一份副本以备可能的回滚
      removedTurbine = windTurbines.value[index];

      // 首先从本地 store 中删除
      windTurbines.value.splice(index, 1);
      infoExists.value = false;

      // 然后，更新后端
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, windTurbines.value);

      if (!response.data.success) {
        throw new Error(response.data.message || '更新风机数据失败');
      }

      ElMessage.success('风力涡轮机删除成功');
    } catch (error) {
      console.error('Error removing wind turbine:', error);
      ElMessage.error('删除风机失败: ' + error.message);

      // 如果后端更新失败，回滚本地更改
      if (removedTurbine && index !== -1) {
        windTurbines.value.splice(index, 0, removedTurbine);
      }
      throw error;
    }
  };

  /**
   * 更新风力涡轮机的数据。
   * @param {Object} updatedTurbine - 具有更新数据的涡轮机对象。
   */
  const updateWindTurbine = async (updatedTurbine) => {
    try {
      const index = windTurbines.value.findIndex(t => t.id === updatedTurbine.id);
      if (index !== -1) {
        windTurbines.value[index] = { ...windTurbines.value[index], ...updatedTurbine };
        infoExists.value = false; // 表明 info.json 需要重新生成

        // 更新后端
        const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, windTurbines.value);

        if (!response.data.success) {
          throw new Error(response.data.message || '更新风机数据失败');
        }

        ElMessage.success('风力涡轮机更新成功');
      } else {
        throw new Error('风机未找到');
      }
    } catch (error) {
      console.error('Error updating wind turbine:', error);
      ElMessage.error('更新风机失败: ' + error.message);
      throw error;
    }
  };

  /**
   * 设置计算结果
   * @param {Object} newResults 
   */
  const setResults = (newResults) => {
    results.value = newResults;
  };

  return {
    // State
    caseId,
    caseName,
    parameters,
    windTurbines,
    infoExists,
    results,

    // Actions
    initializeCase,
    fetchParameters,
    fetchWindTurbines,
    checkInfoExists,
    submitParameters,
    generateInfoJson,
    downloadInfoJson,
    addWindTurbine,
    removeWindTurbine,
    updateWindTurbine,
    setResults, // 确保 setResults 被正确导出
  };
});