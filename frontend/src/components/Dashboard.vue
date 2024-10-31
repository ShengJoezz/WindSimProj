<!-- frontend/src/components/Dashboard.vue -->
<template>
    <el-menu
      class="el-menu-vertical-demo"
      :background-color="menuBackground"
      :text-color="menuTextColor"
      :active-text-color="menuActiveTextColor"
      default-active="1"
      @select="handleSelect"
    >
      <template v-if="isCaseActive">
        <el-submenu index="1">
          <template #title>
            <span>参数设置</span>
          </template>
          <el-menu-item index="1-1" @click="navigateTo('ParameterSettings')">参数设置</el-menu-item>
        </el-submenu>
        
        <el-submenu index="2">
          <template #title>
            <span>计算输出</span>
          </template>
          <el-menu-item index="2-1" @click="navigateTo('CalculationOutput')">计算输出</el-menu-item>
        </el-submenu>
        
        <el-submenu index="3">
          <template #title>
            <span>结果展示</span>
          </template>
          <el-menu-item index="3-1" @click="navigateTo('ResultsDisplay')">结果展示</el-menu-item>
        </el-submenu>
      </template>
      
      <template v-else>
        <el-menu-item index="1" @click="navigateToHome">
          首页
        </el-menu-item>
        <el-menu-item index="2" @click="navigateToNewCase">
          新建工况
        </el-menu-item>
        <el-menu-item index="3" @click="navigateToCases">
          工况列表
        </el-menu-item>
      </template>
    </el-menu>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  
  const route = useRoute();
  const router = useRouter();
  
  // 判断当前是否处于工况详情页或其子路由
  const isCaseActive = computed(() => {
    return route.name === 'CaseDetails' ||
           route.name === 'ParameterSettings' ||
           route.name === 'CalculationOutput' ||
           route.name === 'ResultsDisplay';
  });
  
  // 可以根据需要修改菜单的颜色
  const menuBackground = '#2c3e50';
  const menuTextColor = '#ecf0f1';
  const menuActiveTextColor = '#ffd04b';
  
  const handleSelect = (key, keyPath) => {
    // 已在点击事件中处理导航，无需额外操作
  };
  
  const navigateTo = (routeName) => {
    if (routeName === 'ParameterSettings') {
      router.push({ name: 'ParameterSettings', params: { caseId: route.params.caseId } });
    } else if (routeName === 'CalculationOutput') {
      router.push({ name: 'CalculationOutput', params: { caseId: route.params.caseId } });
    } else if (routeName === 'ResultsDisplay') {
      router.push({ name: 'ResultsDisplay', params: { caseId: route.params.caseId } });
    }
  };
  
  const navigateToHome = () => {
    router.push({ name: 'Home' });
  };
  
  const navigateToNewCase = () => {
    router.push({ name: 'NewCase' });
  };
  
  const navigateToCases = () => {
    router.push({ name: 'Cases' });
  };
  </script>
  
  <style scoped>
  .el-menu-vertical-demo {
    width: 200px;
    min-height: 100vh;
  }
  </style>