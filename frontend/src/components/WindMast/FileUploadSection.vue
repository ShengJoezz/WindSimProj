<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:03:43
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:08:22
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\FileUploadSection.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="file-upload-section">
    <el-row :gutter="24">
      <el-col :span="12">
        <el-upload
          action="/api/windmast/upload"
          multiple
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :file-list="uploadedFileList"
          :auto-upload="true"
          name="windMastFiles"
          drag
          accept=".csv"
          :before-upload="beforeUpload"
          class="upload-container"
        >
          <el-icon class="upload-icon"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽 CSV 文件到此处 或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              请上传一个或多个测风塔数据 CSV 文件
            </div>
          </template>
        </el-upload>
      </el-col>
      <el-col :span="12">
        <div class="files-list-container">
          <h4 class="files-list-header">待分析文件:</h4>
          <div v-if="uploadedFilesInfo.length > 0" class="files-list">
            <el-scrollbar height="200px">
              <el-list>
                <el-list-item
                  v-for="file in uploadedFilesInfo"
                  :key="file.filename"
                  class="file-item"
                >
                  <div class="file-info">
                    <el-icon><document /></el-icon>
                    <span class="filename">{{ file.originalName }}</span>
                    <span class="filesize">{{ formatFileSize(file.size) }}</span>
                  </div>
                </el-list-item>
              </el-list>
            </el-scrollbar>
            <div class="clear-button-container">
              <el-button type="danger" plain size="small" @click="$emit('clearUploads')">
                <el-icon><delete /></el-icon> 清空列表
              </el-button>
            </div>
          </div>
          <el-empty v-else description="暂无待分析文件" class="empty-files"></el-empty>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { UploadFilled, Document, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  uploadedFileList: Array,
  uploadedFilesInfo: Array
});

const emit = defineEmits(['filesUploaded', 'clearUploads']);

// Methods
const beforeUpload = (file) => {
  const isCSV = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
  if (!isCSV) {
    ElMessage.error('只能上传 CSV 文件!');
  }
  return isCSV;
};

const handleUploadSuccess = (response, file, fileList) => {
  if (response.success && response.files) {
    // Create a new array with the successfully uploaded files
    const updatedFilesInfo = [...props.uploadedFilesInfo];
    
    response.files.forEach(uploadedFile => {
      if (!updatedFilesInfo.some(f => f.originalName === uploadedFile.originalName)) {
        updatedFilesInfo.push(uploadedFile);
      }
    });
    
    ElMessage.success(`${file.name} 上传成功!`);
    emit('filesUploaded', fileList, updatedFilesInfo);
  } else {
    ElMessage.error(`${file.name} 上传失败: ${response.message || '未知错误'}`);
    
    // Remove the file from el-upload's list if the backend reported failure
    const updatedFileList = [...fileList];
    const index = updatedFileList.findIndex(f => f.uid === file.uid);
    if (index > -1) {
      updatedFileList.splice(index, 1);
    }
    
    emit('filesUploaded', updatedFileList, props.uploadedFilesInfo);
  }
};

const handleUploadError = (error, file, fileList) => {
  let errorMessage = '上传出错';
  try {
    // Axios error might contain response data
    const errorResponse = JSON.parse(error.message || '{}');
    errorMessage = errorResponse.message || error.message || '网络错误或服务器错误';
  } catch(e) {
    errorMessage = error.message || '网络错误或服务器错误';
  }
  
  ElMessage.error(`${file.name} ${errorMessage}`);
  
  // Remove the file from el-upload's list
  const updatedFileList = [...fileList];
  const index = updatedFileList.findIndex(f => f.uid === file.uid);
  if (index > -1) {
    updatedFileList.splice(index, 1);
  }
  
  emit('filesUploaded', updatedFileList, props.uploadedFilesInfo);
};

const formatFileSize = (sizeInBytes) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};
</script>

<style scoped>
.file-upload-section {
  margin-bottom: 24px;
}

.upload-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
  color: var(--el-color-primary);
}

.files-list-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
}

.files-list-header {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.files-list {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.file-item {
  padding: 8px 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-info .el-icon {
  color: var(--el-color-primary-light-3);
}

.filename {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filesize {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.clear-button-container {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.empty-files {
  padding: 40px 0;
}
</style>