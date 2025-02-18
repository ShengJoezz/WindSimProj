<!--
 * @File: VelocityFieldDisplay.vue
 * @Description: 读取 VTP 文件，获取 U 向量数据（可能来自 PointData 或 CellData），计算 U 的模并显示
 *              同时使用颜色映射和 colorbar 显示 U 模分布。 使用 Phong 着色和 Gamma 校正优化渲染效果。
-->

<template>
    <div class="velocity-field-viewer">
      <!-- 控件区域：下拉选择不同高度 -->
      <div class="controls">
        <label for="vtpSelect">选择速度场高度：</label>
        <select id="vtpSelect" v-model="selectedFile" @change="loadVelocityField">
          <option v-for="file in vtpFiles" :key="file" :value="file">
            {{ getHeightFromFile(file) }} m
          </option>
        </select>
      </div>
      <!-- VTK 渲染容器 -->
      <div ref="vtkContainer" class="vtk-container"></div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import axios from 'axios';
  
  // 导入 VTK.js 模块
  import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
  import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
  import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
  import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
  import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
  import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor';
  import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
  
  // Props 定义
  const props = defineProps({
    caseId: {
      type: String,
      required: true,
    },
  });
  
  // 响应式状态
  const vtkContainer = ref(null);
  const vtpFiles = ref([]);
  const selectedFile = ref('');
  let genericRenderWindow = null;
  let resizeObserver = null;
  
  const initRenderWindow = () => {
    genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0.15, 0.15, 0.15],
    });
    genericRenderWindow.setContainer(vtkContainer.value);
  
    // 初始化渲染器和交互器
    const renderWindow = genericRenderWindow.getRenderWindow();
    const renderer = genericRenderWindow.getRenderer();
    const interactor = renderWindow.getInteractor();
  
    // 设置交互器
    interactor.initialize();
    interactor.bindEvents(vtkContainer.value);
  
    // 简单的初始化
    genericRenderWindow.resize();
  };
  
  
  // 修改 ResizeObserver 的处理方法
  const setupResizeHandler = () => {
    resizeObserver = new ResizeObserver(() => {
      if (vtkContainer.value && genericRenderWindow) {
        genericRenderWindow.resize();
        genericRenderWindow.getRenderWindow().render();
      }
    });
    resizeObserver.observe(vtkContainer.value);
  };
  
  
  /**
   * 获取 VTP 文件列表
   */
  const fetchVelocityFiles = async () => {
    try {
      const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
      if (response.data.success) {
        vtpFiles.value = response.data.files;
        console.log("Fetched files:", vtpFiles.value);
        if (vtpFiles.value.length > 0) {
          selectedFile.value = vtpFiles.value[0];
          loadVelocityField();
        } else {
          // 默认提示信息，如果无文件
          console.warn("该 Case ID 没有可用的速度场文件。");
        }
      } else {
        console.error("获取文件列表失败");
      }
    } catch (error) {
      console.error("加载文件列表出错:", error);
    }
  };
  
  /**
   * 从文件名中提取高度信息
   */
  const getHeightFromFile = (fileName) => {
    const match = fileName.match(/(\d+)(?=\.vtp$)/);
    return match ? match[1] : fileName;
  };
  /**
  * 加载并显示选中的 VTP 文件
  */
  const loadVelocityField = async () => {
    if (!selectedFile.value) return;
  
    try {
      const fileUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedFile.value}`;
  
      // 清空现有场景或初始化
      if (genericRenderWindow) {
        genericRenderWindow.getRenderer().removeAllViewProps();
      } else {
        initRenderWindow();
      }
  
      // 加载VTP数据
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      const polydata = reader.getOutputData(0);
  
      // 获取速度场数据
      const pointData = polydata.getPointData();
      let uArray = pointData.getArrayByName('U');
      let usingCellData = false;
  
      if (!uArray) {
        const cellData = polydata.getCellData();
        if (cellData) {
          uArray = cellData.getArrayByName('U');
          if (uArray) {
            usingCellData = true;
          }
        }
        if (!uArray) {
          console.error("无法找到速度场数据");
          return;
        }
      }
  
      // 计算速度场模值
      const uData = uArray.getData();
      const numTuples = uData.length / 3;
      const magnitudes = new Float32Array(numTuples);
      let minVal = Number.POSITIVE_INFINITY;
      let maxVal = Number.NEGATIVE_INFINITY;
  
      for (let i = 0; i < numTuples; i++) {
        const idx = i * 3;
        const mag = Math.sqrt(
          uData[idx] * uData[idx] +
          uData[idx + 1] * uData[idx + 1] +
          uData[idx + 2] * uData[idx + 2]
        );
        magnitudes[i] = mag;
        minVal = Math.min(minVal, mag);
        maxVal = Math.max(maxVal, mag);
      }
  
      // 添加模值数据到数据集
      const uMagArray = vtkDataArray.newInstance({
        numberOfComponents: 1,
        values: magnitudes,
        name: 'U_magnitude'
      });
  
      if (usingCellData) {
        polydata.getCellData().addArray(uMagArray);
        polydata.getCellData().setActiveScalars('U_magnitude');
      } else {
        polydata.getPointData().addArray(uMagArray);
        polydata.getPointData().setActiveScalars('U_magnitude');
      }
  
      // 创建颜色映射
      const ctfun = vtkColorTransferFunction.newInstance();
      const range = maxVal - minVal;
  
      // 使用更多的颜色节点实现平滑渐变
      const numberOfPoints = 256; // 增加颜色节点数量
      for (let i = 0; i <= numberOfPoints; i++) {
        const val = minVal + (range * i) / numberOfPoints;
        const t = i / numberOfPoints;
  
        // 使用平滑的颜色过渡
        let r, g, b;
        if (t < 0.25) {
          // 蓝色到青色
          const s = t * 4;
          r = 0;
          g = s;
          b = 1;
        } else if (t < 0.5) {
          // 青色到绿色
          const s = (t - 0.25) * 4;
          r = 0;
          g = 1;
          b = 1 - s;
        } else if (t < 0.75) {
          // 绿色到黄色
          const s = (t - 0.5) * 4;
          r = s;
          g = 1;
          b = 0;
        } else {
          // 黄色到红色
          const s = (t - 0.75) * 4;
          r = 1;
          g = 1 - s;
          b = 0;
        }
  
        // 应用gamma校正使颜色过渡更平滑
        r = Math.pow(r, 1.0 / 2.2);
        g = Math.pow(g, 1.0 / 2.2);
        b = Math.pow(b, 1.0 / 2.2);
  
        ctfun.addRGBPoint(val, r, g, b);
      }
  
      // 设置mapper
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(polydata); //  直接使用原始 polydata
      mapper.setLookupTable(ctfun);
      mapper.setScalarRange(minVal, maxVal);
      mapper.setUseLookupTableScalarRange(true);
      mapper.setScalarVisibility(true);
      mapper.setInterpolateScalarsBeforeMapping(true);  // 启用标量插值
  
      if (usingCellData) {
        mapper.setScalarMode(2);
      }
  
      // 创建actor并设置属性
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
  
      // 配置表面属性以获得更平滑的效果
      const property = actor.getProperty();
      property.setInterpolationToPhong();  // 使用 Phong 着色
      property.setAmbient(0.1);           // 环境光
      property.setDiffuse(0.7);           // 漫反射
      property.setSpecular(0.3);          // 镜面反射
      property.setSpecularPower(20);      // 镜面反射强度
      property.setEdgeVisibility(false);  // 隐藏边缘
      property.setBackfaceCulling(false); // 禁用背面剔除
      property.setFrontfaceCulling(false);// 禁用正面剔除
  
      genericRenderWindow.getRenderer().addActor(actor);
  
      // 创建colorbar
      const scalarBarActor = vtkScalarBarActor.newInstance();
      scalarBarActor.setScalarsToColors(ctfun);
      const scalarBarState = scalarBarActor.getState();
  
      // 配置colorbar
      scalarBarState.title = 'Velocity Magnitude';
      scalarBarState.subtitle = '(m/s)';
      scalarBarState.titleFontSize = 14;
      scalarBarState.subtitleFontSize = 12;
      scalarBarState.labelFontSize = 12;
      scalarBarState.numberOfLabels = 7;
  
      // 设置 colorbar 位置（使用固定值而不是相对计算）
      scalarBarState.position = [0.85, 0.1];
      scalarBarState.position2 = [0.12, 0.8];
  
      scalarBarState.orientation = 'Vertical';
      scalarBarState.boxPosition = 0.05;
      scalarBarState.drawBackground = true;
      scalarBarState.backgroundColor = [1, 1, 1, 0.1];
      scalarBarState.drawFrame = true;
      scalarBarState.frameColor = [1, 1, 1, 0.2];
  
      // 更新 colorbar
      scalarBarActor.modified();
      genericRenderWindow.getRenderer().addActor(scalarBarActor);
  
      // 渲染器属性
      const renderer = genericRenderWindow.getRenderer();
      renderer.setTwoSidedLighting(true);
  
      // 设置相机并渲染
      renderer.resetCamera();
      genericRenderWindow.getRenderWindow().render();
  
    } catch (error) {
      console.error("加载速度场出错:", error);
    }
  };
  
  
  // 修改 onMounted 钩子 (保持不变)
  onMounted(() => {
    if (!vtkContainer.value) {
      console.error("vtkContainer 未挂载");
      return;
    }
  
    setupResizeHandler();
    fetchVelocityFiles();
  });
  
  // 组件卸载时的清理 (保持不变)
  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (genericRenderWindow) {
      genericRenderWindow.delete();
    }
  });
  </script>
  
  <style scoped>
  .velocity-field-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 600px;
  }
  
  .controls {
    padding: 12px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .controls label {
    font-weight: 500;
    color: #333;
  }
  
  .controls select {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    min-width: 120px;
  }
  
  .vtk-container {
    flex: 1;
    min-height: 500px;
    position: relative;
    background-color: #1a1a1a;
    overflow: hidden; /* 确保内容不溢出 */
  }
  
  :deep(.vtk-container canvas) {
    width: 100% !important;
    height: 100% !important;
  }
  </style>