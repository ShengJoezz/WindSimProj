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
  }
});

const isGenerating = ref(false);
const caseStore = useCaseStore();

// 使用服务器端生成PDF
const generatePDF = async () => {
  isGenerating.value = true;
  ElMessage.info('开始生成报告，请稍候...');
  
  try {
    // 发送请求到后端生成PDF
    const response = await axios.post(`/api/cases/${props.caseId}/generate-pdf-report`, {}, {
      responseType: 'blob'  // 重要: 表示响应是一个二进制Blob
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
    ElMessage.error('生成PDF报告失败，请检查服务器日志');
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