/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:41:30
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\store\caseStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { knownTasks } from "../utils/tasks";
import { io } from 'socket.io-client';

export const useCaseStore = defineStore("caseStore", () => {
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
        simulation: { cores: 1, steps: 100, deltaT: 10 },
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
    const calculationStatus = ref("not_started");
    const currentTask = ref(null);
    const overallProgress = ref(0);
    const calculationOutputs = ref([]);
    const tasks = ref(knownTasks.map((task) => ({ ...task, status: "pending" })));
    const hasFetchedCalculationStatus = ref(false);
    const socket = ref(null);
    let startTime = ref(null);

    // Actions

    const initializeCase = async (id, name) => {
        if (!id) {
            ElMessage.error("缺少工况ID");
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
                ElMessage.warning("未找到工况参数，使用默认值");
            }
            // 加载风机数据
            const turbinesResponse = await axios.get(`/api/cases/${caseId.value}/wind-turbines/list`);
            if (turbinesResponse.data.windTurbines) {
                windTurbines.value = turbinesResponse.data.windTurbines;
            }
            // 检查 info.json 是否存在
            const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
            infoExists.value = infoResponse.data.exists;

            // 初始化时加载计算状态
            await fetchCalculationStatus();

        } catch (error) {
            console.error("Failed to initialize case:", error);
            ElMessage.error('初始化失败');
        }
    };

    const fetchCalculationStatus = async () => {
        try {
            const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
            calculationStatus.value = response.data.calculationStatus;
            hasFetchedCalculationStatus.value = true;
            return true;
        } catch (error) {
            console.error("获取计算状态失败:", error);
            calculationStatus.value = "not_started";
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
                ElMessage.success("参数保存成功");
                infoExists.value = false;
            } else {
                throw new Error(response.data.message || "参数保存失败");
            }
        } catch (error) {
            console.error("Error submitting parameters:", error);
            ElMessage.error(error.message || "参数提交失败");
            throw error;
        }
    };

    const generateInfoJson = async () => {
        console.log("generateInfoJson called in caseStore!");
        try {
            const payload = {
                parameters: parameters.value,
                windTurbines: windTurbines.value,
            };
            const response = await axios.post(
                `/api/cases/${caseId.value}/info`,
                payload
            );
            console.log("Case ID:", caseId.value);

            if (response.data.success) {
                ElMessage.success("info.json 生成成功");
                calculationStatus.value = "not_completed";
                infoExists.value = true;
            } else {
                throw new Error(response.data.message || "生成 info.json 失败");
            }
        } catch (error) {
            console.error("Error generating info.json:", error);
            ElMessage.error("生成 info.json 失败");
            throw error;
        }
    };

    const downloadInfoJson = async () => {
        try {
            const response = await axios.get(
                `/api/cases/${caseId.value}/info-download`,
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "info.json");
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url); // 释放内存

            ElMessage.success("info.json 已下载");
        } catch (error) {
            console.error("Error downloading info.json:", error);
            ElMessage.error("下载 info.json 失败");
        }
    };

    const addWindTurbine = async (turbine) => {
        try {
            windTurbines.value.push(turbine);
            infoExists.value = false;

            const response = await axios.post(
                `/api/cases/${caseId.value}/wind-turbines`,
                windTurbines.value
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "保存风机数据失败");
            }

            ElMessage.success("风力涡轮机添加成功");
        } catch (error) {
            console.error("Error adding wind turbine:", error);
            ElMessage.error("添加风机失败: " + error.message);
            windTurbines.value.pop();
            throw error;
        }
    };
    const addBulkWindTurbines = async (turbines) => {
        try {
          // Filter out duplicates based on ID
            const newTurbines = turbines.filter(t => !windTurbines.value.some(existing => existing.id === t.id));
          windTurbines.value.push(...newTurbines);
            infoExists.value = false;

            const response = await axios.post(
                `/api/cases/${caseId.value}/wind-turbines`,
                windTurbines.value
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "批量保存风机数据失败");
            }

            ElMessage.success(`成功导入 ${newTurbines.length} 个风机`);
        } catch (error) {
            console.error("Error importing bulk wind turbines:", error);
            ElMessage.error("批量导入风机失败: " + error.message);
            throw error;
        }
    };

    const removeWindTurbine = async (turbineId) => {
        let removedTurbine = null;
        let index = -1;
        try {
            index = windTurbines.value.findIndex((t) => t.id === turbineId);
            if (index === -1) {
                throw new Error("风机未找到");
            }

            removedTurbine = windTurbines.value[index];
            windTurbines.value.splice(index, 1);
            infoExists.value = false;

            const response = await axios.post(
                `/api/cases/${caseId.value}/wind-turbines`,
                windTurbines.value
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "更新风机数据失败");
            }

            ElMessage.success("风力涡轮机删除成功");
        } catch (error) {
            console.error("Error removing wind turbine:", error);
            ElMessage.error("删除风机失败: " + error.message);

            if (removedTurbine && index !== -1) {
                windTurbines.value.splice(index, 0, removedTurbine);
            }
            throw error;
        }
    };

    const updateWindTurbine = async (updatedTurbine) => {
        try {
            const index = windTurbines.value.findIndex(
                (t) => t.id === updatedTurbine.id
            );
            if (index !== -1) {
                windTurbines.value[index] = {
                    ...windTurbines.value[index],
                    ...updatedTurbine,
                };
                infoExists.value = false;

                const response = await axios.post(
                    `/api/cases/${caseId.value}/wind-turbines`,
                    windTurbines.value
                );

                if (!response.data.success) {
                    throw new Error(response.data.message || "更新风机数据失败");
                }

                ElMessage.success("风力涡轮机更新成功");
            } else {
                throw new Error("风机未找到");
            }
        } catch (error) {
            console.error("Error updating wind turbine:", error);
            ElMessage.error("更新风机失败: " + error.message);
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
                outputs: calculationOutputs.value
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
        tasks.value.forEach(task => {
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
            console.error("加载计算进度失败:", error);
        }
        return null;
    };
    const connectSocket = (caseId) => {
      if (!socket.value) {
        socket.value = io('http://localhost:5000', {
          transports: ['websocket'],
          reconnectionAttempts: 5,
          timeout: 10000,
        });

        socket.value.emit("joinCase", caseId);
         listenToSocketEvents();
        socket.value.on('disconnect', () => {
          console.log('Socket disconnected');
        });
      }
    };

    const disconnectSocket = () => {
      if (socket.value) {
        socket.value.disconnect();
        socket.value = null;
      }
    };
 const listenToSocketEvents = () => {
    if (socket.value) {
      socket.value.on('taskStarted', handleTaskStarted);
      socket.value.on('calculationProgress', handleCalculationProgress);
        socket.value.on('taskCompleted', handleTaskCompleted);
         socket.value.on('calculationOutput', handleCalculationOutput);
         socket.value.on('calculationCompleted',handleCalculationCompleted );
        socket.value.on('calculationError', handleCalculationError);
        socket.value.on('calculationFailed', handleCalculationFailed);
    }
  };

  const handleTaskStarted = (taskId) => {
    const task = tasks.value.find(t => t.id === taskId);
    if (task) {
      task.status = "running";
        calculationOutputs.value.push({
          type: 'task',
          taskName: task.name,
          message: `${task.name} 启动`
        });
    }
  };
  const handleCalculationOutput = (output) => {
    calculationOutputs.value.push({ type: 'output', message: output });
  };
  const handleCalculationProgress = (data) => {
    overallProgress.value = data.progress;
     const task = tasks.value.find(t => t.id === data.taskId);
      if (task) {
           // Prevent duplicate messages for the same progress
             const existingMessage = calculationOutputs.value.find(
                 output => output.taskName === task.name && output.message.includes(`进度: ${data.progress}%`)
             );
             if (!existingMessage) {
                 calculationOutputs.value.push({
                     type: 'task',
                     taskName: task.name,
                     message: `进度: ${data.progress}%`
                 });
             }
      }
    saveCalculationProgress();
  };
    const handleTaskCompleted = (taskId) => {
      const task = tasks.value.find(t => t.id === taskId);
      if (task) {
        task.status = 'completed';
         calculationOutputs.value.push({
            type: 'task',
            taskName: task.name,
            message: '完成'
         });
      }
    };
   const handleCalculationCompleted = (res) => {
    overallProgress.value = 100;
    setResults(res);
      // 标记最后一个任务为完成
     const finalTask = tasks.value.find(t => t.id === 'computation_end');
      if (finalTask && finalTask.status !== 'completed') {
          finalTask.status = 'completed';
          calculationOutputs.value.push({ type: 'task', taskName: finalTask.name, message: '计算完成' });
        }
    ElMessage.success('计算完成');
   
  };
  const handleCalculationError = (err) => {
     calculationOutputs.value.push({ type: 'task', taskName: tasks.value.find(t => t.id === err.taskId)?.name || '未知任务', message: '发生错误' });
    ElMessage.error(err.message || '计算过程中出错');
  };
   const handleCalculationFailed = (err) => {
       calculationOutputs.value.push({ type: 'task', taskName: '计算失败', message: `[失败] ${err.message || '计算失败'}` });
       ElMessage.error(err.message || '计算失败');
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
        removeWindTurbine,
        updateWindTurbine,
        saveCalculationProgress,
          resetCalculationProgress,
        loadCalculationProgress,
        connectSocket,
        disconnectSocket,
        listenToSocketEvents,
    };
});