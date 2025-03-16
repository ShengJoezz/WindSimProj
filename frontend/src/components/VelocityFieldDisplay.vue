<!--
 * @File: VelocityFieldDisplay.vue
 * @Description: 读取 VTP 文件，获取 U 向量数据（可能来自 PointData 或 CellData），计算 U 的模并显示
 *              同时使用颜色映射和 colorbar 显示 U 模分布。 使用 Phong 着色和 Gamma 校正优化渲染效果。
-->

<template>
  <div class="velocity-field-viewer">
    <!-- 控件区域：下拉选择不同高度 -->
    <div class="controls">
      <div class="select-container">
        <label for="vtpSelect">速度场高度</label>
        <select id="vtpSelect" v-model="selectedFile" @change="loadVelocityField">
          <option v-for="file in vtpFiles" :key="file" :value="file">
            {{ getHeightFromFile(file) }} m
          </option>
        </select>
        <span class="select-arrow"></span>
      </div>

      <div class="loading-indicator" v-if="loading">
        <span class="loading-spinner"></span>
        <span>加载中...</span>
      </div>
    </div>

    <!-- VTK 渲染容器 -->
    <div ref="vtkContainer" class="vtk-container">
      <!-- 无数据提示 -->
      <div class="no-data-message" v-if="vtpFiles.length === 0">
        <div class="message-icon"></div>
        <div class="message-text">暂无速度场数据</div>
      </div>
    </div>
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
const loading = ref(false);
let genericRenderWindow = null;
let resizeObserver = null;

const initRenderWindow = () => {
  genericRenderWindow = vtkGenericRenderWindow.newInstance({
    background: [0.1, 0.1, 0.15],
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
  loading.value = true;
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
  } finally {
    loading.value = false;
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

  loading.value = true;
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
    scalarBarState.title = '速度大小';
    scalarBarState.subtitle = '(m/s)';
    scalarBarState.titleFontSize = 16;
    scalarBarState.subtitleFontSize = 12;
    scalarBarState.labelFontSize = 12;
    scalarBarState.numberOfLabels = 7;

    // 设置 colorbar 位置（使用固定值而不是相对计算）
    scalarBarState.position = [0.85, 0.1];
    scalarBarState.position2 = [0.12, 0.8];

    scalarBarState.orientation = 'Vertical';
    scalarBarState.boxPosition = 0.05;
    scalarBarState.drawBackground = true;
    scalarBarState.backgroundColor = [0.1, 0.1, 0.1, 0.7];
    scalarBarState.drawFrame = true;
    scalarBarState.frameColor = [1, 1, 1, 0.3];

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
  } finally {
    loading.value = false;
  }
};

// 导出速度场文件
const exportLayerPhotos = async () => {
  if (!selectedFile.value || vtpFiles.value.length === 0) {
    return { success: false, message: '没有可导出的速度场数据' };
  }

  loading.value = true;
  try {
    // 构建当前选中层级的文件URL
    const fileUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedFile.value}`;

    // 使用fetch检查文件是否存在
    const response = await fetch(fileUrl, { method: 'HEAD' });

    if (!response.ok) {
      return { success: false, message: `文件不存在或无法访问: ${response.statusText}` };
    }

    // 创建下载链接
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${props.caseId}_${selectedFile.value}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 如果需要导出所有层级，询问用户是否继续
    if (vtpFiles.value.length > 1) {
      const choice = confirm('您希望如何导出所有层级文件？\n确定: 下载打包的ZIP文件\n取消: 单独下载每个文件');

      if (choice) {
        // 下载ZIP包
        const zipUrl = `/api/cases/${props.caseId}/export-velocity-layers`;
        window.open(zipUrl, '_blank');
        return { success: true, message: '正在下载所有速度场文件的ZIP包' };
      } else {
        // 单独下载每个文件 (已有的代码)
        try {
          // 创建一个下载多个文件的函数
          const downloadFile = (url, filename) => {
            return new Promise((resolve) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              // 给浏览器一些时间开始下载
              setTimeout(resolve, 300);
            });
          };

          // 逐个下载其他层级文件
          for (const file of vtpFiles.value) {
            if (file === selectedFile.value) continue; // 跳过已下载的当前层级

            const url = `/uploads/${props.caseId}/run/postProcessing/Data/${file}`;
            await downloadFile(url, `${props.caseId}_${file}`);
          }

          return {
            success: true,
            message: `已触发 ${vtpFiles.value.length} 个速度场文件的下载`
          };
        } catch (downloadError) {
          console.error('下载多个文件时出错:', downloadError);
          return {
            success: true,
            message: `部分文件下载可能失败: ${downloadError.message}`
          };
        }
      }
    }

    return { success: true, message: '速度场文件下载已开始' };
  } catch (error) {
    console.error('导出速度场文件失败:', error);
    return { success: false, message: `导出失败: ${error.message}` };
  } finally {
    loading.value = false;
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

// 将方法暴露给父组件
defineExpose({ exportLayerPhotos });
</script>

<style scoped>
.velocity-field-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #f8fafc;
  overflow: hidden;
  position: relative;
}

.controls {
  padding: 12px 16px;
  background: linear-gradient(to right, #f1f5f9, #e2e8f0);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 5;
}

.select-container {
  position: relative;
  min-width: 180px;
  max-width: 320px;
}

.controls label {
  display: block;
  font-weight: 500;
  color: #475569;
  margin-bottom: 6px;
  font-size: 13px;
}

.controls select {
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background-color: white;
  font-size: 14px;
  color: #1e293b;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.controls select:hover {
  border-color: #94a3b8;
}

.controls select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.select-arrow {
  position: absolute;
  right: 12px;
  bottom: 11px;
  width: 10px;
  height: 10px;
  border-right: 2px solid #64748b;
  border-bottom: 2px solid #64748b;
  pointer-events: none;
  transform: rotate(45deg);
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #3b82f6;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.vtk-container {
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  overflow: hidden;
}

.no-data-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.message-icon {
  width: 64px;
  height: 64px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255, 255, 255, 0.6)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9l-7-7z'/%3E%3Cpath d='M13 3v6h6'/%3E%3Cpath d='M9 13h6'/%3E%3Cpath d='M9 17h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.6;
}

.message-text {
  font-size: 16px;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式布局调整 */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .select-container {
    width: 100%;
    max-width: none;
  }

  .loading-indicator {
    align-self: flex-end;
  }
}
</style>