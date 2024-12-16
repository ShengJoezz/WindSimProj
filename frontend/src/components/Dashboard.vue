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
      <div class="collapse-btn-wrapper">
        <el-tooltip content="折叠/展开目录" placement="right" effect="dark">
          <div class="collapse-btn" @click="toggleCollapse">
            <el-icon :size="24" class="glow-icon">
              <component :is="isCollapse ? 'Expand' : 'Menu'" />
            </el-icon>
          </div>
        </el-tooltip>
        <div class="light-bar" :class="{ active: !isCollapse }"></div>
      </div>

      <template v-if="isCaseDetail">
        <div class="back-btn" @click="backToMain">
          <el-icon class="spin-icon"><Back /></el-icon>
          <span v-if="!isCollapse" class="glowing-text">返回工况列表</span>
        </div>

        <el-divider />

        <el-menu-item :index="`/cases/${caseId}/terrain`" class="menu-item-shine">
          <el-icon><Location /></el-icon>
          <template #title>地形展示</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/parameters`" class="menu-item-shine">
          <el-icon><Setting /></el-icon>
          <template #title>参数设置</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/calculation`" class="menu-item-shine">
          <el-icon><Monitor /></el-icon>
          <template #title>计算输出</template>
        </el-menu-item>

        <el-menu-item :index="`/cases/${caseId}/results`" class="menu-item-shine">
          <el-icon><DataLine /></el-icon>
          <template #title>结果展示</template>
        </el-menu-item>
      </template>

      <template v-else>
        <el-menu-item index="/" class="menu-item-shine">
          <el-icon><House /></el-icon>
          <template #title>首页</template>
        </el-menu-item>
        <el-menu-item index="/new" class="menu-item-shine">
          <el-icon><Plus /></el-icon>
          <template #title>新建工况</template>
        </el-menu-item>
        <el-menu-item index="/cases" class="menu-item-shine">
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
  Menu,
  Expand,
  Back,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const isCollapse = ref(false);

const isCaseDetail = computed(() => {
  return route.path.includes('/cases/') && route.params.caseId;
});

const caseId = computed(() => route.params.caseId);

const defaultActive = computed(() => route.path);

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

const backToMain = () => {
  router.push('/cases');
};

const menuBackground = '#2c3e50';
const menuTextColor = '#ecf0f1';
const menuActiveTextColor = '#ffd04b';
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
  display: flex;
}

.el-menu-vertical-demo {
  width: 200px;
  min-height: 100vh;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: #2c3e50;
  overflow: hidden; /* Hide text on collapse */
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  box-shadow: 5px 0 10px rgba(0, 0, 0, 0.2);
}

.el-menu--collapse {
  width: 64px;
}

.el-menu--collapse .el-tooltip {
  padding: 0 !important; /* Override Element Plus inline style */
}

.collapse-btn-wrapper {
  position: relative;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s;
}

.light-bar {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 100%;
  background-color: #409EFF;
  transition: width 0.3s ease;
  z-index: -1;
}

.light-bar.active {
  width: 5px;
}

.collapse-btn {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #34495e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1;
}

.collapse-btn:hover {
  background-color: #409EFF;
}

.collapse-btn .el-icon {
  transition: transform 0.3s ease, color 0.3s ease;
}

.collapse-btn:hover .el-icon {
  transform: rotate(180deg);
  color: #fff;
}

.glow-icon {
  animation: glow 2s infinite alternate;
}

@keyframes glow {
  from {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #409EFF, 0 0 20px #409EFF;
  }
  to {
    text-shadow: 0 0 10px #fff, 0 0 15px #409EFF, 0 0 20px #409EFF, 0 0 25px #409EFF, 0 0 30px #409EFF;
  }
}

.back-btn {
  height: 56px;
  line-height: 56px;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s;
  color: #ecf0f1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #2c3e50; /* Slightly darker background */
}

.back-btn:hover {
  background-color: #34495e;
}

.back-btn .spin-icon {
  transition: transform 0.5s ease;
}

.back-btn:hover .spin-icon {
  transform: rotate(360deg);
}

.back-btn span {
  font-size: 14px;
  transition: opacity 0.3s;
}

.glowing-text {
  animation: textGlow 2s infinite alternate;
}

@keyframes textGlow {
  from {
    text-shadow: 0 0 3px #fff, 0 0 6px #409EFF;
  }
  to {
    text-shadow: 0 0 6px #fff, 0 0 9px #409EFF, 0 0 12px #409EFF;
  }
}

.el-divider {
  background-color: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.el-menu-item {
  display: flex;
  align-items: center;
  transition: background-color 0.3s;
}

.el-menu-item .el-icon {
  margin-right: 5px;
  transition: color 0.3s; /* Add transition for icon color */
}

.el-menu-item:hover {
  background-color: #34495e;
}

.el-menu-item:hover .el-icon {
  color: #409EFF; /* Change icon color on hover */
}

.el-menu-item.is-active {
  background-color: #34495e;
}

.menu-item-shine {
  position: relative;
  overflow: hidden;
}

.menu-item-shine::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s ease;
}

.menu-item-shine:hover::after {
  left: 100%;
}
</style>