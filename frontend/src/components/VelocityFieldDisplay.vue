<!--
 * @File: VelocityFieldDisplay.vue  
 * @Description: 基于3DtestOld.vue的3D风流可视化，适配动态生成的文件结构 (已根据最新要求修改)
-->

<template>
  <div class="flow-particle-viewer">
    <div ref="vtkContainer" class="vtk-container"></div>
    
    <!-- 修改后的控制面板 -->
    <div class="controls" :class="{ collapsed: isControlsCollapsed }">
      <div class="controls-header">
        <div class="controls-title">显示设置</div>
        <button
          type="button"
          class="controls-collapse-button"
          @click="toggleControls"
          :aria-expanded="!isControlsCollapsed"
          :aria-label="isControlsCollapsed ? '展开显示设置' : '折叠显示设置'"
        >
          <span :class="['icon-panel-toggle', isControlsCollapsed ? 'collapsed' : 'expanded']"></span>
        </button>
      </div>

      <div v-show="!isControlsCollapsed" class="control-content">
        <!-- 1. 保留显示功能中的高度选择 -->
        <div>
          <label for="height-select">选择高度:</label>
          <select id="height-select" v-model="selectedHeight" @change="loadData">
            <option v-for="height in availableHeights" :key="height" :value="height">
              {{ height }} 米
            </option>
          </select>
        </div>
        
        <!-- 1. 保留显示功能中的速度场显示 -->
        <div>
          <label for="terrain-select">速度场显示:</label>
          <select id="terrain-select" v-model="terrainVisibility" @change="updateTerrainVisibility">
            <option value="visible">显示</option>
            <option value="transparent">半透明</option>
            <option value="hidden">隐藏</option>
          </select>
        </div>
        
        <!-- 1. 保留显示流线的功能 -->
        <div>
          <label>
            <input type="checkbox" v-model="showLines" @change="updateVisibility">
            显示流线
          </label>
        </div>

        <!-- 新增：粒子效果开关（关闭时停止动画并隐藏粒子/轨迹） -->
        <div>
          <label>
            <input type="checkbox" v-model="showParticles" @change="updateParticlesVisibility">
            显示粒子
          </label>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading-indicator">
      <div class="loading-spinner"></div>
      <div>加载中...</div>
    </div>
    
    <!-- 删除了 class="legend" 的风速显示板块 -->

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import axios from 'axios';

// VTK.js 导入
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkGlyph3DMapper from '@kitware/vtk.js/Rendering/Core/Glyph3DMapper';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import { ColorMode, ScalarMode } from '@kitware/vtk.js/Rendering/Core/Mapper/Constants';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource';
import vtkArrowSource from '@kitware/vtk.js/Filters/Sources/ArrowSource';
import vtkLookupTable from '@kitware/vtk.js/Common/Core/LookupTable';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor';

// Props 定义
const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

// 组件状态 - 界面与控制
const vtkContainer = ref(null);
const loading = ref(false);
const isControlsCollapsed = ref(false);

const CONTROLS_COLLAPSE_KEY = 'windsim.velocity.controlsCollapsed';

const toggleControls = () => {
  isControlsCollapsed.value = !isControlsCollapsed.value;
};

const loadControlsState = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CONTROLS_COLLAPSE_KEY);
    if (raw === null) return;
    isControlsCollapsed.value = raw === '1' || raw === 'true';
  } catch (e) {
    console.warn('读取速度场面板折叠状态失败:', e);
  }
};

watch(isControlsCollapsed, (val) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONTROLS_COLLAPSE_KEY, val ? '1' : '0');
  } catch (e) {
    console.warn('保存速度场面板折叠状态失败:', e);
  }
});

// 高度选择 (根据脚本动态生成)
const availableHeights = ref([]);
const selectedHeight = ref(null);

// 2. 修改粒子设置：增加粒子数量，调整大小让它们更明显
const particleCount = ref(4000); // 从2000增加到4000
const particleSpeed = ref(0.5); 
const particleSize = ref(25.0); // 从20.0增加到25.0让粒子更明显

// 保留的其他粒子内部设置
const trailLength = ref(5); // 从3增加到5，让轨迹更明显
const particleOpacity = ref(0.95); // 从0.9增加到0.95
const trailOpacity = ref(0.7); // 从0.6增加到0.7
const showLines = ref(false); 
const showParticles = ref(true);
const useColorSpeed = ref(true); 
const particleStyle = ref('arrow'); 
const resetTrailsOnJump = ref(true);

// 默认颜色方案
const selectedColorScheme = ref('blueRed');

// 默认背景设置 (因UI移除而固定)
const selectedBg = ref('dark');
const bgColors = {
  dark: [0.02, 0.02, 0.1],
  black: [0.0, 0.0, 0.0],
  gradient: 'gradient',
  light: [0.95, 0.95, 0.98]
};

