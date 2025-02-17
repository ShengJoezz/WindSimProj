<!--
 * @File: VelocityFieldDisplay.vue
 * @Description: 读取 VTP 文件，获取 U 向量数据（可能来自 PointData 或 CellData），计算 U 的模并显示
 *              同时使用颜色映射和 colorbar 显示 U 模分布。
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
  import { ref, onMounted } from 'vue';
  import axios from 'axios';
  
  // 导入 VTK.js 模块
  import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
  import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
  import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
  import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
  import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
  import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor';
  import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
  
  // 通过 props 接收当前 caseId
  const props = defineProps({
    caseId: {
      type: String,
      required: true,
    },
  });
  
  const vtkContainer = ref(null);
  const vtpFiles = ref([]); // 后端返回的 VTP 文件列表
  const selectedFile = ref('');
  
  // 保存 vtk.js 的渲染窗口实例
  let genericRenderWindow = null;
  
  /**
   * 获取 VTP 文件列表（接口：/api/cases/{caseId}/list-velocity-files）。
   */
  const fetchVelocityFiles = async () => {
    try {
      const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
      if (response.data.success) {
        vtpFiles.value = response.data.files;
        console.log("Fetched files:", vtpFiles.value);
        if (vtpFiles.value.length > 0) {
          // 默认选择第一个文件并加载
          selectedFile.value = vtpFiles.value[0];
          loadVelocityField();
        }
      } else {
        console.error("获取文件列表失败");
      }
    } catch (error) {
      console.error("加载文件列表出错:", error);
    }
  };
  
  /**
   * 从文件名中提取高度信息，例如 "100.vtp" -> "100"
   */
  const getHeightFromFile = (fileName) => {
    const match = fileName.match(/(\d+)(?=\.vtp$)/);
    return match ? match[1] : fileName;
  };
  
  /**
   * 加载并显示选中的 VTP 文件
   */
  const loadVelocityField = async () => {
    if (!selectedFile.value) {
      console.warn("未选择 VTP 文件");
      return;
    }
    
    console.log("加载文件:", selectedFile.value);
    try {
      // 构造 VTP 文件 URL（静态资源通过 /uploads/ 路径访问）
      const fileUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedFile.value}`;
      console.log("File URL:", fileUrl);
      
      // 如果渲染窗口已存在则清空场景；否则新建实例
      if (genericRenderWindow) {
        genericRenderWindow.getRenderer().removeAllActors();
      } else {
        genericRenderWindow = vtkGenericRenderWindow.newInstance({
          background: [0.1, 0.1, 0.1],
        });
        genericRenderWindow.setContainer(vtkContainer.value);
      }
      
      // 获取 VTP 文件的二进制数据
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      console.log("Received file data, size:", response.data.byteLength);
      
      // 解析 VTP 数据
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      const polydata = reader.getOutputData(0);
      
      // -------------------------------
      // 尝试从 PointData 中获取 U 数组
      // -------------------------------
      const pointData = polydata.getPointData();
      let uArray = pointData.getArrayByName('U');
      let usingCellData = false;
      
      if (!uArray) {
        // 安全遍历 PointData 中所有数组
        const availablePointArrays = [];
        pointData.getArrays().forEach((arr) => {
          if (arr && typeof arr.getName === 'function') {
            availablePointArrays.push(arr.getName());
          } else if (arr && arr.name) {
            availablePointArrays.push(arr.name);
          }
        });
        console.warn("未在 PointData 中找到名为 'U' 的数组，可用数组：", availablePointArrays);
        
        // -------------------------------
        // 若 PointData 中未找到，则尝试从 CellData 中寻找
        // -------------------------------
        const cellData = polydata.getCellData();
        if (cellData) {
          const availableCellArrays = [];
          cellData.getArrays().forEach((arr) => {
            if (arr && typeof arr.getName === 'function') {
              availableCellArrays.push(arr.getName());
            } else if (arr && arr.name) {
              availableCellArrays.push(arr.name);
            }
          });
          console.warn("CellData 中的数组有：", availableCellArrays);
          const cellUArray = cellData.getArrayByName('U');
          if (cellUArray) {
            console.log("在 CellData 中找到 U 数据，使用 CellData 中的 'U'");
            uArray = cellUArray;
            usingCellData = true;
          }
        }
      }
      
      let minVal = 0.0;
      let maxVal = 1.0;
      if (uArray) {
        const uData = uArray.getData(); // 格式为 [u,v,w, u,v,w, ...]
        const numTuples = uData.length / 3;
        const magnitudes = new Float32Array(numTuples);
        minVal = Number.POSITIVE_INFINITY;
        maxVal = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < numTuples; i++) {
          const idx = i * 3;
          const mag = Math.sqrt(
            uData[idx] * uData[idx] +
            uData[idx + 1] * uData[idx + 1] +
            uData[idx + 2] * uData[idx + 2]
          );
          magnitudes[i] = mag;
          if (mag < minVal) minVal = mag;
          if (mag > maxVal) maxVal = mag;
        }
        if (minVal === maxVal) {
          // 确保范围不为 0
          maxVal = minVal + 1.0;
        }
        
        // -------------------------------
        // 将计算得到的 U 模数据添加到对应的数据集合中
        // 使用 vtkDataArray.newInstance 创建新数组对象
        // -------------------------------
        if (!usingCellData) {
          const uMagArray = vtkDataArray.newInstance({
            numberOfComponents: 1,
            values: magnitudes,
          });
          uMagArray.setName('U_magnitude');
          pointData.addArray(uMagArray);
          pointData.setActiveScalars('U_magnitude');
        } else {
          const cellData = polydata.getCellData();
          const uMagArray = vtkDataArray.newInstance({
            numberOfComponents: 1,
            values: magnitudes,
          });
          uMagArray.setName('U_magnitude');
          cellData.addArray(uMagArray);
          cellData.setActiveScalars('U_magnitude');
        }
        console.log("Computed U magnitudes, range:", minVal, maxVal);
      } else {
        console.error("无法找到名为 'U' 的数据数组，无法渲染速度场。");
        return;
      }
      
      // -------------------------------
      // 设置颜色映射：低值蓝色，高值红色
      // -------------------------------
      const ctfun = vtkColorTransferFunction.newInstance();
      ctfun.addRGBPoint(minVal, 0.0, 0.0, 1.0);
      ctfun.addRGBPoint(maxVal, 1.0, 0.0, 0.0);
      
      // 创建 mapper，并传入 polydata 和标量映射信息
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(polydata);
      mapper.setLookupTable(ctfun);
      mapper.setScalarRange(minVal, maxVal);
      mapper.setUseLookupTableScalarRange(true);
      mapper.setScalarVisibility(true);
      
      // 如果 U 数据属于 CellData，则指定 mapper 使用 CellData（mode = 2）
      if (usingCellData) {
        mapper.setScalarMode(2);
      }
      
      // 创建 actor 并关联 mapper
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
      genericRenderWindow.getRenderer().addActor(actor);
      
      // -------------------------------
      // 创建并配置 colorbar（刻度条）
      // -------------------------------
      const scalarBarActor = vtkScalarBarActor.newInstance();
      scalarBarActor.setScalarsToColors(ctfun);
      const scalarBarState = scalarBarActor.getState();
      scalarBarState.title = 'U Magnitude';
      scalarBarState.numberOfLabels = 4;
      scalarBarState.maximumWidthInPixels = 100;
      scalarBarActor.modified();
      genericRenderWindow.getRenderer().addActor(scalarBarActor);
      
      // 重置相机并渲染场景
      genericRenderWindow.getRenderer().resetCamera();
      genericRenderWindow.getRenderWindow().render();
      
      console.log("VTK 渲染完毕");
    } catch (error) {
      console.error("加载速度场 vtp 文件出错:", error);
    }
  };
  
  onMounted(() => {
    if (vtkContainer.value) {
      console.log("vtkContainer 已挂载：", vtkContainer.value);
    } else {
      console.error("vtkContainer 未挂载");
    }
    fetchVelocityFiles();
  });
  </script>
  
  <style scoped>
  .velocity-field-viewer {
    display: flex;
    flex-direction: column;
    min-height: 600px;
  }
  
  .controls {
    margin: 10px 0;
  }
  
  .vtk-container {
    flex: 1;
    width: 100%;
    min-height: 500px; /* 确保有足够显示区域 */
    border: 1px solid #ccc;
  }
  </style>