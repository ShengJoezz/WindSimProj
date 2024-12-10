<!--
文件: Cases.vue
功能: 工况管理页面组件
描述: 该组件用于展示和管理工况列表,包含查看和删除功能
依赖组件:
- Element Plus: el-table, el-button, ElMessage, ElMessageBox
- Vue Router
- Axios

API接口:
- GET /api/cases - 获取工况列表
- DELETE /api/cases/{caseName} - 删除指定工况

页面结构:
- 标题
- 工况列表表格
  - 工况名称列
  - 操作列(查看/删除按钮)
-->

<template>
  <div>
    <!-- 页面标题 -->
    <h2>工况列表</h2>

    <!-- 
    工况列表表格
    :data - 绑定表格数据源
    -->
    <el-table :data="cases" style="width: 100%">
      <!-- 工况名称列 -->
      <el-table-column prop="name" label="工况名称"></el-table-column>
      
      <!-- 
      操作列 
      #default="scope" - 作用域插槽,scope.row可访问当前行数据
      -->
      <el-table-column label="操作" width="200">
        <template #default="scope">
          <!-- 查看按钮 -->
          <el-button 
            type="primary" 
            size="small" 
            @click="viewCase(scope.row.name)"
          >查看</el-button>
          
          <!-- 删除按钮 -->
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

// 状态定义
const cases = ref([]); // 工况列表数据
const router = useRouter();

// 获取工况列表
const fetchCases = async () => {
  try {
    const res = await axios.get('/api/cases', {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (res.data.cases) {
      // 将返回的工况名称数组转换为对象数组格式
      cases.value = res.data.cases.map(name => ({ name }));
    } else {
      throw new Error('获取数据格式错误');
    }
  } catch (error) {
    console.error('获取工况列表失败:', error);
    ElMessage.error(error.response?.data?.message || '获取工况列表失败');
  }
};

// 查看工况详情
const viewCase = (caseName) => {
  router.push({ 
    name: 'CaseDetails',
    params: { caseId: caseName }
  });
};

// 删除工况
const deleteCase = async (caseName) => {
  try {
    // 显示删除确认对话框
    await ElMessageBox.confirm(
      `确定要删除工况 "${caseName}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    // 调用删除API
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
      await fetchCases(); // 删除成功后刷新列表
    } else {
      throw new Error(response.data.message || '删除失败');
    }
  } catch (error) {
    // 用户取消删除时不显示错误提示
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

// 组件挂载时获取工况列表
onMounted(() => {
  fetchCases();
});
</script>

<style scoped>
/* 按钮间距 */
.el-button {
  margin: 0 5px;
}

/* 表格上边距 */
.el-table {
  margin-top: 20px;
}
</style>