// 地形显示模式 - 默认设置为半透明
const terrainVisibility = ref('transparent');

// 颜色方案配置
const colorSchemes = {
  blueRed: {
    hueRange: [0.67, 0.0],
    satRange: [0.85, 0.95],
    valRange: [0.8, 0.9]
  }
};

// VTK实例
let renderer = null;
let renderWindow = null;
let fullScreenRenderer = null;
let streamlinesActor = null;
let particlesActor = null;
let trailsActor = null;
let terrainActor = null;
let scalarBarActor = null; // 保留 scalarBarActor
let streamlinesData = null;
let terrainData = null;
let animationFrameId = null;
let particles = [];
let streamlines = []; 
let flowVectors = []; 
let modelScale = 1.0;  
let currentColorScheme = null;
let maxVelocityMagnitude = 1.0; 
let minVelocityMagnitude = 0.1; 
let medianVelocityMagnitude = 0.5; 
let allVelocities = []; 
let globalWindDirection = [0, 0, 1]; 
let isRebuildingParticles = false;

let terrainBounds = null;

const handleWindowResize = () => {
  if (fullScreenRenderer) fullScreenRenderer.resize();
};

// 根据caseId和高度构建URL
const getStreamlineUrl = () => {
  if (!selectedHeight.value) return null;
  return `/uploads/${props.caseId}/run/VTK/processed/internal_${selectedHeight.value}m_web.vtp`;
};

const getTerrainUrl = () => {
  if (!selectedHeight.value) return null;
  return `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
};

/**
 * 获取可用的高度列表
 */
const fetchAvailableHeights = async () => {
  try {
    loading.value = true;
    console.log(`获取案例 ${props.caseId} 的可用高度列表...`);
    
    // 方法1: 通过API获取文件列表
    try {
      const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
      if (response.data.success && response.data.files && response.data.files.length > 0) {
        const heights = response.data.files
          .map(filename => {
            const match = filename.match(/^(\d+)\.vtp$/);
            return match ? parseInt(match[1]) : null;
          })
          .filter(height => height !== null)
          .sort((a, b) => a - b);
        
        if (heights.length > 0) {
          availableHeights.value = heights;
          selectedHeight.value = heights[0];
          return;
        }
      }
    } catch (error) {
      console.warn('通过API获取高度列表失败:', error.message);
    }
    
    // 方法2: 尝试常见的高度值
    const commonHeights = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 50, 75, 100];
    const validHeights = [];
    
    for (const height of commonHeights) {
      try {
        const terrainUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${height}.vtp`;
        const response = await axios.head(terrainUrl);
        if (response.status === 200) {
          validHeights.push(height);
        }
      } catch (error) {
        continue;
      }
    }
    
    if (validHeights.length > 0) {
      availableHeights.value = validHeights;
      selectedHeight.value = validHeights[0];
    } else {
      console.warn('未找到任何可用的高度文件');
      availableHeights.value = [1];
      selectedHeight.value = 1;
    }
    
  } catch (error) {
    console.error('获取可用高度列表失败:', error);
    availableHeights.value = [1];
    selectedHeight.value = 1;
  } finally {
    loading.value = false;
  }
};

// 工具函数
function normalizeVector(vec) {
  const magnitude = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  if (magnitude > 0.0001) return [vec[0] / magnitude, vec[1] / magnitude, vec[2] / magnitude];
  return [0, 0, 1]; 
}

function safeRender() {
  if (renderWindow) {
    try { renderWindow.render(); } 
    catch (e) { console.warn("渲染失败:", e); }
  }
}

function stopParticleAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function clearParticlesFromScene() {
  stopParticleAnimation();
  particles = [];
  if (!renderer) return;
  try {
    if (particlesActor) { renderer.removeActor(particlesActor); particlesActor = null; }
    if (trailsActor) { renderer.removeActor(trailsActor); trailsActor = null; }
  } catch (e) {
    console.warn("清理粒子/轨迹失败:", e);
  }
  safeRender();
}

function updateParticlesVisibility() {
  // 关闭：停止动画并移除粒子/轨迹 actor（避免静止残影 + 节省性能）
  if (!showParticles.value) {
    clearParticlesFromScene();
    return;
  }

  // 开启：如果数据已加载则重新初始化粒子系统
  if (!renderer) return;
  if (streamlines.length === 0) return;

  if (particles.length === 0 || !particlesActor) {
    initParticleSystem();
    return;
  }

  // 已存在时只恢复动画与可见性
  try {
    if (particlesActor) particlesActor.setVisibility(true);
    if (trailsActor) trailsActor.setVisibility(true);
  } catch (e) {
    console.warn("恢复粒子可见性失败:", e);
  }
  if (!animationFrameId) startParticleAnimation();
}

