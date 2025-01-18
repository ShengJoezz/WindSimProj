<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-13 10:00:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-18 18:49:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\VTKViewer.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->
<template>
  <div class="vtk-container relative">
    <div ref="vtkContainer" class="w-full h-full"></div>

    <!-- 错误提示 Toast -->
    <div v-if="error"
         class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-700 p-4 rounded-lg shadow-lg z-50 flex items-center space-x-2">
      <span class="material-icons">error</span>
      <p>{{ error }}</p>
      <button @click="error = ''" class="ml-2 text-red-500 hover:text-red-700">
        <span class="material-icons">close</span>
      </button>
    </div>

    <!-- 控制面板 -->
    <div class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg space-y-3 w-64">
      <!-- 状态信息 -->
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700">
          正在显示: {{ vtkFileName }}
        </span>
        <div v-if="loading" class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
      </div>

      <!-- 视图控制 -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">视图控制</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="resetCamera"
            class="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
          >
            重置视图
          </button>
          <button
            @click="toggleOrientationAxes"
            class="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
          >
            坐标轴
          </button>
        </div>
      </div>

      <!-- 显示选项 -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">显示选项</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="toggleWireframe"
            class="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            :class="{ 'bg-blue-200': showWireframe }"
          >
            {{ showWireframe ? '隐藏网格' : '显示网格' }}
          </button>
          <button
            @click="toggleSurface"
            class="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            :class="{ 'bg-blue-200': showSurface }"
          >
            {{ showSurface ? '隐藏表面' : '显示表面' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';

const vtkContainer = ref(null);
const error = ref('');
const loading = ref(false);
const showOrientationAxes = ref(true);
const vtkFileName = ref('');
const showWireframe = ref(true);  // 默认显示网格
const showSurface = ref(true);    // 默认显示表面

// State refs
let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let currentMapper = null;
let currentActor = null;
let orientationAxes = null;

// Props
const props = defineProps({
  vtkFileUrl: {
    type: String,
    required: true,
  },
});

// Methods
const resetCamera = () => {
  if (renderer) {
    renderer.resetCamera();
    renderWindow?.render();
  }
};

const toggleOrientationAxes = () => {
  showOrientationAxes.value = !showOrientationAxes.value;
  if (orientationAxes) {
    orientationAxes.setVisibility(showOrientationAxes.value);
    renderWindow?.render();
  }
};

// 切换网格显示
const toggleWireframe = () => {
  showWireframe.value = !showWireframe.value;
  if (currentActor) {
    currentActor.getProperty().setEdgeVisibility(showWireframe.value);
    if (showWireframe.value) {
      currentActor.getProperty().setEdgeColor(0, 0, 0); // 黑色网格线
      currentActor.getProperty().setLineWidth(1); // 网格线宽度
    }
    renderWindow?.render();
  }
};

// 切换表面显示
const toggleSurface = () => {
  showSurface.value = !showSurface.value;
  if (currentActor) {
    currentActor.getProperty().setOpacity(showSurface.value ? 1 : 0);
    renderWindow?.render();
  }
};

const initializeRenderer = () => {
  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    container: vtkContainer.value,
    background: [0.1, 0.1, 0.1],
  });

  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();

  // 添加坐标轴
  orientationAxes = vtkAxesActor.newInstance();
  renderer.addActor(orientationAxes);
};

const loadVtkFile = async () => {
  if (!props.vtkFileUrl) {
    error.value = '未提供 VTK 文件 URL';
    return;
  }

  loading.value = true;
  error.value = '';
  vtkFileName.value = props.vtkFileUrl.split('/').pop();

  try {
    const response = await fetch(props.vtkFileUrl);
    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态码: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const reader = vtkXMLPolyDataReader.newInstance();
    reader.parseAsArrayBuffer(arrayBuffer);

    if (currentActor) {
      renderer.removeActor(currentActor);
    }

    currentMapper = vtkMapper.newInstance();
    currentMapper.setInputData(reader.getOutputData());

    currentActor = vtkActor.newInstance();
    currentActor.setMapper(currentMapper);

    // 设置默认显示属性
    const property = currentActor.getProperty();
    property.setEdgeVisibility(showWireframe.value);
    if (showWireframe.value) {
      property.setEdgeColor(0, 0, 0);  // 黑色网格线
      property.setLineWidth(1);         // 网格线宽度
    }
    property.setOpacity(showSurface.value ? 1 : 0);  // 表面透明度
    property.setColor(0.8, 0.8, 0.8); // 浅灰色表面
    property.setLighting(true);       // 启用光照

    renderer.addActor(currentActor);

    if (!orientationAxes) {
      orientationAxes = vtkAxesActor.newInstance();
      renderer.addActor(orientationAxes);
    }
    orientationAxes.setVisibility(showOrientationAxes.value);

    renderer.resetCamera();
    renderWindow?.render();

    console.log('VTK file loaded successfully');
  } catch (e) {
    console.error('加载 VTK 文件出错:', e);
    error.value = `加载 VTK 文件出错: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

// 监听 vtkFileUrl 的变化
watch(() => props.vtkFileUrl, (newUrl) => {
  if (newUrl) {
    loadVtkFile();
  }
}, { immediate: true });

// 监听显示状态变化
watch([showWireframe, showSurface], () => {
  if (currentActor && renderWindow) {
    renderWindow.render();
  }
});

onMounted(() => {
  initializeRenderer();
});

onBeforeUnmount(() => {
  if (fullScreenRenderer) {
    fullScreenRenderer.delete();
  }
});
</script>

<style scoped>
.vtk-container {
  width: 100%;
  height: 100vh;
  background: rgb(17, 17, 17);
}

/* 添加过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>