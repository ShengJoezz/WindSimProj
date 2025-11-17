<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:12:29
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:23:28
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\WindMastLayout.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- src/views/WindMast/WindMastLayout.vue -->
<template>
  <div class="wind-mast-layout">
    <el-container>
      <el-aside width="240px">
        <el-menu
          router
          :default-active="$route.path"
          class="wind-mast-menu"
          background-color="#f8f9fa"
          text-color="#303133"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/windmast">
            <el-icon><Monitor /></el-icon>
            <span>概览</span>
          </el-menu-item>
          
          <el-menu-item index="/windmast/upload">
            <el-icon><Upload /></el-icon>
            <span>文件上传</span>
          </el-menu-item>
          
          <el-menu-item index="/windmast/analysis">
            <el-icon><DataAnalysis /></el-icon>
            <span>执行分析</span>
          </el-menu-item>
          
          <el-menu-item index="/windmast/results">
            <el-icon><PieChart /></el-icon>
            <span>分析结果</span>
          </el-menu-item>
          
          <el-menu-item index="/windmast/management">
            <el-icon><Management /></el-icon>
            <span>文件管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-container>
        <el-header>
          <div class="header-content">
            <h2>{{ $route.meta.title || '测风塔数据分析系统' }}</h2>
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item :to="{ path: '/windmast' }">测风塔分析</el-breadcrumb-item>
              <el-breadcrumb-item v-if="$route.name !== 'WindMastDashboard'">
                {{ getBreadcrumbName($route.name) }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
        </el-header>
        
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { Monitor, Upload, DataAnalysis, PieChart, Management } from '@element-plus/icons-vue';

// Helper to translate route names to breadcrumb names
const getBreadcrumbName = (routeName) => {
  const nameMap = {
    'WindMastUpload': '文件上传',
    'WindMastAnalysis': '执行分析',
    'WindMastResults': '分析结果',
    'WindMastResultDetail': '详细结果',
    'WindMastManagement': '文件管理'
  };
  return nameMap[routeName] || routeName;
};
</script>

<style scoped>
.wind-mast-layout {
  height: 100%;
  min-height: calc(100vh - 64px); /* Adjust based on main app header */
}

.el-container {
  height: 100%;
}

.el-aside {
  background-color: #f8f9fa;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.wind-mast-menu {
  height: 100%;
  border-right: none;
}

.el-header {
  background-color: #fff;
  border-bottom: 1px solid #ebeef5;
  padding: 0 20px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #303133;
}

.el-main {
  padding: 20px;
  background-color: #f8f9fa;
}
</style>