function initRenderer() {
  try {
    if (!vtkContainer.value) {
      console.warn("VTK container not available yet");
      return false;
    }

    if (fullScreenRenderer) fullScreenRenderer.delete();
    const bgColor = bgColors[selectedBg.value] || [0.95, 0.95, 0.98];
    
    fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      container: vtkContainer.value,
      background: bgColor,
      rootContainer: vtkContainer.value,
      containerStyle: { width: '100%', height: '100%' },
    });
    
    renderer = fullScreenRenderer.getRenderer();
    renderWindow = fullScreenRenderer.getRenderWindow();
    renderer.setTwoSidedLighting(true);
    renderer.setAutomaticLightCreation(true);
    
    console.log("渲染器初始化完成");
    return true;
  } catch (e) { 
    console.error("初始化渲染器失败:", e); 
    return false; 
  }
}

function updateBackground() {
  if (!renderer) return;
  try {
    const bgColor = bgColors[selectedBg.value];
    renderer.setBackground(bgColor);

    if (streamlinesActor) {
      const isDarkBg = selectedBg.value !== 'light';
      // 修改流线颜色，让它们更明显
      streamlinesActor.getProperty().setColor(isDarkBg ? 0.8 : 0.3, isDarkBg ? 0.8 : 0.4, isDarkBg ? 1.0 : 0.7);
      streamlinesActor.getProperty().setOpacity(0.6); // 从0.2增加到0.6让流线更明显
      streamlinesActor.getProperty().setLineWidth(2); // 增加线宽
    }
    safeRender();
  } catch (e) { console.error("更新背景失败:", e); }
}

function updateTerrainVisibility() {
  if (!terrainActor) return;
  try {
    switch (terrainVisibility.value) {
      case 'visible': 
        terrainActor.setVisibility(true); 
        terrainActor.getProperty().setOpacity(1.0); 
        break;
      case 'transparent': 
        terrainActor.setVisibility(true); 
        terrainActor.getProperty().setOpacity(0.3); 
        break;
      case 'hidden': 
        terrainActor.setVisibility(false); 
        break;
    }
    safeRender();
  } catch (e) { console.error("更新地形可见性失败:", e); }
}

function updateColorScheme() {
  try {
    currentColorScheme = colorSchemes[selectedColorScheme.value];
    if (particles.length > 0 && particlesActor) {
      const mapper = particlesActor.getMapper();
      const lut = vtkLookupTable.newInstance();
      if (currentColorScheme.hueRange) {
        lut.setHueRange(currentColorScheme.hueRange[0], currentColorScheme.hueRange[1]);
        const isDarkBg = selectedBg.value !== 'light';
        const valMin = isDarkBg ? 0.7 : 0.6;
        const valMax = isDarkBg ? 1.0 : 0.85;
        lut.setValueRange(valMin, valMax);
        lut.setSaturationRange(currentColorScheme.satRange[0], currentColorScheme.satRange[1]);
      }
      lut.setAlphaRange(0.7, 0.9);
      if (typeof lut.build === 'function') lut.build();
      mapper.setLookupTable(lut);
      mapper.setScalarRange(0, 1);
      updateParticleColors();
    }
    safeRender();
  } catch (e) { console.error("更新颜色方案失败:", e); }
}

async function loadData() {
  if (!selectedHeight.value) {
    console.warn('未选择高度，跳过数据加载');
    return;
  }
  
  loading.value = true;
  try {
    clearScene();
    
    await loadTerrainData();
    
    const streamlineUrl = getStreamlineUrl();
    const streamlineResponse = await axios.get(streamlineUrl, { responseType: 'arraybuffer' });
    const reader = vtkXMLPolyDataReader.newInstance();
    reader.parseAsArrayBuffer(streamlineResponse.data);
    streamlinesData = reader.getOutputData(0);
    
    const bounds = streamlinesData.getBounds();
    modelScale = Math.sqrt(Math.pow(bounds[1] - bounds[0], 2) + Math.pow(bounds[3] - bounds[2], 2) + Math.pow(bounds[5] - bounds[4], 2)) / 100;
    
    extractStreamlinesFromVTP(); 

    const mapper = vtkMapper.newInstance();
    mapper.setInputData(streamlinesData);
    streamlinesActor = vtkActor.newInstance();
    streamlinesActor.setMapper(mapper);
    const isDarkBg = selectedBg.value !== 'light';
    // 修改流线颜色和透明度，让它们更明显
    streamlinesActor.getProperty().setColor(isDarkBg ? 0.8 : 0.3, isDarkBg ? 0.8 : 0.4, isDarkBg ? 1.0 : 0.7);
    streamlinesActor.getProperty().setOpacity(0.6); // 从0.2增加到0.6
    streamlinesActor.getProperty().setLineWidth(2); // 增加线宽
    streamlinesActor.setVisibility(showLines.value); // 使用showLines的值
    renderer.addActor(streamlinesActor);
    
    if (streamlines.length === 0 || flowVectors.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100)); 
      if (streamlines.length === 0) {
        extractStreamlinesFromVTP(); 
      }
    }
    
    if (showParticles.value) {
      initParticleSystem();
    } else {
      clearParticlesFromScene();
    }
    renderer.resetCamera();
    
    // 优化初始缩放比例
    const camera = renderer.getActiveCamera();
    camera.zoom(1.2); // 增加缩放比例，让模型显示更大
    
    safeRender();
    
  } catch (error) { 
    console.error('加载数据失败:', error); 
  } finally { 
    loading.value = false; 
  }
}

