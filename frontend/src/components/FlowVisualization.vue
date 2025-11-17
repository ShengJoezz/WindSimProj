<template>
    <div class="flow-visualization">
      <div ref="vtkContainer" class="vtk-container"></div>
      <div v-if="loading" class="overlay-message">
        <el-loading text="加载流场数据..." />
      </div>
      <div v-else-if="error" class="overlay-message error">
        <el-alert type="error" :title="error" show-icon />
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import { useRoute } from 'vue-router';
  import * as vtk from 'vtk.js/Sources/index';
  import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
  import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
  import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
  import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
  
  const vtkContainer = ref(null);
  const loading = ref(false);
  const error = ref(null);
  let renderWindow = null;
  const route = useRoute();
  
  onMounted(async () => {
    loading.value = true;
    error.value = null;
  
    renderWindow = vtkFullScreenRenderWindow.newInstance({
      rootContainer: vtkContainer.value,
      background: [0.1, 0.1, 0.1],
    });
  
    const renderer = renderWindow.getRenderer();
    const renderWindowInstance = renderWindow.getRenderWindow();
  
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
      url: `/api/cases/${route.params.caseId}/results-vtk`,
    });
  
    const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
    mapper.setInputConnection(reader.getOutputPort());
  
    const actor = vtk.Rendering.Core.vtkActor.newInstance();
    actor.setMapper(mapper);
    renderer.addActor(actor);
  
    // 添加颜色映射
    const lut = vtkColorTransferFunction.newInstance();
    lut.addRGBPoint(0, 0.0, 0.0, 1.0); // 蓝色
    lut.addRGBPoint(0.5, 0.0, 1.0, 0.0); // 绿色
    lut.addRGBPoint(1, 1.0, 0.0, 0.0);   // 红色
    mapper.setScalarModeToUsePointFieldData();
    mapper.setScalarVisibility(true);
    mapper.setLookupTable(lut);
  
    // 添加透明度控制 (可选)
    // const pwf = vtkPiecewiseFunction.newInstance();
    // pwf.addPoint(0, 0.0);
    // pwf.addPoint(1, 1.0);
    // actor.getProperty().setScalarOpacityFunction(pwf);
    // actor.getProperty().setOpacity(1);
  
    reader.onReady(() => {
      renderer.resetCamera();
      renderWindowInstance.render();
      loading.value = false;
    });
  
    reader.onError((e) => {
      console.error("加载 VTK 数据失败:", e);
      error.value = "加载 VTK 数据失败";
      loading.value = false;
    });
  
    reader.loadData();
  });
  
  onBeforeUnmount(() => {
    if (renderWindow) {
      renderWindow.delete();
    }
  });
  </script>
  
  <style scoped>
  .flow-visualization {
    position: relative;
    width: 100%;
    height: 600px; /* 可以根据需要调整高度 */
  }
  
  .vtk-container {
    width: 100%;
    height: 100%;
  }
  
  .overlay-message {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 1.2em;
  }
  
  .overlay-message.error {
    background-color: rgba(255, 0, 0, 0.3);
  }
  </style>