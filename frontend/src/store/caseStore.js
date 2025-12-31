/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 19:55:12
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-21 20:39:10
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\caseStore.js
 * @Description: 这是 Pinia store 的一个综合版本，结合了新功能和更健壮的实现。
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
  // --- State ---
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
    terrain: {
      r1: 4000,
      r2: 5000,
    },
    roughness: {
      Cd: 0.2,        // 拖曳系数
      lad_max: 0.5,   // 最大叶面积密度
      vege_times: 1.0 // 植被高度缩放
    },
  });

  const windTurbines = ref([]);
  const infoExists = ref(false);
  const curveFiles = ref([]);
  const roughnessFile = ref(null); // 用于暂存粗糙度文件

  // --- Calculation & Progress State ---
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

  // --- Computed ---
  const geographicSize = computed(() => {
    if (
      typeof minLongitude.value !== 'number' ||
      typeof maxLongitude.value !== 'number' ||
      typeof minLatitude.value !== 'number' ||
      typeof maxLatitude.value !== 'number'
    ) {
      return { width: 0, height: 0 };
    }
    const R = 6371000; // 地球半径，单位：米
    const lat1Rad = minLatitude.value * Math.PI / 180;
    const lat2Rad = maxLatitude.value * Math.PI / 180;
    const midLatRad = ((minLatitude.value + maxLatitude.value) / 2) * Math.PI / 180;
    const deltaLatRad = (maxLatitude.value - minLatitude.value) * Math.PI / 180;
    const aHeight = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2);
    const cHeight = 2 * Math.atan2(Math.sqrt(aHeight), Math.sqrt(1 - aHeight));
    const height = R * cHeight;
    const deltaLonRad = (maxLongitude.value - minLongitude.value) * Math.PI / 180;
    const aWidthMid = Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2) * Math.cos(midLatRad) * Math.cos(midLatRad);
    const cWidth = 2 * Math.atan2(Math.sqrt(aWidthMid), Math.sqrt(1 - aWidthMid));
    const width = R * cWidth;
    return { width, height };
  });

  // --- Actions ---

  const unlockParameters = async () => {
    if (!caseId.value) throw new Error('工况ID无效，无法解锁参数。');
    try {
      const response = await axios.delete(`/api/cases/${caseId.value}/info`);
      if (response.data.success) {
        infoExists.value = false;
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

  // --- Curve Files Actions ---
  function setCurveFiles(files) {
    curveFiles.value = files;
  }

  async function uploadCurveFiles() {
    if (!caseId.value) throw new Error('工况未初始化，无法上传曲线文件');
    if (curveFiles.value.length === 0) {
      console.log('没有选择任何性能曲线文件，跳过上传。');
      return;
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
      throw error;
    }
  }

  // --- Roughness File Actions ---
  function setRoughnessFile(file) {
    roughnessFile.value = file;
  }

  async function uploadRoughnessFile() {
    if (!caseId.value) throw new Error('工况未初始化，无法上传粗糙度文件');
    if (!roughnessFile.value) {
      console.log('没有选择新的粗糙度文件，跳过上传。');
      return;
    }
    const form = new FormData();
    form.append('roughnessFile', roughnessFile.value, 'rou'); // 强制文件名为 'rou'
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/roughness-file`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        ElMessage.success('粗糙度数据文件上传成功');
        roughnessFile.value = null; // 上传成功后清除
      } else {
        throw new Error(response.data.message || '粗糙度文件上传失败');
      }
    } catch (error) {
      console.error('上传粗糙度文件时出错:', error);
      const errorMessage = error.response?.data?.message || error.message || '上传粗糙度文件时发生未知错误';
      ElMessage.error(errorMessage);
      throw error;
    }
  }

  async function deleteRoughnessFile() {
    if (!caseId.value) throw new Error('工况ID无效');
    try {
        const response = await axios.delete(`/api/cases/${caseId.value}/roughness-file`);
        if (!response.data.success) {
            throw new Error(response.data.message || '从服务器删除文件失败');
        }
    } catch (error) {
        console.error('删除粗糙度文件时出错:', error);
        const errorMessage = error.response?.data?.message || '删除粗糙度文件失败';
        ElMessage.error(errorMessage);
        throw error;
    }
  }

  // --- Case Management Actions ---
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
        const { parameters: backendParams, geographicBounds: bounds } = response.data;

        // 更新参数 (已有逻辑)
        if (backendParams) {
          parameters.value = { ...parameters.value, ...backendParams };
        }

        // [新增] 如果后端返回了地理边界，则恢复它们
        if (bounds) {
          minLatitude.value = bounds.minLat;
          maxLatitude.value = bounds.maxLat;
          minLongitude.value = bounds.minLon;
          maxLongitude.value = bounds.maxLon;
        }

        await fetchWindTurbines();
        const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
        infoExists.value = infoResponse.data.exists;
        await fetchCalculationStatus();
        connectSocket(id);

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
        calculationStatus.value = 'not_started';
        return false;
    }
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
      const backendStatus = response.data.calculationStatus;

      // [来自版本1的健壮性代码] 保护运行中的状态不被错误的后端状态覆盖
      if (calculationStatus.value === 'running' && backendStatus === 'not_started') {
        console.log('保护运行中的状态不被覆盖 (fetchCalculationStatus): 前端为 running, 后端为 not_started. 保持前端状态.');
        hasFetchedCalculationStatus.value = true;
        return true;
      }

      calculationStatus.value = backendStatus;
      hasFetchedCalculationStatus.value = true;
      return true;
    } catch (error) {
      console.error('获取计算状态失败:', error);
      if (!calculationStatus.value || calculationStatus.value === 'not_started') {
        calculationStatus.value = 'not_started';
      }
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
      // [来自版本2的更新] 包含 geographicBounds
      const payload = {
        parameters: parameters.value,
        windTurbines: windTurbines.value,
        geographicBounds: {
          minLat: minLatitude.value, maxLat: maxLatitude.value,
          minLon: minLongitude.value, maxLon: maxLongitude.value
        }
      };
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

  // --- Wind Turbine Actions ---
  const addWindTurbine = async (turbine) => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, turbine);
      if (response.data.success) {
        windTurbines.value = [...windTurbines.value, response.data.turbine];
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
        throw new Error('没有选择工况，请先创建或选择一个工况');
      }
      const response = await axios.post(
        `/api/cases/${currentCaseId.value}/wind-turbines/bulk`,
        turbines,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      if (response.data.success) {
        await fetchWindTurbines(); // Re-fetch all turbines to ensure consistency
        infoExists.value = false;
        return response.data.turbines || turbines;
      } else {
        throw new Error(response.data.message || '批量导入风机失败');
      }
    } catch (error) {
      console.error("caseStore.addBulkWindTurbines出错:", error);
      if (error.response) {
        throw new Error(`服务器返回错误: ${error.response.status} - ${error.response.data.message || '未知错误'}`);
      } else if (error.request) {
        throw new Error('服务器没有响应，请检查网络连接');
      }
      throw error;
    }
  };

  const fetchWindTurbines = async () => {
    if (!currentCaseId.value) {
      windTurbines.value = [];
      return;
    }
    try {
      const response = await axios.get(`/api/cases/${currentCaseId.value}/wind-turbines`);
      if (response.data && Array.isArray(response.data.turbines)) {
        windTurbines.value = response.data.turbines;
      } else {
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
        infoExists.value = false;
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

  const updateWindTurbine = async (updatedTurbine) => {
    try {
      const response = await axios.put(`/api/cases/${caseId.value}/wind-turbines/${updatedTurbine.id}`, updatedTurbine);
      if (response.data.success) {
        const index = windTurbines.value.findIndex(t => t.id === updatedTurbine.id);
        if (index !== -1) {
          windTurbines.value[index] = response.data.turbine;
        } else {
            windTurbines.value.push(response.data.turbine);
        }
        infoExists.value = false;
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

  // --- Calculation & Progress Actions ---
  const setResults = (newResults) => {
    results.value = newResults;
    calculationStatus.value = 'completed';
  };

  const saveCalculationProgress = async () => {
    if (!currentCaseId.value) return;
    try {
      const progressData = {
        status: calculationStatus.value,
        progress: overallProgress.value,
        tasks: tasks.value,
        outputs: calculationOutputs.value,
        startTime: startTime.value,
        timestamp: Date.now(),
        completed: calculationStatus.value === 'completed' && overallProgress.value === 100
      };
      await axios.post(`/api/cases/${currentCaseId.value}/calculation-progress`, progressData);
    } catch (error) {
      console.error('保存计算进度失败:', error.message || error);
    }
  };

  const resetCalculationProgress = () => {
    calculationStatus.value = 'not_started';
    overallProgress.value = 0;
    calculationOutputs.value = [];
    const newTasks = {};
    knownTasks.forEach(task => { newTasks[task.id] = 'pending'; });
    tasks.value = newTasks;
    currentTask.value = null;
    startTime.value = null;
  };

  const loadCalculationProgress = async () => {
    if (!caseId.value) return null;
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-progress`);
      if (response.data && response.data.progress) {
        const prog = response.data.progress;
        overallProgress.value = prog.progress || 0;
        if (prog.tasks) {
            const persistentTasks = {};
            knownTasks.forEach(task => { persistentTasks[task.id] = prog.tasks[task.id] || 'pending'; });
            tasks.value = persistentTasks;
        } else {
            knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; });
        }
        calculationOutputs.value = prog.outputs || [];
        startTime.value = prog.startTime || null;
        return prog;
      }
    } catch (error) {
      if (error.response && error.response.status !== 404) {
          console.error('加载计算进度失败:', error);
      } else if (!error.response) {
          console.error('加载计算进度失败 (network or other error):', error);
      }
    }
    return null;
  };

  const startCalculation = async () => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/calculate`);
      if (response.data.success) {
        calculationStatus.value = 'running';
        startTime.value = Date.now();
        overallProgress.value = 0;
        knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; });
        calculationOutputs.value = [{ type: 'info', message: 'Calculation started via store.' }];
        await saveCalculationProgress();
      } else {
        throw new Error(response.data.message || 'Failed to start calculation via store.');
      }
    } catch (error) {
      calculationStatus.value = 'error';
      calculationOutputs.value.push({ type: 'error', message: `Failed to start calculation (store): ${error.message}` });
      await saveCalculationProgress();
    }
  };

  // --- Socket.io Actions (Robust version from code 1) ---
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
        socket.value.connect();
    } else if (!socket.value) {
        console.log("No socket instance, creating new one.");
        socket.value = io({ transports: ['websocket'], reconnectionAttempts: 5, timeout: 10000 });
    }

    caseId.value = id;

    // [关键] 移除所有旧的监听器，防止重复绑定
    if (socket.value) {
        socket.value.offAny();
    }

    // --- Attach Listeners ---
    socket.value.on('connect', () => {
      console.log('Socket connected:', socket.value.id);
      if (caseId.value) {
          socket.value.emit('joinCase', caseId.value);
          console.log(`Socket joined case room: ${caseId.value} on connect.`);
      }
    });
    socket.value.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    socket.value.on('connect_error', error => console.error('Socket connection error:', error));

    socket.value.on('calculationOutput', (output) => calculationOutputs.value.push({ type: 'output', message: output }));
    socket.value.on('taskUpdate', (taskStatuses) => {
      Object.assign(tasks.value, taskStatuses);
      saveCalculationProgress();
    });
    socket.value.on('calculationProgress', (data) => {
        overallProgress.value = data.progress;
        if (data.currentTaskName) currentTask.value = data.currentTaskName;
        saveCalculationProgress();
    });
    socket.value.on('calculationCompleted', () => {
        calculationStatus.value = 'completed';
        overallProgress.value = 100;
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'success', message: 'Calculation completed (socket)!' });
        saveCalculationProgress();
    });
    socket.value.on('calculationFailed', (error) => {
        calculationStatus.value = 'error';
        currentTask.value = null;
        const message = error?.message || 'Calculation failed (socket)';
        const details = error?.details ? `\n${error.details}` : '';
        calculationOutputs.value.push({ type: 'error', message: `Calculation failed (socket): ${message}${details}` });
        saveCalculationProgress();
    });
    socket.value.on('calculationError', (error) => {
        calculationStatus.value = 'error';
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'error', message: `Calculation error (socket): ${error.message || "Unknown error"}` });
        saveCalculationProgress();
    });
    socket.value.on('calculationStarted', (data) => {
        if (calculationStatus.value !== 'running') calculationStatus.value = 'running';
        if (data && data.startTime) startTime.value = data.startTime;
        else if (!startTime.value) startTime.value = Date.now();
        saveCalculationProgress();
    });
    
    // Wind Mast Store Listeners
    const windMastStore = useWindMastStore();
    socket.value.on('windmast_analysis_progress', (message) => windMastStore.addProgressMessage(message));
    socket.value.on('windmast_analysis_error', (errorMessage) => windMastStore.addProgressMessage(`后台错误: ${errorMessage}`));
    socket.value.on('windmast_analysis_complete', (data) => {
      const analysisId = data?.analysisId;
      if (data.success) {
        windMastStore.setAnalysisStatus('success');
        ElNotification({ title: '成功', message: '测风塔数据分析完成', type: 'success', duration: 4000 });
        if (analysisId) {
          windMastStore.fetchResults(analysisId);
        } else {
          console.warn('windmast_analysis_complete missing analysisId:', data);
        }
        if (data?.shouldRefreshList) {
          windMastStore.fetchSavedAnalyses();
        }
      } else {
        windMastStore.setAnalysisStatus('error', data.message || '分析失败', data.error || '');
        ElNotification({ title: '失败', message: `测风塔分析失败: ${data.message || ''}`, type: 'error', duration: 0 });
      }
    });

    if (socket.value && !socket.value.connected) {
      socket.value.connect();
    }
  };

  const disconnectSocket = () => {
    if (socket.value) {
      console.log("Disconnecting socket and removing listeners...");
      if (caseId.value) {
          socket.value.emit('leaveCase', caseId.value);
          console.log(`Socket left case room: ${caseId.value} on disconnect call.`);
      }
      // [关键] 移除所有监听器
      socket.value.offAny();
      socket.value.disconnect();
      socket.value = null;
      console.log("Socket disconnected and event listeners removed.");
    }
  };
  
  const listenToSocketEvents = () => {
    if (!socket.value) {
      console.error('Socket is not connected, cannot listen to events.');
      return;
    }
    console.log("listenToSocketEvents called. Ensure listeners are not duplicated as they are set in connectSocket.");
  };

  // --- Return all state and actions ---
  return {
    // State
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
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    curveFiles,
    roughnessFile,

    // Computed
    geographicSize,

    // Actions
    initializeCase,
    fetchCalculationStatus,
    submitParameters,
    generateInfoJson,
    downloadInfoJson,
    unlockParameters,
    
    setCurveFiles,
    uploadCurveFiles,
    setRoughnessFile,
    uploadRoughnessFile,
    deleteRoughnessFile,
    
    addWindTurbine,
    addBulkWindTurbines,
    fetchWindTurbines,
    deleteWindTurbine,
    updateWindTurbine,
    
    setResults,
    saveCalculationProgress,
    resetCalculationProgress,
    loadCalculationProgress,
    startCalculation,
    
    connectSocket,
    disconnectSocket,
    listenToSocketEvents,
  };
});