async function loadTerrainData() {
  try {
    const terrainUrl = getTerrainUrl();
    const response = await axios.get(terrainUrl, { responseType: 'arraybuffer' });
    const reader = vtkXMLPolyDataReader.newInstance();
    reader.parseAsArrayBuffer(response.data);
    terrainData = reader.getOutputData(0);
    
    terrainBounds = terrainData.getBounds();
    
    const pointData = terrainData.getPointData();
    const cellData = terrainData.getCellData();
    let uArray = pointData.getArrayByName('U') || cellData.getArrayByName('U');
    const usingCellData = !pointData.getArrayByName('U') && !!cellData.getArrayByName('U');

    if (uArray) {
      const uData = uArray.getData();
      const numTuples = uData.length / 3;
      const magnitudes = new Float32Array(numTuples);
      let minVal = Infinity, maxVal = -Infinity;
      
      for (let i = 0; i < numTuples; i++) {
        const idx = i * 3;
        const mag = Math.sqrt(uData[idx]**2 + uData[idx+1]**2 + uData[idx+2]**2);
        magnitudes[i] = mag;
        minVal = Math.min(minVal, mag);
        maxVal = Math.max(maxVal, mag);
      }
      
      const uMagArray = vtkDataArray.newInstance({ values: magnitudes, name: 'U_magnitude' });
      
      if (usingCellData) {
        terrainData.getCellData().addArray(uMagArray);
        terrainData.getCellData().setActiveScalars('U_magnitude');
      } else {
        terrainData.getPointData().addArray(uMagArray);
        terrainData.getPointData().setActiveScalars('U_magnitude');
      }
      
      const ctfun = vtkColorTransferFunction.newInstance();
      const range = maxVal - minVal;
      const numberOfPoints = 256;
      for (let i = 0; i <= numberOfPoints; i++) {
        const val = minVal + (range * i) / numberOfPoints;
        const t = i / numberOfPoints;
        let r, g, b;
        if (t < 0.25) { const s = t * 4; r = 0; g = s; b = 1; } 
        else if (t < 0.5) { const s = (t - 0.25) * 4; r = 0; g = 1; b = 1 - s; } 
        else if (t < 0.75) { const s = (t - 0.5) * 4; r = s; g = 1; b = 0; } 
        else { const s = (t - 0.75) * 4; r = 1; g = 1 - s; b = 0; }
        ctfun.addRGBPoint(val, r**0.45, g**0.45, b**0.45);
      }
      
      const mapper = vtkMapper.newInstance({
        lookupTable: ctfun,
        scalarRange: [minVal, maxVal],
        useLookupTableScalarRange: true,
        scalarVisibility: true,
        interpolateScalarsBeforeMapping: true
      });
      mapper.setInputData(terrainData);
      if (usingCellData) mapper.setScalarMode(2);
      
      terrainActor = vtkActor.newInstance();
      terrainActor.setMapper(mapper);
      
      const property = terrainActor.getProperty();
      property.setInterpolationToPhong();
      property.setAmbient(0.1);
      property.setDiffuse(0.7);
      property.setSpecular(0.3);
      property.setSpecularPower(20);
      
      // ### 优化风速大小显示面板 (ScalarBarActor) ###
      scalarBarActor = vtkScalarBarActor.newInstance();
      scalarBarActor.setScalarsToColors(ctfun);
      const scalarBarState = scalarBarActor.getState();
      
      scalarBarState.title = '风速大小';
      scalarBarState.subtitle = '(m/s)';
      scalarBarState.titleFontSize = 18;
      scalarBarState.subtitleFontSize = 14;
      scalarBarState.labelFontSize = 13;
      scalarBarState.numberOfLabels = 6;
      
      // 调整位置到左下角
      scalarBarState.position = [0.05, 0.15];
      scalarBarState.position2 = [0.15, 0.7];
      scalarBarState.orientation = 'Vertical';
      scalarBarState.boxPosition = 0.05;
      
      // 优化颜色和背景
      scalarBarState.drawBackground = true;
      scalarBarState.backgroundColor = [1.0, 1.0, 1.0, 0.9]; // 白色半透明背景
      scalarBarState.drawFrame = true;
      scalarBarState.frameColor = [0.2, 0.2, 0.2, 0.8]; // 深灰色边框
      
      // 设置字体颜色为黑色
      scalarBarState.titleColor = [0.0, 0.0, 0.0]; // 黑色标题
      scalarBarState.labelColor = [0.0, 0.0, 0.0]; // 黑色标签
      
      scalarBarActor.modified();
      renderer.addActor(scalarBarActor);
      
    } else {
      console.warn("未找到速度场数据 'U'，使用简单地形着色");
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(terrainData);
      terrainActor = vtkActor.newInstance();
      terrainActor.setMapper(mapper);
      const isDarkBg = selectedBg.value !== 'light';
      terrainActor.getProperty().setColor(isDarkBg ? 0.2 : 0.8, isDarkBg ? 0.2 : 0.8, isDarkBg ? 0.28 : 0.85);
    }
    
    updateTerrainVisibility();
    renderer.addActor(terrainActor);
    
  } catch (error) { 
    console.error(`加载地形数据失败 (高度: ${selectedHeight.value}m):`, error); 
    terrainData = null; 
    terrainBounds = null;
  }
}

