<template>
  <div class="page-container">
    <div class="content-wrapper">
      <el-table :data="cases" style="width: 100%" :header-cell-style="{ background: '#f5f7fa', color: '#333' }"
        :cell-style="{ padding: '12px 0' }" :border="true">
        <el-table-column prop="caseName" label="工况名称" min-width="180" sortable>
          <template #default="scope">
            <span class="case-name">{{ scope.row.caseName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="scope">
            <div class="actions-container">
              <el-button type="primary" icon="el-icon-view" size="small" @click="showCaseDetails(scope.row.caseName)"
                class="action-button">
                查看详情
              </el-button>
              <el-popconfirm :title="`确定要删除工况 '${scope.row.caseName}' 吗？`" @confirm="deleteCase(scope.row.caseName)">
                <template #reference>
                  <el-button type="danger" icon="el-icon-delete" size="small" class="action-button">
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="dialogVisible" title="创建新工况" width="500px" :close-on-click-modal="false" @close="resetForm">
        <el-form :model="newCase" :rules="rules" ref="formRef" label-width="100px" class="create-case-form">
          <el-form-item label="工况名称" prop="caseName">
            <el-input v-model="newCase.caseName" placeholder="请输入工况名称" clearable class="form-input" />
          </el-form-item>
          <el-form-item label="地形文件" prop="terrainFile">
            <el-upload class="terrain-upload" drag action="#" :before-upload="handleTerrainUpload"
              :on-remove="removeTerrainFile" :file-list="fileList" :limit="1" accept=".tif,.tiff">
              <i class="el-icon-upload"></i>
              <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
              <div class="el-upload__tip el-upload__tip--center">仅支持 GeoTIFF 文件</div>
            </el-upload>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false" class="dialog-button">取 消</el-button>
          <el-button type="primary" @click="createCase" class="dialog-button" :loading="isCreatingCase">确 定</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const router = useRouter();
const cases = ref([]);
const dialogVisible = ref(false);
const newCase = reactive({
  caseName: '',
  terrainFile: null
});
const fileList = ref([]);
const formRef = ref(null);
const isCreatingCase = ref(false);

const rules = {
  caseName: [
    { required: true, message: '请输入工况名称', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  terrainFile: [
    {
      required: true,
      message: '请上传 GeoTIFF 文件',
      trigger: ['change', 'blur'],
      validator: (rule, value, callback) => {
        if (!newCase.terrainFile) {
          callback(new Error('请上传 GeoTIFF 文件'));
        } else {
          callback();
        }
      }
    }
  ],
};

const loadCases = async () => {
  try {
    const response = await axios.get('/api/cases');
    cases.value = response.data.cases.map(caseName => ({ caseName }));
  } catch (error) {
    console.error('加载工况列表失败:', error);
    ElMessage.error('加载工况列表失败');
  }
};

const handleTerrainUpload = (file) => {
  newCase.terrainFile = file;
  fileList.value = [file];
  formRef.value?.validateField('terrainFile');
  return false;
};

const removeTerrainFile = () => {
  newCase.terrainFile = null;
  fileList.value = [];
  formRef.value?.validateField('terrainFile');
};

const createCase = async () => {
  try {
    await formRef.value.validate();

    isCreatingCase.value = true;

    const formData = new FormData();
    formData.append('caseName', newCase.caseName);
    if (newCase.terrainFile) {
      formData.append('terrainFile', newCase.terrainFile);
    }

    const response = await axios.post('/api/cases', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.data.success) {
      ElMessage.success(response.data.message);
      dialogVisible.value = false;
      await loadCases();
      router.push({
        name: 'CaseDetails',
        params: { caseId: response.data.caseName },
        query: { caseName: response.data.caseName }
      });
    } else {
      ElMessage.error(response.data.message);
    }
  } catch (error) {
    console.error('创建工况失败:', error);
    ElMessage.error(error.response?.data?.message || '创建工况失败');
  } finally {
    isCreatingCase.value = false;
  }
};

const deleteCase = async (caseName) => {
  try {
    const response = await axios.delete(`/api/cases/${caseName}`);
    if (response.data.success) {
      ElMessage.success(response.data.message);
      await loadCases();
    } else {
      ElMessage.error(response.data.message);
    }
  } catch (error) {
    console.error('删除工况失败:', error);
    ElMessage.error('删除工况失败');
  }
};

const showCaseDetails = (caseName) => {
  router.push({
    name: 'CaseDetails',
    params: { caseId: caseName },
    query: { caseName: caseName }
  });
};

const resetForm = () => {
  newCase.caseName = '';
  newCase.terrainFile = null;
  fileList.value = [];
  if (formRef.value) {
    formRef.value.clearValidate();
  }
};

onMounted(loadCases);
</script>

<style scoped>
.page-container {
  font-family: 'Arial', sans-serif;
  min-height: 100vh;
  background: linear-gradient(135deg, #e1e8f0, #f5f8fa); /* Adjusted gradient */
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 20px;
}

.content-wrapper {
  width: 100%;
  max-width: 1000px;
  background-color: #f8f8f8; /* Slightly darker background for contrast */
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); /* Stronger shadow */
  padding: 30px;
  border: 2px solid #ced4da; /* Added a more distinct border */
}

.el-table {
  border-radius: 8px;
  overflow: hidden;
}

.el-table .el-table__header-wrapper th {
  background-color: #f0f4f7; /* Slightly different header color */
}

.el-table .el-table__body-wrapper td {
  background-color: #f8f8f8; /* Match content-wrapper background */
}

.case-name {
  font-weight: 600;
  color: #2980b9; /* Slightly darker blue */
}

.actions-container {
  display: flex;
  justify-content: flex-end; /* Align buttons to the right */
  gap: 10px; /* Space between buttons */
}

.action-button {
  margin: 0; /* Remove default margin */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add a shadow to the button */
  transition: all 0.2s ease; /* Smooth transition */
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); /* Larger shadow on hover */
}

.create-case-form .form-input {
  width: 100%;
}

.terrain-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  text-align: center;
  padding: 20px;
}

.terrain-upload:hover {
  border-color: #409EFF;
}

.el-upload__tip--center {
  text-align: center;
}

.dialog-button {
  margin-top: 20px;
  transition: all 0.3s ease;
}

.dialog-button:hover {
  transform: scale(1.05);
}
</style>