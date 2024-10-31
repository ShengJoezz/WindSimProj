<!-- frontend/src/views/Cases.vue -->
<template>
    <div>
      <h2>工况列表</h2>
      <el-table :data="cases" style="width: 100%">
        <el-table-column prop="name" label="工况名称"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button type="primary" size="small" @click="viewCase(scope.row.name)">查看</el-button>
            <el-button 
              type="danger" 
              size="small" 
              @click="deleteCase(scope.row.name)"
              style="margin-left: 10px"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
  import { ElMessage, ElMessageBox } from 'element-plus';
  
  const cases = ref([]);
  const router = useRouter();
  
  const fetchCases = async () => {
    try {
      const res = await axios.get('/api/cases', {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.data.cases) {
        cases.value = res.data.cases.map(name => ({ name }));
      } else {
        throw new Error('获取数据格式错误');
      }
    } catch (error) {
      console.error('获取工况列表失败:', error);
      ElMessage.error(error.response?.data?.message || '获取工况列表失败');
    }
  };
  
  const viewCase = (caseName) => {
  // 直接跳转，不添加任何额外参数
  router.push({ 
    path: '/', 
    query: { caseId: caseName }
  });
};


  const deleteCase = async (caseName) => {
    try {
      await ElMessageBox.confirm(
        `确定要删除工况 "${caseName}" 吗？`,
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
      
      const url = `/api/cases/${caseName}`;
      
      const response = await axios.delete(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      if (response.data.success) {
        ElMessage.success('删除成功');
        await fetchCases(); // 刷新列表
      } else {
        throw new Error(response.data.message || '删除失败');
      }
    } catch (error) {
      if (error !== 'cancel') {
        console.error('删除失败:', error);
        ElMessage.error(
          error.response?.data?.message || 
          error.message || 
          '删除失败'
        );
      }
    }
  };
  
  onMounted(() => {
    fetchCases();
  });
  </script>

<style scoped>
.el-button {
  margin: 0 5px;
}

.el-table {
  margin-top: 20px;
}
</style>