function clearScene() {
  if (streamlinesActor) { renderer.removeActor(streamlinesActor); streamlinesActor = null; }
  if (particlesActor) { renderer.removeActor(particlesActor); particlesActor = null; }
  if (trailsActor) { renderer.removeActor(trailsActor); trailsActor = null; }
  if (terrainActor) { renderer.removeActor(terrainActor); terrainActor = null; }
  if (scalarBarActor) { renderer.removeActor(scalarBarActor); scalarBarActor = null; }
  stopParticleAnimation();
  streamlines = []; 
  flowVectors = []; 
  particles = []; 
  allVelocities = [];
  terrainBounds = null;
}

function extractStreamlinesFromVTP() {
  streamlines = [];
  flowVectors = [];
  allVelocities = [];
  
  if (!streamlinesData) return;

  const streamBounds = streamlinesData.getBounds();
  let transform = null;
  
  if (terrainBounds) {
    const streamWidth = streamBounds[1] - streamBounds[0];
    const streamHeight = streamBounds[3] - streamBounds[2];
    const streamDepth = streamBounds[5] - streamBounds[4];
    
    const terrainWidth = terrainBounds[1] - terrainBounds[0];
    const terrainHeight = terrainBounds[3] - terrainBounds[2];
    const terrainDepth = terrainBounds[5] - terrainBounds[4];
    
    const scaleX = terrainWidth / streamWidth;
    const scaleY = terrainHeight / streamHeight;
    const scaleZ = streamDepth > 0.001 ? terrainDepth / streamDepth : 1.0;
    
    const streamCenterX = (streamBounds[0] + streamBounds[1]) / 2;
    const streamCenterY = (streamBounds[2] + streamBounds[3]) / 2;
    const streamCenterZ = (streamBounds[4] + streamBounds[5]) / 2;
    
    const terrainCenterX = (terrainBounds[0] + terrainBounds[1]) / 2;
    const terrainCenterY = (terrainBounds[2] + terrainBounds[3]) / 2;
    const terrainCenterZ = (terrainBounds[4] + terrainBounds[5]) / 2;
    
    const offsetX = terrainCenterX - streamCenterX * scaleX;
    const offsetY = terrainCenterY - streamCenterY * scaleY;
    const offsetZ = terrainCenterZ - streamCenterZ * scaleZ;
    
    transform = { scaleX, scaleY, scaleZ, offsetX, offsetY, offsetZ };
    
    const scaleRatio = Math.max(scaleX, scaleY) / Math.min(scaleX, scaleY);
    if (scaleRatio <= 2.0 && Math.abs(scaleX - 1.0) <= 0.1 && Math.abs(scaleY - 1.0) <= 0.1) {
      transform = null;
    }
  }

  const velocityData = streamlinesData.getPointData().getArrayByName('U');
  const points = streamlinesData.getPoints().getData();
  
  const extract = (cellData) => {
    let count = 0, i = 0;
    while (i < cellData.length) {
      const size = cellData[i++];
      if (size < 2) { i += size; continue; }

      const line = [], currentLineVectors = [], pointIds = [];
      for (let j = 0; j < size; j++) {
        const pointId = cellData[i++];
        pointIds.push(pointId);
        if (pointId * 3 + 2 >= points.length) continue;
        const [x, y, z] = [points[pointId*3], points[pointId*3+1], points[pointId*3+2]];
        line.push(transform ? [x*transform.scaleX+transform.offsetX, y*transform.scaleY+transform.offsetY, z*transform.scaleZ+transform.offsetZ] : [x, y, z]);
      }
      if (line.length < 2) continue;
      
      for (const pointId of pointIds) {
        let vector = [0,0,0], magnitude = 0, valid = false;
        if (velocityData && pointId*3+2 < velocityData.getData().length) {
          const [vx, vy, vz] = [velocityData.getData()[pointId*3], velocityData.getData()[pointId*3+1], velocityData.getData()[pointId*3+2]];
          const [tvx, tvy, tvz] = transform ? [vx*transform.scaleX, vy*transform.scaleY, vz*transform.scaleZ] : [vx, vy, vz];
          magnitude = Math.sqrt(tvx**2 + tvy**2 + tvz**2);
          if (magnitude > 0.0001) { vector = [tvx, tvy, tvz]; valid = true; }
        }
        currentLineVectors.push({ vector, magnitude, valid });
      }
      streamlines.push(line);
      flowVectors.push(currentLineVectors);
      allVelocities.push(...currentLineVectors.filter(v=>v.valid).map(v=>v.magnitude));
      count++;
    }
    return count;
  }
  
  const lines = streamlinesData.getLines();
  if (!lines || extract(lines.getData()) === 0) {
    const polys = streamlinesData.getPolys();
    if(polys) extract(polys.getData());
  }

  if (allVelocities.length > 0) {
    const sorted = [...allVelocities].sort((a, b) => a - b);
    minVelocityMagnitude = Math.max(0.0001, sorted[0]);
    maxVelocityMagnitude = sorted[sorted.length - 1];
    medianVelocityMagnitude = sorted[Math.floor(sorted.length * 0.5)];
  }
  
  const transformedStreamlinesData = createTransformedStreamlinesData();
  if (transformedStreamlinesData) streamlinesData = transformedStreamlinesData;
}

