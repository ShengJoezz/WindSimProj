<template>
  <div class="pdf-generator">
    <div v-if="isGenerating" class="pdf-loading">
      <div class="pdf-loading-spinner"></div>
      <span>正在生成PDF报告...</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const props = defineProps({
  caseId: {
    type: String,
    required: true
  }
});

const isGenerating = ref(false);

// 简化 PDF 生成流程，依赖后端服务处理数据和图表
const generatePDF = async () => {
  if (isGenerating.value) return;

  isGenerating.value = true;
  console.log('开始生成PDF报告...');

  try {
    // 直接调用后端 PDF 生成接口，无需前端准备图表数据
    const response = await axios.post(
      `/api/cases/${props.caseId}/generate-pdf-report`,
      {}, // 空 body，后端服务会准备所有数据
      {
        responseType: 'blob',
        timeout: 120000 // 2分钟超时
      }
    );

    console.log('收到后端响应:', response.status, 'Content-Type:', response.headers['content-type']);

    if (response.data instanceof Blob) {
      // 创建下载链接
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${props.caseId}_report.pdf`);
      document.body.appendChild(link);

      // 触发下载
      link.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      ElMessage.success('PDF报告生成成功');
    } else {
      throw new Error('服务器响应不是有效的PDF文件');
    }
  } catch (error) {
    console.error('PDF报告生成失败:', error);
    let errorMessage = 'PDF报告生成失败';
    if (error.response) {
      errorMessage += ` (状态码: ${error.response.status})`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    ElMessage.error(errorMessage);
  } finally {
    isGenerating.value = false;
  }
};

// 导出方法供父组件调用
defineExpose({
  generatePDF
});
</script>

<style scoped>
.pdf-generator {
  position: relative;
}

.pdf-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.pdf-loading-spinner {
  width: 50px;
  height: 50px;
  margin-bottom: 15px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>