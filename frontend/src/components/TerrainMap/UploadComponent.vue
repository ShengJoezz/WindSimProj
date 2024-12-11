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
        :on-change="handleUploadChange"
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
  
  const emit = defineEmits(["import-turbines"]);
  
  const showExample = ref(false);
  
  const toggleExample = () => {
    showExample.value = !showExample.value;
  };
  
  const handleUploadChange = () => {
    // 需要时可添加额外处理
  };
  
  const handleFileUpload = (file) => {
    const reader = new FileReader();
  
    reader.onload = (e) => {
      const content = e.target.result;
      parseTurbineData(content, file.name);
    };
  
    reader.readAsText(file);
  
    return false; // 防止自动上传
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
        parsedData = parsedData.slice(1).map((row) => ({
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
      );
  
      const turbines = parsedData.map((row) => ({
          id: row.name, // Using name as ID
          longitude: parseFloat(row.longitude),
          latitude: parseFloat(row.latitude),
          hubHeight: parseFloat(row.hubHeight), // Use hubHeight
          rotorDiameter: parseFloat(row.rotorDiameter), // Use rotorDiameter
        }));
  
      emit("import-turbines", turbines);
      ElMessage.success(`成功导入 ${turbines.length} 个风机`);
    } catch (error) {
      console.error("导入风机数据失败:", error);
      ElMessage.error("导入风机数据失败");
    } finally {
      loadingInstance.close();
    }
  };
  
  // 生成 UUID 的函数（也可以使用 uuidv4 库）
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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