function createTransformedStreamlinesData() {
  if (streamlines.length === 0) return null;
  
  const polyData = vtkPolyData.newInstance();
  const pointsArray = [], linesArray = [];
  let pointOffset = 0;
  
  for (const line of streamlines) {
    if (line.length < 2) continue;
    for (const point of line) pointsArray.push(...point);
    linesArray.push(line.length);
    for (let i=0; i<line.length; i++) linesArray.push(pointOffset+i);
    pointOffset += line.length;
  }
  
  if (pointsArray.length > 0) {
    const points = vtkPoints.newInstance();
    points.setData(new Float32Array(pointsArray), 3);
    polyData.setPoints(points);
    if (linesArray.length > 0) polyData.getLines().setData(new Uint32Array(linesArray));
    return polyData;
  }
  return null;
}

function analyzeGlobalWindDirection() {
  let avgDirection = [0,0,0], validCount = 0;
  for (const line of flowVectors) {
    for (const {valid, vector} of line) {
      if (valid && (vector[0]**2+vector[1]**2+vector[2]**2)>0.000001) {
        const norm = normalizeVector(vector);
        avgDirection[0]+=norm[0]; avgDirection[1]+=norm[1]; avgDirection[2]+=norm[2];
        validCount++;
      }
    }
  }
  globalWindDirection = validCount > 0 ? normalizeVector([avgDirection[0]/validCount, avgDirection[1]/validCount, avgDirection[2]/validCount]) : [1,0,0];
}

function createParticleTrails() {
  if (particles.length === 0) return;
  const trailPoints = [], trailLines = [], trailColors = [];
  let pointOffset = 0;
  for (const p of particles) {
    if (p.trail && p.trail.length >= 2) {
      const len = Math.min(p.trail.length, trailLength.value);
      const start = p.trail.length - len;
      for (let i=start; i<p.trail.length; i++) {
        trailPoints.push(...p.trail[i]);
        const alpha = (i-start) / (len-1);
        const speed = p.speed || 0;
        const normSpeed = Math.min(1, speed / maxVelocityMagnitude);
        trailColors.push(normSpeed, normSpeed, alpha);
      }
      if (len >= 2) {
        for (let i=0; i<len-1; i++) trailLines.push(2, pointOffset+i, pointOffset+i+1);
        pointOffset += len;
      }
    }
  }
  if (trailPoints.length > 0) {
    const polyData = vtkPolyData.newInstance();
    const points = vtkPoints.newInstance();
    points.setData(new Float32Array(trailPoints));
    polyData.setPoints(points);
    if(trailLines.length > 0) polyData.getLines().setData(new Uint32Array(trailLines));
    if(trailColors.length > 0) {
      const colors = vtkDataArray.newInstance({numberOfComponents: 3, values: new Float32Array(trailColors), name: 'Colors'});
      polyData.getPointData().setScalars(colors);
    }
    if (trailsActor) renderer.removeActor(trailsActor);
    const mapper = vtkMapper.newInstance({scalarVisibility: true});
    mapper.setInputData(polyData);
    trailsActor = vtkActor.newInstance();
    trailsActor.setMapper(mapper);
    trailsActor.getProperty().setOpacity(trailOpacity.value);
    trailsActor.getProperty().setLineWidth(2); // 增加轨迹线宽
    renderer.addActor(trailsActor);
  }
}

