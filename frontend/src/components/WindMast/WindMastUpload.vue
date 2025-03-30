<!-- src/views/WindMast/WindMastUpload.vue -->
<template>
  <div class="wind-mast-upload">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span>上传测风塔数据文件</span>
          <el-button-group>
            <el-button type="primary" @click="refreshFiles">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
            <el-button type="success" @click="$router.push('/windmast/analysis')">
              <el-icon><Right /></el-icon> 进入分析
            </el-button>
          </el-button-group>
        </div>
      </template>
      
      <!-- Upload Area -->
      <div class="upload-area">
        <el-upload
          action="/api/windmast/upload"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :file-list="uploadedFileList"
          :auto-upload="true"
          name="file"
          drag
          accept=".csv"
          :before-upload="beforeUpload"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽 CSV 文件到此处 或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              请上传测风塔数据 CSV 文件 
              <el-tooltip content="支持标准测风塔数据格式，每列应包含时间戳、风速、风向等信息" placement="top">
                <el-icon><InfoFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-upload>
      </div>
    </el-card>
    
    <!-- Uploaded Files List -->
    <el-card class="files-card" v-loading="store.isLoadingFiles">
      <template #header>
        <div class="card-header">
          <span>已上传文件列表</span>
          <el-input
            v-model="searchQuery"
            placeholder="搜索文件"
            prefix-icon="Search"
            clearable
            style="width: 250px"
          ></el-input>
        </div>
      </template>
      
      <el-table
        :data="filteredFiles"
        style="width: 100%"
        empty-text="暂无上传文件"
        :default-sort="{ prop: 'createdAt', order: 'descending' }"
      >
        <el-table-column type="expand">
          <template #default="props">
            <div class="file-details">
              <p><strong>文件路径：</strong> {{ props.row.path }}</p>
              <p><strong>文件大小：</strong> {{ formatFileSize(props.row.size) }}</p>
              <p><strong>创建时间：</strong> {{ formatDate(props.row.createdAt) }}</p>
              <p><strong>修改时间：</strong> {{ formatDate(props.row.modifiedAt) }}</p>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="originalName" label="文件名" sortable min-width="250"></el-table-column>
        
        <el-table-column prop="size" label="大小" width="120" sortable>
          <template #default="scope">
            {{ formatFileSize(scope.row.size) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="createdAt" label="上传时间" width="180" sortable>
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              @click="renameFile(scope.row)"
              plain
            >
              重命名
            </el-button>
            
            <el-button
              type="danger"
              size="small"
              @click="deleteFile(scope.row)"
              plain
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredFiles.length"
        />
      </div>
    </el-card>
    
    <!-- Rename Dialog -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名文件"
      width="500px"
      destroy-on-close
    >
      <el-form :model="renameForm" label-width="80px">
        <el-form-item label="当前名称">
          <el-input v-model="renameForm.currentName" disabled></el-input>
        </el-form-item>
        <el-form-item label="新名称">
          <el-input 
            v-model="renameForm.newName" 
            placeholder="输入新的文件名（不含路径）"
            clearable
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRename" :loading="isRenaming">
            确认重命名
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { UploadFilled, InfoFilled, Refresh, Right, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useWindMastStore } from '@/store/windMastStore';

const store = useWindMastStore();
const uploadedFileList = ref([]);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const renameDialogVisible = ref(false);
const renameForm = ref({
  currentName: '',
  newName: '',
  filename: ''
});
const isRenaming = ref(false);

onMounted(() => {
  refreshFiles();
});

const refreshFiles = async () => {
  await store.scanInputFolder();
};

const filteredFiles = computed(() => {
  if (!searchQuery.value) {
    return store.inputFiles;
  }
  
  const query = searchQuery.value.toLowerCase();
  return store.inputFiles.filter(file => 
    file.originalName.toLowerCase().includes(query)
  );
});

const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredFiles.value.slice(start, end);
});

const formatFileSize = (sizeInBytes) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const beforeUpload = (file) => {
  const isCSV = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
  if (!isCSV) {
    ElMessage.error('只能上传 CSV 文件!');
  }
  return isCSV;
};

const handleUploadSuccess = (response, file, fileList) => {
  if (response.success && response.file) {
    ElMessage.success(`${file.name} 上传成功!`);
    refreshFiles();
  } else {
    ElMessage.error(`${file.name} 上传失败: ${response.message || '未知错误'}`);
    
    // Remove the file from el-upload's list if the backend reported failure
    const index = fileList.findIndex(f => f.uid === file.uid);
    if (index > -1) {
      fileList.splice(index, 1);
    }
  }
  
  uploadedFileList.value = fileList;
};

const handleUploadError = (error, file, fileList) => {
  let errorMessage = '上传出错';
  try {
    const errorResponse = JSON.parse(error.message || '{}');
    errorMessage = errorResponse.message || error.message || '网络错误或服务器错误';
  } catch(e) {
    errorMessage = error.message || '网络错误或服务器错误';
  }
  
  ElMessage.error(`${file.name} ${errorMessage}`);
  
  // Remove the file from el-upload's list
  const index = fileList.findIndex(f => f.uid === file.uid);
  if (index > -1) {
    fileList.splice(index, 1);
  }
  
  uploadedFileList.value = fileList;
};

const renameFile = (file) => {
  renameForm.value = {
    currentName: file.originalName,
    newName: file.originalName,
    filename: file.filename
  };
  renameDialogVisible.value = true;
};

const confirmRename = async () => {
  if (!renameForm.value.newName.trim()) {
    ElMessage.warning('请输入有效的文件名');
    return;
  }
  
  isRenaming.value = true;
  
  try {
    const success = await store.renameInputFile(
      renameForm.value.filename, 
      renameForm.value.newName
    );
    
    if (success) {
      renameDialogVisible.value = false;
    }
  } finally {
    isRenaming.value = false;
  }
};

const deleteFile = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${file.originalName}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await store.deleteInputFile(file.filename);
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除文件时出错:', error);
    }
  }
};
</script>

<style scoped>
.wind-mast-upload {
  max-width: 1400px;
  margin: 0 auto;
}

.upload-card,
.files-card {
  margin-bottom: 24px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-area {
  padding: 20px 0;
}

.upload-icon {
  font-size: 48px;
  color: #409EFF;
  margin-bottom: 16px;
}

.el-upload__tip {
  margin-top: 8px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 5px;
}

.file-details {
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.file-details p {
  margin: 8px 0;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>