<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-19 21:44:17
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-06-19 17:35:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\VTKTest.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div v-if="process.env.NODE_ENV === 'development'" class="test-vtk-container">
    <div ref="vtkContainer" class="vtk-viewer"></div>
    <div class="controls">
      <button @click="loadAndDisplayVTK" class="test-button">
        Load VTK File
      </button>
      <button @click="resetCamera" class="test-button">
        Reset Camera
      </button>
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';

const vtkContainer = ref(null);
const error = ref('');

let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let currentActor = null;
let axes = null;

// 初始化渲染器
const initRenderer = () => {
  if (!vtkContainer.value) return;

  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    container: vtkContainer.value,
    background: [0.2, 0.2, 0.2],
  });

  renderWindow = fullScreenRenderer.getRenderWindow();
  renderer = fullScreenRenderer.getRenderer();

  // 设置交互器样式
  const interactor = renderWindow.getInteractor();
  interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

  // 添加坐标轴
  axes = vtkAxesActor.newInstance();
  renderer.addActor(axes);

  renderer.resetCamera();
  renderWindow.render();
};

// 加载并显示VTK文件
const loadAndDisplayVTK = async () => {
  try {
    const caseId = '1234'; // 使用测试用例ID
    const response = await fetch(`/api/cases/${caseId}/VTK/processed/mesh.vtp`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Received array buffer size:', arrayBuffer.byteLength);

    const reader = vtkXMLPolyDataReader.newInstance();
    reader.parseAsArrayBuffer(arrayBuffer);
    const polyData = reader.getOutputData(0);

    console.log('PolyData info:', {
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
    property.setColor(0.5, 0.5, 1.0);
    property.setEdgeVisibility(true);
    property.setEdgeColor(0.0, 0.0, 0.0);
    property.setLineWidth(1);
    property.setOpacity(1.0);
    property.setLighting(true);

    // 添加actor到渲染器
    renderer.addActor(currentActor);

    // 重置相机并渲染
    renderer.resetCamera();
    renderWindow.render();

    // 打印相机信息
    const camera = renderer.getActiveCamera();
    console.log('Camera position:', camera.getPosition());
    console.log('Camera focal point:', camera.getFocalPoint());
    console.log('Camera up vector:', camera.getViewUp());

  } catch (err) {
    console.error('Error loading VTK file:', err);
    error.value = err.message;
  }
};

// 重置相机
const resetCamera = () => {
  if (renderer) {
    renderer.resetCamera();
    renderWindow.render();
  }
};

// 生命周期钩子
onMounted(() => {
  initRenderer();
});

onBeforeUnmount(() => {
  if (fullScreenRenderer) {
    fullScreenRenderer.delete();
  }
});
</script>

<style scoped>
.test-vtk-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background: #1a1a1a;
}

.vtk-viewer {
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
}

.test-button {
  margin: 5px;
  padding: 8px 16px;
  background: #4a4a4a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-button:hover {
  background: #5a5a5a;
}

.error-message {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}
</style>