function updateParticleData() {
  if (!showParticles.value) return;
  if (particles.length === 0) return;
  const points = [], velocities = [], speeds = [];
  for (const p of particles) {
    points.push(...p.position);
    velocities.push(...p.velocity);
    speeds.push(p.normalizedSpeed || 0.5);
  }
  if (points.length > 0) {
    const polyData = vtkPolyData.newInstance();
    const vtkPts = vtkPoints.newInstance();
    vtkPts.setData(new Float32Array(points), 3);
    polyData.setPoints(vtkPts);
    polyData.getPointData().addArray(vtkDataArray.newInstance({ name: 'velocity', values: new Float32Array(velocities), numberOfComponents: 3 }));
    polyData.getPointData().addArray(vtkDataArray.newInstance({ name: 'speed', values: new Float32Array(speeds) }));
    polyData.getPointData().setActiveScalars('speed');
    
    let source;
    if (particleStyle.value === 'arrow') {
        source = vtkArrowSource.newInstance({ tipResolution: 12, tipRadius: particleSize.value*modelScale*0.4, tipLength: particleSize.value*modelScale*1.0, shaftResolution: 12, shaftRadius: particleSize.value*modelScale*0.15 });
    } else {
        source = vtkSphereSource.newInstance({ thetaResolution: 16, phiResolution: 16, radius: particleSize.value*modelScale*0.4 });
    }
    
    const lut = vtkLookupTable.newInstance();
    const scheme = colorSchemes[selectedColorScheme.value];
    lut.setHueRange(scheme.hueRange[0], scheme.hueRange[1]);
    lut.setValueRange(selectedBg.value==='light'?0.6:0.7, selectedBg.value==='light'?0.85:1.0);
    lut.setSaturationRange(scheme.satRange[0], scheme.satRange[1]);
    lut.setAlphaRange(0.9, 1.0);
    lut.build();
    
    if (particlesActor) renderer.removeActor(particlesActor);
    
    const mapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
        scaleArray: 'speed',
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
        scalarVisibility: useColorSpeed.value,
        orient: true,
        orientationMode: vtkGlyph3DMapper.OrientationModes.DIRECTION,
        orientationArray: 'velocity'
    });
    mapper.setInputData(polyData, 0);
    mapper.setInputConnection(source.getOutputPort(), 1);
    mapper.setLookupTable(lut);
    mapper.setScalarRange(0, 1);
    
    particlesActor = vtkActor.newInstance();
    particlesActor.setMapper(mapper);
    const prop = particlesActor.getProperty();
    prop.setOpacity(particleOpacity.value);
    prop.setAmbient(0.7);
    prop.setDiffuse(0.9);
    prop.setSpecular(0.9);
    prop.setSpecularPower(5);
    renderer.addActor(particlesActor);
  }
  createParticleTrails();
}

function initParticleSystem() {
  if (!showParticles.value) return;
  if (streamlines.length === 0) return;
  analyzeGlobalWindDirection();
  createParticles();
  updateParticleData();
  startParticleAnimation();
}

function createParticles() {
  particles = [];
  if (streamlines.length === 0) return;
  const targetCount = particleCount.value;
  const particlesPerLine = Math.max(1, Math.floor(targetCount / streamlines.length));
  
  for (let i=0; i<streamlines.length && particles.length < targetCount; i++) {
    const line = streamlines[i], vectors = flowVectors[i];
    if (line.length < 2) continue;
    for (let j=0; j<particlesPerLine; j++) {
      const startIndex = Math.floor(Math.random() * (line.length-1));
      const progress = Math.random();
      const pos1=line[startIndex], pos2=line[startIndex+1];
      const position = [pos1[0]+(pos2[0]-pos1[0])*progress, pos1[1]+(pos2[1]-pos1[1])*progress, pos1[2]+(pos2[2]-pos1[2])*progress];
      const vecData = vectors[startIndex] || {vector:globalWindDirection, magnitude:1.0, valid:true};
      particles.push({
        position:[...position], lineIndex:i, pointIndex:startIndex, progress, trail:[position],
        velocity: normalizeVector(vecData.vector), speed: vecData.magnitude,
        normalizedSpeed: Math.max(0, Math.min(1, (vecData.magnitude-minVelocityMagnitude)/(maxVelocityMagnitude-minVelocityMagnitude||1))),
        age:0, maxAge: 100+Math.random()*200
      });
    }
  }
}

