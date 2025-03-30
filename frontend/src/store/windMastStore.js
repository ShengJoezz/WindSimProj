/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:10:08
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:48:39
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\windMastStore.js
 * @Description: Pinia store for Wind Mast data analysis module, incorporating fixes.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

export const useWindMastStore = defineStore('windMast', () => {
  // Analysis state
  const analysisStatus = ref('idle'); // idle, pending, success, error
  const analysisResults = ref(null);
  const progressMessages = ref([]);
  const errorMessage = ref('');
  const currentAnalysisId = ref(null); // Stores the ID of the currently running or last run analysis

  // File management state
  const inputFiles = ref([]);
  const savedAnalyses = ref([]); // Holds fetched/scanned analysis records
  const isLoadingFiles = ref(false);
  const isLoadingAnalyses = ref(false);

  // Computed properties
  const isIdle = computed(() => analysisStatus.value === 'idle');
  const isPending = computed(() => analysisStatus.value === 'pending');
  const isSuccess = computed(() => analysisStatus.value === 'success');
  const isError = computed(() => analysisStatus.value === 'error');
  const hasResults = computed(() => analysisResults.value !== null && (analysisResults.value.summary?.total_files > 0));

  // --- Actions for analysis ---

  const setAnalysisStatus = (status, msg = '', details = '') => {
    analysisStatus.value = status;
    console.log(`Analysis status set to: ${status}, msg: ${msg}, details: ${details}`); // Debug log
    if (status === 'error') {
      errorMessage.value = `${msg}${details ? ': ' + details : ''}`;
      progressMessages.value.push(`错误: ${errorMessage.value}`);
    } else {
      errorMessage.value = '';
    }
    // Reset progress and results when starting a new analysis
    if (status === 'pending') {
      progressMessages.value = [`[${new Date().toLocaleTimeString()}] 分析任务已启动...`]; // Start with an initial message
      analysisResults.value = null;
    }
    // Clear current analysis ID if resetting to idle
    if (status === 'idle') {
      currentAnalysisId.value = null;
      progressMessages.value = [];
      analysisResults.value = null;
      errorMessage.value = '';
    }
  };

  const addProgressMessage = (message) => {
    // Add timestamp to messages
    const timestamp = new Date().toLocaleTimeString();
    progressMessages.value.push(`[${timestamp}] ${message}`);
  };

  const clearProgressMessages = () => {
    progressMessages.value = [];
  };

  const triggerAnalysis = async (config) => { // Pass the whole config object
    setAnalysisStatus('pending', '正在启动分析...');
    currentAnalysisId.value = null; // Reset current ID before starting new analysis

    try {
      console.log("触发分析，配置:", config); // Debug log
      const response = await axios.post('/api/windmast/analyze', config); // Send entire config

      if (response.status === 202 && response.data.success && response.data.analysisId) {
        ElMessage.info('分析任务已启动，请等待实时更新...');
        currentAnalysisId.value = response.data.analysisId; // Store the new analysis ID
        console.log(`分析任务启动成功，Analysis ID: ${currentAnalysisId.value}`); // Debug log
        addProgressMessage(`分析任务已成功提交 (ID: ${currentAnalysisId.value})`);
        return response.data.analysisId;
      } else {
        throw new Error(response.data.message || `启动分析失败 (API 返回状态 ${response.status})`);
      }
    } catch (error) {
      console.error("触发分析 API 调用失败:", error);
      const apiErrorMsg = error.response?.data?.message || error.message || '未知错误';
      setAnalysisStatus('error', '启动分析请求失败', apiErrorMsg);
      ElMessage.error(`启动分析请求失败: ${apiErrorMsg}`);
      currentAnalysisId.value = null; // Ensure ID is null on failure
      return null;
    }
  };

  const fetchResults = async (analysisId) => { // Changed: analysisId is now required
     if (!analysisId) {
        console.warn("fetchResults called without analysisId");
        analysisResults.value = null;
        return null;
     }
     console.log(`正在获取分析结果，ID: ${analysisId}`); // Debug log
     // Set status to pending if not already error/success, indicates loading results
     if (!isError.value && !isSuccess.value) {
         // Optional: could set a specific 'loading_results' status if needed
         // analysisStatus.value = 'pending';
     }
     try {
        const url = `/api/windmast/results/${analysisId}`;
        const response = await axios.get(url);

        if (response.data.success && response.data.data) {
            analysisResults.value = response.data.data;
            // Only add message if status wasn't already error/success from polling/websocket
            if (analysisStatus.value !== 'error' && analysisStatus.value !== 'success') {
               addProgressMessage("成功获取分析结果。");
            }
            console.log("获取结果成功:", analysisResults.value); // Debug log
            // Optionally update status to success if it was pending
            // if(analysisStatus.value === 'pending') {
            //    setAnalysisStatus('success', '分析结果已加载');
            // }
            return response.data.data;
        } else {
            throw new Error(response.data.message || '获取结果 API 失败');
        }
     } catch (error) {
        console.error(`获取分析结果 (ID: ${analysisId}) 失败:`, error);
        // Don't set global error status here, let polling/websocket handle final status
        // setAnalysisStatus('error', '获取分析结果失败', error.message);
        ElMessage.error(`获取分析结果失败: ${error.message}`);
        analysisResults.value = null;
        return null;
     }
  };

  // --- Actions for file management ---

  const scanInputFolder = async () => {
    isLoadingFiles.value = true;
    try {
      console.log("正在扫描输入文件夹..."); // Debug log
      const response = await axios.get('/api/windmast/files/input');
      if (response.data.success) {
        inputFiles.value = response.data.files || [];
        console.log(`扫描到 ${inputFiles.value.length} 个输入文件`); // Debug log
      } else {
        throw new Error(response.data.message || '扫描输入文件夹失败');
      }
    } catch (error) {
      console.error("扫描输入文件夹失败:", error);
      ElMessage.error(`扫描输入文件夹失败: ${error.message}`);
      inputFiles.value = [];
    } finally {
      isLoadingFiles.value = false;
    }
  };

  // Updated fetchSavedAnalyses incorporating directory scanning logic
  const fetchSavedAnalyses = async () => {
    isLoadingAnalyses.value = true;
    try {
      console.log('正在获取已保存的分析记录 (通过API)...'); // Debug log
      const response = await axios.get('/api/windmast/analyses');
      console.log('分析记录API响应:', response.data); // Debug log

      if (response.data.success) {
        savedAnalyses.value = response.data.analyses || [];
        console.log(`通过API获取到 ${savedAnalyses.value.length} 条分析记录`);
        // If API returns empty, try scanning the directory as a fallback
        if (savedAnalyses.value.length === 0) {
            console.log('API未返回分析记录，尝试扫描输出目录...');
            await scanOutputDirectory();
        }
      } else {
        // If API call itself fails, throw error to trigger catch block
        throw new Error(response.data.message || '获取保存的分析记录API失败');
      }
    } catch (error) {
      console.error("通过API获取保存的分析失败:", error);
      ElMessage.error(`获取分析记录失败: ${error.message}. 尝试扫描输出目录...`);
      // Fallback: Attempt to scan the output directory directly
      await scanOutputDirectory();
    } finally {
      isLoadingAnalyses.value = false;
    }
  };

  // Added function to scan output directory via dedicated API endpoint
  const scanOutputDirectory = async () => {
    try {
      console.log('正在扫描输出目录以查找分析结果...'); // Debug log
      const response = await axios.get('/api/windmast/analyses/scan');
      console.log('扫描目录API响应:', response.data); // Debug log

      if (response.data.success && Array.isArray(response.data.analyses)) {
        // IMPORTANT: Only update if scan finds results and API didn't,
        // or if the API call failed initially. Avoid overwriting valid API results unless empty.
        if (savedAnalyses.value.length === 0) {
             savedAnalyses.value = response.data.analyses;
             console.log(`通过扫描目录获取到 ${savedAnalyses.value.length} 条分析记录`);
             if(savedAnalyses.value.length > 0) {
                ElMessage.info(`通过扫描目录找到了 ${savedAnalyses.value.length} 条分析记录。`);
             } else {
                ElMessage.info(`扫描目录未找到有效的分析记录。`);
             }
        } else {
            console.log('API已返回有效记录，扫描结果被忽略。');
        }
      } else {
         // Log error but don't overwrite potentially existing (empty) results from API
         console.error("扫描分析目录API调用未成功或未返回有效数组:", response.data.message || '未知扫描错误');
         if (savedAnalyses.value.length === 0) { // Only show error if we have no analyses at all
            ElMessage.warning('扫描输出目录未能找到分析记录。');
         }
      }
    } catch (error) {
      console.error("扫描分析目录失败 (axios请求出错):", error);
       if (savedAnalyses.value.length === 0) { // Only show error if we have no analyses at all
         ElMessage.error(`扫描输出目录时发生错误: ${error.message}`);
       }
    }
    // isLoadingAnalyses is handled by fetchSavedAnalyses finally block
  };


  const renameInputFile = async (originalFilename, newFilename) => {
    try {
      console.log(`重命名文件: ${originalFilename} -> ${newFilename}`); // Debug log
      const response = await axios.post('/api/windmast/files/rename', {
        originalFilename,
        newFilename
      });

      if (response.data.success) {
        ElMessage.success(`文件重命名成功: ${newFilename}`);
        await scanInputFolder(); // Refresh the file list
        return true;
      } else {
        throw new Error(response.data.message || '重命名文件失败');
      }
    } catch (error) {
      console.error("重命名文件失败:", error);
      ElMessage.error(`重命名文件失败: ${error.message}`);
      return false;
    }
  };

  const deleteInputFile = async (filename) => {
    try {
      console.log(`删除文件: ${filename}`); // Debug log
      const response = await axios.delete(`/api/windmast/files/input/${encodeURIComponent(filename)}`);

      if (response.data.success) {
        ElMessage.success(`文件删除成功: ${filename}`);
        await scanInputFolder(); // Refresh the file list
        return true;
      } else {
        throw new Error(response.data.message || '删除文件失败');
      }
    } catch (error) {
      console.error("删除文件失败:", error);
      ElMessage.error(`删除文件失败: ${error.message}`);
      return false;
    }
  };

  const deleteAnalysis = async (analysisId) => {
    try {
      console.log(`删除分析: ${analysisId}`); // Debug log
      const response = await axios.delete(`/api/windmast/analyses/${analysisId}`);

      if (response.data.success) {
        ElMessage.success('分析结果已删除');
        await fetchSavedAnalyses(); // Refresh the analyses list
        // If the deleted analysis was the currently viewed one, reset results view
        if(analysisResults.value && analysisResults.value?.id === analysisId) {
            analysisResults.value = null;
        }
        // If the deleted analysis was the last one run, reset analysis state
        if(currentAnalysisId.value === analysisId) {
            resetState();
        }
        return true;
      } else {
        throw new Error(response.data.message || '删除分析结果失败');
      }
    } catch (error) {
      console.error("删除分析结果失败:", error);
      ElMessage.error(`删除分析结果失败: ${error.message}`);
      return false;
    }
  };

  const resetState = () => {
    console.log("重置分析状态..."); // Debug log
    setAnalysisStatus('idle'); // Use the setter to handle cleanup
  };

  return {
    // State
    analysisStatus,
    analysisResults,
    progressMessages,
    errorMessage,
    currentAnalysisId,
    inputFiles,
    savedAnalyses,
    isLoadingFiles,
    isLoadingAnalyses,

    // Computed
    isIdle,
    isPending,
    isSuccess,
    isError,
    hasResults,

    // Actions
    setAnalysisStatus,
    addProgressMessage,
    clearProgressMessages,
    triggerAnalysis,
    fetchResults,
    resetState,
    scanInputFolder,
    fetchSavedAnalyses, // This now includes scan fallback logic
    // scanOutputDirectory, // Exposing scan might be useful for manual refresh? Keep internal for now.
    renameInputFile,
    deleteInputFile,
    deleteAnalysis
  };
});