<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 21:35:19
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 21:36:25
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\PDFReportGenerator.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="pdf-generator">
    <el-button 
      type="primary" 
      @click="generatePDF" 
      :loading="isGenerating" 
      class="generate-btn"
    >
      {{ isGenerating ? '正在生成报告...' : '生成PDF报告' }}
    </el-button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCaseStore } from '../store/caseStore';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps({
  caseId: {
    type: String,
    required: true
  },
  windTurbineRef: {
    type: Object,
    default: null
  },
  vtkViewerRef: {
    type: Object,
    default: null
  },
  velocityFieldRef: {
    type: Object,
    default: null
  }
});

const isGenerating = ref(false);
const caseStore = useCaseStore();

// 从风机性能组件中获取数据
const getWindTurbineData = () => {
  if (!props.windTurbineRef) return null;
  
  const turbineRef = props.windTurbineRef;
  
  // 安全地获取各项指标
  return {
    turbineCount: typeof turbineRef.turbineCount !== 'undefined' ? 
      turbineRef.turbineCount : (typeof turbineRef.value?.turbineCount !== 'undefined' ? 
        turbineRef.value.turbineCount : caseStore.windTurbines.length),
        
    avgSpeed: typeof turbineRef.avgSpeed !== 'undefined' ? 
      turbineRef.avgSpeed : (typeof turbineRef.value?.avgSpeed !== 'undefined' ? 
        turbineRef.value.avgSpeed : null),
        
    totalPower: typeof turbineRef.totalPower !== 'undefined' ? 
      turbineRef.totalPower : (typeof turbineRef.value?.totalPower !== 'undefined' ? 
        turbineRef.value.totalPower : null),
        
    avgCt: typeof turbineRef.avgCt !== 'undefined' ? 
      turbineRef.avgCt : (typeof turbineRef.value?.avgCt !== 'undefined' ? 
        turbineRef.value.avgCt : null)
  };
};

// 使用服务器端HTML2PDF生成PDF
const generatePDF = async () => {
  isGenerating.value = true;
  ElMessage.info('开始生成报告，请稍候...');
  
  try {
    // 准备数据
    const reportData = {
      caseId: props.caseId,
      caseName: caseStore.caseName,
      parameters: caseStore.parameters,
      windTurbines: caseStore.windTurbines,
      calculationStatus: caseStore.calculationStatus,
      overallProgress: caseStore.overallProgress,
      results: caseStore.results,
      turbineStats: getWindTurbineData()
    };
    
    // 发送请求到后端生成PDF
    const response = await axios.post('/api/reports/generate-pdf', reportData, {
      responseType: 'blob',  // 重要: 表示响应是一个二进制Blob
    });
    
    // 处理响应 - 下载PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseStore.caseName || 'wind-simulation'}-report.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    ElMessage.success('PDF报告生成成功！');
  } catch (error) {
    console.error('生成PDF报告失败:', error);
    ElMessage.error('生成PDF报告失败: ' + (error.response?.data?.message || error.message || '未知错误'));
  } finally {
    isGenerating.value = false;
  }
};

defineExpose({
  generatePDF
});
</script>

<style scoped>
.pdf-generator {
  margin: 16px 0;
}

.generate-btn {
  padding: 10px 24px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.generate-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.generate-btn:active {
  transform: translateY(0);
}
</style>