/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 17:46:49
 * @FilePath: frontend/src/store/caseStore.js
 * @Description: Pinia 状态管理，包含工况初始化、参数管理、计算状态和持久化同步
 *
 * Copyright (c) 2024 by joe, All Rights Reserved.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage, ElNotification } from 'element-plus'; // Import ElNotification
import { knownTasks } from '../utils/tasks.js';
import { io } from 'socket.io-client';
import { useWindMastStore } from './windMastStore'; // *** IMPORT the new store ***

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
  // 持久化存储任务状态时，建议使用对象（键是 task id）
  const tasks = ref({});
  // 初始化时以 knownTasks 建立默认任务对象
  knownTasks.forEach(task => {
    tasks.value[task.id] = 'pending';
  });
  const hasFetchedCalculationStatus = ref(false);
  const socket = ref(null);
  const startTime = ref(null);
  const isSubmittingParameters = ref(false);

  const initializeCase = async (id, name) => {
    return new Promise(async (resolve, reject) => { // Make initializeCase return a Promise
      if (!id) {
        ElMessage.error('缺少工况ID');
        reject('缺少工况ID'); // Reject promise on error
        return;
      }
      currentCaseId.value = id;
      localStorage.setItem('currentCaseId', id);
      caseId.value = id;
      caseName.value = name || id;
      try {
        const response = await axios.get(`/api/cases/${caseId.value}/parameters`);
        if (response.data && response.data.parameters) {
          parameters.value = {
            ...parameters.value,
            ...response.data.parameters,
          };
        } else {
          ElMessage.warning('未找到工况参数，使用默认值');
        }
        await loadSavedState(); // Await loadSavedState
        const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
        infoExists.value = infoResponse.data.exists;
        await fetchCalculationStatus(); // Await fetchCalculationStatus

           // Connect or rejoin socket room *after* setting the ID
           connectSocket(id); // Ensure socket is connected/rejoined for this case

        // Reset wind mast store for the new case
        const windMastStore = useWindMastStore();
        windMastStore.resetState();
        // Fetch initial wind mast results if any exist
        windMastStore.fetchResults(id);

        resolve(); // Resolve promise after all async operations
      } catch (error) {
        console.error('Failed to initialize case:', error);
        ElMessage.error('初始化失败');
        reject(error); // Reject promise on error
      }
    });
  };

  const fetchCalculationStatus = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
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
      isSubmittingParameters.value = true;
      const response = await axios.post(`/api/cases/${caseId.value}/parameters`, parameters.value);
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
    } finally {
      isSubmittingParameters.value = false;
    }
  };

  const generateInfoJson = async () => {
    try {
      const payload = { parameters: parameters.value, windTurbines: windTurbines.value };
      const response = await axios.post(`/api/cases/${caseId.value}/info`, payload);
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
      const response = await axios.get(`/api/cases/${caseId.value}/info-download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'info.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      ElMessage.success('info.json 已下载');
    } catch (error) {
      console.error('Error downloading info.json:', error);
      ElMessage.error('下载 info.json 失败');
    }
  };

  const addWindTurbine = async (turbine) => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, turbine);
      if (response.data.success) {
        windTurbines.value.push(response.data.turbine);
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
      if (!currentCaseId.value) throw new Error('No case ID available');
      const response = await axios.post(`/api/cases/${currentCaseId.value}/wind-turbines/bulk`, turbines, {
        headers: { 'Content-Type': 'application/json' }
      });
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
      if (index === -1) throw new Error('风机未找到');
      removedTurbine = windTurbines.value[index];
      windTurbines.value.splice(index, 1);
      infoExists.value = false;
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, windTurbines.value);
      if (!response.data.success) throw new Error(response.data.message || '更新风机数据失败');
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

  // 保存持久化计算进度（同步 isCalculating、progress、tasks、outputs 字段）
  const saveCalculationProgress = async () => {
    if (!currentCaseId.value) {
      console.error('No case ID available');
      return;
    }
    try {
      const progressData = {
        isCalculating: overallProgress.value < 100,
        progress: overallProgress.value,
        tasks: tasks.value, // 以对象存储
        outputs: calculationOutputs.value,
        timestamp: Date.now(),
        completed: overallProgress.value === 100
      };
      const response = await axios.post(`/api/cases/${currentCaseId.value}/calculation-progress`, progressData);
      if (!response.data.success) {
        throw new Error(response.data.message || '保存失败');
      }
    } catch (error) {
      console.error('\n保存计算进度失败:', error);
    }
  };

  const resetCalculationProgress = () => {
    overallProgress.value = 0;
    calculationOutputs.value = [];
    // 重置任务状态
    const newTasks = {};
    knownTasks.forEach(task => {
      newTasks[task.id] = 'pending';
    });
    tasks.value = newTasks;
  };

  // 加载持久化计算进度，并根据 knownTasks 顺序组装任务数组
  const loadCalculationProgress = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-progress`);
      if (response.data && response.data.progress) {
        const prog = response.data.progress;
        overallProgress.value = prog.progress || 0;
        // prog.tasks 为对象格式，按照 knownTasks 顺序构造任务数组
        const persistentTasks = {};
        knownTasks.forEach(task => {
          persistentTasks[task.id] = prog.tasks && prog.tasks[task.id] ? prog.tasks[task.id] : 'pending';
        });
        tasks.value = persistentTasks;
        calculationOutputs.value = prog.outputs || [];
        if (Boolean(prog.completed)) { // 修改处：更安全的布尔类型检查
          calculationStatus.value = 'completed';
        }
        return prog;
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
        calculationOutputs.value.push({ type: 'info', message: 'Calculation started.' });
      } else {
        throw new Error(response.data.message || 'Failed to start calculation.');
      }
    } catch (error) {
      calculationStatus.value = 'error';
      calculationOutputs.value.push({ type: 'error', message: `Failed to start calculation: ${error.message}` });
    }
  };


  const connectSocket = (id) => {
    if (socket.value) { // Avoid reconnecting if already connected
        // If switching cases, potentially just rejoin the room
        if (caseId.value && caseId.value !== id) {
            socket.value.emit('leaveCase', caseId.value);
            console.log(`Socket left old case room: ${caseId.value}`);
        }
         if (!caseId.value || caseId.value !== id) {
             socket.value.emit('joinCase', id);
             console.log(`Socket joined new case room: ${id}`);
         }
         caseId.value = id; // Update the store's caseId
         return; // Already connected
    }

    // Establish new connection
    socket.value = io('http://localhost:5000', { // Your backend URL
      transports: ['websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    caseId.value = id; // Set initial caseId

    // --- Generic Socket Event Listeners ---
    socket.value.on('connect', () => {
      console.log('Socket connected:', socket.value.id);
      if (caseId.value) {
          socket.value.emit('joinCase', caseId.value); // Join room on connect/reconnect
      }
    });

    socket.value.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // Handle potential cleanup or UI updates on disconnect
    });

    socket.value.on('connect_error', error => console.error('Socket connection error:', error));
    socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout:', timeout));
    socket.value.on('reconnect_error', error => console.error('Socket reconnection error:', error));
    socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed'));


    // --- Calculation Specific Listeners (Keep Existing) ---
    socket.value.on('calculationStarted', () => {
      calculationStatus.value = 'running';
      calculationOutputs.value.push({ type: 'info', message: 'Calculation started.' });
    });
    socket.value.on('calculationProgress', (data) => {
      overallProgress.value = data.progress;
      if (data.taskId) {
        tasks.value[data.taskId] = 'running';
      }
      calculationOutputs.value.push({ type: 'progress', message: `Calculation progress: ${data.progress}%` });
    });
    socket.value.on('calculationCompleted', () => {
      calculationStatus.value = 'completed';
      overallProgress.value = 100;
      calculationOutputs.value.push({ type: 'success', message: 'Calculation completed successfully!' });
    });
    socket.value.on('calculationError', (error) => {
      calculationStatus.value = 'error';
      calculationOutputs.value.push({ type: 'error', message: `Calculation error: ${error.message}` });
    });
    socket.value.on('taskStarted', (taskId) => {
      tasks.value[taskId] = 'running';
    });
    socket.value.on('taskUpdate', (taskStatuses) => {
      Object.keys(tasks.value).forEach(taskId => {
        if (taskStatuses[taskId]) {
          tasks.value[taskId] = taskStatuses[taskId];
        }
      });
    });
    socket.value.on('calculationOutput', (output) => {
      calculationOutputs.value.push({ type: 'output', message: output });
    });


    // --- *** Wind Mast Analysis Listeners (NEW) *** ---
    const windMastStore = useWindMastStore(); // Get instance of the other store

    socket.value.on('windmast_analysis_progress', (message) => {
      // console.log('Socket received windmast_analysis_progress:', message);
      windMastStore.addProgressMessage(message);
    });

    socket.value.on('windmast_analysis_error', (errorMessage) => {
      console.error('Socket received windmast_analysis_error:', errorMessage);
      // Add to progress log, actual status set by 'complete' event
       windMastStore.addProgressMessage(`后台错误: ${errorMessage}`);
    });

    socket.value.on('windmast_analysis_complete', (data) => {
      console.log('Socket received windmast_analysis_complete:', data);
      if (data.success) {
        windMastStore.setAnalysisStatus('success'); // Set status
        ElNotification({ title: '成功', message: '测风塔数据分析完成', type: 'success', duration: 4000 });
        windMastStore.fetchResults(caseId.value); // Fetch results now
      } else {
        // Pass message and potential error details
        windMastStore.setAnalysisStatus('error', data.message || '分析失败', data.error || '');
        ElNotification({ title: '失败', message: `测风塔分析失败: ${data.message || ''}`, type: 'error', duration: 0 }); // Show persistent error
      }
    });

    console.log("Socket connected and all event listeners attached for case:", id);
  };

  const disconnectSocket = () => {
    if (socket.value) {
      console.log("Disconnecting socket and removing listeners...");
      // Remove calculation listeners
      socket.value.off("calculationStarted");
      socket.value.off("calculationProgress");
      socket.value.off("calculationCompleted");
      socket.value.off("calculationError");
      socket.value.off("taskStarted");
      socket.value.off("taskUpdate");
      socket.value.off("calculationOutput");

      // *** Remove Wind Mast listeners ***
      socket.value.off("windmast_analysis_progress");
      socket.value.off("windmast_analysis_error");
      socket.value.off("windmast_analysis_complete");

      // Remove generic listeners
      socket.value.off('connect');
      socket.value.off('disconnect');
      socket.value.off('connect_error');
      socket.value.off('connect_timeout');
      socket.value.off('reconnect_error');
      socket.value.off('reconnect_failed');


      if (caseId.value) {
          socket.value.emit('leaveCase', caseId.value); // Leave room before disconnecting
      }
      socket.value.disconnect();
      socket.value = null;
      caseId.value = null; // Reset caseId on disconnect
      console.log("Socket disconnected and event listeners removed.");

      // Optionally reset parts of the caseStore state here if needed
      // resetCalculationProgress(); // Example
    }
  };

  const listenToSocketEvents = () => {
    if (!socket.value) {
      console.error('Socket is not connected.');
      return;
    }
    socket.value.on('connect_error', error => console.error('Socket connection error:', error));
    socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout:', timeout));
    socket.value.on('reconnect_error', error => console.error('Socket reconnection error:', error));
    socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed'));
  };

  const saveCurrentState = async () => {
    if (!currentCaseId.value) return;
    try {
      await axios.post(`/api/cases/${currentCaseId.value}/state`, { windTurbines: windTurbines.value });
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
    isSubmittingParameters,
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