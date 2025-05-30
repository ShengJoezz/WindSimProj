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
          支持 .txt 或 .csv 格式，每行包含: 名称,经度,纬度,高度,直径,模型 (可选)
          <br>经纬度支持十进制度数(116.3912)或度分秒格式(103°14'42" 或 103°14′42″)，中国区域经度为东经（正值），纬度为北纬（正值）
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

const convertDMSToDecimal = (dmsStr) => {
  // 匹配包含特殊引号符号的度分秒格式
  // 支持 ′ (U+2032 PRIME) 和 ″ (U+2033 DOUBLE PRIME) 作为分和秒的符号
  // 也支持普通的单引号(')和双引号(")

  // 统一不同类型的引号，关键步骤！
  const normalizedStr = dmsStr
    .replace(/′/g, "'")  // 替换特殊分符号为普通单引号
    .replace(/″/g, '"'); // 替换特殊秒符号为普通双引号

  console.log("标准化后的 DMS 字符串:", normalizedStr); // 调试输出

  // 匹配带方向的格式
  const dmsRegexWithDirection = /(\d+)°(\d+)'(\d+(\.\d+)?)"([NSEW])/i;
  // 匹配不带方向的格式
  const dmsRegexWithoutDirection = /(\d+)°(\d+)'(\d+(\.\d+)?)"/;

  let match = normalizedStr.match(dmsRegexWithDirection);

  if (match) {
    // 带方向指示符的情况
    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]) / 60;
    const seconds = parseFloat(match[3]) / 3600;
    const direction = match[5].toUpperCase();

    let decimal = degrees + minutes + seconds;

    // 如果是南方或西方，需要变成负值
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }

    console.log("带方向 DMS 转换结果:", decimal); // 调试输出
    return decimal;
  } else {
    // 尝试匹配不带方向指示符的格式
    match = normalizedStr.match(dmsRegexWithoutDirection);
    if (match) {
      const degrees = parseFloat(match[1]);
      const minutes = parseFloat(match[2]) / 60;
      const seconds = parseFloat(match[3]) / 3600;

      const decimal = degrees + minutes + seconds;
      console.log("不带方向 DMS 转换结果:", decimal); // 调试输出
      return decimal;
    }
  }

  console.log("非 DMS 格式，尝试直接解析:", dmsStr); // 调试输出
  // 如果不是度分秒格式，尝试直接解析为十进制
  return parseFloat(dmsStr);
};


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

    // 验证经度
    let lon;
    if (typeof longitude === 'string' && longitude.includes('°')) {
      lon = convertDMSToDecimal(longitude);
      if (isNaN(lon) || lon < 0 || lon > 180) { // 假设东经范围
        errors.push(`第 ${index + 1} 行经度超出合理东经范围 (0-180°) (${longitude})`);
      }
    } else {
      lon = parseFloat(longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        errors.push(`第 ${index + 1} 行经度无效，超出全球经度范围 (-180° to 180°) (${longitude})`);
      }
    }

    // 验证纬度
    let lat;
    if (typeof latitude === 'string' && latitude.includes('°')) {
      lat = convertDMSToDecimal(latitude);
      if (isNaN(lat) || lat < 0 || lat > 90) { // 假设北纬范围
        errors.push(`第 ${index + 1} 行纬度超出合理北纬范围 (0-90°) (${latitude})`);
      }
    } else {
      lat = parseFloat(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push(`第 ${index + 1} 行纬度无效，超出全球纬度范围 (-90° to 90°) (${latitude})`);
      }
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
      // 添加这一行立即输出原始内容
      console.log("文件内容原始数据:", event.target.result.substring(0, 200) + "...");

      const content = event.target.result;
      // 自动检测，用逗号分隔则使用逗号，否则使用制表符
      const delimiter = content.indexOf(',') !== -1 ? ',' : '\t';

      const lines = content.split('\n').filter(line => line.trim());
      console.log("解析到的行数:", lines.length);

      // 测试各种格式的转换是否正确
      console.log("测试度分秒转换:");
      const testCoords = [
        "103°14′42″",
        "103°14'42\"",
        "24°03′44″",
        "24°03'44\"",
        "116.3912" // 测试十进制度数
      ];

      testCoords.forEach(coord => {
        console.log(`${coord} => ${convertDMSToDecimal(coord)}`);
      });

      // 修改解析时也采用 delimiter 分隔
      const parsedData = lines.map(line => line.split(delimiter));
      const { isValid, errors } = validateTurbineData(parsedData);

      if (!isValid) {
        parseErrors.value = errors;
        uploadStatus.value = 'exception';
        return;
      }

      const turbines = lines.map(line => {
        const [name, longitude, latitude, hubHeight, rotorDiameter, model] = line.split(delimiter);

        // 处理经纬度 - 确保详细记录转换过程便于调试
        let lon = longitude.trim();
        let lat = latitude.trim();

        let decimalLon, decimalLat;

        console.log(`原始经度字符串: ${lon}`); // 调试输出 - 原始经度
        if (lon.includes('°')) {
          decimalLon = convertDMSToDecimal(lon);
          console.log(`转换经度: ${lon} => ${decimalLon}`); // 调试输出 - 转换过程
        } else {
          decimalLon = parseFloat(lon);
          console.log(`经度直接解析为十进制: ${lon} => ${decimalLon}`); // 调试输出 - 十进制解析
        }

        console.log(`原始纬度字符串: ${lat}`); // 调试输出 - 原始纬度
        if (lat.includes('°')) {
          decimalLat = convertDMSToDecimal(lat);
          console.log(`转换纬度: ${lat} => ${decimalLat}`); // 调试输出 - 转换过程
        } else {
          decimalLat = parseFloat(lat);
          console.log(`纬度直接解析为十进制: ${lat} => ${decimalLat}`); // 调试输出 - 十进制解析
        }

        return {
          name: name.trim(),
          longitude: decimalLon,
          latitude: decimalLat,
          hubHeight: parseFloat(hubHeight),
          rotorDiameter: parseFloat(rotorDiameter),
          model: model ? model.trim() : '',
        };
      });

      // 在emit前后添加log
      console.log("解析得到的风机数据:", turbines);
      console.log("准备发送import-turbines事件...");
      emit('import-turbines', turbines);
      console.log("import-turbines事件已发送");

      uploadStatus.value = 'success';
      uploadProgress.value = 100;
      ElMessage.success('上传并解析成功'); // 添加成功消息
    } catch (error) {
      console.error('文件解析错误:', error);
      console.error('错误堆栈:', error.stack);  // 添加堆栈信息
      parseErrors.value = ['文件解析失败: ' + error.message];
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
  border-radius: 12px;
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