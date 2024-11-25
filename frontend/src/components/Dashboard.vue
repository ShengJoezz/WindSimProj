<!-- frontend/src/components/Dashboard.vue -->
<template>
  <div class="dashboard-container">
    <el-menu
      class="el-menu-vertical-demo"
      :collapse="isCollapse"
      :background-color="menuBackground"
      :text-color="menuTextColor"
      :active-text-color="menuActiveTextColor"
      :default-active="defaultActive"
      router
    >
      <!-- 折叠按钮 -->
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon :size="20">
          <component :is="isCollapse ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>

      <!-- 返回按钮，只在工况详情页显示 -->
      <template v-if="isCaseDetail">
        <div class="back-btn" @click="backToMain">
          <el-icon><Back /></el-icon>
          <span v-if="!isCollapse">返回工况列表</span>
        </div>

        <el-divider />

        <el-menu-item :index="`/cases/${caseId}/terrain`">
          <el-icon><Location /></el-icon>
          <template #title>地形展示</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/parameters`">
          <el-icon><Setting /></el-icon>
          <template #title>参数设置</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/calculation`">
          <el-icon><Monitor /></el-icon>
          <template #title>计算输出</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/results`">
          <el-icon><DataLine /></el-icon>
          <template #title>结果展示</template>
        </el-menu-item>
      </template>

      <!-- 主界面菜单项 -->
      <template v-else>
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <template #title>首页</template>
        </el-menu-item>
        <el-menu-item index="/new">
          <el-icon><Plus /></el-icon>
          <template #title>新建工况</template>
        </el-menu-item>
        <el-menu-item index="/cases">
          <el-icon><Files /></el-icon>
          <template #title>工况列表</template>
        </el-menu-item>
      </template>
    </el-menu>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  House,
  Plus,
  Files,
  Setting,
  Monitor,
  DataLine,
  Location,
  Fold,
  Expand,
  Back
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const isCollapse = ref(false);

// 判断是否在工况详情页
const isCaseDetail = computed(() => {
  return route.path.includes('/cases/') && route.params.caseId;
});

// 获取当前工况ID
const caseId = computed(() => route.params.caseId);

// 计算当前激活的菜单项
const defaultActive = computed(() => route.path);

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

// 返回工况列表
const backToMain = () => {
  router.push('/cases');
};

// 菜单样式
const menuBackground = '#2c3e50';
const menuTextColor = '#ecf0f1';
const menuActiveTextColor = '#ffd04b';
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
  display: flex;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 200px;
  min-height: 100vh;
}

.el-menu--collapse {
  width: 64px;
}

.collapse-btn, .back-btn {
  height: 56px;
  line-height: 56px;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s;
  color: #ecf0f1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
}

.collapse-btn:hover, .back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.el-menu--collapse .back-btn {
  padding: 0;
  justify-content: center;
}

.back-btn {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.back-btn span {
  font-size: 14px;
  transition: opacity 0.3s;
}

.el-divider {
  background-color: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

/* 确保图标垂直居中 */
:deep(.el-menu-item) {
  display: flex;
  align-items: center;
}

:deep(.el-menu-item .el-icon) {
  margin-right: 5px;
}
</style>