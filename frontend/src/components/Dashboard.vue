<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-27 11:18:01
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-27 12:02:14
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\Dashboard.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

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
      tabindex="0"
      @keydown.enter="handleMenuEnter"
      @keydown.arrow-down="handleArrowDown"
      @keydown.arrow-up="handleArrowUp"
    >
      <div class="logo-area" :class="{ collapsed: isCollapse }">
        <div class="logo-content">
          <div class="logo-icon">W</div>
          <span v-if="!isCollapse" class="logo-text">WindSim</span>
        </div>
      </div>

      <div class="collapse-btn-wrapper">
        <el-tooltip content="折叠/展开目录" placement="right" effect="dark">
          <div class="collapse-btn" @click="toggleCollapse" aria-expanded="!isCollapse" aria-controls="menu-items">
            <el-icon :size="20" class="glow-icon">
              <component :is="isCollapse ? 'Expand' : 'Menu'" />
            </el-icon>
          </div>
        </el-tooltip>
        <div class="light-bar" :class="{ active: !isCollapse }"></div>
      </div>

      <div id="menu-items" class="menu-items-container">
        <template v-if="isCaseDetail">
          <div class="back-btn" @click="backToMain" role="button" tabindex="0">
            <el-icon class="spin-icon"><Back /></el-icon>
            <span v-if="!isCollapse" class="back-text">返回工况列表</span>
          </div>
          <el-divider />
        </template>

        <template v-for="item in menuItems" :key="item.index">
          <el-menu-item :index="item.index" :class="getMenuItemClass(item)" role="menuitem">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>
              <span class="menu-title">{{ item.title }}</span>
            </template>
          </el-menu-item>
        </template>
      </div>

      <div class="menu-footer" v-if="!isCollapse">
        <div class="user-status">
          <div class="user-avatar">W</div>
          <div class="user-info">
            <div class="user-name">WindSim用户</div>
            <div class="user-role">系统管理员</div>
          </div>
        </div>
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

const menuBackground = "#1a202c";
const menuTextColor = "#e2e8f0";
const menuActiveTextColor = "#60a5fa";


const menuItems = computed(() => {
  if (isCaseDetail.value && caseId.value) {
  return [
    { index: `/cases/${caseId.value}/terrain`, icon: Location, title: "地形展示" },
    { index: `/cases/${caseId.value}/parameters`, icon: Setting, title: "参数设置" },
    { index: `/cases/${caseId.value}/calculation`, icon: Monitor, title: "计算输出" },
    { index: `/cases/${caseId.value}/results`, icon: DataLine, title: "结果展示" },
    { index: `/cases/${caseId.value}/wind-management`, icon: DataLine, title: "风机管理" }
  ];
}else {
      return [
        { index: "/", icon: House, title: "首页" },
        { index: "/new", icon: Plus, title: "新建工况" },
        { index: "/cases", icon: Files, title: "工况列表" },
      ];
    }
  });
const getMenuItemClass = (item) => {
  const classes = ['menu-item-shine'];
  if (item.index === defaultActive.value) {
    classes.push('is-active-custom');
  }
  return classes;
};
  const handleMenuEnter = (event) => {
      const target = event.target;
       if (target.classList.contains("el-menu-item")) {
            target.click();
         }
      if(target.classList.contains('back-btn')) {
           target.click();
      }
  };
  const handleArrowDown = (event) => {
     const menu = event.target.querySelector('#menu-items');
        if (menu) {
            const items = Array.from(menu.querySelectorAll('.el-menu-item, .back-btn'));
             if (items.length > 0) {
                  let nextIndex = -1;
                const activeItem = menu.querySelector('.el-menu-item.is-active, .back-btn:focus');
                if (activeItem) {
                    const currentIndex = items.indexOf(activeItem);
                    nextIndex = (currentIndex + 1) % items.length;
                } else {
                     nextIndex = 0;
                }
             items[nextIndex].focus();
            }
        }
    };
    const handleArrowUp = (event) => {
     const menu = event.target.querySelector('#menu-items');
      if (menu) {
            const items = Array.from(menu.querySelectorAll('.el-menu-item, .back-btn'));
             if (items.length > 0) {
                   let nextIndex = -1;
                 const activeItem = menu.querySelector('.el-menu-item.is-active, .back-btn:focus');
                if (activeItem) {
                    const currentIndex = items.indexOf(activeItem);
                    nextIndex = (currentIndex - 1 + items.length) % items.length;
                }else {
                    nextIndex = items.length - 1;
                }
                items[nextIndex].focus();
            }
        }
    };
</script>

