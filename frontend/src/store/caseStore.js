/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 18:33:46
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 20:19:46
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { knownTasks } from '../utils/tasks';
import { io } from 'socket.io-client';

export const useCaseStore = defineStore('caseStore', () => {
  // State
  const caseId = ref(null);
  const caseName = ref(null);
  const currentCaseId = ref(localStorage.getItem('currentCaseId') || null);
  const parameters = ref({
    calculationDomain: { width: 10000, height: 800 },
    conditions: { windDirection: 0, inletWindSpeed: 10 },
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
      scale: 0.001,
    },
    simulation: { cores: 1, steps: 100, deltaT: 1 },
    postProcessing: {
      resultLayers: 10,
      layerSpacing: 20,
      layerDataWidth: 1000,
      layerDataHeight: 1000,
    },
  });
  const windTurbines = ref([]);
  const infoExists = ref(false);
  const results = ref({});
  const calculationStatus = ref('not_started'); // 'not_started', 'running', 'completed', 'error'
  const currentTask = ref(null);
  const overallProgress = ref(0);
  const calculationOutputs = ref([]);
  const tasks = ref(knownTasks.map((task) => ({ ...task, status: 'pending' })));
  const hasFetchedCalculationStatus = ref(false);
  const socket = ref(null);
  const startTime = ref(null);

  // Actions

  const initializeCase = async (id, name) => {
    if (!id) {
      ElMessage.error('缺少工况ID');
      return;
    }
    currentCaseId.value = id;
    localStorage.setItem('currentCaseId', id);
    caseId.value = id;
    caseName.value = name || id;

    try {
      // 加载参数
      const response = await axios.get(`/api/cases/${caseId.value}/parameters`);
      if (response.data && response.data.parameters) {
        parameters.value = {
          ...parameters.value, // 默认值
          ...response.data.parameters, // 加载的值
        };
      } else {
        ElMessage.warning('未找到工况参数，使用默认值');
      }
        
       //加载保存的风机状态
      await loadSavedState();
      // 检查 info.json 是否存在
      const infoResponse = await axios.get(
        `/api/cases/${caseId.value}/info-exists`
      );
      infoExists.value = infoResponse.data.exists;

      // 初始化时加载计算状态
      await fetchCalculationStatus();
    } catch (error) {
      console.error('Failed to initialize case:', error);
      ElMessage.error('初始化失败');
    }
  };

  const fetchCalculationStatus = async () => {
    try {
      const response = await axios.get(
        `/api/cases/${caseId.value}/calculation-status`
      );
      calculationStatus.value = response.data.calculationStatus;
      hasFetchedCalculationStatus.value = true;
      return true;
    } catch (error) {
      console.error('获取计算状态失败:', error);
      calculationStatus.value = 'not_started';
      return false;
    }
  };

  const submitParameters = async () => {
    try {
      const response = await axios.post(
        `/api/cases/${caseId.value}/parameters`,
        parameters.value
      );
      if (response.data.success) {
        ElMessage.success('参数保存成功');
        infoExists.value = false;
      } else {
        throw new Error(response.data.message || '参数保存失败');
      }
    } catch (error) {
      console.error('Error submitting parameters:', error);
      ElMessage.error(error.message || '参数提交失败');
      throw error;
    }
  };

  const generateInfoJson = async () => {
    console.log('generateInfoJson called in caseStore!');
    try {
      const payload = {
        parameters: parameters.value,
        windTurbines: windTurbines.value,
      };
      const response = await axios.post(
        `/api/cases/${caseId.value}/info`,
        payload
      );
      console.log('Case ID:', caseId.value);

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

  const downloadInfoJson = async () => {
    try {
      const response = await axios.get(
        `/api/cases/${caseId.value}/info-download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
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

  const addWindTurbine = async (turbine) => {
    try {
      // 假设后端分配 ID
      const response = await axios.post(
        `/api/cases/${caseId.value}/wind-turbines`,
        turbine
      );
  
      if (response.data.success) {
        windTurbines.value.push(response.data.turbine); // 添加返回的带有 ID 的风机
        infoExists.value = false;
        ElMessage.success('风力涡轮机添加成功');
      } else {
        throw new Error(response.data.message || '保存风机数据失败');
      }
    } catch (error) {
      console.error('Error adding wind turbine:', error);
      ElMessage.error('添加风机失败: ' + error.message);
      throw error;
    }
  };
  
  const addBulkWindTurbines = async (turbines) => {
    try {
      if (!currentCaseId.value) {
        throw new Error('No case ID available');
      }

      const response = await axios.post(
        `/api/cases/${currentCaseId.value}/wind-turbines/bulk`,
        turbines,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        windTurbines.value.push(...response.data.turbines);
        infoExists.value = false;
        ElMessage.success(`成功导入 ${response.data.turbines.length} 个风机`);
        return response.data.turbines;
      } else {
        throw new Error(response.data.message || '批量导入风机失败');
      }
    } catch (error) {
      console.error('Error importing bulk wind turbines:', error);
      ElMessage.error('批量导入风机失败: ' + (error.message || '未知错误'));
      throw error;
    }
  };

  const fetchWindTurbines = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/wind-turbines`);
      
      if (response.data.success) {
        windTurbines.value = response.data.turbines;
      } else {
        throw new Error(response.data.message || '获取风机数据失败');
      }
    } catch (error) {
      console.error('Error fetching wind turbines:', error);
      ElMessage.error('获取风机数据失败: ' + error.message);
      throw error;
    }
  };

  const deleteWindTurbine = async (turbineId) => {
    try {
      const response = await axios.delete(`/api/cases/${caseId.value}/wind-turbines/${turbineId}`);
      
      if (response.data.success) {
        windTurbines.value = windTurbines.value.filter(t => t.id !== turbineId);
        ElMessage.success('风力涡轮机删除成功');
      } else {
        throw new Error(response.data.message || '删除风机数据失败');
      }
    } catch (error) {
      console.error('Error deleting wind turbine:', error);
      ElMessage.error('删除风机失败: ' + error.message);
      throw error;
    }
  };

  const removeWindTurbine = async (turbineId) => {
    let removedTurbine = null;
    let index = -1;
    try {
      index = windTurbines.value.findIndex((t) => t.id === turbineId);
      if (index === -1) {
        throw new Error('风机未找到');
      }

      removedTurbine = windTurbines.value[index];
      windTurbines.value.splice(index, 1);
      infoExists.value = false;

      const response = await axios.post(
        `/api/cases/${caseId.value}/wind-turbines`,
        windTurbines.value
      );

      if (!response.data.success) {
        throw new Error(response.data.message || '更新风机数据失败');
      }

      ElMessage.success('风力涡轮机删除成功');
    } catch (error) {
      console.error('Error removing wind turbine:', error);
      ElMessage.error('删除风机失败: ' + error.message);

      if (removedTurbine && index !== -1) {
        windTurbines.value.splice(index, 0, removedTurbine);
      }
      throw error;
    }
  };

  const updateWindTurbine = async (updatedTurbine) => {
    try {
      const response = await axios.put(`/api/cases/${caseId.value}/wind-turbines/${updatedTurbine.id}`, updatedTurbine);
      
      if (response.data.success) {
        const index = windTurbines.value.findIndex(t => t.id === updatedTurbine.id);
        if (index !== -1) {
          windTurbines.value[index] = response.data.turbine;
          ElMessage.success('风力涡轮机更新成功');
        }
      } else {
        throw new Error(response.data.message || '更新风机数据失败');
      }
    } catch (error) {
      console.error('Error updating wind turbine:', error);
      ElMessage.error('更新风机失败: ' + error.message);
      throw error;
    }
  };

  const setResults = (newResults) => {
    results.value = newResults;
    calculationStatus.value = 'completed';
  };

  const saveCalculationProgress = async () => {
    if (!currentCaseId.value) {
      console.error('No case ID available');
      return;
    }

    try {
      const progressData = {
        isCalculating: true,
        progress: overallProgress.value,
        tasks: tasks.value,
        outputs: calculationOutputs.value,
      };

      const response = await axios.post(
        `/api/cases/${currentCaseId.value}/calculation-progress`,
        progressData
      );

      if (!response.data.success) {
        throw new Error(response.data.message || '保存失败');
      }
    } catch (error) {
      console.error('\n 保存计算进度失败:', error);
    }
  };

  const resetCalculationProgress = () => {
    overallProgress.value = 0;
    calculationOutputs.value = [];
    tasks.value.forEach((task) => {
      task.status = 'pending';
    });
  };

  const loadCalculationProgress = async () => {
    try {
      const response = await axios.get(
        `/api/cases/${caseId.value}/calculation-progress`
      );
      if (response.data.progress) {
        return response.data.progress;
      }
    } catch (error) {
      console.error('加载计算进度失败:', error);
    }
    return null;
  };

  const startCalculation = async () => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/calculate`);
      if (response.data.success) {
        calculationStatus.value = 'running';
        calculationOutputs.value.push({
          type: 'info',
          message: 'Calculation started.',
        });
      } else {
        throw new Error(
          response.data.message || 'Failed to start calculation.'
        );
      }
    } catch (error) {
      calculationStatus.value = 'error';
      calculationOutputs.value.push({
        type: 'error',
        message: `Failed to start calculation: ${error.message}`,
      });
    }
  };

  const connectSocket = (id) => {
    if (!socket.value) {
      socket.value = io('http://localhost:5000', {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      caseId.value = id;
      socket.value.emit('joinCase', id);

      socket.value.on('calculationStarted', () => {
        calculationStatus.value = 'running';
        calculationOutputs.value.push({
          type: 'info',
          message: 'Calculation started.',
        });
      });

      socket.value.on('calculationProgress', (data) => {
        calculationOutputs.value.push({
          type: 'progress',
          message: `Calculation progress: ${data.progress}%`,
        });
      });

      socket.value.on('calculationCompleted', () => {
        calculationStatus.value = 'completed';
        calculationOutputs.value.push({
          type: 'success',
          message: 'Calculation completed successfully!',
        });
      });

      socket.value.on('calculationError', (error) => {
        calculationStatus.value = 'error';
        calculationOutputs.value.push({
          type: 'error',
          message: `Calculation error: ${error.message}`,
        });
      });
      listenToSocketEvents();
    }
  };

  const disconnectSocket = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
      calculationStatus.value = 'not_started';
      calculationOutputs.value = [];
    }
  };

  const listenToSocketEvents = () => {
    if (!socket.value) {
      console.error('Socket is not connected.');
      return;
    }
    socket.value.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  
    socket.value.on('connect_timeout', (timeout) => {
      console.error('Socket connection timeout:', timeout);
    });
  
    socket.value.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
  
    socket.value.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });
    socket.value.on("calculationStarted", () => {
        overallProgress.value = 0;
        calculationStatus.value = "running";
        calculationOutputs.value.push({
          type: "info",
          message: "Calculation started.",
        });
      });

    socket.value.on("calculationProgress", (data) => {
        overallProgress.value = data.progress;

        if (data.taskId) {
          const taskIndex = tasks.value.findIndex(
            (task) => task.id === data.taskId
          );
          if (taskIndex !== -1) {
            tasks.value[taskIndex].status = "running";
          }
        }
    
        calculationOutputs.value.push({
          type: "progress",
          message: `Calculation progress: ${data.progress}%`,
        });
      });

      socket.value.on("calculationCompleted", () => {
        calculationStatus.value = "completed";
        overallProgress.value = 100;
        calculationOutputs.value.push({
          type: "success",
          message: "Calculation completed successfully!",
        });
      });

      socket.value.on("calculationError", (error) => {
        calculationStatus.value = "error";
        calculationOutputs.value.push({
          type: "error",
          message: `Calculation error: ${error.message}`,
        });
      });
        socket.value.on("taskStarted", (taskId) => {
            const taskIndex = tasks.value.findIndex(
            (task) => task.id === taskId
            );
            if (taskIndex !== -1) {
            tasks.value[taskIndex].status = "running";
            }
        });
        socket.value.on("taskUpdate", (taskStatuses) => {
            tasks.value.forEach((task) => {
              if (taskStatuses[task.id]) {
                task.status = taskStatuses[task.id];
              }
            });
        });
        socket.value.on("calculationOutput", (output) => {
            calculationOutputs.value.push({ type: "output", message: output });
        });
          
  };

  const saveCurrentState = async () => {
    if (!currentCaseId.value) return;
    
    try {
      await axios.post(`/api/cases/${currentCaseId.value}/state`, {
        windTurbines: windTurbines.value
      });
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  const loadSavedState = async () => {
    if (!currentCaseId.value) return;
    
    try {
      const response = await axios.get(`/api/cases/${currentCaseId.value}/state`);
      if (response.data.windTurbines) {
        windTurbines.value = response.data.windTurbines;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  };

  return {
    caseId,
    caseName,
    currentCaseId,
    parameters,
    windTurbines,
    infoExists,
    results,
    calculationStatus,
    currentTask,
    overallProgress,
    calculationOutputs,
    tasks,
    hasFetchedCalculationStatus,
    socket,
    startTime,
    setResults,
    initializeCase,
    fetchCalculationStatus,
    submitParameters,
    generateInfoJson,
    downloadInfoJson,
    addWindTurbine,
    addBulkWindTurbines,
    fetchWindTurbines,
    deleteWindTurbine,
    removeWindTurbine,
    updateWindTurbine,
    saveCalculationProgress,
    resetCalculationProgress,
    loadCalculationProgress,
    connectSocket,
    disconnectSocket,
    startCalculation,
    listenToSocketEvents,
    saveCurrentState,
    loadSavedState
  };
});