function startParticleAnimation() {
  stopParticleAnimation();
  const animate = () => {
    if (!showParticles.value) {
      stopParticleAnimation();
      return;
    }
    updateParticlePositions();
    updateTrails();
    if (particles.length > 0) updateParticleData();
    safeRender();
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
}

function updateParticlePositions() {
  for (const p of particles) {
    p.age++;
    if (p.age > p.maxAge) { resetParticle(p); continue; }
    const line = streamlines[p.lineIndex];
    if (line && line.length > 1) {
      p.progress += particleSpeed.value * 0.01;
      if (p.progress >= 1.0) {
        if(resetTrailsOnJump.value) { resetParticle(p); continue; }
        else { p.progress = 0; p.pointIndex = 0; }
      }
      const totalPts = line.length-1, exactIdx = p.progress*totalPts;
      const floorIdx = Math.floor(exactIdx), ceilIdx = Math.min(floorIdx+1, totalPts);
      const localProg = exactIdx - floorIdx;
      if (floorIdx < line.length && ceilIdx < line.length) {
        const p1=line[floorIdx], p2=line[ceilIdx];
        p.position = [p1[0]+(p2[0]-p1[0])*localProg, p1[1]+(p2[1]-p1[1])*localProg, p1[2]+(p2[2]-p1[2])*localProg];
        const vecData = flowVectors[p.lineIndex][floorIdx] || {vector:globalWindDirection, magnitude:1.0, valid:true};
        p.velocity = vecData.vector;
        p.speed = vecData.magnitude;
        p.pointIndex = floorIdx;
      }
    }
  }
}

function resetParticle(p) {
  const line = streamlines[p.lineIndex];
  if(line && line.length > 0) {
    p.progress = 0; p.pointIndex = 0; p.age = 0;
    p.position = [...line[0]];
    p.trail = [p.position];
  }
}

function updateTrails() {
  for (const p of particles) {
    p.trail.push([...p.position]);
    if (p.trail.length > trailLength.value) p.trail.shift();
  }
}

function updateParticleColors() {
  if (particles.length > 0) updateParticleData();
}

function updateVisibility() {
  if (streamlinesActor) {
    streamlinesActor.setVisibility(showLines.value);
    safeRender();
  }
}

const exportLayerPhotos = async () => {
  if (!selectedHeight.value) return { success: false, message: '未选择高度' };
  try {
    const url = getTerrainUrl();
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return { success: false, message: '文件不存在' };
    const link = document.createElement('a');
    link.href = url;
    link.download = `${props.caseId}_${selectedHeight.value}m_velocity_field.vtp`;
    link.click();
    document.body.removeChild(link);
    return { success: true };
  } catch (error) {
    return { success: false, message: `导出失败: ${error.message}` };
  }
};

onMounted(async () => {
  loadControlsState();
  await nextTick();
  if (!vtkContainer.value) return;
  await fetchAvailableHeights();
  if (initRenderer()) {
    updateBackground();
    currentColorScheme = colorSchemes[selectedColorScheme.value];
    if (selectedHeight.value) loadData();
    window.addEventListener('resize', handleWindowResize);
  }
});

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (fullScreenRenderer) fullScreenRenderer.delete();
  window.removeEventListener('resize', handleWindowResize);
});

defineExpose({ exportLayerPhotos });
</script>

<style scoped>
/* 样式保持不变 */
.flow-particle-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.vtk-container {
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  color: #333;
  z-index: 10;
  width: 300px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  max-height: 80vh;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.controls-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #1f2937;
}

.controls-collapse-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.controls-collapse-button:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 0, 0, 0.18);
}

.icon-panel-toggle {
  display: inline-block;
  width: 18px;
  height: 18px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='15 18 9 12 15 6'/%3E%3C/svg%3E");
  transition: transform 0.2s ease;
}

.icon-panel-toggle.expanded {
  transform: rotate(180deg);
}

.icon-panel-toggle.collapsed {
  transform: rotate(0deg);
}

.controls.collapsed {
  width: 52px;
  padding: 10px;
  max-height: none;
  overflow: visible;
}

.controls.collapsed .controls-header {
  justify-content: center;
  padding: 0;
  border-bottom: none;
}

.controls.collapsed .controls-title {
  display: none;
}

.control-content {
  padding: 20px;
}

.control-content > div {
  margin-bottom: 16px;
}

.control-content > div:last-child {
  margin-bottom: 0;
}

.controls label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: #444;
}

.controls select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  background: white;
  color: #333;
  border: 1px solid #dee2e6;
  font-size: 13px;
  cursor: pointer;
}

.controls input[type="checkbox"] {
  accent-color: #007bff;
  margin-right: 8px;
  transform: scale(1.1);
  cursor: pointer;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  padding: 24px 32px;
  border-radius: 12px;
  font-size: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media screen and (max-width: 768px) {
  .controls { 
    width: 280px; 
    top: 15px;
    right: 15px;
  }
}

@media screen and (max-width: 480px) {
  .controls {
    width: calc(100vw - 30px);
  }
}
</style>
