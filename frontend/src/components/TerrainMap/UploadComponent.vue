<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 18:32:29
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 20:10:10
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\UploadComponent.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
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
      // Split the content by newlines and filter out empty lines
      const content = event.target.result;
      const lines = content.split('\n').filter(line => line.trim());
      
      const { isValid, errors } = validateTurbineData(lines);

      if (!isValid) {
        parseErrors.value = errors;
        uploadStatus.value = 'exception';
        return;
      }

      const turbines = lines.map(line => {
        const [name, longitude, latitude, hubHeight, rotorDiameter, model] = line.split('\t');
        return {
          name: name.trim(),
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude),
          hubHeight: parseFloat(hubHeight),
          rotorDiameter: parseFloat(rotorDiameter),
          model: model ? model.trim() : null,
        };
      });

      emit('import-turbines', turbines);
      uploadStatus.value = 'success';
      uploadProgress.value = 100;

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
}

.upload-wrapper {
  margin-bottom: 20px;
}

.error-list {
  margin-top: 20px;
  padding: 10px;
  background-color: #fff3f3;
  border-radius: 4px;
}

.error-item {
  color: #f56c6c;
  margin: 5px 0;
  font-size: 14px;
}
</style>