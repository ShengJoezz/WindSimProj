/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 12:10:40
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-15 19:30:21
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\caseStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
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
    calculationDomain: { width: 6500, height: 800 },
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
        // REMOVE: await loadSavedState(); // Remove call to deprecated function

        // ADD: Fetch turbines using the primary endpoint
        await fetchWindTurbines(); // Fetch data from /wind-turbines endpoint

        const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
        infoExists.value = infoResponse.data.exists;
        await fetchCalculationStatus(); // Await fetchCalculationStatus

           // Connect or rejoin socket room *after* setting the ID
           connectSocket(id); // Ensure socket is connected/rejoined for this case

        // Reset wind mast store for the new case
        const windMastStore = useWindMastStore();
        windMastStore.resetState();

// 只在特定路径下才加载测风塔分析结果
if (window.location.pathname.includes('/windmast')) {
  try {
    await windMastStore.fetchResults(id);
  } catch (error) {
    console.warn('预加载测风塔分析数据失败，可能分析尚未完成', error);
    // 错误处理，但不影响正常功能
  }
}

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
    console.log("caseStore.addBulkWindTurbines被调用，turbines数量:", turbines.length);
    console.log("当前工况ID:", currentCaseId.value);

    try {
      if (!currentCaseId.value) {
        console.error("没有有效的工况ID");
        throw new Error('没有选择工况，请先创建或选择一个工况');
      }

      console.log("开始API请求...");
      const response = await axios.post(
        `/api/cases/${currentCaseId.value}/wind-turbines/bulk`,
        turbines,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 增加超时时间
        }
      );

      console.log("API响应:", response.data);

      if (response.data.success) {
        // 注意：确保这里正确处理响应中的turbines数据
        // 有些API会返回新创建的风机对象，带有服务器生成的ID
        const newTurbines = response.data.turbines || turbines;

        console.log("收到的新风机数据:", newTurbines);
        console.log("更新store前，当前风机数量:", windTurbines.value.length);

        // 更新store状态，使用新数据替换或追加
        windTurbines.value = [...windTurbines.value, ...newTurbines];

        console.log("更新store后，当前风机数量:", windTurbines.value.length);

        // 标记info.json需要重新生成
        infoExists.value = false;

        // 返回新添加的风机数据
        return newTurbines;
      } else {
        throw new Error(response.data.message || '批量导入风机失败');
      }
    } catch (error) {
      console.error("caseStore.addBulkWindTurbines出错:", error);

      // 检查是否为网络或服务器错误
      if (error.response) {
        // 服务器返回非2xx响应
        console.error("服务器错误:", error.response.status, error.response.data);
        throw new Error(`服务器返回错误: ${error.response.status} - ${error.response.data.message || '未知错误'}`);
      } else if (error.request) {
        // 请求发出但没有收到响应
        console.error("无响应错误:", error.request);
        throw new Error('服务器没有响应，请检查网络连接');
      }

      throw error;
    }
  };

  // MODIFY: fetchWindTurbines logic
  const fetchWindTurbines = async () => {
    if (!currentCaseId.value) {
      console.warn("fetchWindTurbines: No current case ID.");
      windTurbines.value = []; // Set to empty if no ID
      return;
    }
    try {
      console.log(`Fetching turbines for case: ${currentCaseId.value}`);
      const response = await axios.get(`/api/cases/${currentCaseId.value}/wind-turbines`);
      if (response.data && Array.isArray(response.data.turbines)) {
        console.log(`Received ${response.data.turbines.length} turbines from API.`);
        // FIX: Directly assign the array from the backend
        windTurbines.value = response.data.turbines;
      } else {
        console.warn("API response for turbines was invalid or not an array:", response.data);
        windTurbines.value = []; // Set to empty on invalid response
      }
    } catch (error) {
      console.error("Failed to fetch wind turbines:", error);
      // Consider setting to empty or keeping old value based on desired behavior on error
      windTurbines.value = []; // Or keep existing: // windTurbines.value = windTurbines.value;
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


  // REMOVE: Deprecated state functions
  // const saveCurrentState = async () => { ... };
  // const loadSavedState = async () => { ... };


  // MODIFY: Return statement at the end
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
    // REMOVE: saveCurrentState,  // Remove from exported methods
    // REMOVE: loadSavedState    // Remove from exported methods
    fetchWindTurbines,  // Ensure fetchWindTurbines is exported if needed elsewhere, though initializeCase calls it
    // ... rest of the returned object ...
  };
});