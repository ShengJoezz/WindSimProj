<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-15 15:19:17
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:01:51
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\UploadComponent.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- UploadComponent.vue -->
<template>
  <div class="upload-section">
    <el-upload
      class="upload-wrapper"
      :action="null"
      :auto-upload="false"
      :on-change="handleFileChange"
      :before-upload="beforeUpload"
      accept=".txt,.csv"
      drag
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        拖拽文件到此处或 <em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持 .txt 或 .csv 格式，每行包含: 名称,经度,纬度,高度,直径，模型 (可选)
        </div>
      </template>
    </el-upload>

    <el-progress
      v-if="uploadProgress > 0 && uploadProgress < 100"
      :percentage="uploadProgress"
      :status="uploadStatus"
    />

    <div v-if="parseErrors.length" class="error-list">
      <h4>解析错误:</h4>
      <ul>
        <li v-for="(error, index) in parseErrors" :key="index" class="error-item">
          {{ error }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const emit = defineEmits(['import-turbines']);
const uploadProgress = ref(0);
const uploadStatus = ref('');
const parseErrors = ref([]);

const validateTurbineData = (data) => {
  const errors = [];

  if (!Array.isArray(data)) {
    errors.push('无效的数据格式');
    return { isValid: false, errors };
  }

  data.forEach((row, index) => {
    // Split the row by tab if it's a string
    const fields = typeof row === 'string' ? row.split('\t') : row;

    // Check for mandatory fields (first 5 fields)
    if (fields.length < 5) {
      errors.push(`第 ${index + 1} 行数据不完整，必需字段：名称、经度、纬度、高度、直径`);
      return;
    }

    const [name, longitude, latitude, hubHeight, rotorDiameter, model] = fields;

    // Validate each field
    if (!name || name.trim() === '') {
      errors.push(`第 ${index + 1} 行缺少名称`);
    }

    // Validate longitude
    const lon = parseFloat(longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.push(`第 ${index + 1} 行经度无效 (${longitude})`);
    }

    // Validate latitude
    const lat = parseFloat(latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push(`第 ${index + 1} 行纬度无效 (${latitude})`);
    }

    // Validate hubHeight
    if (!hubHeight || isNaN(parseFloat(hubHeight))) {
      errors.push(`第 ${index + 1} 行高度无效 (${hubHeight})`);
    }

    // Validate rotorDiameter
    if (!rotorDiameter || isNaN(parseFloat(rotorDiameter))) {
      errors.push(`第 ${index + 1} 行直径无效 (${rotorDiameter})`);
    }
  });

  return { isValid: errors.length === 0, errors };
};

const beforeUpload = (file) => {
  const validTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel'];
  if (!validTypes.includes(file.type)) {
    ElMessage.error('请上传 .txt 或 .csv 文件');
    return false;
  }
  return true;
};

const handleFileChange = (file) => {
  parseErrors.value = [];
  uploadProgress.value = 0;
  uploadStatus.value = 'processing';

  const reader = new FileReader();

  reader.onload = async (event) => {
    try {
      const content = event.target.result;
      // 自动检测，用逗号分隔则使用逗号，否则使用制表符
      const delimiter = content.indexOf(',') !== -1 ? ',' : '\t';

      const lines = content.split('\n').filter(line => line.trim());

      // 修改解析时也采用 delimiter 分隔
      const { isValid, errors } = validateTurbineData(lines.map(line => line.split(delimiter)));

      if (!isValid) {
        parseErrors.value = errors;
        uploadStatus.value = 'exception';
        return;
      }

      const turbines = lines.map(line => {
        const [name, longitude, latitude, hubHeight, rotorDiameter, model] = line.split(delimiter);
        return {
          name: name.trim(),
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude),
          hubHeight: parseFloat(hubHeight),
          rotorDiameter: parseFloat(rotorDiameter),
          model: model ? model.trim() : '',
        };
      });

      emit('import-turbines', turbines);
      uploadStatus.value = 'success';
      uploadProgress.value = 100;
      ElMessage.success('上传并解析成功'); // 添加成功消息
    } catch (error) {
      console.error('File parsing error:', error);
      parseErrors.value = ['文件解析失败'];
      uploadStatus.value = 'exception';
    }
  };

  reader.onerror = () => {
    parseErrors.value = ['文件读取失败'];
    uploadStatus.value = 'exception';
  };

  reader.readAsText(file.raw);
};
</script>

<style scoped>
.upload-section {
  padding: 20px;
  background: #f9fafc;
  border-radius: 12px;
  margin-top: 24px;
  border: 1px dashed #dcdfe6;
  transition: all 0.3s ease;
}

.upload-section:hover {
  border-color: #409EFF;
  background: #f2f6fc;
}

.upload-wrapper {
  margin-bottom: 20px;
}

:deep(.el-upload) {
  width: 100%;
}

:deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

:deep(.el-upload-dragger:hover) {
  background: #ffffff;
  border-color: #409EFF;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

:deep(.el-upload-dragger i) {
  font-size: 40px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

:deep(.el-upload__text) {
  color: #606266;
  font-size: 14px;
  text-align: center;
}

:deep(.el-upload__text em) {
  color: #409EFF;
  font-style: normal;
  font-weight: 600;
}

:deep(.el-upload__tip) {
  color: #909399;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

:deep(.el-progress-bar__outer) {
  border-radius: 8px;
  height: 8px;
}

:deep(.el-progress-bar__inner) {
  border-radius: 8px;
}

.error-list {
  margin-top: 20px;
  padding: 16px;
  background-color: #fef0f0;
  border-radius: 8px;
  border: 1px solid #fde2e2;
}

.error-list h4 {
  color: #f56c6c;
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 14px;
}

.error-item {
  color: #f56c6c;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 12px;
  background: rgba(245, 108, 108, 0.05);
  border-radius: 6px;
  border-left: 3px solid #f56c6c;
}
</style>