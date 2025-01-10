<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 15:19:08
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:31:36
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\UploadComponent.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 -->

 <template>
  <div class="import-section">
    <el-divider><span class="divider-text">批量导入</span></el-divider>
    <el-upload
      class="upload-area"
      drag
      action="#"
      :before-upload="handleFileUpload"
      :show-file-list="false"
      accept=".csv,.txt"
      :on-progress="handleProgress"
    >
      <i class="el-icon-upload"></i>
      <div class="upload-text">
        拖拽文件至此处或 <span class="highlight-text">点击上传</span>
      </div>
      <div class="upload-hint">支持 .csv 或 .txt 格式文件</div>
      <el-link type="primary" @click="toggleExample" class="example-link">
        {{ showExample ? '隐藏示例' : '查看示例格式' }}
      </el-link>
      <el-alert
        v-if="showExample"
        title="示例格式 (.csv)"
        type="info"
        :closable="false"
        class="example-content"
      >
        <pre>
name,longitude,latitude,hubHeight,rotorDiameter
风机1,-73.985,40.748,120,116
风机2,-74.006,40.712,130,120
        </pre>
      </el-alert>
      <el-progress v-if="uploading" :percentage="uploadProgress" />
    </el-upload>
  </div>
</template>

<script setup>
/**
 * UploadComponent.vue
 *
 * 处理批量导入风机数据的上传组件。
 */

import { ref } from "vue";
import Papa from "papaparse";
import { ElLoading, ElMessage } from "element-plus";
import { generateUUID } from '../../utils/uuid';
import path from 'path';

const emit = defineEmits(["import-turbines"]);

const showExample = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);

const toggleExample = () => {
  showExample.value = !showExample.value;
};

const handleFileUpload = (file) => {
  const supportedFormats = ['.csv', '.txt'];
  const fileExt = path.extname(file.name).toLowerCase();
  if (!supportedFormats.includes(fileExt)) {
    ElMessage.error('仅支持 .csv 和 .txt 文件格式');
    return false;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const content = e.target.result;
    parseTurbineData(content, file.name);
  };

  reader.onerror = () => {
    ElMessage.error('文件读取失败');
    uploading.value = false;
    uploadProgress.value = 0;
  };
  uploading.value = true;
    uploadProgress.value = 0;
  reader.readAsText(file);
  return false; // Prevent automatic upload
};
const handleProgress = (event) => {
  uploadProgress.value = Math.round((event.loaded / event.total) * 100);
};

const parseTurbineData = async (data, fileName) => {
  let parsedData = [];
  const loadingInstance = ElLoading.service({
    text: "正在导入风机数据...",
    background: "rgba(0, 0, 0, 0.7)",
  });

  try {
    if (fileName.endsWith(".csv")) {
      parsedData = Papa.parse(data, {
        delimiter: ",",
        skipEmptyLines: true,
        header: true,
      }).data;
    } else if (fileName.endsWith(".txt")) {
      parsedData = data
        .split("\n")
        .map((line) => line.trim().split(/\s+/))
        .filter((line) => line.length >= 5);

      // Check if the first line is a header
      const hasHeader = parsedData.length > 0 && isNaN(parseFloat(parsedData[0][1]));

      parsedData = parsedData
        .slice(hasHeader ? 1 : 0) // Skip header if present
        .map((row) => ({
          name: row[0],
          longitude: parseFloat(row[1]),
          latitude: parseFloat(row[2]),
          hubHeight: parseFloat(row[3]),
          rotorDiameter: parseFloat(row[4]),
        }));
    }

    parsedData = parsedData.filter(
      (row) =>
        row.name &&
        !isNaN(row.latitude) &&
        !isNaN(row.longitude) &&
        !isNaN(row.hubHeight) &&
        !isNaN(row.rotorDiameter)
    ).map(row => ({
      ...row,
      id: generateUUID(), // Ensure unique ID for all turbines
    }));

    if(parsedData.length === 0) {
      throw new Error('没有有效的风机数据被解析。');
    }

    emit("import-turbines", parsedData);
    ElMessage.success(`成功导入 ${parsedData.length} 个风机`);
  } catch (error) {
    console.error("导入风机数据失败:", error);
    ElMessage.error("导入风机数据失败: " + error.message);
  } finally {
    loadingInstance.close();
      uploading.value = false;
      uploadProgress.value = 0;
  }
};
</script>

<style scoped>
.import-section {
  padding: 20px;
}

.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.upload-area:hover {
  border-color: #409eff;
}

.upload-area i {
  font-size: 20px;
  color: #909399;
}

.upload-text {
  margin: 10px 0;
  color: #606266;
}

.upload-text .highlight-text {
  color: #409eff;
  font-style: normal;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

.example-link {
  display: block;
  margin-top: 10px;
  text-align: center;
}

.example-content {
  margin-top: 10px;
  white-space: pre-wrap; /* 允许 pre 标签内换行 */
  font-family: monospace;
}
</style>