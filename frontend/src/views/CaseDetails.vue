<!-- frontend/src/views/CaseDetails.vue -->
<template>
    <div class="case-details-container">
      <NavigationBar :isCaseActive="true" />
      <div class="sub-main-content">
        <router-view />
      </div>
    </div>
  </template>
  
  <script setup>
  import NavigationBar from '../components/NavigationBar.vue';
  </script>
  
  <style scoped>
  .case-details-container {
    display: flex;
    height: 100vh;
  }
  
  .sub-main-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    background-color: rgba(255, 255, 255, 0.8);
    position: relative;
    z-index: 1;
  }
  </style>