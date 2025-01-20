<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-19 21:49:23
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-19 21:51:13
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\VTKViewer.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->


<template>
  <div class="vtk-container">
    <div ref="vtkContainer" class="vtk-viewer"></div>
    
    <!-- 控制面板 - 修改样式确保可见 -->
    <div class="control-panel">
      <!-- 状态信息 -->
      <div class="panel-section">
        <span class="status-text">
          当前显示: {{ vtkFileName }}
          <span v-if="loading" class="loading-indicator">加载中...</span>
        </span>
      </div>

      <!-- 文件选择 -->
      <div class="panel-section">
        <h3 class="section-title">选择显示内容</h3>
        <div class="button-group">
          <button
            @click="switchFile('mesh')"
            :class="['control-button', currentFile === 'mesh' ? 'active' : '']"
          >
            网格
          </button>
          <button
            @click="switchFile('bot')"
            :class="['control-button', currentFile === 'bot' ? 'active' : '']"
          >
            底面
          </button>
        </div>
      </div>

      <!-- 视图控制 -->
      <div class="panel-section">
        <h3 class="section-title">视图控制</h3>
        <div class="button-group">
          <button
            @click="resetView"
            class="control-button"
          >
            重置视图
          </button>
          <button
            @click="toggleAxes"
            :class="['control-button', showAxes ? 'active' : '']"
          >
            坐标轴
          </button>
        </div>
      </div>

      <!-- 显示选项 -->
      <div class="panel-section">
        <h3 class="section-title">显示选项</h3>
        <div class="button-group">
          <button
            @click="toggleWireframe"
            :class="['control-button', showWireframe ? 'active' : '']"
          >
            线框
          </button>
          <button
            @click="toggleSurface"
            :class="['control-button', showSurface ? 'active' : '']"
          >
            表面
          </button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';

const props = defineProps({
  caseId: {
    type: String,
    required: true
  }
});

const vtkContainer = ref(null);
const error = ref('');
const loading = ref(false);
const vtkFileName = ref('');
const currentFile = ref('mesh');
const showAxes = ref(true);
const showWireframe = ref(true);
const showSurface = ref(true);

let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let currentActor = null;
let axes = null;
let isInitialized = false;

// 初始化渲染器
const initRenderer = () => {
  if (isInitialized || !vtkContainer.value) return;

  try {
    fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      container: vtkContainer.value,
      background: [0.2, 0.2, 0.2],
    });

    renderWindow = fullScreenRenderer.getRenderWindow();
    renderer = fullScreenRenderer.getRenderer();

    const interactor = renderWindow.getInteractor();
    interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

    axes = vtkAxesActor.newInstance();
    renderer.addActor(axes);
    axes.setVisibility(showAxes.value);

    renderer.resetCamera();
    renderWindow.render();

    isInitialized = true;
    console.log('Renderer initialized successfully');
  } catch (err) {
    console.error('Error initializing renderer:', err);
    error.value = '渲染器初始化失败';
  }
};

// 加载VTK文件
const loadVTKFile = async (fileType = 'mesh') => {
  if (!isInitialized) {
    console.warn('Renderer not initialized');
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const fileName = `${fileType}.vtp`;
    const response = await fetch(`/api/cases/${props.caseId}/VTK/processed/${fileName}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`Received array buffer size for ${fileName}:`, arrayBuffer.byteLength);

    const reader = vtkXMLPolyDataReader.newInstance();
    reader.parseAsArrayBuffer(arrayBuffer);
    const polyData = reader.getOutputData(0);

    console.log('PolyData info:', {
      fileName,
      numberOfPoints: polyData.getNumberOfPoints(),
      numberOfCells: polyData.getNumberOfCells(),
      bounds: polyData.getBounds()
    });

    // 移除现有的actor
    if (currentActor) {
      renderer.removeActor(currentActor);
    }

    // 创建新的mapper和actor
    const mapper = vtkMapper.newInstance();
    mapper.setInputData(polyData);

    currentActor = vtkActor.newInstance();
    currentActor.setMapper(mapper);

    // 设置actor属性
    const property = currentActor.getProperty();
    
    // 根据文件类型设置不同的颜色
    if (fileType === 'mesh') {
      property.setColor(0.5, 0.5, 1.0); // 蓝色网格
    } else {
      property.setColor(0.8, 0.8, 0.8); // 灰色底面
    }
    
    property.setEdgeVisibility(showWireframe.value);
    property.setEdgeColor(0.0, 0.0, 0.0);
    property.setLineWidth(1);
    property.setOpacity(showSurface.value ? 1.0 : 0.5);
    property.setLighting(true);

    // 添加actor到渲染器
    renderer.addActor(currentActor);

    // 重置相机并渲染
    renderer.resetCamera();
    renderWindow.render();

    vtkFileName.value = fileName;
    currentFile.value = fileType;

  } catch (err) {
    console.error('Error loading VTK file:', err);
    error.value = '加载VTK文件失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 切换文件
const switchFile = (fileType) => {
  loadVTKFile(fileType);
};

// 重置视图
const resetView = () => {
  if (renderer) {
    renderer.resetCamera();
    renderWindow.render();
  }
};

// 切换坐标轴显示
const toggleAxes = () => {
  if (axes) {
    showAxes.value = !showAxes.value;
    axes.setVisibility(showAxes.value);
    renderWindow.render();
  }
};

// 切换线框显示
const toggleWireframe = () => {
  if (currentActor) {
    showWireframe.value = !showWireframe.value;
    currentActor.getProperty().setEdgeVisibility(showWireframe.value);
    renderWindow.render();
  }
};

// 切换表面显示
const toggleSurface = () => {
  if (currentActor) {
    showSurface.value = !showSurface.value;
    currentActor.getProperty().setOpacity(showSurface.value ? 1.0 : 0.5);
    renderWindow.render();
  }
};

// 监听caseId变化
watch(() => props.caseId, async (newId) => {
  if (newId && !isInitialized) {
    initRenderer();
  }
  if (newId) {
    await loadVTKFile(currentFile.value);
  }
}, { immediate: true });

// 生命周期钩子
onMounted(() => {
  initRenderer();
  if (props.caseId) {
    loadVTKFile(currentFile.value);
  }
});

onBeforeUnmount(() => {
  if (fullScreenRenderer) {
    if (currentActor) {
      renderer.removeActor(currentActor);
    }
    fullScreenRenderer.delete();
    isInitialized = false;
  }
});
</script>


<style scoped>
.vtk-container {
  width: 100%;
  height: calc(100vh - 64px);
  position: relative;
  background: #1a1a1a;
  overflow: hidden;
}

.vtk-viewer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 控制面板样式 */
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 16px;
  width: 240px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.panel-section {
  margin-bottom: 16px;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.control-button {
  padding: 8px 12px;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-button:hover {
  background-color: #e5e7eb;
}

.control-button.active {
  background-color: #60a5fa;
  color: white;
  border-color: #3b82f6;
}

.status-text {
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.loading-indicator {
  font-size: 12px;
  color: #3b82f6;
  animation: pulse 1.5s infinite;
}

.error-message {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #fee2e2;
  color: #dc2626;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>

<!-- Script部分保持不变 -->