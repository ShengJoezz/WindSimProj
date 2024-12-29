<template>
  <div class="dashboard-container" role="navigation">
    <el-menu
      class="el-menu-vertical-demo"
      :collapse="isCollapse"
      :background-color="menuBackground"
      :text-color="menuTextColor"
      :active-text-color="menuActiveTextColor"
      :default-active="defaultActive"
      role="menubar"
      router
    >
      <div class="collapse-btn-wrapper">
        <el-tooltip content="折叠/展开目录" placement="right" effect="dark">
          <div class="collapse-btn" @click="toggleCollapse" aria-expanded="!isCollapse" aria-controls="menu-items">
            <el-icon :size="24" class="glow-icon">
              <component :is="isCollapse ? 'Expand' : 'Menu'" />
            </el-icon>
          </div>
        </el-tooltip>
        <div class="light-bar" :class="{ active: !isCollapse }"></div>
      </div>

      <div id="menu-items">
        <template v-if="isCaseDetail">
          <div class="back-btn" @click="backToMain" role="button" tabindex="0">
            <el-icon class="spin-icon"><Back /></el-icon>
            <span v-if="!isCollapse" class="glowing-text">返回工况列表</span>
          </div>
          <el-divider />
        </template>

        <template v-for="item in menuItems" :key="item.index">
          <el-menu-item :index="item.index" :class="getMenuItemClass(item)" role="menuitem">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </div>
    </el-menu>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
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
} from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const isCollapse = ref(false);

const isCaseDetail = computed(() => {
  return route.path.includes("/cases/") && route.params.caseId;
});

const caseId = computed(() => route.params.caseId);

const defaultActive = computed(() => route.path);

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

const backToMain = () => {
  router.push("/cases");
};

const menuBackground = "#2c3e50";
const menuTextColor = "#ecf0f1";
const menuActiveTextColor = "#ffd04b";

const menuItems = computed(() =>
  isCaseDetail.value
    ? [
        { index: `/cases/${caseId.value}/terrain`, icon: Location, title: "地形展示" },
        { index: `/cases/${caseId.value}/parameters`, icon: Setting, title: "参数设置" },
        { index: `/cases/${caseId.value}/calculation`, icon: Monitor, title: "计算输出" },
        { index: `/cases/${caseId.value}/results`, icon: DataLine, title: "结果展示" },
      ]
    : [
        { index: "/", icon: House, title: "首页" },
        { index: "/new", icon: Plus, title: "新建工况" },
        { index: "/cases", icon: Files, title: "工况列表" },
      ]
);

const getMenuItemClass = (item) => {
  // 示例：应用动态类
  const classes = ['menu-item-shine'];
  // 可以添加更多逻辑来判断其他类
  // 例如：
  // if (item.isActive) classes.push('active-item');
  return classes;
};
</script>

<style scoped>
:root {
  /* 将背景色调整为更深的色调 */
  --primary-dark: #111827;       /* 更深的主背景色 */
  --primary-bg: #1a2234;         /* 更深的菜单背景色 */
  --secondary-bg: #1e293b;       /* 更深的次级背景色 */
  --hover-bg: #2d3748;           /* 更深的悬停背景色 */
  --active-bg: #2c3e50;          /* 更深的激活状态背景 */
  
  /* 文字颜色 */
  --text-primary: #e2e8f0;       /* 主要文字 */
  --text-secondary: #9ca3af;     /* 次要文字 */
  --text-muted: #6b7280;         /* 淡化文字 */
  
  /* 强调色 */
  --accent-blue: #60a5fa;        /* 主要强调色 */
  --accent-purple: #7c3aed;      /* 次要强调色 */
  --accent-green: #34d399;       /* 成功状态色 */
  
  /* 边框和分割线 */
  --border-color: rgba(75, 85, 99, 0.4);
  --divider-color: rgba(75, 85, 99, 0.3);
  
  /* 阴影效果 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  
  /* 过渡效果 */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dashboard-container {
  height: 100vh;
  display: flex;
  background-color: var(--primary-dark);
  opacity: 1; /* 确保完全不透明 */
}

.el-menu-vertical-demo {
  width: 260px;
  min-height: 100vh;
  background-color: var(--primary-bg);
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 260px;
}

.el-menu--collapse {
  width: 64px;
}

/* 顶部折叠按钮区域 */
.collapse-btn-wrapper {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--secondary-bg);
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.collapse-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--text-secondary);
}

.collapse-btn:hover {
  background-color: var(--hover-bg);
  color: var(--accent-blue);
  transform: scale(1.05);
}

/* 菜单项样式 */
.el-menu-item {
  height: 50px;
  line-height: 50px;
  margin: 4px 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all var(--transition-normal);
}

.el-menu-item:hover {
  background-color: var(--hover-bg);
  color: var(--text-primary);
  transform: translateX(4px);
}

.el-menu-item.is-active {
  background: linear-gradient(45deg, var(--accent-purple), var(--accent-blue));
  color: white;
  font-weight: 500;
  box-shadow: var(--shadow-md);
}

/* 图标样式 */
.el-menu-item .el-icon {
  font-size: 18px;
  margin-right: 12px;
  transition: all var(--transition-normal);
}

.el-menu-item:hover .el-icon {
  color: var(--accent-blue);
  transform: scale(1.1);
}

.el-menu-item.is-active .el-icon {
  color: white;
}

/* 返回按钮样式 */
.back-btn {
  height: 48px;
  margin: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-normal);
}

.back-btn:hover {
  background-color: var(--hover-bg);
  color: var(--accent-blue);
  transform: translateX(-4px);
}

.back-btn .spin-icon {
  font-size: 18px;
  transition: all var(--transition-normal);
}

/* 分割线样式 */
.el-divider {
  margin: 8px 0;
  background-color: var(--divider-color);
}

/* 滚动条美化 */
.el-menu-vertical-demo::-webkit-scrollbar {
  width: 4px;
}

.el-menu-vertical-demo::-webkit-scrollbar-track {
  background: transparent;
}

.el-menu-vertical-demo::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 4px;
}

.el-menu-vertical-demo::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 光效和动画 */
.menu-item-shine {
  position: relative;
  overflow: hidden;
}

.menu-item-shine::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.08),
    transparent
  );
  transition: left 0.5s ease;
}

.menu-item-shine:hover::after {
  left: 100%;
}

/* 焦点状态样式 */
.el-menu-item:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3);
}

/* 激活状态的特殊效果 */
.el-menu-item.is-active {
  position: relative;
  overflow: hidden;
}

.el-menu-item.is-active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    45deg,
    rgba(124, 58, 237, 0.1),
    rgba(96, 165, 250, 0.1)
  );
  opacity: 0.5;
  z-index: -1;
}

/* 文字效果 */
.el-menu-item span {
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: all var(--transition-normal);
}

.el-menu-item.is-active span {
  font-weight: 600;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

/* 适配暗色主题 */
@media (prefers-color-scheme: dark) {
  .el-menu-vertical-demo {
    background-color: var(--primary-bg);
  }
  
  .el-menu-item {
    color: var(--text-secondary);
  }
  
  .el-menu-item:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .el-menu-vertical-demo:not(.el-menu--collapse) {
    width: 230px;
  }
  
  .el-menu-item {
    height: 45px;
    line-height: 45px;
    font-size: 14px;
  }
}

/* 优化动画性能 */
* {
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>