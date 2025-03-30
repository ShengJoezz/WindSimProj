/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 17:50:02
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:10:08
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\windMastStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// windMastStore.js 修改
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

export const useWindMastStore = defineStore('windMast', () => {
    // --- 状态保持不变 ---
    const analysisStatus = ref('idle');
    const analysisResults = ref(null);
    const progressMessages = ref([]);
    const errorMessage = ref('');
    const analysisId = ref(null); // 新增：追踪分析ID

    // --- Getters 保持不变 ---
    const isIdle = computed(() => analysisStatus.value === 'idle');
    const isPending = computed(() => analysisStatus.value === 'pending');
    const isSuccess = computed(() => analysisStatus.value === 'success');
    const isError = computed(() => analysisStatus.value === 'error');
    const hasResults = computed(() => analysisResults.value !== null && (analysisResults.value.summary?.total_files > 0));

    // --- Actions 修改 ---
    const setAnalysisStatus = (status, msg = '', details = '') => {
        analysisStatus.value = status;
        if (status === 'error') {
            errorMessage.value = `${msg}${details ? ': ' + details : ''}`;
            progressMessages.value.push(`错误: ${errorMessage.value}`);
        } else {
            errorMessage.value = '';
        }
        if (status === 'pending') {
            progressMessages.value = [];
            analysisResults.value = null;
        }
    };

    const addProgressMessage = (message) => {
        progressMessages.value.push(message);
    };

    // 修改：不再需要caseId参数
    const triggerAnalysis = async (uploadedFiles) => {
        setAnalysisStatus('pending', '正在启动分析...');

        try {
            // 提取文件列表以发送到后端
            const filenamesToAnalyze = uploadedFiles.map(file => file.filename);

            const response = await axios.post('/api/windmast/analyze', {
                filesToAnalyze: filenamesToAnalyze
            });
            if (response.status === 202 && response.data.success) {
                ElMessage.info('分析任务已启动，请等待实时更新...');
                analysisId.value = response.data.analysisId; // 保存返回的分析ID
            } else {
                throw new Error(response.data.message || '启动分析失败 (API)');
            }
        } catch (error) {
            console.error("触发分析 API 调用失败:", error);
            const apiErrorMsg = error.response?.data?.message || error.message || '未知错误';
            setAnalysisStatus('error', '启动分析请求失败', apiErrorMsg);
            ElMessage.error(`启动分析请求失败: ${apiErrorMsg}`);
        }
    };

    // 修改：不再需要caseId参数
    const fetchResults = async () => {
        try {
            const response = await axios.get('/api/windmast/results'); // 修改URL
            if (response.data.success) {
                analysisResults.value = response.data.data;
                if (analysisStatus.value !== 'error') {
                    addProgressMessage("成功获取分析结果。");
                }
            } else {
                throw new Error(response.data.message || '获取结果 API 失败');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                console.log("分析结果尚不存在或未找到。");
                analysisResults.value = null;
                if(analysisStatus.value === 'success') {
                    addProgressMessage("分析完成，但未找到结果文件。");
                }
            } else {
                console.error("获取分析结果失败:", error);
                const fetchErrorMsg = error.response?.data?.message || error.message || '未知错误';
                ElMessage.error(`获取分析结果失败: ${fetchErrorMsg}`);
                analysisResults.value = null;
            }
        }
    };

    const resetState = () => {
        analysisStatus.value = 'idle';
        analysisResults.value = null;
        progressMessages.value = [];
        errorMessage.value = '';
        analysisId.value = null;
    };
// Add this method to the store actions section
const clearProgressMessages = () => {
    progressMessages.value = [];
  };
  
  // Add it to the return statement
  return {
    analysisStatus, analysisResults, progressMessages, errorMessage, analysisId,
    isIdle, isPending, isSuccess, isError, hasResults,
    setAnalysisStatus, addProgressMessage, triggerAnalysis, fetchResults, resetState,
    clearProgressMessages, // Add this line
  };
});