<style scoped>
/* 颜色变量 */
:root {
  --primary-color: #60a5fa;
  --primary-gradient-start: #6366f1;
  --primary-gradient-end: #3b82f6;
  --background-dark: #0f172a;
  --sidebar-bg: #1a202c;
  --menu-item-bg: #1e293b;
  --menu-item-hover: #2d3748;
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  --border-color: rgba(100, 116, 139, 0.2);
}

.dashboard-container {
  height: 100vh;
  display: flex;
  position: relative;
}

.el-menu-vertical-demo {
  width: 260px;
  min-height: 100vh;
  height: 100%;
  background-color: var(--sidebar-bg);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border-right: 1px solid var(--border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 260px;
}

.el-menu--collapse {
  width: 70px;
}

/* 顶部品牌区域 */
.logo-area {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: linear-gradient(to right, var(--primary-gradient-start), var(--primary-gradient-end));
  transition: all 0.3s ease;
}

.logo-area.collapsed {
  padding: 0 8px;
}

.logo-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  min-width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.5px;
}

/* 折叠按钮区域 */
.collapse-btn-wrapper {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  padding: 0 16px;
  background-color: rgba(0, 0, 0, 0.1);
}

.collapse-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  color: var(--text-secondary);
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
  color: var(--primary-color);
}

.light-bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 2px;
  width: 0;
  background: linear-gradient(to right, var(--primary-gradient-start), var(--primary-gradient-end));
  transition: width 0.3s ease;
  border-radius: 2px;
}

.light-bar.active {
  width: 40px;
}

/* 菜单内容区域 */
.menu-items-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}

/* 返回按钮 */
.back-btn {
  height: 46px;
  margin: 6px 0;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 8px;
  background-color: rgba(59, 130, 246, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background-color: rgba(59, 130, 246, 0.15);
  transform: translateX(-4px);
}

.back-btn .spin-icon {
  font-size: 18px;
  color: var(--primary-color);
  transition: transform 0.3s ease;
}

.back-btn:hover .spin-icon {
  transform: rotate(-10deg);
}

.back-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
}

/* 菜单项样式 */
.el-menu-item {
  height: 46px;
  line-height: 46px;
  margin: 6px 0;
  border-radius: 8px;
  padding: 0 14px !important;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  background-color: var(--menu-item-bg);
}

.el-menu-item:hover {
  background-color: var(--menu-item-hover);
  transform: translateX(4px);
}

.el-menu-item.is-active,
.el-menu-item.is-active-custom {
  background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
  color: white !important;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}

.el-menu-item .el-icon {
  margin-right: 12px;
  font-size: 18px;
  transition: all 0.2s ease;
}

.el-menu-item:hover .el-icon {
  color: var(--primary-color);
  transform: scale(1.1);
}

.el-menu-item.is-active .el-icon,
.el-menu-item.is-active-custom .el-icon {
  color: white !important;
}

.menu-title {
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.el-menu-item.is-active .menu-title,
.el-menu-item.is-active-custom .menu-title {
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* 分割线 */
.el-divider {
  margin: 8px 0;
  background-color: var(--border-color);
  opacity: 0.6;
}

/* 菜单底部区域 */
.menu-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background-color: rgba(0, 0, 0, 0.1);
}

.user-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.user-role {
  font-size: 12px;
  color: var(--text-muted);
}

/* 滚动条美化 */
.menu-items-container::-webkit-scrollbar {
  width: 4px;
}

.menu-items-container::-webkit-scrollbar-track {
  background: transparent;
}

.menu-items-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.menu-items-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 菜单项特效 */
.menu-item-shine {
  position: relative;
  overflow: hidden;
}

.menu-item-shine::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.06),
    transparent
  );
  transition: left 0.5s ease;
}

.menu-item-shine:hover::after {
  left: 100%;
}

/* 活跃菜单项特效 */
.el-menu-item.is-active::before,
.el-menu-item.is-active-custom::before {
  content: '';
  position: absolute;
  width: 4px;
  height: 60%;
  left: 0;
  top: 20%;
  background: white;
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .el-menu-vertical-demo:not(.el-menu--collapse) {
    width: 240px;
  }
  
  .el-menu-item {
    font-size: 13px;
  }
  
  .logo-text {
    font-size: 18px;
  }
}

/* 折叠状态的特殊调整 */
.el-menu--collapse .el-menu-item {
  padding: 0 !important;
  display: flex;
  justify-content: center;
}

.el-menu--collapse .el-menu-item .el-icon {
  margin: 0;
}

.el-menu--collapse .back-btn {
  justify-content: center;
  padding: 0;
}

/* 全局动画优化 */
* {
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>