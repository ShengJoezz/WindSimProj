<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-19 19:43:55
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-17 01:38:08
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\Dashboard.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- /frontend/src/components/Dashboard.vue -->
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
          <div class="logo-icon">H</div> <!-- Changed W to H for HustWind -->
          <span v-if="!isCollapse" class="logo-text">HustWind</span> <!-- Changed WindSim to HustWind -->
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
          <div class="user-avatar">H</div> <!-- Changed W to H for HustWind -->
          <div class="user-info">
            <div class="user-name">HustWind用户</div> <!-- Changed WindSim to HustWind -->
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
    { index: `/cases/${caseId.value}/speed-visualization`, icon: 'WindPower', title: "速度场分析" },
    { index: `/cases/${caseId.value}/wind-management`, icon: Files, title: "风机管理" } // Changed DataLine to Files
  ];
}else {
      return [
        { index: "/", icon: House, title: "首页" },
        { index: `/windmast`, icon: DataLine, title: "测风塔分析" }, // Changed Files to DataLine
        { index: "/new", icon: Plus, title: "新建工况" },
        { index: "/cases", icon: Files, title: "工况列表" }, // Kept Files
        { index: "/terrainClip",icon: Location,title:"地形获取与裁剪"} // Changed Files to Location
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
  --primary-color: #4f8cfc;
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
  --box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
  box-shadow: var(--box-shadow);
  border-right: 1px solid var(--border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 10;
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
  background: linear-gradient(45deg, var(--primary-gradient-start), var(--primary-gradient-end));
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.logo-area::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent 70%);
  z-index: 1;
}

.logo-area.collapsed {
  padding: 0 8px;
}

.logo-content {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.logo-icon {
  min-width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: white;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  font-size: 22px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
  position: relative;
}

.collapse-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.05);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
  color: var(--primary-color);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

.collapse-btn:active {
  transform: scale(0.95);
}

.glow-icon {
  transition: all 0.3s ease;
  filter: drop-shadow(0 0 2px rgba(79, 140, 252, 0));
}

.collapse-btn:hover .glow-icon {
  filter: drop-shadow(0 0 3px rgba(79, 140, 252, 0.5));
}

.light-bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 3px;
  width: 0;
  background: linear-gradient(to right, var(--primary-gradient-start), var(--primary-gradient-end));
  transition: width 0.3s ease, opacity 0.3s ease;
  border-radius: 3px;
  opacity: 0;
}

.light-bar.active {
  width: 50px;
  opacity: 1;
}

/* 菜单内容区域 */
.menu-items-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  background-image:
    radial-gradient(circle at 10% 20%, rgba(30, 41, 59, 0.4) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, rgba(30, 41, 59, 0.4) 0%, transparent 20%);
}

/* 返回按钮 */
.back-btn {
  height: 48px;
  margin: 8px 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 10px;
  background-color: rgba(59, 130, 246, 0.12);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(59, 130, 246, 0.15);
}

.back-btn:hover {
  background-color: rgba(59, 130, 246, 0.18);
  transform: translateX(-5px);
  box-shadow: 0 3px 12px rgba(59, 130, 246, 0.15);
}

.back-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 140, 252, 0.5);
}

.back-btn .spin-icon {
  font-size: 18px;
  color: var(--primary-color);
  transition: transform 0.3s ease;
}

.back-btn:hover .spin-icon {
  transform: rotate(-20deg) scale(1.1);
}

.back-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
  letter-spacing: 0.3px;
}

/* 菜单项样式 */
.el-menu-item {
  height: 48px;
  line-height: 48px;
  margin: 8px 0;
  border-radius: 10px;
  padding: 0 16px !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background-color: var(--menu-item-bg);
  border: 1px solid transparent;
}

.el-menu-item:hover {
  background-color: var(--menu-item-hover);
  transform: translateX(5px);
  border-color: rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.el-menu-item.is-active,
.el-menu-item.is-active-custom {
  background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
  color: white !important;
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(0);
}

.el-menu-item .el-icon {
  margin-right: 14px;
  font-size: 18px;
  transition: all 0.25s ease;
}

.el-menu-item:hover .el-icon {
  color: var(--primary-color);
  transform: scale(1.15);
}

.el-menu-item.is-active .el-icon,
.el-menu-item.is-active-custom .el-icon {
  color: white !important;
  transform: scale(1.1);
}

.menu-title {
  font-size: 14px;
  font-weight: 500;
  transition: all 0.25s ease;
  letter-spacing: 0.2px;
}

.el-menu-item.is-active .menu-title,
.el-menu-item.is-active-custom .menu-title {
  font-weight: 600;
  letter-spacing: 0.4px;
}

/* 分割线 */
.el-divider {
  margin: 10px 0;
  background-color: var(--border-color);
  opacity: 0.6;
}

/* 菜单底部区域 */
.menu-footer {
  margin-top: auto;
  padding: 18px;
  border-top: 1px solid var(--border-color);
  background-color: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(5px);
}

.user-status {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.user-role {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.3px;
}

/* 滚动条美化 */
.menu-items-container::-webkit-scrollbar {
  width: 5px;
}

.menu-items-container::-webkit-scrollbar-track {
  background: transparent;
}

.menu-items-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
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
  left: -150%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.08),
    transparent
  );
  transition: left 0.7s ease;
}

.menu-item-shine:hover::after {
  left: 150%;
}

/* 活跃菜单项特效 */
.el-menu-item.is-active::before,
.el-menu-item.is-active-custom::before {
  content: '';
  position: absolute;
  width: 5px;
  height: 70%;
  left: 0;
  top: 15%;
  background: white;
  border-radius: 0 5px 5px 0;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(255, 255, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }
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
  font-size: 20px;
}

.el-menu--collapse .back-btn {
  justify-content: center;
  padding: 0;
}

.el-menu--collapse .back-btn .spin-icon {
  margin: 0;
  font-size: 20px;
}

/* 全局动画优化 */
* {
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 添加过渡效果 */
.el-menu-item,
.back-btn,
.collapse-btn,
.logo-area,
.user-avatar {
  will-change: transform, opacity, background-color;
}

/* 折叠状态的动画 */
.el-menu-vertical-demo {
  will-change: width;
}
</style>