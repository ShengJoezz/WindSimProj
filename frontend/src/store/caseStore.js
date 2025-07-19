/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 19:55:12
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-14 17:45:36
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\caseStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import { ElMessage, ElNotification } from 'element-plus';
import { knownTasks } from '../utils/tasks.js';
import { io } from 'socket.io-client';
import { useWindMastStore } from './windMastStore';

export const useCaseStore = defineStore('caseStore', () => {
  const caseId = ref(null);
  const caseName = ref(null);
  const currentCaseId = ref(localStorage.getItem('currentCaseId') || null);
  const minLatitude = ref(null);
  const maxLatitude = ref(null);
  const minLongitude = ref(null);
  const maxLongitude = ref(null);
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
  const curveFiles = ref([]); // ===== 新增: State for curve files =====

  // ==========================================================
  // [新增] 在这里添加计算地理尺寸的 computed 属性
  // ==========================================================
  const geographicSize = computed(() => {
    if (
      typeof minLongitude.value !== 'number' ||
      typeof maxLongitude.value !== 'number' ||
      typeof minLatitude.value !== 'number' ||
      typeof maxLatitude.value !== 'number'
    ) {
      return { width: 0, height: 0 };
    }

    // 使用 Haversine 公式进行更精确的距离计算
    // 这比简单的常数乘法在不同纬度下更准确
    const R = 6371000; // 地球半径，单位：米

    const lat1Rad = minLatitude.value * Math.PI / 180;
    const lat2Rad = maxLatitude.value * Math.PI / 180;
    const midLatRad = ((minLatitude.value + maxLatitude.value) / 2) * Math.PI / 180;
    
    // 计算高度 (纬度差)
    const deltaLatRad = (maxLatitude.value - minLatitude.value) * Math.PI / 180;
    const aHeight = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2);
    const cHeight = 2 * Math.atan2(Math.sqrt(aHeight), Math.sqrt(1 - aHeight));
    const height = R * cHeight;
    
    // 计算宽度 (经度差)，需要在地形的中心纬度进行计算
    const deltaLonRad = (maxLongitude.value - minLongitude.value) * Math.PI / 180;
    const aWidth = Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    // 使用中点纬度计算更准确
    const aWidthMid = Math.sin(deltaLonRad/2) * Math.sin(deltaLonRad/2) * Math.cos(midLatRad) * Math.cos(midLatRad);
    const cWidth = 2 * Math.atan2(Math.sqrt(aWidthMid), Math.sqrt(1 - aWidthMid));
    const width = R * cWidth;

    return { width, height };
  });
  const results = ref({});
  const calculationStatus = ref('not_started');
  const currentTask = ref(null);
  const overallProgress = ref(0);
  const calculationOutputs = ref([]);
  const tasks = ref({});
  knownTasks.forEach(task => {
    tasks.value[task.id] = 'pending';
  });
  const hasFetchedCalculationStatus = ref(false);
  const socket = ref(null);
  const startTime = ref(null);
  const isSubmittingParameters = ref(false);
  
  const unlockParameters = async () => {
    if (!caseId.value) {
      throw new Error('工况ID无效，无法解锁参数。');
    }
    try {
      const response = await axios.delete(`/api/cases/${caseId.value}/info`);
      if (response.data.success) {
        infoExists.value = false;
        // 重置计算状态，因为旧的计算结果和进度不再与当前参数匹配
        if (calculationStatus.value === 'completed' || calculationStatus.value === 'error') {
            calculationStatus.value = 'not_started';
        }
        return true;
      } else {
        throw new Error(response.data.message || '解锁参数失败');
      }
    } catch (error) {
      console.error('解锁参数时出错:', error);
      const errorMessage = error.response?.data?.message || '解锁参数时发生未知错误';
      ElMessage.error(errorMessage);
      throw error;
    }
  };
  // ===== 新增: Mutator for curve files =====
  function setCurveFiles(files) {
    curveFiles.value = files;
  }

  // ===== 新增: Action to upload curve files =====
  async function uploadCurveFiles() {
    if (!caseId.value) throw new Error('工况未初始化，无法上传曲线文件');
    if (curveFiles.value.length === 0) {
      console.log('没有选择任何性能曲线文件，跳过上传。');
      return; // Nothing to do
    }
  
    const form = new FormData();
    curveFiles.value.forEach(f => form.append('curveFiles', f, f.name));
  
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/curve-files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        ElMessage.success(`成功上传 ${response.data.files.length} 个性能曲线文件`);
      } else {
        throw new Error(response.data.message || '曲线文件上传失败');
      }
    } catch (error) {
      console.error('上传性能曲线时出错:', error);
      const errorMessage = error.response?.data?.message || error.message || '上传性能曲线时发生未知错误';
      ElMessage.error(errorMessage);
      throw error; // Re-throw to stop the calling process (e.g., handleGenerateClick)
    }
  }


  const initializeCase = async (id, name) => {
    return new Promise(async (resolve, reject) => {
      if (!id) {
        ElMessage.error('缺少工况ID');
        reject('缺少工况ID');
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

        await fetchWindTurbines();
        const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
        infoExists.value = infoResponse.data.exists;
        await fetchCalculationStatus(); // Fetch status after case ID is set

        connectSocket(id); // Connect or rejoin socket room

        const windMastStore = useWindMastStore();
        windMastStore.resetState();

        if (window.location.pathname.includes('/windmast')) {
          try {
            await windMastStore.fetchResults(id);
          } catch (error) {
            console.warn('预加载测风塔分析数据失败，可能分析尚未完成', error);
          }
        }
        resolve();
      } catch (error) {
        console.error('Failed to initialize case:', error);
        ElMessage.error('初始化失败');
        reject(error);
      }
    });
  };

  const fetchCalculationStatus = async () => {
    if (!caseId.value) {
        console.warn("fetchCalculationStatus called without caseId.");
        calculationStatus.value = 'not_started'; // Default if no caseId
        return false;
    }
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
      const backendStatus = response.data.calculationStatus;

      // MODIFICATION: Protect running state
      if (calculationStatus.value === 'running' && backendStatus === 'not_started') {
        console.log('保护运行中的状态不被覆盖 (fetchCalculationStatus): 前端为 running, 后端为 not_started. 保持前端状态.');
        // Optionally, you might want to schedule another check or rely on socket updates.
        // For now, we just don't overwrite.
        hasFetchedCalculationStatus.value = true; // We did fetch, even if we didn't apply.
        return true; // Indicate fetch was "successful" in the sense of getting a response
      }

      calculationStatus.value = backendStatus;
      hasFetchedCalculationStatus.value = true;
      return true;
    } catch (error) {
      console.error('获取计算状态失败:', error);
      // MODIFICATION: Conditional reset of status on error
      if (!calculationStatus.value || calculationStatus.value === 'not_started') {
        calculationStatus.value = 'not_started';
      }
      // If calculationStatus.value was 'running', 'completed', etc., a network error
      // during fetch won't reset it to 'not_started'.
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
      // --- 修改开始 ---
      // 原来的代码 (修改数组)
      // windTurbines.value.push(response.data.turbine);

      // 新的代码 (替换数组)
      windTurbines.value = [...windTurbines.value, response.data.turbine];
      // --- 修改结束 ---

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
          timeout: 30000
        }
      );
      console.log("API响应:", response.data);
      if (response.data.success) {
        const newTurbines = response.data.turbines || turbines;
        console.log("收到的新风机数据:", newTurbines);
        console.log("更新store前，当前风机数量:", windTurbines.value.length);
        // windTurbines.value = [...windTurbines.value, ...newTurbines]; // This might duplicate if backend returns all
        await fetchWindTurbines(); // Re-fetch all turbines to ensure consistency
        console.log("更新store后，当前风机数量:", windTurbines.value.length);
        infoExists.value = false;
        return newTurbines; // Or response.data.turbines if it contains only the newly added ones with IDs
      } else {
        throw new Error(response.data.message || '批量导入风机失败');
      }
    } catch (error) {
      console.error("caseStore.addBulkWindTurbines出错:", error);
      if (error.response) {
        console.error("服务器错误:", error.response.status, error.response.data);
        throw new Error(`服务器返回错误: ${error.response.status} - ${error.response.data.message || '未知错误'}`);
      } else if (error.request) {
        console.error("无响应错误:", error.request);
        throw new Error('服务器没有响应，请检查网络连接');
      }
      throw error;
    }
  };

  const fetchWindTurbines = async () => {
    if (!currentCaseId.value) {
      console.warn("fetchWindTurbines: No current case ID.");
      windTurbines.value = [];
      return;
    }
    try {
      console.log(`Fetching turbines for case: ${currentCaseId.value}`);
      const response = await axios.get(`/api/cases/${currentCaseId.value}/wind-turbines`);
      if (response.data && Array.isArray(response.data.turbines)) {
        console.log(`Received ${response.data.turbines.length} turbines from API.`);
        windTurbines.value = response.data.turbines;
      } else {
        console.warn("API response for turbines was invalid or not an array:", response.data);
        windTurbines.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch wind turbines:", error);
      windTurbines.value = [];
    }
  };

  const deleteWindTurbine = async (turbineId) => {
    try {
      const response = await axios.delete(`/api/cases/${caseId.value}/wind-turbines/${turbineId}`);
      if (response.data.success) {
        windTurbines.value = windTurbines.value.filter(t => t.id !== turbineId);
        infoExists.value = false; // Info needs regeneration
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

  const removeWindTurbine = async (turbineId) => { // This seems like a duplicate of deleteWindTurbine or an older version. Keeping deleteWindTurbine as it's more standard REST.
    // If this has specific frontend-only logic before backend call, clarify. Otherwise, prefer deleteWindTurbine.
    // For now, assuming deleteWindTurbine is the primary one.
    console.warn("removeWindTurbine called. Consider using deleteWindTurbine for consistency.");
    await deleteWindTurbine(turbineId); // Delegate to the more standard one
  };

  const updateWindTurbine = async (updatedTurbine) => {
    try {
      const response = await axios.put(`/api/cases/${caseId.value}/wind-turbines/${updatedTurbine.id}`, updatedTurbine);
      if (response.data.success) {
        const index = windTurbines.value.findIndex(t => t.id === updatedTurbine.id);
        if (index !== -1) {
          windTurbines.value[index] = response.data.turbine; // Use the turbine data from response
        } else {
            windTurbines.value.push(response.data.turbine); // If somehow not found, add it
        }
        infoExists.value = false; // Info needs regeneration
        ElMessage.success('风力涡轮机更新成功');
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
    calculationStatus.value = 'completed'; // This implies calculation is done when results are set.
  };

  const saveCalculationProgress = async () => {
    if (!currentCaseId.value) {
      console.error('No case ID available for saving progress');
      return;
    }
    try {
      const progressData = {
        // isCalculating: calculationStatus.value === 'running', // More reliable to use status
        status: calculationStatus.value, // Persist current status
        progress: overallProgress.value,
        tasks: tasks.value,
        outputs: calculationOutputs.value, // This is an array of log objects
        startTime: startTime.value, // Persist start time
        timestamp: Date.now(),
        completed: calculationStatus.value === 'completed' && overallProgress.value === 100
      };
      const response = await axios.post(`/api/cases/${currentCaseId.value}/calculation-progress`, progressData);
      if (!response.data.success) {
        throw new Error(response.data.message || '保存进度失败');
      }
    } catch (error) {
      console.error('保存计算进度失败:', error.message || error);
    }
  };

  const resetCalculationProgress = () => {
    calculationStatus.value = 'not_started'; // Explicitly set status
    overallProgress.value = 0;
    calculationOutputs.value = [];
    const newTasks = {};
    knownTasks.forEach(task => {
      newTasks[task.id] = 'pending';
    });
    tasks.value = newTasks;
    currentTask.value = null;
    startTime.value = null;
    // Do not call saveCalculationProgress here automatically, let the component decide if reset needs saving.
  };

  const loadCalculationProgress = async () => {
    if (!caseId.value) {
        console.warn("loadCalculationProgress called without caseId.");
        return null;
    }
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-progress`);
      if (response.data && response.data.progress) { // Assuming backend wraps it in 'progress'
        const prog = response.data.progress;

        // Important: Only apply saved status if it's more "advanced" or consistent.
        // For example, don't let a saved 'not_started' overwrite an in-memory 'running'.
        // The component (CalculationOutput.vue) onMounted handles this logic better.
        // This function should primarily just load and return the data.
        // The store's state can be updated by the component based on this loaded data.

        overallProgress.value = prog.progress || 0;
        if (prog.tasks) {
            const persistentTasks = {};
            knownTasks.forEach(task => {
              persistentTasks[task.id] = prog.tasks[task.id] || 'pending';
            });
            tasks.value = persistentTasks;
        } else {
            // Reset tasks if not in saved data
            knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; });
        }
        calculationOutputs.value = prog.outputs || [];
        startTime.value = prog.startTime || null; // Load start time

        // Set calculationStatus from persisted data if it's definitive (completed/error)
        // Or if it's 'running' and timestamp is recent (though 'running' should ideally be confirmed by backend)
        // For simplicity, the component will handle status updates more robustly.
        if (prog.status) {
             // Allow component to decide if this status should be applied
             // calculationStatus.value = prog.status;
        } else if (prog.completed) { // Legacy 'completed' field
             // calculationStatus.value = 'completed';
        }

        return prog; // Return the loaded progress object
      }
    } catch (error) {
      // If 404, means no progress saved, which is fine.
      if (error.response && error.response.status !== 404) {
          console.error('加载计算进度失败:', error);
      } else if (!error.response) {
          console.error('加载计算进度失败 (network or other error):', error);
      }
    }
    return null;
  };

  const startCalculation = async () => { // This is called by the component, which handles UI. Store might not need its own.
    // The component `CalculationOutput.vue` directly calls the API `/api/cases/${caseId}/calculate`.
    // This store method might be redundant if component handles it.
    // If kept, ensure it aligns with component's logic.
    console.warn("store.startCalculation() called. This logic is primarily in CalculationOutput.vue's startComputation().");
    try {
      // This should mirror what the component does: call API, then update status.
      const response = await axios.post(`/api/cases/${caseId.value}/calculate`);
      if (response.data.success) {
        calculationStatus.value = 'running';
        startTime.value = Date.now();
        overallProgress.value = 0; // Reset progress
        knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; }); // Reset tasks
        calculationOutputs.value = [{ type: 'info', message: 'Calculation started via store.' }];
        await saveCalculationProgress();
      } else {
        throw new Error(response.data.message || 'Failed to start calculation via store.');
      }
    } catch (error) {
      calculationStatus.value = 'error'; // Or 'not_started' depending on error
      calculationOutputs.value.push({ type: 'error', message: `Failed to start calculation (store): ${error.message}` });
      await saveCalculationProgress(); // Save error state
    }
  };


  const connectSocket = (id) => {
    if (socket.value && socket.value.connected && caseId.value === id) {
        console.log(`Socket already connected and in room for case: ${id}`);
        return;
    }
    if (socket.value && socket.value.connected && caseId.value !== id) {
        socket.value.emit('leaveCase', caseId.value);
        console.log(`Socket left old case room: ${caseId.value}`);
        socket.value.emit('joinCase', id);
        console.log(`Socket joined new case room: ${id}`);
        caseId.value = id;
        return;
    }
    if (socket.value && !socket.value.connected) {
        console.log("Socket exists but not connected, attempting to connect...");
        socket.value.connect(); // Attempt to reconnect existing instance
        // Listeners should still be attached. If it connects, it will join room.
    } else if (!socket.value) {
        console.log("No socket instance, creating new one.");
        socket.value = io( {
          transports: ['websocket'],
          reconnectionAttempts: 5,
          timeout: 10000,
          // autoConnect: false, // Connect manually if needed
        });
    }

    caseId.value = id;

    // Remove all existing listeners before attaching new ones to prevent duplicates if re-called
    if(socket.value){
        socket.value.offAny(); // Removes all listeners
    }

    socket.value.on('connect', () => {
      console.log('Socket connected:', socket.value.id);
      if (caseId.value) {
          socket.value.emit('joinCase', caseId.value);
          console.log(`Socket joined case room: ${caseId.value} on connect.`);
      }
    });

    socket.value.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // No need to set calculationStatus here, rely on API polling or manual restart
    });

    socket.value.on('connect_error', error => console.error('Socket connection error:', error));
    socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout:', timeout));
    socket.value.on('reconnect_attempt', attempt => console.log(`Socket reconnect attempt ${attempt}`));
    socket.value.on('reconnect_error', error => console.error('Socket reconnection error:', error));
    socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed'));
    socket.value.on('reconnect', attempt => console.log(`Socket reconnected after ${attempt} attempts`));


    // Calculation Specific Listeners from component are primary. Store can also listen.
    // These mirror what the component listens for.
    socket.value.on('calculationOutput', (output) => {
        calculationOutputs.value.push({ type: 'output', message: output });
        // No direct UI update here, component handles that.
    });
    socket.value.on('taskUpdate', (taskStatuses) => {
        Object.keys(taskStatuses).forEach(taskId => {
            if (tasks.value.hasOwnProperty(taskId)) {
                tasks.value[taskId] = taskStatuses[taskId];
            }
        });
        saveCalculationProgress(); // Save progress on task update
    });
    socket.value.on('calculationProgress', (data) => {
        overallProgress.value = data.progress;
        if (data.currentTaskName) currentTask.value = data.currentTaskName;
        // startTime might be set here if backend sends it
        saveCalculationProgress(); // Save progress
    });
    socket.value.on('calculationCompleted', () => {
        calculationStatus.value = 'completed';
        overallProgress.value = 100;
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'success', message: 'Calculation completed (socket)!' });
        saveCalculationProgress();
    });
    socket.value.on('calculationError', (error) => { // error is {message: string}
        calculationStatus.value = 'error';
        const errorMessage = error.message || "Unknown calculation error from socket";
        currentTask.value = null; // Clear current task on error
        calculationOutputs.value.push({ type: 'error', message: `Calculation error (socket): ${errorMessage}` });
        saveCalculationProgress();
    });
    // calculationStarted is handled by component setting status to 'running' after API call.
    // If backend sends 'calculationStarted' event, can use it for confirmation:
    socket.value.on('calculationStarted', (data) => { // data might include { startTime }
        if (calculationStatus.value !== 'running') { // If not already set to running by optimistic update
            calculationStatus.value = 'running';
        }
        if(data && data.startTime) startTime.value = data.startTime;
        else if(!startTime.value) startTime.value = Date.now(); // Fallback
        console.log("Calculation started event received from socket.");
        saveCalculationProgress();
    });


    const windMastStore = useWindMastStore();
    socket.value.on('windmast_analysis_progress', (message) => {
      windMastStore.addProgressMessage(message);
    });
    socket.value.on('windmast_analysis_error', (errorMessage) => {
      console.error('Socket received windmast_analysis_error:', errorMessage);
      windMastStore.addProgressMessage(`后台错误: ${errorMessage}`);
    });
    socket.value.on('windmast_analysis_complete', (data) => {
      console.log('Socket received windmast_analysis_complete:', data);
      if (data.success) {
        windMastStore.setAnalysisStatus('success');
        ElNotification({ title: '成功', message: '测风塔数据分析完成', type: 'success', duration: 4000 });
        windMastStore.fetchResults(caseId.value);
      } else {
        windMastStore.setAnalysisStatus('error', data.message || '分析失败', data.error || '');
        ElNotification({ title: '失败', message: `测风塔分析失败: ${data.message || ''}`, type: 'error', duration: 0 });
      }
    });

    if (socket.value && !socket.value.connected) {
      socket.value.connect(); // Manually connect if not already connected
      console.log("Attempting to connect socket for case:", id);
    } else if (socket.value && socket.value.connected && caseId.value){
        // If already connected, ensure it's in the correct room (handled at start of function)
    }
  };

  const disconnectSocket = () => {
    if (socket.value) {
      console.log("Disconnecting socket and removing listeners...");
      if (caseId.value) {
          socket.value.emit('leaveCase', caseId.value);
          console.log(`Socket left case room: ${caseId.value} on disconnect call.`);
      }
      socket.value.offAny(); // Remove all listeners
      socket.value.disconnect();
      socket.value = null;
      // Do not reset caseId here, it might be needed if page isn't fully unmounted
      console.log("Socket disconnected and event listeners removed.");
    }
  };

  const listenToSocketEvents = () => { // This function seems to mostly re-attach generic error listeners.
                                     // The main event listeners are attached in connectSocket.
    if (!socket.value) {
      console.error('Socket is not connected, cannot listen to events.');
      return;
    }
    // These are usually attached once during io() or connectSocket.
    // Re-attaching them here might not be necessary if connectSocket handles it comprehensively.
    // socket.value.on('connect_error', error => console.error('Socket connection error (listenToSocketEvents):', error));
    // socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout (listenToSocketEvents):', timeout));
    // socket.value.on('reconnect_error', error => console.error('Socket reconnection error (listenToSocketEvents):', error));
    // socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed (listenToSocketEvents)'));
    console.log("listenToSocketEvents called. Ensure listeners are not duplicated.");
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
    removeWindTurbine, // Consider deprecating if deleteWindTurbine is sufficient
    updateWindTurbine,
    saveCalculationProgress,
    resetCalculationProgress,
    loadCalculationProgress,
    connectSocket,
    disconnectSocket,
    startCalculation, // Component primarily handles this
    listenToSocketEvents,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    geographicSize,
    // ===== 新增: Export new state and actions =====
    curveFiles,
    setCurveFiles,
    uploadCurveFiles,
    unlockParameters,
  };
});