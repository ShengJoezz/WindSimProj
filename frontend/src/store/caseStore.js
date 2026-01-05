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
import { knownTasks } from '../utils/tasks.js';
import { io } from 'socket.io-client';
import { useWindMastStore } from './windMastStore';
import { notifyError, notifySuccess } from '../utils/notify.js';

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
  let socketRoomCaseId = null;
  const startTime = ref(null);
  const calculationProgressMeta = ref(null);
  const isSubmittingParameters = ref(false);
  const visualizationStatus = ref(null); // null | 'not_run' | 'starting' | 'running' | 'completed' | 'failed'
  const visualizationMessages = ref([]);
  const visualizationLastError = ref('');

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
      notifyError(error, '解锁参数失败');
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
        notifySuccess(`成功上传 ${response.data.files.length} 个性能曲线文件`);
      } else {
        throw new Error(response.data.message || '曲线文件上传失败');
      }
    } catch (error) {
      console.error('上传性能曲线时出错:', error);
      notifyError(error, '上传性能曲线失败');
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
        notifySuccess('粗糙度数据文件上传成功');
        roughnessFile.value = null; // 上传成功后清除
      } else {
        throw new Error(response.data.message || '粗糙度文件上传失败');
      }
    } catch (error) {
      console.error('上传粗糙度文件时出错:', error);
      notifyError(error, '上传粗糙度文件失败');
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
        notifyError(error, '删除粗糙度文件失败');
        throw error;
    }
  }

  // --- Case Management Actions ---
  const initializeCase = async (id, name) => {
	    return new Promise(async (resolve, reject) => {
	      if (!id) {
	        notifyError('缺少工况ID');
	        reject('缺少工况ID');
	        return;
	      }
	      // Clear transient file selections when switching cases to avoid mis-submitting uploads.
	      if (currentCaseId.value && currentCaseId.value !== id) {
	        curveFiles.value = [];
	        roughnessFile.value = null;
	      }
        // Reset visualization events when switching cases to avoid mixing logs across tabs/cases.
        visualizationStatus.value = null;
        visualizationMessages.value = [];
        visualizationLastError.value = '';
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
        try {
          await loadCalculationProgress();
        } catch (e) {
          console.warn('加载持久化进度失败（将继续使用实时进度）:', e?.message || e);
        }
        connectSocket(id);

        const windMastStore = useWindMastStore();
        windMastStore.resetState();
        resolve();
      } catch (error) {
        console.error('Failed to initialize case:', error);
        notifyError(error, '初始化失败');
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
      visualizationStatus.value = response.data.visualizationStatus ?? visualizationStatus.value;

      const deriveStatusFromProgress = (prog) => {
        if (!prog || typeof prog !== 'object') return null;
        if (prog.status === 'running' || prog.isCalculating === true) return 'running';
        if (prog.status === 'completed' || prog.completed === true || prog.progress === 100) return 'completed';
        if (prog.status === 'canceled' || prog.canceled === true) return 'canceled';
        if (prog.status === 'error' || prog.timeout === true) return 'error';
        return null;
      };

      const progressDerivedStatus = deriveStatusFromProgress(calculationProgressMeta.value);
      let effectiveStatus = backendStatus;

      // When backend reports "not_started", use persisted progress metadata to show
      // a more accurate user-facing status (canceled / timeout / completed / still running).
      if (backendStatus === 'not_started') {
        if (progressDerivedStatus) effectiveStatus = progressDerivedStatus;
      } else if (backendStatus === 'unknown' || backendStatus === 'error_reading_status') {
        if (progressDerivedStatus) effectiveStatus = progressDerivedStatus;
      }

      // [来自版本1的健壮性代码] 保护运行中的状态不被错误的后端状态覆盖
      if (calculationStatus.value === 'running' && effectiveStatus === 'not_started') {
        console.log('保护运行中的状态不被覆盖 (fetchCalculationStatus): 前端为 running, 后端为 not_started. 保持前端状态.');
        hasFetchedCalculationStatus.value = true;
        return true;
      }

      calculationStatus.value = effectiveStatus;
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
        notifySuccess('参数保存成功');
        infoExists.value = false;
      } else {
        throw new Error(response.data.message || '参数保存失败');
      }
    } catch (error) {
      console.error('Error submitting parameters:', error);
      notifyError(error, '参数提交失败');
      throw error;
    } finally {
      isSubmittingParameters.value = false;
    }
  };

  const generateInfoJson = async () => {
    try {
      const hasGeographicBounds = [
        minLatitude.value,
        maxLatitude.value,
        minLongitude.value,
        maxLongitude.value,
      ].every((v) => typeof v === 'number' && Number.isFinite(v));

      const payload = {
        parameters: parameters.value,
        windTurbines: windTurbines.value,
      };

      if (hasGeographicBounds) {
        payload.geographicBounds = {
          minLat: minLatitude.value,
          maxLat: maxLatitude.value,
          minLon: minLongitude.value,
          maxLon: maxLongitude.value,
        };
      } else {
        console.warn('No geographicBounds in store; generating info.json without bounds (backend will fallback).');
      }

      const response = await axios.post(`/api/cases/${caseId.value}/info`, payload);
      if (response.data.success) {
        notifySuccess('info.json 生成成功');
        infoExists.value = true;
      } else {
        throw new Error(response.data.message || '生成 info.json 失败');
      }
    } catch (error) {
      console.error('Error generating info.json:', error);
      notifyError(error, '生成 info.json 失败');
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
      notifySuccess('info.json 已下载');
    } catch (error) {
      console.error('Error downloading info.json:', error);
      notifyError(error, '下载 info.json 失败');
    }
  };

  // --- Wind Turbine Actions ---
  const addWindTurbine = async (turbine) => {
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, turbine);
      if (response.data.success) {
        windTurbines.value = [...windTurbines.value, response.data.turbine];
        infoExists.value = false;
        notifySuccess('风力涡轮机添加成功');
      } else {
        throw new Error(response.data.message || '保存风机数据失败');
      }
    } catch (error) {
      console.error('Error adding wind turbine:', error);
      notifyError(error, '添加风机失败');
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
        notifySuccess('风力涡轮机删除成功');
      } else {
        throw new Error(response.data.message || '删除风机数据失败');
      }
    } catch (error) {
      console.error('Error deleting wind turbine:', error);
      notifyError(error, '删除风机失败');
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
        notifySuccess('风力涡轮机更新成功');
      } else {
        throw new Error(response.data.message || '更新风机数据失败');
      }
    } catch (error) {
      console.error('Error updating wind turbine:', error);
      notifyError(error, '更新风机失败');
      throw error;
    }
  };

  // --- Calculation & Progress Actions ---
  const setResults = (newResults) => {
    results.value = newResults;
    calculationStatus.value = 'completed';
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
    calculationProgressMeta.value = null;
  };

  const loadCalculationProgress = async () => {
    if (!caseId.value) return null;
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-progress`);
      if (response.data && response.data.progress) {
        const prog = response.data.progress;
        calculationProgressMeta.value = prog;
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

        // Reconcile status based on persisted metadata when backend reports not_started.
        const isRunning = prog.status === 'running' || prog.isCalculating === true;
        const isCompleted = prog.status === 'completed' || prog.completed === true || prog.progress === 100;
        const isCanceled = prog.status === 'canceled' || prog.canceled === true;
        const isTimeoutOrError = prog.status === 'error' || prog.timeout === true;

        const canOverrideToRunning = ['running', 'not_started', 'unknown', 'error_reading_status'].includes(calculationStatus.value);
        if (isRunning && canOverrideToRunning) {
          calculationStatus.value = 'running';
        } else if (isCompleted) {
          calculationStatus.value = 'completed';
        } else if (isCanceled && ['not_started', 'unknown', 'error_reading_status'].includes(calculationStatus.value)) {
          calculationStatus.value = 'canceled';
        } else if (isTimeoutOrError) {
          calculationStatus.value = 'error';
        }
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
    if (!caseId.value) {
      throw new Error('无效的工况ID');
    }
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/calculate`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || '启动计算失败');
      }

      resetCalculationProgress();
      calculationStatus.value = 'running';
      startTime.value = Date.now();
      calculationProgressMeta.value = {
        status: 'running',
        isCalculating: true,
        progress: 0,
        tasks: { ...tasks.value },
        timestamp: Date.now(),
        completed: false,
        startTime: startTime.value,
        endTime: null,
        exitCode: null,
        canceled: false,
        timeout: false,
        currentTaskId: null,
        lastTaskId: null,
      };
      calculationOutputs.value.push({
        type: 'info',
        message: `[SYSTEM] ${response.data?.message || '计算已启动'}\n`,
      });
      return response.data;
    } catch (error) {
      const message = error?.response?.data?.message || error.message || '启动计算失败';
      calculationStatus.value = 'error';
      calculationOutputs.value.push({ type: 'error', message: `启动计算失败: ${message}\n` });
      throw new Error(message);
    }
  };

  const startVisualizationPrecompute = async () => {
    if (!caseId.value) throw new Error('无效的工况ID');
    visualizationLastError.value = '';
    visualizationMessages.value = [];
    visualizationStatus.value = 'starting';
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/precompute-visualization`);
      if (response.status !== 202 && !response.data?.success) {
        throw new Error(response.data?.message || '预计算启动失败');
      }
      visualizationMessages.value.push(`[SYSTEM] ${response.data?.message || '预计算已开始'}\n`);
      return response.data;
    } catch (error) {
      const message = error?.response?.data?.message || error.message || '预计算启动失败';
      visualizationStatus.value = 'failed';
      visualizationLastError.value = message;
      visualizationMessages.value.push(`[ERROR] ${message}\n`);
      throw new Error(message);
    }
  };

  // --- Socket.io Actions (Robust version from code 1) ---
  const connectSocket = (id) => {
    if (socket.value && socket.value.connected && socketRoomCaseId === id) {
      console.log(`Socket already connected and in room for case: ${id}`);
      caseId.value = id;
      return;
    }
    // When switching cases, ensure we actually leave/join rooms based on socketRoomCaseId,
    // because store.caseId may already be updated by initializeCase().
    if (socket.value && socket.value.connected && socketRoomCaseId !== id) {
      if (socketRoomCaseId) {
        socket.value.emit('leaveCase', socketRoomCaseId);
        console.log(`Socket left old case room: ${socketRoomCaseId}`);
      }
      socket.value.emit('joinCase', id);
      console.log(`Socket joined new case room: ${id}`);
      socketRoomCaseId = id;
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
          socketRoomCaseId = caseId.value;
      }
    });
    socket.value.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      socketRoomCaseId = null;
    });
    socket.value.on('connect_error', error => console.error('Socket connection error:', error));

    socket.value.on('calculationOutput', (output) => calculationOutputs.value.push({ type: 'output', message: output }));
    socket.value.on('taskUpdate', (taskStatuses) => {
      Object.assign(tasks.value, taskStatuses);
    });
    socket.value.on('calculationProgress', (data) => {
        overallProgress.value = data.progress;
        if (data.taskId) {
          const taskName = knownTasks.find(t => t.id === data.taskId)?.name;
          currentTask.value = taskName || data.taskId;
        } else if (data.currentTaskName) {
          currentTask.value = data.currentTaskName;
        }
    });
    socket.value.on('calculationCompleted', () => {
        calculationStatus.value = 'completed';
        overallProgress.value = 100;
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'success', message: 'Calculation completed (socket)!' });
    });
    socket.value.on('calculationFailed', (error) => {
        calculationStatus.value = 'error';
        currentTask.value = null;
        const message = error?.message || 'Calculation failed (socket)';
        const details = error?.details ? `\n${error.details}` : '';
        calculationOutputs.value.push({ type: 'error', message: `Calculation failed (socket): ${message}${details}` });
    });
    socket.value.on('calculationCanceled', (data) => {
        calculationStatus.value = 'canceled';
        currentTask.value = null;
        const message = data?.message || 'Calculation canceled (socket)';
        calculationOutputs.value.push({ type: 'info', message: `${message}\n` });
    });
    socket.value.on('calculationError', (error) => {
        calculationStatus.value = 'error';
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'error', message: `Calculation error (socket): ${error.message || "Unknown error"}` });
    });
    socket.value.on('calculationStarted', (data) => {
        if (calculationStatus.value !== 'running') calculationStatus.value = 'running';
        if (data && data.startTime) startTime.value = data.startTime;
        else if (!startTime.value) startTime.value = Date.now();
    });

    // Visualization precompute events
    socket.value.on('visualization_progress', (data) => {
      const message = data?.message ?? data;
      if (!message) return;
      if (!visualizationStatus.value || visualizationStatus.value === 'starting') {
        visualizationStatus.value = 'running';
      }
      visualizationMessages.value.push(`${message}\n`);
      const maxLines = 200;
      if (visualizationMessages.value.length > maxLines) {
        visualizationMessages.value = visualizationMessages.value.slice(-maxLines);
      }
    });
    socket.value.on('visualization_error', (data) => {
      const message = data?.message ?? data;
      if (!message) return;
      visualizationStatus.value = 'failed';
      visualizationLastError.value = String(message);
      visualizationMessages.value.push(`[ERROR] ${message}\n`);
      const maxLines = 200;
      if (visualizationMessages.value.length > maxLines) {
        visualizationMessages.value = visualizationMessages.value.slice(-maxLines);
      }
    });
    socket.value.on('visualization_status', (data) => {
      const status = data?.status;
      if (status) visualizationStatus.value = status;
      if (status === 'failed' && data?.error) visualizationLastError.value = String(data.error);
    });
    
    // WindMast 模块使用自己的 WebSocket 连接（/windmast/analysis），这里不再订阅 windmast_* 事件，
    // 避免在工况页面与测风塔页面之间相互污染日志/状态（尤其是多次分析时会混入旧输出）。

    if (socket.value && !socket.value.connected) {
      socket.value.connect();
    }
  };

  const disconnectSocket = () => {
    if (socket.value) {
      console.log("Disconnecting socket and removing listeners...");
      if (socketRoomCaseId) {
          socket.value.emit('leaveCase', socketRoomCaseId);
          console.log(`Socket left case room: ${socketRoomCaseId} on disconnect call.`);
      }
      // [关键] 移除所有监听器
      socket.value.offAny();
      socket.value.disconnect();
      socket.value = null;
      socketRoomCaseId = null;
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
    calculationProgressMeta,
    isSubmittingParameters,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    curveFiles,
    roughnessFile,
    visualizationStatus,
    visualizationMessages,
    visualizationLastError,

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
    resetCalculationProgress,
    loadCalculationProgress,
    startCalculation,
    startVisualizationPrecompute,
    
    connectSocket,
    disconnectSocket,
    listenToSocketEvents,
  };
});
