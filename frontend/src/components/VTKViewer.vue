<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 20:05:26
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-06-19 17:35:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\VTKViewer.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="vtk-container">
    <div ref="vtkContainer" class="vtk-viewer"></div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <!-- 状态信息 -->
      <div class="panel-section status-section">
        <div class="status-text">
          <span class="status-label">当前显示:</span>
          <span class="status-value">{{ vtkFileName }}</span>
          <span v-if="loading" class="loading-indicator">
            <span class="loading-spinner"></span>加载中...
          </span>
        </div>
      </div>

      <!-- 文件选择 -->
      <div class="panel-section">
        <h3 class="section-title">选择显示内容</h3>
        <div class="button-group">
          <button
            @click="switchFile('mesh')"
            :class="['control-button', currentFile === 'mesh' ? 'active' : '']"
          >
            <i class="icon-mesh"></i>网格
          </button>
          <button
            @click="switchFile('bot')"
            :class="['control-button', currentFile === 'bot' ? 'active' : '']"
          >
            <i class="icon-bottom"></i>底面
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
            <i class="icon-reset"></i>重置视图
          </button>
          <button
            @click="toggleAxes"
            :class="['control-button', showAxes ? 'active' : '']"
          >
            <i class="icon-axes"></i>坐标轴
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
            <i class="icon-wireframe"></i>线框
          </button>
          <button
            @click="toggleSurface"
            :class="['control-button', showSurface ? 'active' : '']"
          >
            <i class="icon-surface"></i>表面
          </button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <i class="icon-error"></i>
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
let isInitialized = ref(false);

// 初始化渲染器
const initRenderer = () => {
  if (isInitialized.value || !vtkContainer.value) return;

  try {
    fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      container: vtkContainer.value,
      background: [0.1, 0.1, 0.15],
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

    isInitialized.value = true;
    console.log('Renderer initialized successfully');
  } catch (err) {
    console.error('Error initializing renderer:', err);
    error.value = '渲染器初始化失败';
  }
};

// 加载VTK文件
const loadVTKFile = async (fileType = 'mesh') => {
  if (!isInitialized.value) {
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
      property.setColor(0.4, 0.6, 1.0); // 蓝色网格
    } else {
      property.setColor(0.85, 0.85, 0.85); // 灰色底面
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

// 导出网格文件
const exportGrid = async () => {
  if (!isInitialized.value) {
    return { success: false, message: '渲染器未初始化' };
  }

  try {
    loading.value = true;

    // 构建下载URL - 直接从后端获取文件
    const fileUrl = `/api/cases/${props.caseId}/VTK/processed/${currentFile.value}.vtp`;

    // 使用fetch检查文件是否存在
    const response = await fetch(fileUrl, { method: 'HEAD' });

    if (!response.ok) {
      return { success: false, message: `文件不存在或无法访问: ${response.statusText}` };
    }

    // 创建下载链接
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${props.caseId}_${currentFile.value}.vtp`;
    link.target = '_blank'; // 在新标签页打开
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true, message: '网格文件下载已开始' };
  } catch (error) {
    console.error('导出网格失败:', error);
    return { success: false, message: `导出网格失败: ${error.message}` };
  } finally {
    loading.value = false;
  }
};


// 监听caseId变化
watch(() => props.caseId, async (newId) => {
  if (newId && !isInitialized.value) {
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
    isInitialized.value = false;
  }
});

defineExpose({ exportGrid });
</script>

<style scoped>
.vtk-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #0d1117, #161b22);
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
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
  top: 16px;
  right: 16px;
  background: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 16px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  transition: all 0.3s ease;
}

.control-panel:hover {
  background: rgba(30, 41, 59, 0.92);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  transform: translateY(-2px);
}

.panel-section {
  margin-bottom: 20px;
  position: relative;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.status-section {
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-size: 12px;
}

.section-title::after {
  content: '';
  flex-grow: 1;
  height: 1px;
  background: rgba(148, 163, 184, 0.2);
  margin-left: 8px;
}

.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.control-button {
  padding: 10px 12px;
  background-color: rgba(51, 65, 85, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.control-button:hover {
  background-color: rgba(71, 85, 105, 0.8);
  border-color: rgba(100, 116, 139, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.control-button.active {
  background-color: rgba(59, 130, 246, 0.6);
  border-color: rgba(96, 165, 250, 0.8);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4), inset 0 0 6px rgba(255, 255, 255, 0.1);
}

.status-text {
  font-size: 13px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.status-label {
  font-weight: 500;
  color: #94a3b8;
}

.status-value {
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(59, 130, 246, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  white-space: nowrap;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #60a5fa;
  font-size: 12px;
  margin-left: auto;
  background: rgba(96, 165, 250, 0.15);
  padding: 4px 8px;
  border-radius: 12px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(96, 165, 250, 0.2);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-message {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(220, 38, 38, 0.9);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 80%;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease;
}

/* 图标样式 */
[class^="icon-"] {
  display: inline-block;
  width: 18px;
  height: 18px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

.icon-mesh {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'/%3E%3Cpolyline points='2 17 12 22 22 17'/%3E%3Cpolyline points='2 12 12 17 22 12'/%3E%3C/svg%3E");
}

.icon-bottom {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='3' y1='15' x2='21' y2='15'/%3E%3C/svg%3E");
}

.icon-reset {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/%3E%3Cpath d='M3 3v5h5'/%3E%3C/svg%3E");
}

.icon-axes {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 3L3 21'/%3E%3Cpath d='M21 21H3V3'/%3E%3C/svg%3E");
}

.icon-wireframe {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 20 7 20 17 12 22 4 17 4 7 12 2'/%3E%3Cline x1='12' y1='2' x2='12' y2='22'/%3E%3Cline x1='4' y1='7' x2='20' y2='7'/%3E%3Cline x1='4' y1='17' x2='20' y2='17'/%3E%3C/svg%3E");
}

.icon-surface {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/%3E%3C/svg%3E");
}

.icon-error {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E");
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .control-panel {
    width: 100%;
    top: auto;
    bottom: 0;
    right: 0;
    border-radius: 16px 16px 0 0;
    max-height: 40vh;
    overflow-y: auto;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
    transform: none;
  }
  
  .control-panel:hover {
    transform: none;
  }

  .button-group {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .status-value {
    max-width: 120px;
  }
}

/* 添加控制面板的淡入效果 */
@keyframes panelFadeIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.control-panel {
  animation: panelFadeIn 0.4s ease-out;
}

/* 添加按钮激活时的动画 */
.control-button.active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 添加悬浮时光晕效果 */
.control-button:hover {
  box-shadow: 0 0 15px rgba(96, 165, 250, 0.3);
}

/* 提高控制面板的视觉层次感 */
.control-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.05), transparent);
  border-radius: 12px 12px 0 0;
  pointer-events: none;
}
</style>