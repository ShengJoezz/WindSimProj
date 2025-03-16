<!-- frontend/src/views/NewCase.vue -->
<template>
  <div class="new-case-container">
    <div class="case-header">
      <h2>新建工况</h2>
      <p class="subtitle">创建一个新的地形分析工况</p>
    </div>
    
    <el-card class="form-card">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="工况名称" prop="caseName">
          <el-input 
            v-model="form.caseName" 
            placeholder="输入工况名称" 
            class="custom-input"
          />
        </el-form-item>

        <el-form-item label="地形数据 (GeoTIFF)" prop="terrainFile">
          <el-upload
            class="upload-box"
            drag
            :file-list="terrainFileList"
            :before-upload="beforeUploadGeoTIFF"
            :on-remove="removeTerrainFile"
            accept=".tif,.tiff"
            :auto-upload="false"
            :on-change="handleTerrainChange"
          >
            <div class="upload-content">
              <i class="el-icon-upload upload-icon"></i>
              <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
              <div class="el-upload__tip">仅支持 .tif/.tiff 格式的地形文件</div>
            </div>
          </el-upload>
        </el-form-item>

        <el-form-item class="submit-item">
          <el-button type="primary" class="submit-button" @click="handleSubmit">
            <i class="el-icon-plus"></i> 创建工况
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <transition name="fade">
      <div v-if="message" :class="['message-box', success ? 'success-message' : 'error-message']">
        <i :class="success ? 'el-icon-check' : 'el-icon-close'"></i>
        {{ message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { useRouter } from 'vue-router';

// 表单数据
const form = reactive({
  caseName: '',
  terrainFile: null,
});

// 上传文件列表
const terrainFileList = ref([]);

// 消息提示
const success = ref(true);
const message = ref('');

// 表单引用
const formRef = ref(null);

// 路由
const router = useRouter();

// 规则定义
const rules = {
  caseName: [
    { required: true, message: '请输入工况名称', trigger: 'blur' }
  ],
  terrainFile: [
    { 
      required: true, 
      message: '请上传 GeoTIFF 文件', 
      trigger: ['change', 'blur'],
      validator: (rule, value, callback) => {
        if (!form.terrainFile) {
          callback(new Error('请上传 GeoTIFF 文件'));
        } else {
          callback();
        }
      }
    }
  ],
};

// 文件变更处理函数
const handleTerrainChange = (file) => {
  form.terrainFile = file.raw;
  terrainFileList.value = [file];
  formRef.value?.validateField('terrainFile');
};

// 上传前处理函数
const beforeUploadGeoTIFF = (file) => {
  console.log('Selected GeoTIFF file:', file);
  form.terrainFile = file;
  terrainFileList.value = [file];
  formRef.value?.validateField('terrainFile');
  return false;
};

// 文件移除处理函数
const removeTerrainFile = () => {
  form.terrainFile = null;
  terrainFileList.value = [];
  formRef.value?.validateField('terrainFile');
};

// 提交表单
const handleSubmit = async () => {
  console.log('Form state before validation:', {
    caseName: form.caseName,
    terrainFile: form.terrainFile,
  });

  if (!formRef.value) return;

  formRef.value.validate(async (valid) => {
    console.log('Validation result:', valid);
    if (valid) {
      const formData = new FormData();
      formData.append('caseName', form.caseName);
      if (form.terrainFile) {
        formData.append('terrainFile', form.terrainFile);
      }

      try {
        const res = await axios.post('/api/cases', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        if (res.data.success) {
          success.value = true;
          message.value = '工况创建成功';
          ElMessage.success('工况创建成功');
          // 清空表单
          form.caseName = '';
          form.terrainFile = null;
          terrainFileList.value = [];
          // 跳转到工况列表
          router.push('/cases');
        } else {
          success.value = false;
          message.value = res.data.message || '工况创建失败';
          ElMessage.error(message.value);
        }
      } catch (error) {
        success.value = false;
        message.value = error.response?.data?.message || '服务器错误，工况创建失败';
        ElMessage.error(message.value);
      }
    } else {
      ElMessage.error('请填写所有必填项并上传文件');
      return false;
    }
  });
};
</script>

<style scoped>
.new-case-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.case-header {
  text-align: center;
  margin-bottom: 30px;
}

.case-header h2 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  font-size: 16px;
}

.form-card {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  margin-bottom: 30px;
  padding: 10px;
}

.custom-input {
  border-radius: 4px;
}

.upload-box {
  width: 100%;
}

.upload-content {
  padding: 30px 0;
}

.upload-icon {
  font-size: 48px;
  color: #409EFF;
  margin-bottom: 16px;
}

.el-upload__text {
  font-size: 16px;
  margin-bottom: 8px;
}

.el-upload__text em {
  color: #409EFF;
  font-style: normal;
  font-weight: 500;
  cursor: pointer;
}

.el-upload__tip {
  color: #909399;
  font-size: 14px;
}

.submit-item {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.submit-button {
  min-width: 180px;
  padding: 12px 20px;
  font-size: 16px;
  border-radius: 4px;
  transition: all 0.3s;
}

.submit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

.message-box {
  padding: 12px 20px;
  margin-top: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all 0.3s;
}

.success-message {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.error-message {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.message-box i {
  margin-right: 8px;
  font-size: 16px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>