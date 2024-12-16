<!-- frontend/src/views/NewCase.vue -->
<template>
  <div>
    <h2>新建工况</h2>
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="工况名称" prop="caseName">
        <el-input v-model="form.caseName" placeholder="输入工况名称" />
      </el-form-item>

      <el-form-item label="地形数据 (GeoTIFF)" prop="terrainFile">
        <el-upload
          class="upload-demo"
          drag
          :file-list="terrainFileList"
          :before-upload="beforeUploadGeoTIFF"
          :on-remove="removeTerrainFile"
          accept=".tif,.tiff"
          :auto-upload="false"
          :on-change="handleTerrainChange"
        >
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
          <div class="el-upload__tip">仅支持 .tif/.tiff 文件</div>
        </el-upload>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleSubmit">创建工况</el-button>
      </el-form-item>
    </el-form>
    <div v-if="message" :class="{'success-message': success, 'error-message': !success}" style="margin-top: 20px;">
      {{ message }}
    </div>
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
.success-message {
  color: green;
}
.error-message {
  color: red;
}
.upload-demo i {
  font-size: 40px;
  color: #409EFF;
}
.upload-demo .el-upload__text em {
  color: #409EFF;
}
</style>