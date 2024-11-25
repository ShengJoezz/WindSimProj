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

      <template v-if="isCaseDetail">
        <el-menu-item :index="`/cases/${caseId}/terrain`">
          <el-icon><Location /></el-icon>
          <template #title>地形展示</template>
        </el-menu-item>

        <el-divider />

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
import { useRoute } from 'vue-router';
import {
  House,
  Plus,
  Files,
  Setting,
  Monitor,
  DataLine,
  Location,
  Fold,
  Expand
} from '@element-plus/icons-vue';

const route = useRoute();
const isCollapse = ref(false);

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

const isCaseDetail = computed(() => {
  return route.path.includes('/cases/') && route.params.caseId;
});

const caseId = computed(() => route.params.caseId);

const defaultActive = computed(() => route.path);

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

.collapse-btn {
  height: 56px;
  line-height: 56px;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s;
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.el-divider {
  background-color: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}
</style>