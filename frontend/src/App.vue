<!-- frontend/src/App.vue -->
<template>
  <div class="app-container">
    <Dashboard />
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import Dashboard from './components/Dashboard.vue';
import TerrainMap from './components/TerrainMap/TerrainMap.vue';
</script>

<style>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: rgba(255, 255, 255, 0.8);
  position: relative;
  z-index: 1;
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
</style>