<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-26 16:38:45
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-26 19:26:14
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\3DtestOld.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="flow-particle-test">
      <div ref="vtkContainer" class="vtk-container"></div>
      
      <div class="controls">
        <div class="control-tabs">
          <div 
            v-for="(tab, index) in tabs" 
            :key="index" 
            :class="['tab', { active: activeTab === index }]" 
            @click="activeTab = index"
          >
            {{ tab }}
          </div>
        </div>
        
        <div class="control-content" v-if="activeTab === 0">
          <div>
            <label for="file-select">流线文件:</label>
            <select id="file-select" v-model="selectedFile" @change="loadData">
              <option value="internal_75m_web.vtp">1米高度切片</option>
            </select>
          </div>
          
          <div>
            <label for="terrain-select">速度场显示:</label>
            <select id="terrain-select" v-model="terrainVisibility" @change="updateTerrainVisibility">
              <option value="visible">显示</option>
              <option value="transparent">半透明</option>
              <option value="hidden">隐藏</option>
            </select>
          </div>
          
          <div>
            <label for="visual-style">视觉风格:</label>
            <select id="visual-style" v-model="visualStyle" @change="updateVisualStyle">
              <option value="analytical">分析风格</option>
              <option value="modern">现代风格</option>
            </select>
          </div>
          
          <div>
            <label for="bg-select">背景:</label>
            <select id="bg-select" v-model="selectedBg" @change="updateBackground">
              <option value="light">浅色</option>
              <option value="dark">深蓝</option>
              <option value="black">纯黑</option>
              <option value="gradient">深色渐变</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          
          <div v-if="selectedBg === 'custom'">
            <label>自定义颜色:</label>
            <input type="color" v-model="customBgColor" @change="updateBackground">
          </div>
          
          <div>
            <label>
              <input type="checkbox" v-model="showLines" @change="updateVisibility">
              显示流线
            </label>
          </div>
        </div>
        
        <div class="control-content" v-else-if="activeTab === 1">
          <div>
            <label for="particle-count">粒子数量:</label>
            <input id="particle-count" type="range" min="100" max="5000" step="50" v-model.number="particleCount" @change="updateParticles">
            <span class="range-value">{{ particleCount }}</span>
          </div>
          
          <div>
            <label for="particle-speed">粒子速度:</label>
            <input id="particle-speed" type="range" min="0.1" max="2.0" step="0.1" v-model.number="particleSpeed" @change="updateParticleSpeed">
            <span class="range-value">{{ particleSpeed }}</span>
          </div>
          
          <div>
            <label for="particle-size">粒子大小:</label>
            <input id="particle-size" type="range" min="5" max="25" step="1" v-model.number="particleSize" @change="updateParticleSize">
            <span class="range-value">{{ particleSize }}</span>
          </div>
          
          <div>
            <label for="particle-style">粒子类型:</label>
            <select id="particle-style" v-model="particleStyle" @change="updateParticleShape">
              <option value="arrow">箭头</option>
              <option value="sphere">球体</option>
            </select>
          </div>
          
          <div>
            <label for="trail-length">尾迹长度:</label>
            <input id="trail-length" type="range" min="0" max="25" step="1" v-model.number="trailLength" @change="updateParticles">
            <span class="range-value">{{ trailLength }}</span>
          </div>
          
          <div>
            <label for="trail-opacity">尾迹不透明度:</label>
            <input id="trail-opacity" type="range" min="0.1" max="1" step="0.1" v-model.number="trailOpacity" @change="updateTrailOpacity">
            <span class="range-value">{{ trailOpacity }}</span>
          </div>
          
          <div>
            <label for="particle-opacity">粒子不透明度:</label>
            <input id="particle-opacity" type="range" min="0.3" max="1" step="0.1" v-model.number="particleOpacity" @change="updateParticleOpacity">
            <span class="range-value">{{ particleOpacity }}</span>
          </div>
          
          <div>
            <label>
              <input type="checkbox" v-model="useColorSpeed" @change="updateParticleColors">
              速度着色
            </label>
          </div>
          
          <div>
            <label>
              <input type="checkbox" v-model="resetTrailsOnJump">
              循环时重置尾迹
            </label>
          </div>
        </div>
        
        <div class="control-content" v-else-if="activeTab === 2">
          <div>
            <label for="filter-mode">异常值处理:</label>
            <select id="filter-mode" v-model="filterMode" @change="updateFilterMode">
              <option value="none">不过滤</option>
              <option value="auto">自动过滤</option>
              <option value="manual">手动过滤</option>
              <option value="highlight">高亮异常</option>
            </select>
          </div>
          
          <div v-if="filterMode === 'manual'">
            <label for="max-speed-filter">最大速度过滤:</label>
            <input id="max-speed-filter" type="range" min="90" max="100" step="1" v-model.number="maxSpeedPercentile" @change="updateSpeedFilters">
            <span class="range-value">{{ maxSpeedPercentile }}%</span>
          </div>
          
          <div v-if="filterMode === 'manual'">
            <label for="min-speed-filter">最小速度过滤:</label>
            <input id="min-speed-filter" type="range" min="0" max="20" step="1" v-model.number="minSpeedPercentile" @change="updateSpeedFilters">
            <span class="range-value">{{ minSpeedPercentile }}%</span>
          </div>
          
          <div v-if="filterMode === 'auto'">
            <label for="outlier-sensitivity">异常值敏感度:</label>
            <input id="outlier-sensitivity" type="range" min="1" max="5" step="0.1" v-model.number="outlierSensitivity" @change="updateSpeedFilters">
            <span class="range-value">{{ outlierSensitivity }}</span>
          </div>
          
          <div>
            <label for="speed-scaling">速度缩放:</label>
            <select id="speed-scaling" v-model="speedScaling" @change="updateSpeedFilters">
              <option value="linear">线性缩放</option>
              <option value="log">对数缩放</option>
              <option value="sqrt">平方根缩放</option>
              <option value="equal">等分区间</option>
            </select>
          </div>
          
          <div>
            <label for="color-scheme">颜色方案:</label>
            <select id="color-scheme" v-model="selectedColorScheme" @change="updateColorScheme">
              <option value="blueRed">蓝红</option>
              <option value="analytical">分析色</option>
              <option value="rainbow">彩虹</option>
              <option value="plasma">等离子</option>
              <option value="simple">简单</option>
            </select>
          </div>
          
          <div>
            <label>
              <input type="checkbox" v-model="smoothVelocities" @change="updateSpeedFilters">
              平滑速度场
            </label>
          </div>
        </div>
      </div>
      
      <div v-if="loading" class="loading-indicator">
        <div class="loading-spinner"></div>
        <div>加载中...</div>
      </div>
      
      <div class="legend" v-if="useColorSpeed">
        <div class="legend-title">风速 (m/s)</div>
        <div class="legend-gradient" :style="getLegendStyle()"></div>
        <div class="legend-labels">
          <span>低速</span>
          <span>高速</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
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
  
  // 组件状态 - 界面与控制
  const vtkContainer = ref(null);
  const loading = ref(false);
  const tabs = ['显示', '粒子', '数据'];
  const activeTab = ref(0);
  
  // 文件选择 - 只保留1米高度切片
  const selectedFile = ref('internal_75m_web.vtp');
  
  // 视觉风格
  const visualStyle = ref('analytical');
  
  // 数据过滤与处理
  const filterMode = ref('none'); 
  const maxSpeedPercentile = ref(98);
  const minSpeedPercentile = ref(5);
  const outlierSensitivity = ref(2);
  const speedScaling = ref('linear');
  const smoothVelocities = ref(true);
  
  // 粒子设置
  const particleCount = ref(800); 
  const particleSpeed = ref(0.8); 
  const particleSize = ref(12.0); 
  const trailLength = ref(10);
  const particleOpacity = ref(0.9);
  const trailOpacity = ref(0.6);
  const showLines = ref(false); 
  const useColorSpeed = ref(true); 
  const particleStyle = ref('arrow'); 
  const resetTrailsOnJump = ref(true);
  
  // 颜色方案
  const selectedColorScheme = ref('blueRed');
  
  // 背景设置
  const selectedBg = ref('light');
  const customBgColor = ref('#1a1a2a');
  const bgColors = {
    dark: [0.02, 0.02, 0.1],
    black: [0.0, 0.0, 0.0],
    gradient: 'gradient',
    light: [0.95, 0.95, 0.98],
    custom: 'custom'
  };
  
  // 速度统计信息
  const velocityStats = ref({
    count: 0,
    raw: { min: 0, max: 0, median: 0, q25: 0, q75: 0, mean: 0, stdDev: 0 },
    filtered: { min: 0, max: 0, median: 0, q25: 0, q75: 0 },
    outliers: 0
  });
  
  // 地形显示模式
  const terrainVisibility = ref('visible');
  
  // 视觉风格配置
  const visualStyles = {
    analytical: {
      particleStyle: 'arrow',
      trailLength: 10,
      bg: 'light',
      colorScheme: 'blueRed'
    },
    modern: {
      particleStyle: 'arrow', 
      trailLength: 12,
      bg: 'light',
      colorScheme: 'rainbow'
    }
  };
  
  // 颜色方案配置
  const colorSchemes = {
    blueRed: {
      hueRange: [0.67, 0.0],
      satRange: [0.85, 0.95],
      valRange: [0.8, 0.9]
    },
    analytical: {
      hueRange: [0.6, 0.1], 
      satRange: [0.8, 0.85],
      valRange: [0.8, 0.9]
    },
    rainbow: {
      hueRange: [0.67, 0], 
      satRange: [0.7, 0.8],
      valRange: [0.8, 0.9]
    },
    plasma: {
      hueRange: [0.8, 0], 
      satRange: [0.8, 0.9],
      valRange: [0.8, 1.0]
    },
    simple: {
      hueRange: [0.6, 0], 
      satRange: [0.7, 0.7],
      valRange: [0.8, 0.8]
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
  let scalarBarActor = null;
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
  
  const STREAMLINE_URL = 'http://localhost:5000/uploads/test/run/VTK/run_10/';
  const TERRAIN_URL = 'http://localhost:5000/uploads/test/run/postProcessing/Data/20.vtp';
  
  function distance3D(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2) + Math.pow(p1[2] - p2[2], 2));
  }
  
  function dotProduct(v1, v2) { return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]; }
  
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
  
  function getLegendStyle() {
    const scheme = colorSchemes[selectedColorScheme.value];
    const hueStart = scheme.hueRange[0] * 360;
    const hueEnd = scheme.hueRange[1] * 360;
    const sat = scheme.satRange[0] * 100;
    const val = scheme.valRange[0] * 100;
    return { background: `linear-gradient(to right, hsl(${hueStart}, ${sat}%, ${val}%), hsl(${hueEnd}, ${sat}%, ${val}%))` };
  }
  
  function initRenderer() {
  try {
    // Check if container is available
    if (!vtkContainer.value) {
      console.warn("VTK container not available yet");
      return false;
    }

    if (fullScreenRenderer) fullScreenRenderer.delete();
    const bgColor = getBgColor();
    
    fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      container: vtkContainer.value,
      background: bgColor === 'gradient' ? [0.02, 0.02, 0.1] : bgColor,
      rootContainer: vtkContainer.value,
      containerStyle: { width: '100%', height: '100%' },
    });
    
    renderer = fullScreenRenderer.getRenderer();
    renderWindow = fullScreenRenderer.getRenderWindow();
    renderer.setTwoSidedLighting(true);
    
    try { 
      renderer.setAutomaticLightCreation(true); 
    } catch (e) { 
      console.warn("不支持自动光照创建", e); 
    }
    
    if (bgColor === 'gradient') createGradientBackground();
    console.log("渲染器初始化完成");
    return true;
  } catch (e) { 
    console.error("初始化渲染器失败:", e); 
    return false; 
  }
}
  function createGradientBackground() {
    const container = vtkContainer.value;
    if (container) container.style.background = 'linear-gradient(to bottom, #050533 0%, #050533 35%, #101030 100%)';
  }
  
  function getBgColor() {
    if (selectedBg.value === 'custom') {
      try {
        const hex = customBgColor.value.substring(1);
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        return [r, g, b];
      } catch (e) { console.warn("解析自定义颜色失败，使用默认深蓝色", e); return [0.02, 0.02, 0.1]; }
    } else { return bgColors[selectedBg.value]; }
  }
  
  function updateVisualStyle() {
    const style = visualStyles[visualStyle.value];
    particleStyle.value = style.particleStyle;
    trailLength.value = style.trailLength;
    selectedBg.value = style.bg;
    selectedColorScheme.value = style.colorScheme;
    updateBackground();
    if (renderer && renderWindow) {
      updateColorScheme();
      updateParticleShape();
    }
  }
  
  function updateBackground() {
    if (!renderer) return;
    try {
      const bgColor = getBgColor();
      if (bgColor === 'gradient') {
        createGradientBackground();
        renderer.setBackground([0.02, 0.02, 0.1]);
      } else {
        const container = vtkContainer.value;
        if (container) container.style.background = '';
        renderer.setBackground(bgColor);
      }
      if (streamlinesActor) {
        const isDarkBg = selectedBg.value !== 'light';
        streamlinesActor.getProperty().setColor(isDarkBg ? 0.6 : 0.2, isDarkBg ? 0.6 : 0.3, isDarkBg ? 0.9 : 0.6);
        streamlinesActor.getProperty().setOpacity(0.2);
      }
      safeRender();
    } catch (e) { console.error("更新背景失败:", e); }
  }
  
  function updateParticleOpacity() {
    try {
      if (particlesActor) {
        particlesActor.getProperty().setOpacity(particleOpacity.value);
        safeRender();
      }
    } catch (e) { console.error("更新粒子不透明度失败:", e); }
  }
  
  function updateTrailOpacity() {
    try {
      if (trailsActor) {
        trailsActor.getProperty().setOpacity(trailOpacity.value);
        safeRender();
      }
    } catch (e) { console.error("更新尾迹不透明度失败:", e); }
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
        try {
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
        } catch (e) { console.error("创建或设置LUT失败", e); }
        updateParticleColors();
      }
      safeRender();
    } catch (e) { console.error("更新颜色方案失败:", e); }
  }
  
  function updateFilterMode() { updateSpeedFilters(); }
  
  function updateSpeedFilters() {
    if (allVelocities.length === 0) {
      minVelocityMagnitude = 0.0001; 
      maxVelocityMagnitude = 1.0; 
      medianVelocityMagnitude = 0.5;
      velocityStats.value = { 
        count: 0, 
        raw: { min: 0, max: 0, median: 0, q25: 0, q75: 0, mean: 0, stdDev: 0 }, 
        filtered: { min: 0.0001, max: 1.0, median: 0.5, q25: 0.25, q75: 0.75 }, 
        outliers: 0 
      };
      console.log("No velocity data available, using default velocity range.");
      if (particles.length > 0) updateParticles(); 
      return;
    }
    try {
      const sortedVelocities = [...allVelocities].sort((a, b) => a - b);
      minVelocityMagnitude = Math.max(0.0001, sortedVelocities[0]);
      maxVelocityMagnitude = sortedVelocities[sortedVelocities.length - 1];
      if (maxVelocityMagnitude <= minVelocityMagnitude) maxVelocityMagnitude = minVelocityMagnitude + 0.0001;
      const medianIndex = Math.floor(sortedVelocities.length * 0.5);
      medianVelocityMagnitude = sortedVelocities[medianIndex];
      velocityStats.value.count = allVelocities.length;
      velocityStats.value.raw.min = sortedVelocities[0]; 
      velocityStats.value.raw.max = sortedVelocities[sortedVelocities.length - 1];
      velocityStats.value.raw.median = medianVelocityMagnitude;
      velocityStats.value.raw.q25 = sortedVelocities[Math.floor(sortedVelocities.length * 0.25)];
      velocityStats.value.raw.q75 = sortedVelocities[Math.floor(sortedVelocities.length * 0.75)];
      velocityStats.value.filtered.min = minVelocityMagnitude;
      velocityStats.value.filtered.max = maxVelocityMagnitude;
      velocityStats.value.filtered.median = medianVelocityMagnitude;
      velocityStats.value.filtered.q25 = sortedVelocities[Math.floor(sortedVelocities.length * 0.25)];
      velocityStats.value.filtered.q75 = sortedVelocities[Math.floor(sortedVelocities.length * 0.75)];
      velocityStats.value.outliers = 0; 
      console.log(`Using full velocity range: ${minVelocityMagnitude.toFixed(4)} to ${maxVelocityMagnitude.toFixed(4)}`);
      if (smoothVelocities.value) smoothVelocityField();
      if (particles.length > 0) updateParticles();
    } catch (e) { console.error("更新速度过滤器失败:", e); }
  }
  
  function smoothVelocityField() {
    if (flowVectors.length === 0) return;
    try {
      const smoothingRadius = 2; 
      for (let i = 0; i < flowVectors.length; i++) {
        const vectors = flowVectors[i];
        const smoothedVectors = [];
        for (let j = 0; j < vectors.length; j++) {
          const currentVector = vectors[j];
          if (!currentVector.valid) { 
            smoothedVectors.push({ ...currentVector }); 
            continue; 
          }
          let weightSum = 0; 
          const averageVector = [0, 0, 0]; 
          let averageMagnitude = 0;
          for (let k = Math.max(0, j - smoothingRadius); k <= Math.min(vectors.length - 1, j + smoothingRadius); k++) {
            const neighborVector = vectors[k];
            if (neighborVector.valid) {
              const distance = Math.abs(j - k); 
              const weight = 1 / (1 + distance); 
              averageVector[0] += neighborVector.vector[0] * weight; 
              averageVector[1] += neighborVector.vector[1] * weight; 
              averageVector[2] += neighborVector.vector[2] * weight;
              averageMagnitude += neighborVector.magnitude * weight; 
              weightSum += weight;
            }
          }
          if (weightSum > 0) {
            averageVector[0] /= weightSum; 
            averageVector[1] /= weightSum; 
            averageVector[2] /= weightSum; 
            averageMagnitude /= weightSum;
            smoothedVectors.push({ vector: averageVector, magnitude: averageMagnitude, valid: true });
          } else { 
            smoothedVectors.push({ ...currentVector }); 
          }
        }
        flowVectors[i] = smoothedVectors;
      }
      console.log("已应用速度场平滑");
    } catch (e) { console.error("平滑速度场失败:", e); }
  }
  
  async function loadData() {
    loading.value = true;
    try {
      clearScene();
      
      // 加载流线数据
      const streamlineUrl = `${STREAMLINE_URL}${selectedFile.value}`;
      console.log(`加载流线数据: ${streamlineUrl}`);
      const response = await axios.get(streamlineUrl, { responseType: 'arraybuffer' });
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      streamlinesData = reader.getOutputData(0);
      console.log(`流线数据加载成功，包含 ${streamlinesData.getNumberOfPoints()} 个点和 ${streamlinesData.getNumberOfCells()} 条线/多边形`);
      
      const bounds = streamlinesData.getBounds();
      modelScale = Math.sqrt(Math.pow(bounds[1] - bounds[0], 2) + Math.pow(bounds[3] - bounds[2], 2) + Math.pow(bounds[5] - bounds[4], 2)) / 100;
      console.log(`模型尺度: ${modelScale}`);
      
      extractStreamlinesFromVTP(); 
      
      // 创建流线Actor
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(streamlinesData);
      streamlinesActor = vtkActor.newInstance();
      streamlinesActor.setMapper(mapper);
      const isDarkBg = selectedBg.value !== 'light';
      streamlinesActor.getProperty().setColor(isDarkBg ? 0.6 : 0.2, isDarkBg ? 0.6 : 0.3, isDarkBg ? 0.9 : 0.6);
      streamlinesActor.getProperty().setOpacity(0.2);
      streamlinesActor.setVisibility(showLines.value);
      renderer.addActor(streamlinesActor);
      
      // 确保加载地形数据
      await loadTerrainData();
      
      console.log("数据加载完成，开始初始化粒子系统...");
      
      if (streamlines.length === 0 || flowVectors.length === 0) {
        console.warn("流线数据不完整，使用备用方法重建流线");
        await new Promise(resolve => setTimeout(resolve, 100)); 
        if (streamlines.length === 0) {
          console.log("使用备用方法从点云构建流线...");
          extractStreamlinesFromVTP(); 
        }
      }
      
      initParticleSystem();
      renderer.resetCamera();
      safeRender();
      
    } catch (error) { 
      console.error('加载流线数据失败:', error); 
    } finally { 
      loading.value = false; 
    }
  }
  
  async function loadTerrainData() {
    try {
      console.log(`加载地形和速度场数据: ${TERRAIN_URL}`);
      const response = await axios.get(TERRAIN_URL, { responseType: 'arraybuffer' });
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      terrainData = reader.getOutputData(0);
      console.log(`地形数据加载成功，包含 ${terrainData.getNumberOfPoints()} 个点和 ${terrainData.getNumberOfCells()} 个面`);
      
      // 提取速度场数据
      const pointData = terrainData.getPointData();
      const cellData = terrainData.getCellData();
      let uArray = null;
      let usingCellData = false;
      
      // 首先尝试从点数据获取
      uArray = pointData.getArrayByName('U');
      if (!uArray) {
        // 如果点数据中没有，尝试从单元数据获取
        uArray = cellData.getArrayByName('U');
        if (uArray) {
          usingCellData = true;
          console.log("使用单元数据中的速度场");
        }
      } else {
        console.log("使用点数据中的速度场");
      }
      
      if (uArray) {
        console.log(`找到速度场数据 'U'，包含${uArray.getNumberOfComponents()}分量`);
        
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
        
        console.log(`速度场范围: ${minVal.toFixed(4)} 到 ${maxVal.toFixed(4)} m/s`);
        
        // 添加模值数据到数据集
        const uMagArray = vtkDataArray.newInstance({
          numberOfComponents: 1,
          values: magnitudes,
          name: 'U_magnitude'
        });
        
        if (usingCellData) {
          terrainData.getCellData().addArray(uMagArray);
          terrainData.getCellData().setActiveScalars('U_magnitude');
        } else {
          terrainData.getPointData().addArray(uMagArray);
          terrainData.getPointData().setActiveScalars('U_magnitude');
        }
        
        // 创建颜色映射
        const ctfun = vtkColorTransferFunction.newInstance();
        const range = maxVal - minVal;
        
        // 使用平滑的颜色过渡
        const numberOfPoints = 256;
        for (let i = 0; i <= numberOfPoints; i++) {
          const val = minVal + (range * i) / numberOfPoints;
          const t = i / numberOfPoints;
          
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
        
        // 创建地形Actor with 速度场着色
        const mapper = vtkMapper.newInstance();
        mapper.setInputData(terrainData);
        mapper.setLookupTable(ctfun);
        mapper.setScalarRange(minVal, maxVal);
        mapper.setUseLookupTableScalarRange(true);
        mapper.setScalarVisibility(true);
        mapper.setInterpolateScalarsBeforeMapping(true);
        
        if (usingCellData) {
          mapper.setScalarMode(2); // VTK_SCALAR_MODE_USE_CELL_DATA
        }
        
        terrainActor = vtkActor.newInstance();
        terrainActor.setMapper(mapper);
        
        // 配置表面属性
        const property = terrainActor.getProperty();
        property.setInterpolationToPhong();
        property.setAmbient(0.1);
        property.setDiffuse(0.7);
        property.setSpecular(0.3);
        property.setSpecularPower(20);
        property.setEdgeVisibility(false);
        property.setBackfaceCulling(false);
        property.setFrontfaceCulling(false);
        
        // 创建colorbar
        scalarBarActor = vtkScalarBarActor.newInstance();
        scalarBarActor.setScalarsToColors(ctfun);
        const scalarBarState = scalarBarActor.getState();
        
        // 配置colorbar
        scalarBarState.title = '风速大小';
        scalarBarState.subtitle = '(m/s)';
        scalarBarState.titleFontSize = 16;
        scalarBarState.subtitleFontSize = 12;
        scalarBarState.labelFontSize = 12;
        scalarBarState.numberOfLabels = 7;
        
        // 设置 colorbar 位置
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
        renderer.addActor(scalarBarActor);
        
        console.log("速度场可视化已创建");
      } else {
        console.warn("未找到速度场数据 'U'，使用简单地形着色");
        
        // 创建简单地形Actor
        const mapper = vtkMapper.newInstance();
        mapper.setInputData(terrainData);
        terrainActor = vtkActor.newInstance();
        terrainActor.setMapper(mapper);
        
        // 设置简单地形颜色
        const isDarkBg = selectedBg.value !== 'light';
        terrainActor.getProperty().setColor(isDarkBg ? 0.2 : 0.8, isDarkBg ? 0.2 : 0.8, isDarkBg ? 0.28 : 0.85);
      }
      
      // 应用地形可见性设置
      updateTerrainVisibility();
      
      // 添加到渲染器
      renderer.addActor(terrainActor);
      console.log("地形Actor已添加到场景");
      
    } catch (error) { 
      console.error('加载地形数据失败:', error); 
      terrainData = null; 
    }
  }
  
  function clearScene() {
    if (streamlinesActor) { renderer.removeActor(streamlinesActor); streamlinesActor = null; }
    if (particlesActor) { renderer.removeActor(particlesActor); particlesActor = null; }
    if (trailsActor) { renderer.removeActor(trailsActor); trailsActor = null; }
    if (terrainActor) { renderer.removeActor(terrainActor); terrainActor = null; }
    if (scalarBarActor) { renderer.removeActor(scalarBarActor); scalarBarActor = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    streamlines = []; 
    flowVectors = []; 
    particles = []; 
    allVelocities = [];
  }
  
  function extractStreamlinesFromCellData(cellData, points, velocityData) {
    let extractedCount = 0;
    let i = 0;
    while (i < cellData.length) {
      const size = cellData[i++];
      if (size < 2) { 
        i += size; 
        continue; 
      }
      const line = []; 
      const currentLineVectors = []; 
      const pointIds = [];
      for (let j = 0; j < size; j++) {
        const pointId = cellData[i++];
        pointIds.push(pointId);
        if (pointId * 3 + 2 >= points.length) { 
          console.warn(`点索引 ${pointId} 超出范围 (点数: ${points.length / 3})`); 
          continue; 
        }
        line.push([points[pointId * 3], points[pointId * 3 + 1], points[pointId * 3 + 2]]);
      }
      if (line.length < 2) continue; 
      let hasValidVelocity = false;
      for (let k = 0; k < pointIds.length; k++) { 
        const pointId = pointIds[k];
        let vector = [0, 0, 0]; 
        let magnitude = 0; 
        let valid = false;
        if (velocityData && velocityData.getData && pointId * 3 + 2 < velocityData.getData().length) {
          const vx = velocityData.getData()[pointId * 3]; 
          const vy = velocityData.getData()[pointId * 3 + 1]; 
          const vz = velocityData.getData()[pointId * 3 + 2];
          magnitude = Math.sqrt(vx*vx + vy*vy + vz*vz);
          if (magnitude > 0.0001) { 
            vector = [vx, vy, vz]; 
            valid = true; 
            hasValidVelocity = true; 
            allVelocities.push(magnitude); 
          }
        }
        currentLineVectors.push({ vector, magnitude, valid });
      }
      streamlines.push(line);
      flowVectors.push(currentLineVectors); 
      extractedCount++;
      if (!hasValidVelocity && line.length > 1) {
        const defaultVectors = [];
        for (let j = 0; j < line.length; j++) {
          if (j < line.length - 1) {
            const current = line[j]; 
            const next = line[j + 1];
            const dx = next[0] - current[0]; 
            const dy = next[1] - current[1]; 
            const dz = next[2] - current[2];
            const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (len > 0.0001) {
              defaultVectors.push({ vector: [dx/len, dy/len, dz/len], magnitude: len, valid: true });
              allVelocities.push(len);
            } else { 
              defaultVectors.push({ vector: [0, 0, 1], magnitude: 0.01, valid: true }); 
              allVelocities.push(0.01); 
            }
          } else { 
            if (defaultVectors.length > 0) defaultVectors.push({...defaultVectors[defaultVectors.length - 1]});
            else { 
              defaultVectors.push({ vector: [0, 0, 1], magnitude: 0.01, valid: true }); 
              allVelocities.push(0.01); 
            }
          }
        }
        if (flowVectors.length > 0) flowVectors[flowVectors.length - 1] = defaultVectors;
      }
    }
    return extractedCount;
  }
  
  function extractStreamlinesFromVTP() {
    streamlines = []; 
    flowVectors = []; 
    allVelocities = [];
    if (!streamlinesData) return;
    
    let velocityData = null;
    try {
      const pointData = streamlinesData.getPointData();
      const velocityFieldNames = ['U', 'Velocity', 'velocity', 'V', 'v', 'vel'];
      for (const name of velocityFieldNames) {
        try {
          const array = pointData.getArray(name);
          if (array) { 
            velocityData = array; 
            console.log(`找到速度场数据: ${name}, 包含${array.getNumberOfComponents()}分量`); 
            break; 
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) { console.warn("获取点数据失败:", e); }
    
    const points = streamlinesData.getPoints().getData();
    let extractedCount = 0;
    
    try {
      const lines = streamlinesData.getLines();
      if (lines && lines.getData && lines.getData().length > 0) {
        console.log("从线段数据中提取流线...");
        extractedCount = extractStreamlinesFromCellData(lines.getData(), points, velocityData);
        if (extractedCount > 0) console.log(`成功从线段数据中提取了 ${extractedCount} 条流线`);
        else console.log("在线段数据中未找到流线。");
      } else console.log("无有效的线段数据。");
    } catch (e) { console.warn("从线段数据提取失败:", e); }
    
    if (extractedCount === 0) {
      try {
        const polys = streamlinesData.getPolys();
        if (polys && polys.getData && polys.getData().length > 0) {
          console.log("从多边形数据中提取流线...");
          extractedCount = extractStreamlinesFromCellData(polys.getData(), points, velocityData);
          if (extractedCount > 0) console.log(`成功从多边形数据中提取了 ${extractedCount} 条流线`);
          else console.log("在多边形数据中未找到流线。");
        } else console.log("无有效的多边形数据。");
      } catch (e) { console.warn("从多边形数据提取失败:", e); }
    }
    
    if (extractedCount === 0 || streamlines.length === 0) {
      console.log("未从单元数据中提取到流线，尝试从点云重建...");
      rebuildStreamlinesFromPointCloud(); 
    }
    
    if (allVelocities.length > 0) allVelocities.sort((a, b) => a - b);
    updateSpeedFilters();
    validateAndFixStreamlines();
  }

  function rebuildStreamlinesFromPointCloud() {
    try {
      const points = streamlinesData.getPoints().getData();
      const nPoints = streamlinesData.getNumberOfPoints();
      const pointData = streamlinesData.getPointData();
      let velocityData = null;
      try {
        const velocityFieldNames = ['U', 'Velocity', 'velocity', 'V', 'v', 'vel'];
        for (const name of velocityFieldNames) {
          const array = pointData.getArray(name);
          if (array) { velocityData = array; break; }
        }
      } catch (e) { /* ignore */ }
      const pointCloud = [];
      for (let i = 0; i < nPoints; i++) {
        if (i * 3 + 2 >= points.length) continue;
        const point = [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
        let velocity = [0, 0, 0]; let speed = 0; let validVelocity = false;
        if (velocityData && velocityData.getData && i * 3 + 2 < velocityData.getData().length) {
          const vx = velocityData.getData()[i * 3]; const vy = velocityData.getData()[i * 3 + 1]; const vz = velocityData.getData()[i * 3 + 2];
          speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
          if (speed > 0.0001) { velocity = [vx, vy, vz]; validVelocity = true; allVelocities.push(speed); }
        }
        pointCloud.push({ point, velocity, speed, validVelocity, used: false });
      }
      pointCloud.sort((a, b) => b.speed - a.speed);
      const maxStreamlines = 2000; const pointsPerLine = 50;    
      const gridSize = 50; const bounds = streamlinesData.getBounds();
      const grid = createSpatialGrid(pointCloud, bounds, gridSize);
      for (let i = 0; i < pointCloud.length && streamlines.length < maxStreamlines; i++) {
        const startPoint = pointCloud[i];
        if (startPoint.used || !startPoint.validVelocity) continue;
        startPoint.used = true;
        const line = [startPoint.point];
        const vectors = [{ vector: startPoint.velocity, magnitude: startPoint.speed, valid: true }];
        let currentPoint = startPoint;
        for (let j = 1; j < pointsPerLine; j++) {
          const step = 0.1; 
          const nextPos = [ currentPoint.point[0] + currentPoint.velocity[0] * step, currentPoint.point[1] + currentPoint.velocity[1] * step, currentPoint.point[2] + currentPoint.velocity[2] * step ];
          const nearest = findNearestPointInGrid(nextPos, grid, bounds, gridSize, 0.2);
          if (nearest && !nearest.used && nearest.validVelocity) {
            line.push(nearest.point);
            vectors.push({ vector: nearest.velocity, magnitude: nearest.speed, valid: true });
            nearest.used = true; currentPoint = nearest;
          } else break;
        }
        if (line.length >= 3) { streamlines.push(line); flowVectors.push(vectors); }
      }
      console.log(`高级方法重建了 ${streamlines.length} 条流线`);
    } catch (e) { console.error("重建流线失败:", e); }
  }

  function createSpatialGrid(points, bounds, gridSize) {
    const grid = {};
    const size = [bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4]];
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (size[0] === 0 || size[1] === 0 || size[2] === 0) continue;
      const ix = Math.floor(gridSize * (point.point[0] - bounds[0]) / size[0]);
      const iy = Math.floor(gridSize * (point.point[1] - bounds[2]) / size[1]);
      const iz = Math.floor(gridSize * (point.point[2] - bounds[4]) / size[2]);
      const key = `${ix},${iy},${iz}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(point);
    }
    return grid;
  }

  function findNearestPointInGrid(pos, grid, bounds, gridSize, maxDist) {
    const size = [bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4]];
    if (size[0] === 0 || size[1] === 0 || size[2] === 0) return null;
    const ix = Math.floor(gridSize * (pos[0] - bounds[0]) / size[0]);
    const iy = Math.floor(gridSize * (pos[1] - bounds[2]) / size[1]);
    const iz = Math.floor(gridSize * (pos[2] - bounds[4]) / size[2]);
    let nearest = null; let minDistSq = maxDist * maxDist; 
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${ix+dx},${iy+dy},${iz+dz}`;
          if (grid[key]) {
            for (const point of grid[key]) {
              const distSq = Math.pow(pos[0] - point.point[0], 2) + Math.pow(pos[1] - point.point[1], 2) + Math.pow(pos[2] - point.point[2], 2);
              if (distSq < minDistSq) { minDistSq = distSq; nearest = point; }
            }
          }
        }
      }
    }
    return nearest;
  }

  function validateAndFixStreamlines() {
    for (let i = 0; i < streamlines.length; i++) {
      const line = streamlines[i]; const vectors = flowVectors[i];
      if (line.length < 2 || vectors.length < 2) continue;
      let consistentDirectionCount = 0; let inconsistentDirectionCount = 0;
      for (let j = 1; j < line.length; j++) {
        const p0 = line[j-1]; const p1 = line[j];
        if (vectors[j-1] && vectors[j-1].valid && vectors[j] && vectors[j].valid) { 
          const v0 = vectors[j-1].vector; 
          const segDir = [ p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2] ];
          const segLen = Math.sqrt(segDir[0]*segDir[0] + segDir[1]*segDir[1] + segDir[2]*segDir[2]);
          if (segLen > 0.0001) {
            segDir[0] /= segLen; segDir[1] /= segLen; segDir[2] /= segLen;
            const dotProd = v0[0]*segDir[0] + v0[1]*segDir[1] + v0[2]*segDir[2];
            if (dotProd > 0.1) consistentDirectionCount++;
            else if (dotProd < -0.1) inconsistentDirectionCount++;
          }
        }
      }
      if (inconsistentDirectionCount > consistentDirectionCount && inconsistentDirectionCount > line.length * 0.3) { 
        streamlines[i] = line.reverse();
        const reversedVectors = vectors.reverse(); 
        for (let k = 0; k < reversedVectors.length; k++) {
          if (reversedVectors[k].valid) { 
            reversedVectors[k].vector = [ -reversedVectors[k].vector[0], -reversedVectors[k].vector[1], -reversedVectors[k].vector[2] ];
          }
        }
        flowVectors[i] = reversedVectors;
      }
    }
    console.log("流线验证和修复完成");
  }
  
  function initParticleSystem() {
    try {
      console.log("开始初始化粒子系统，总粒子数目标:", particleCount.value);
      currentColorScheme = colorSchemes[selectedColorScheme.value];
      particles = []; 
      createParticles(); 
      console.log(`成功创建粒子: ${particles.length}/${particleCount.value}`);
      
      if (particles.length === 0 && particleCount.value > 0) {
        console.warn("未能创建任何粒子，请检查流线数据和创建逻辑。");
      }
      
      let particleSource;
      switch (particleStyle.value) {
        case 'arrow':
          try { 
            particleSource = vtkArrowSource.newInstance({ 
              tipResolution: 12, 
              tipRadius: particleSize.value * modelScale * 0.4, 
              tipLength: particleSize.value * modelScale * 1.0, 
              shaftResolution: 12, 
              shaftRadius: particleSize.value * modelScale * 0.15, 
              invert: false 
            }); 
          } 
          catch (e) { 
            console.error("创建箭头源失败，使用锥体替代", e); 
            particleSource = vtkConeSource.newInstance({ 
              height: particleSize.value * modelScale * 1.0, 
              resolution: 12, 
              radius: particleSize.value * modelScale * 0.4 
            }); 
          }
          break;
        case 'sphere': 
        default: 
          particleSource = vtkSphereSource.newInstance({ 
            thetaResolution: 16, 
            phiResolution: 16, 
            radius: particleSize.value * modelScale * 0.4, 
            latLongTessellation: true 
          }); 
          break;
      }
      console.log("粒子几何体创建完成");
      
      const lut = vtkLookupTable.newInstance();
      try {
        lut.setHueRange(currentColorScheme.hueRange[0], currentColorScheme.hueRange[1]);
        const isDarkBg = selectedBg.value !== 'light';
        const valMin = isDarkBg ? 0.7 : 0.6; 
        const valMax = isDarkBg ? 1.0 : 0.85;
        lut.setValueRange(valMin, valMax);
        lut.setSaturationRange(currentColorScheme.satRange[0], currentColorScheme.satRange[1]);
        lut.setAlphaRange(0.9, 1.0); 
        if (typeof lut.build === 'function') lut.build();
      } catch (e) { console.error("设置颜色表失败:", e); }
      
      const particlePolyData = vtkPolyData.newInstance(); 
      const particlePoints = vtkPoints.newInstance();
      particlePolyData.setPoints(particlePoints); 
      updateParticleData(particlePolyData); 
      
      const glyph3DMapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE, 
        scaleArray: 'speed', 
        colorMode: ColorMode.MAP_SCALARS, 
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA, 
        scalarVisibility: true,
        orient: true, 
        orientationMode: vtkGlyph3DMapper.OrientationModes.DIRECTION, 
        orientationArray: 'velocity'
      });
      glyph3DMapper.setInputData(particlePolyData, 0);
      glyph3DMapper.setInputConnection(particleSource.getOutputPort(), 1);
      glyph3DMapper.setLookupTable(lut); 
      glyph3DMapper.setScalarRange(0, 1); 
      
      particlesActor = vtkActor.newInstance(); 
      particlesActor.setMapper(glyph3DMapper);
      particlesActor.getProperty().setOpacity(particleOpacity.value);
      particlesActor.getProperty().setAmbient(0.7); 
      particlesActor.getProperty().setDiffuse(0.9);  
      particlesActor.getProperty().setSpecular(0.9); 
      particlesActor.getProperty().setSpecularPower(5); 
      
      try { 
        particlesActor.getProperty().setEdgeVisibility(true); 
        particlesActor.getProperty().setEdgeColor(1, 1, 1); 
        particlesActor.getProperty().setLineWidth(1.5); 
      } 
      catch (e) { console.warn("设置边缘线条失败", e); }
      
      renderer.addActor(particlesActor); 
      console.log("粒子Actor创建并添加到场景");
      
      if (trailLength.value > 0) { 
        createParticleTrails(); 
        console.log("粒子尾迹创建完成"); 
      } 
      else console.log("尾迹长度为0，跳过尾迹创建");
      
      startParticleAnimation();
    } catch (e) { console.error("初始化粒子系统失败:", e); }
  }
  
  function createParticleTrails() {
    try {
      if (trailsActor) renderer.removeActor(trailsActor);
      if (trailLength.value <= 0) { 
        console.log("尾迹长度为0，不创建尾迹"); 
        return; 
      }
      
      const actualTrailLength = Math.max(1, trailLength.value);
      console.log(`创建尾迹，长度: ${actualTrailLength}`);
      
      const trailsPolyData = vtkPolyData.newInstance(); 
      const trailsPoints = vtkPoints.newInstance();
      trailsPolyData.setPoints(trailsPoints);
      
      const numTrailPoints = particles.length * actualTrailLength;
      trailsPoints.setData(new Float32Array(numTrailPoints * 3)); 
      
      const lineColorsArray = new Float32Array(numTrailPoints * 3);
      const linesArray = new Uint32Array(particles.length * (1 + actualTrailLength));
      
      let pointOffset = 0; 
      let lineOffset = 0;
      for (let i = 0; i < particles.length; i++) {
        linesArray[lineOffset++] = actualTrailLength; 
        for (let j = 0; j < actualTrailLength; j++) linesArray[lineOffset++] = pointOffset + j; 
        pointOffset += actualTrailLength;
      }
      
      trailsPolyData.getLines().setData(linesArray);
      trailsPolyData.getPointData().setScalars(vtkDataArray.newInstance({ 
        name: 'colors', 
        values: lineColorsArray, 
        numberOfComponents: 3 
      }));
      
      const trailsMapper = vtkMapper.newInstance(); 
      trailsMapper.setInputData(trailsPolyData);
      trailsMapper.setColorModeToDirectScalars();
      
      trailsActor = vtkActor.newInstance(); 
      trailsActor.setMapper(trailsMapper);
      trailsActor.getProperty().setOpacity(trailOpacity.value); 
      
      try { 
        trailsActor.getProperty().setLineWidth(2.0); 
      } 
      catch (e) { console.warn("设置线宽失败", e); }
      
      renderer.addActor(trailsActor);
    } catch (e) { console.error("创建粒子尾迹失败:", e); }
  }

  function selectEntryPoint() {
    if (streamlines.length === 0) return 0; 
    if (!globalWindDirection || (globalWindDirection[0] === 0 && globalWindDirection[1] === 0 && globalWindDirection[2] === 0)) {
      analyzeGlobalWindDirection();
    }
    if (!streamlinesData) return Math.floor(Math.random() * streamlines.length); 
    
    const bounds = streamlinesData.getBounds();
    const size = [bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4]];
    const candidates = []; 
    let totalWeight = 0;
    
    for (let i = 0; i < streamlines.length; i++) {
      const line = streamlines[i]; 
      const vectors = flowVectors[i];
      if (line.length === 0 || vectors.length === 0) continue;
      const startPoint = line[0]; 
      let startVector = null; 
      let startSpeed = 0;
      if (vectors[0] && vectors[0].valid) { 
        startVector = vectors[0].vector; 
        startSpeed = vectors[0].magnitude; 
      } 
      else if (line.length > 1) {
        const dx = line[1][0] - startPoint[0]; 
        const dy = line[1][1] - startPoint[1]; 
        const dz = line[1][2] - startPoint[2];
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len > 0) { 
          startVector = [dx/len, dy/len, dz/len]; 
          startSpeed = len; 
        }
      }
      if (!startVector) continue;
      
      const isNearBoundary = ( 
        Math.abs(startPoint[0] - bounds[0]) < size[0] * 0.1 || 
        Math.abs(startPoint[0] - bounds[1]) < size[0] * 0.1 || 
        Math.abs(startPoint[1] - bounds[2]) < size[1] * 0.1 || 
        Math.abs(startPoint[1] - bounds[3]) < size[1] * 0.1 || 
        Math.abs(startPoint[2] - bounds[4]) < size[2] * 0.1 || 
        Math.abs(startPoint[2] - bounds[5]) < size[2] * 0.1 
      );
      
      if (isNearBoundary) {
        const center = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2, (bounds[4] + bounds[5]) / 2];
        const toCenter = [ center[0] - startPoint[0], center[1] - startPoint[1], center[2] - startPoint[2] ];
        const toCenterLength = Math.sqrt(toCenter[0]*toCenter[0] + toCenter[1]*toCenter[1] + toCenter[2]*toCenter[2]);
        if (toCenterLength > 0) {
          toCenter[0] /= toCenterLength; 
          toCenter[1] /= toCenterLength; 
          toCenter[2] /= toCenterLength;
          const dotProd = startVector[0] * toCenter[0] + startVector[1] * toCenter[1] + startVector[2] * toCenter[2];
          if (dotProd > 0.0) {
            let weight = 1.0;
            weight *= (1.0 + startSpeed / (maxVelocityMagnitude > 0 ? maxVelocityMagnitude : 1.0) );
            weight *= (1.0 + dotProd);
            candidates.push({ lineIndex: i, weight: weight }); 
            totalWeight += weight;
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      const random = Math.random() * totalWeight; 
      let accumulatedWeight = 0;
      for (const candidate of candidates) {
        accumulatedWeight += candidate.weight;
        if (random <= accumulatedWeight) return candidate.lineIndex;
      }
      return candidates[candidates.length - 1].lineIndex;
    }
    
    const lowCandidates = [];
    const zThreshold = bounds[4] + size[2] * 0.2; 
    for (let i = 0; i < streamlines.length; i++) {
      const line = streamlines[i];
      if (line.length === 0) continue;
      if (line[0][2] < zThreshold) lowCandidates.push(i);
    }
    if (lowCandidates.length > 0) return lowCandidates[Math.floor(Math.random() * lowCandidates.length)];
    
    return Math.floor(Math.random() * streamlines.length);
  }

  function analyzeGlobalWindDirection() {
    const vectorSum = [0, 0, 0]; 
    let validCount = 0;
    for (const flowLine of flowVectors) {
      for (const vector of flowLine) {
        if (vector.valid) { 
          vectorSum[0] += vector.vector[0]; 
          vectorSum[1] += vector.vector[1]; 
          vectorSum[2] += vector.vector[2]; 
          validCount++; 
        }
      }
    }
    if (validCount > 0) {
      vectorSum[0] /= validCount; 
      vectorSum[1] /= validCount; 
      vectorSum[2] /= validCount;
      const magnitude = Math.sqrt(vectorSum[0]*vectorSum[0] + vectorSum[1]*vectorSum[1] + vectorSum[2]*vectorSum[2]);
      if (magnitude > 0) globalWindDirection = [ vectorSum[0]/magnitude, vectorSum[1]/magnitude, vectorSum[2]/magnitude ];
      else globalWindDirection = [0, 0, 1]; 
    }
  }

  function updateParticleData(polyData) {
    try {
      if (particles.length === 0) { 
        polyData.getPoints().setData(new Float32Array(0), 3);
        if (polyData.getPointData().hasArray('velocity')) polyData.getPointData().removeArray('velocity');
        if (polyData.getPointData().hasArray('speed')) polyData.getPointData().removeArray('speed');
        polyData.modified(); 
        return;
      }
      
      const positions = new Float32Array(particles.length * 3);
      const velocities = new Float32Array(particles.length * 3);
      const speeds = new Float32Array(particles.length); 
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        positions[i * 3] = p.position[0]; 
        positions[i * 3 + 1] = p.position[1]; 
        positions[i * 3 + 2] = p.position[2];
        velocities[i * 3] = p.velocity[0]; 
        velocities[i * 3 + 1] = p.velocity[1]; 
        velocities[i * 3 + 2] = p.velocity[2];
        speeds[i] = p.normalizedSpeed; 
      }
      
      polyData.getPoints().setData(positions, 3);
      
      let velocityArray = polyData.getPointData().getArray('velocity');
      if (!velocityArray) { 
        velocityArray = vtkDataArray.newInstance({ 
          name: 'velocity', 
          values: velocities, 
          numberOfComponents: 3 
        }); 
        polyData.getPointData().addArray(velocityArray); 
      } 
      else velocityArray.setData(velocities);
      
      let speedArray = polyData.getPointData().getArray('speed');
      if (!speedArray) { 
        speedArray = vtkDataArray.newInstance({ 
          name: 'speed', 
          values: speeds, 
          numberOfComponents: 1 
        }); 
        polyData.getPointData().addArray(speedArray); 
      } 
      else speedArray.setData(speeds);
      
      polyData.getPointData().setActiveScalars('speed'); 
      polyData.modified();
    } catch (e) { console.error("更新粒子数据失败:", e); }
  }
  
  function createParticles() {
    if (streamlines.length === 0) { 
      console.warn("无法创建粒子: 没有可用的流线。"); 
      particles = []; 
      return; 
    }
    try {
      particles = [];
      console.log(`开始创建粒子，目标数量: ${particleCount.value}`);
      let totalParticlesCreated = 0; 
      const lineInfos = []; 
      let totalLength = 0; 
      
      for (let i = 0; i < streamlines.length; i++) {
        const line = streamlines[i]; 
        let lineLength = 0;
        if (line.length > 1) {
          for (let j = 1; j < line.length; j++) {
            const p0 = line[j-1]; 
            const p1 = line[j];
            const dx = p1[0] - p0[0]; 
            const dy = p1[1] - p0[1]; 
            const dz = p1[2] - p0[2];
            lineLength += Math.sqrt(dx*dx + dy*dy + dz*dz);
          }
        }
        lineInfos.push({ index: i, length: lineLength }); 
        totalLength += lineLength;
      }
      
      console.log(`用于粒子分布的总流线数: ${lineInfos.length}, 总长度: ${totalLength.toFixed(2)}`);
      
      if (lineInfos.length === 0) { 
        console.warn("没有流线信息可用于创建粒子。"); 
        return; 
      }
      
      const particlesPerStreamlineBase = Math.floor(particleCount.value / lineInfos.length);
      let remainderParticles = particleCount.value % lineInfos.length;
      
      for (let i = 0; i < lineInfos.length; i++) {
        const info = lineInfos[i]; 
        let countForThisLine = particlesPerStreamlineBase;
        if (remainderParticles > 0) { 
          countForThisLine++; 
          remainderParticles--; 
        }
        if (countForThisLine > 0) { 
          createParticlesForLine(info.index, countForThisLine, info); 
          totalParticlesCreated += countForThisLine; 
        }
      }
      
      console.log(`完成粒子创建，实际创建数量: ${particles.length}`);
      
      if (particles.length > 0 && particles.length < particleCount.value * 0.5) {
        console.warn(`实际粒子数(${particles.length})远少于目标数(${particleCount.value})`);
      }
      
      if (particles.length === 0 && particleCount.value > 0) { 
        console.error("无法创建粒子，添加一个调试粒子");
        if (streamlinesData) { 
            const bounds = streamlinesData.getBounds();
            const center = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2, (bounds[4] + bounds[5]) / 2];
            particles.push({
              lineIndex: 0, 
              segmentIndex: 0, 
              t: 0, 
              position: center, 
              velocity: [0, 0, 1], 
              speed: maxVelocityMagnitude, 
              normalizedSpeed: 1.0,
              pathPosition: 0, 
              originalPosition: [...center], 
              originalSegmentIndex: 0, 
              originalT: 0,
              trail: Array(Math.max(1, trailLength.value)).fill().map(() => [...center]),
              sizeScale: 10.0, 
              isDebugParticle: true, 
              launchDelay: 0, 
              hasLaunched: true
            });
        } else console.warn("streamlinesData is not available to create a debug particle.");
      }
    } catch (e) { console.error("创建粒子失败:", e); }
  }
  
  function createParticlesForLine(lineIndex, count, lineInfo) {
    try {
      const line = streamlines[lineIndex];
      const vectors = flowVectors[lineIndex];
      
      if (line.length < 2) {
        if (line.length === 1 && count > 0) {
          const position = [...line[0]];
          let velocity = [0,0,1]; 
          let speed = 0.1; 
          let normalizedSpeed = 0.5;
          if (vectors && vectors.length > 0 && vectors[0] && vectors[0].valid) {
            velocity = [...vectors[0].vector]; 
            speed = vectors[0].magnitude;
            normalizedSpeed = Math.max(0, Math.min(1, (speed - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude || 1)));
          }
          for (let i = 0; i < count; i++) {
            particles.push({
              lineIndex, 
              segmentIndex: 0, 
              t: 0, 
              position, 
              velocity, 
              speed, 
              normalizedSpeed,
              pathPosition: 0, 
              originalPosition: [...position], 
              originalSegmentIndex: 0, 
              originalT: 0,
              trail: Array(Math.max(1, trailLength.value)).fill().map(() => [...position]),
              sizeScale: 1.0, 
              isDebugParticle: false, 
              launchDelay: Math.random() * 0.5, 
              hasLaunched: false
            });
          }
        }
        return; 
      }
  
      const maxStartingSegments = Math.min(6, line.length - 1); 
      const segmentDistances = []; 
      let totalStartingDistance = 0;
      for (let i = 0; i < maxStartingSegments; i++) {
        const p0 = line[i]; 
        const p1 = line[i + 1];
        const dist = distance3D(p0, p1);
        segmentDistances.push(dist); 
        totalStartingDistance += dist;
      }
  
      for (let i = 0; i < count; i++) {
        let segmentIndex = 0; 
        let t_interp = 0; 
        let position = [...line[0]];
        if (totalStartingDistance > 0.0001) {
          const bias = Math.pow(Math.random(), 2.0); 
          const randomDistance = bias * totalStartingDistance;
          let accumulatedDistance = 0;
          for (let j = 0; j < segmentDistances.length; j++) {
            if (accumulatedDistance + segmentDistances[j] >= randomDistance) {
              segmentIndex = j;
              const distanceIntoSegment = randomDistance - accumulatedDistance;
              t_interp = segmentDistances[j] > 0.0001 ? distanceIntoSegment / segmentDistances[j] : 0;
              break;
            }
            accumulatedDistance += segmentDistances[j];
          }
          t_interp = Math.max(0, Math.min(1, t_interp));
          const p0_seg = line[segmentIndex]; 
          const p1_seg = line[segmentIndex + 1];
          position = [ 
            p0_seg[0] + t_interp * (p1_seg[0] - p0_seg[0]), 
            p0_seg[1] + t_interp * (p1_seg[1] - p0_seg[1]), 
            p0_seg[2] + t_interp * (p1_seg[2] - p0_seg[2]) 
          ];
        } else {
          segmentIndex = 0; 
          t_interp = Math.random() * 0.05; 
          const p0_seg = line[0]; 
          const p1_seg = line[1];
          position = [ 
            p0_seg[0] + t_interp * (p1_seg[0] - p0_seg[0]), 
            p0_seg[1] + t_interp * (p1_seg[1] - p0_seg[1]), 
            p0_seg[2] + t_interp * (p1_seg[2] - p0_seg[2]) 
          ];
        }
  
        let velocity = [0, 0, 1]; 
        let speed = 0.1; 
        let normalizedSpeed = 0.5;
        if (vectors && vectors.length > segmentIndex && vectors[segmentIndex] && vectors[segmentIndex].valid) {
          const vStart = vectors[segmentIndex];
          const vEnd = (segmentIndex + 1 < vectors.length && vectors[segmentIndex+1] && vectors[segmentIndex+1].valid) ? vectors[segmentIndex+1] : vStart;
          velocity = [ 
            vStart.vector[0] + t_interp * (vEnd.vector[0] - vStart.vector[0]), 
            vStart.vector[1] + t_interp * (vEnd.vector[1] - vStart.vector[1]), 
            vStart.vector[2] + t_interp * (vEnd.vector[2] - vStart.vector[2]) 
          ];
          speed = Math.sqrt(velocity[0]*velocity[0] + velocity[1]*velocity[1] + velocity[2]*velocity[2]);
          normalizedSpeed = Math.max(0, Math.min(1, (speed - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude || 1)));
          
          if (speed < 0.0001 && line.length > segmentIndex + 1) { 
            const p0_vel = line[segmentIndex]; 
            const p1_vel = line[segmentIndex + 1];
            const dx = p1_vel[0] - p0_vel[0]; 
            const dy = p1_vel[1] - p0_vel[1]; 
            const dz = p1_vel[2] - p0_vel[2];
            const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (len > 0.0001) velocity = [dx/len, dy/len, dz/len];
          }
        } else if (line.length > segmentIndex + 1) {
            const p0_vel = line[segmentIndex]; 
            const p1_vel = line[segmentIndex + 1];
            const dx = p1_vel[0] - p0_vel[0]; 
            const dy = p1_vel[1] - p0_vel[1]; 
            const dz = p1_vel[2] - p0_vel[2];
            const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (len > 0.0001) { 
              velocity = [dx/len, dy/len, dz/len]; 
              speed = len; 
              normalizedSpeed = Math.max(0, Math.min(1, (speed - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude || 1))); 
            }
        }
        
        const baseSizeScale = 0.9 + 0.2 * Math.sqrt(normalizedSpeed); 
        const sizeScale = Math.max(0.8, Math.min(1.1, baseSizeScale));
        
        const currentSegmentActualLength = segmentIndex < segmentDistances.length ? segmentDistances[segmentIndex] : (line.length > 1 ? distance3D(line[0], line[1]) : 0.1);
        const actualTForParticle = t_interp * currentSegmentActualLength; 
        
        particles.push({
          lineIndex, 
          segmentIndex, 
          t: actualTForParticle, 
          position, 
          velocity, 
          speed, 
          normalizedSpeed,
          pathPosition: actualTForParticle, 
          originalPosition: [...position], 
          originalSegmentIndex: segmentIndex, 
          originalT: actualTForParticle,
          trail: Array(Math.max(1, trailLength.value)).fill().map(() => [...position]),
          sizeScale: sizeScale, 
          isDebugParticle: false, 
          launchDelay: Math.random() * 0.5, 
          hasLaunched: false
        });
      }
    } catch (e) { console.error(`为流线 ${lineIndex} 创建粒子失败:`, e); }
  }
  
  function startParticleAnimation() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    let lastTime = performance.now(); 
    const targetFrameTime = 1000 / 60; 
    let localFrameCount = 0;
    
    function animate() {
      try {
        const now = performance.now(); 
        const deltaTime = now - lastTime; 
        lastTime = now;
        const speedFactor = Math.min(2.0, Math.max(0.5, deltaTime / targetFrameTime));
        updateParticlePositions(speedFactor, deltaTime / 1000); 
        safeRender();
        
        if (localFrameCount % 100 === 0) {
          if (particles.length < particleCount.value * 0.5 && !isRebuildingParticles && particleCount.value > 0) {
            console.warn(`粒子数量异常减少: ${particles.length}/${particleCount.value}, 重新创建粒子`);
            isRebuildingParticles = true;
            setTimeout(() => { 
              try { updateParticles(); } 
              finally { 
                setTimeout(() => { isRebuildingParticles = false; }, 5000); 
              } 
            }, 100);
          }
        }
        localFrameCount++; 
        animationFrameId = requestAnimationFrame(animate);
      } catch (e) { 
        console.error("粒子动画更新失败:", e); 
        setTimeout(() => { animationFrameId = requestAnimationFrame(animate); }, 1000); 
      }
    }
    animationFrameId = requestAnimationFrame(animate);
  }

  function updateParticlePositions(speedFactor = 1.0, deltaTimeSeconds = 0.016) {
    if (!streamlinesData || !particlesActor || particles.length === 0 || streamlines.length === 0) return;
    try {
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        if (particle.isDebugParticle) continue;
        if (!particle.hasLaunched) {
          particle.launchDelay -= deltaTimeSeconds; 
          if (particle.launchDelay <= 0) particle.hasLaunched = true;
          else continue; 
        }
        
        let moveDistance = 0.003 * particleSpeed.value * particle.normalizedSpeed * speedFactor;
        
        const oldPosition = [...particle.position];
        particle.t += moveDistance; 
        particle.pathPosition += moveDistance; 
        
        let currentLine = streamlines[particle.lineIndex];
        let currentVectors = flowVectors[particle.lineIndex];

        if (!currentLine || !currentVectors) {
            particle.position = [...particle.originalPosition];
            particle.segmentIndex = particle.originalSegmentIndex;
            particle.t = particle.originalT;
            particle.pathPosition = particle.originalT;
            particle.trail = Array(Math.max(1, trailLength.value)).fill().map(() => [...particle.originalPosition]);
            console.warn(`Particle ${i} on invalid streamline, reset to original.`);
            continue; 
        }

        let segmentLength = 0;
        if (particle.segmentIndex < currentLine.length -1) {
            const p0_seg = currentLine[particle.segmentIndex];
            const p1_seg = currentLine[particle.segmentIndex + 1];
            segmentLength = distance3D(p0_seg, p1_seg);
        } else segmentLength = 0.0001; 
        
        let jumpOccurred = false;
        while (particle.t >= segmentLength && segmentLength > 0.00001) { 
          particle.t -= segmentLength;
          particle.segmentIndex++;
          jumpOccurred = true;

          if (particle.segmentIndex >= currentLine.length - 1) { 
            particle.position = [...particle.originalPosition];
            particle.segmentIndex = particle.originalSegmentIndex;
            particle.t = particle.originalT;
            particle.pathPosition = particle.originalT;
            if (resetTrailsOnJump.value) { 
              particle.trail = Array(Math.max(1, trailLength.value)).fill().map(() => [...particle.originalPosition]);
            }
            
            if (particle.segmentIndex < currentLine.length -1) {
                const p0_new_seg = currentLine[particle.segmentIndex];
                const p1_new_seg = currentLine[particle.segmentIndex + 1];
                segmentLength = distance3D(p0_new_seg, p1_new_seg);
            } else segmentLength = 0.0001; 
            if (!(particle.t >= segmentLength && segmentLength > 0.00001)) break; 
          } else {
              const p0_next_seg = currentLine[particle.segmentIndex];
              const p1_next_seg = currentLine[particle.segmentIndex + 1];
              segmentLength = distance3D(p0_next_seg, p1_next_seg);
          }
        }
        
        if (currentLine && particle.segmentIndex < currentLine.length - 1) { 
          const p0 = currentLine[particle.segmentIndex];
          const p1 = currentLine[particle.segmentIndex + 1];
          const currentSegLen = distance3D(p0,p1); 
          const t_interp = (currentSegLen > 0.0001) ? Math.min(1.0, Math.max(0.0, particle.t / currentSegLen)) : 0.0;
          particle.position = [ 
            p0[0] + t_interp * (p1[0] - p0[0]), 
            p0[1] + t_interp * (p1[1] - p0[1]), 
            p0[2] + t_interp * (p1[2] - p0[2]) 
          ];
          
          const distMoved = distance3D(particle.position, oldPosition);
          if (!jumpOccurred && distMoved > modelScale * 3) { 
              particle.position = [...particle.originalPosition]; 
              particle.segmentIndex = particle.originalSegmentIndex; 
              particle.t = particle.originalT; 
              particle.pathPosition = particle.originalT;
              particle.trail = Array(Math.max(1, trailLength.value)).fill().map(() => [...particle.originalPosition]);
          }
          
          if (currentVectors && particle.segmentIndex < currentVectors.length && currentVectors[particle.segmentIndex]) { 
              const v0_data = currentVectors[particle.segmentIndex];
              const v1_data = (particle.segmentIndex + 1 < currentVectors.length && currentVectors[particle.segmentIndex+1]) ? currentVectors[particle.segmentIndex + 1] : v0_data;
              if (v0_data.valid && v1_data.valid) {
                  const rawVelocity = [ 
                    v0_data.vector[0] + t_interp * (v1_data.vector[0] - v0_data.vector[0]), 
                    v0_data.vector[1] + t_interp * (v1_data.vector[1] - v0_data.vector[1]), 
                    v0_data.vector[2] + t_interp * (v1_data.vector[2] - v0_data.vector[2]) 
                  ];
                  const speedVal = Math.sqrt(rawVelocity[0]*rawVelocity[0] + rawVelocity[1]*rawVelocity[1] + rawVelocity[2]*rawVelocity[2]);
                  particle.speed = speedVal;
                  particle.normalizedSpeed = Math.max(0, Math.min(1, (speedVal - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude || 1)));
                  particle.velocity = [...rawVelocity]; 
                  const newSizeScale = 0.9 + 0.2 * Math.sqrt(particle.normalizedSpeed);
                  particle.sizeScale = particle.sizeScale * 0.95 + newSizeScale * 0.05; 
                  particle.sizeScale = Math.max(0.8, Math.min(1.1, particle.sizeScale));
              } else { 
                   particle.velocity = normalizeVector([p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]]);
                   particle.speed = currentSegLen > 0 ? currentSegLen : 0.1; 
                   particle.normalizedSpeed = 0.5;
              }
          } else { 
              particle.velocity = normalizeVector([p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]]);
              particle.speed = currentSegLen > 0 ? currentSegLen : 0.1; 
              particle.normalizedSpeed = 0.5;
          }
        } else { 
          if (currentLine && currentLine.length > 0) particle.position = [...currentLine[currentLine.length - 1]];
        }
        
        if (trailLength.value > 0 && (!jumpOccurred || !resetTrailsOnJump.value)) {
          particle.trail.unshift([...particle.position]);
          if (particle.trail.length > trailLength.value) particle.trail.pop();
        }
      }
      
      const polyData = particlesActor.getMapper().getInputData(0);
      updateParticleData(polyData); 
      if (trailsActor && trailLength.value > 0) updateTrails();
    } catch (e) { console.error("更新粒子位置失败:", e); }
  }
  
  function updateTrails() {
    try {
      if (trailLength.value <= 0 || !trailsActor || !particles.length) {
        if (trailsActor) { 
            const trailsPolyData = trailsActor.getMapper().getInputData();
            trailsPolyData.getPoints().setData(new Float32Array(0), 3);
            trailsPolyData.getLines().setData(new Uint32Array(0));
            if (trailsPolyData.getPointData().getScalars()) trailsPolyData.getPointData().getScalars().setData(new Float32Array(0));
            trailsPolyData.modified();
        }
        return;
      }
      
      const trailsPolyData = trailsActor.getMapper().getInputData();
      const points = trailsPolyData.getPoints();
      const numTotalTrailPoints = particles.length * trailLength.value;
      let pointsData = points.getData();
      if (!pointsData || pointsData.length !== numTotalTrailPoints * 3) {
        pointsData = new Float32Array(numTotalTrailPoints * 3);
      }
      
      let colorsArray = trailsPolyData.getPointData().getScalars();
      let colorsData;
      if (!colorsArray || !colorsArray.getData() || colorsArray.getData().length !== numTotalTrailPoints * 3) {
        colorsData = new Float32Array(numTotalTrailPoints * 3);
      } else colorsData = colorsArray.getData();
      
      let pointBufferIndex = 0;
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        if (!particle.trail || particle.trail.length === 0 || !particle.hasLaunched) { 
          const posToUse = particle.hasLaunched && particle.position ? particle.position : (particle.trail && particle.trail.length > 0 ? particle.trail[0] : [0,0,0]);
          for (let j = 0; j < trailLength.value; j++) {
            const idx = pointBufferIndex * 3;
            pointsData[idx] = posToUse[0]; 
            pointsData[idx + 1] = posToUse[1]; 
            pointsData[idx + 2] = posToUse[2];
            colorsData[idx] = 0; 
            colorsData[idx+1] = 0; 
            colorsData[idx+2] = 0; 
            pointBufferIndex++;
          }
          continue;
        }
        
        for (let j = 0; j < trailLength.value; j++) {
          const trailPoint = j < particle.trail.length ? particle.trail[j] : particle.trail[particle.trail.length - 1];
          if (!trailPoint) { 
             const idx = pointBufferIndex * 3;
             pointsData[idx] = particle.position[0]; 
             pointsData[idx+1] = particle.position[1]; 
             pointsData[idx+2] = particle.position[2];
             colorsData[idx] = 0; 
             colorsData[idx+1] = 0; 
             colorsData[idx+2] = 0;
             pointBufferIndex++; 
             continue;
          }
          
          const index = pointBufferIndex * 3;
          pointsData[index] = trailPoint[0]; 
          pointsData[index + 1] = trailPoint[1]; 
          pointsData[index + 2] = trailPoint[2];
          
          const fadeRatio = j / Math.max(1, trailLength.value - 1);
          const fadeEffect = Math.pow(1 - fadeRatio, 1.5); 
          let r, g, b;
          if (useColorSpeed.value) {
            const speedRatio = particle.normalizedSpeed;
            if (selectedColorScheme.value === 'blueRed' || selectedColorScheme.value === 'rainbow' || selectedColorScheme.value === 'analytical') {
              r = speedRatio; 
              g = 0.1 * (1 - speedRatio); 
              b = 1 - speedRatio; 
            } else if (selectedColorScheme.value === 'plasma') {
              r = 0.5 + 0.5 * speedRatio; 
              g = 0.2 * speedRatio; 
              b = 0.8 - 0.6 * speedRatio;
            } else { 
              r = speedRatio; 
              g = 0; 
              b = 1 - speedRatio; 
            }
          } else { 
            r = 0.5; 
            g = 0.5; 
            b = 0.8; 
          } 
          
          r *= fadeEffect; 
          g *= fadeEffect; 
          b *= fadeEffect;
          
          const brightness = 1.0; 
          r *= brightness; 
          g *= brightness; 
          b *= brightness;
          
          colorsData[index] = Math.min(1.0, Math.max(0,r));
          colorsData[index + 1] = Math.min(1.0, Math.max(0,g));
          colorsData[index + 2] = Math.min(1.0, Math.max(0,b));
          pointBufferIndex++;
        }
      }
      
    points.setData(pointsData, 3);
    if (colorsArray && colorsArray.setData) colorsArray.setData(colorsData); 
    else trailsPolyData.getPointData().setScalars(vtkDataArray.newInstance({
      name: 'colors', 
      values: colorsData, 
      numberOfComponents: 3
    }));
    trailsPolyData.modified();
  } catch (e) { console.error("更新尾迹失败:", e); }
}

function updateParticleColors() {
  try {
    if (particlesActor) {
      const polyData = particlesActor.getMapper().getInputData(0);
      updateParticleData(polyData); 
    }
    if (trailsActor && trailLength.value > 0) updateTrails();
    safeRender();
  } catch (e) { console.error("更新粒子颜色失败:", e); }
}

function updateParticleShape() {
  try {
    if (streamlinesData && particlesActor) {
      if (particlesActor) { renderer.removeActor(particlesActor); particlesActor = null; }
      if (trailsActor) { renderer.removeActor(trailsActor); trailsActor = null; }
      initParticleSystem(); 
    }
  } catch (e) { console.error("更新粒子形状失败:", e); }
}

function updateParticles() {
  try {
    if (streamlinesData) { 
      if (particlesActor) { renderer.removeActor(particlesActor); particlesActor = null; }
      if (trailsActor) { renderer.removeActor(trailsActor); trailsActor = null; }
      initParticleSystem(); 
    }
  } catch (e) { console.error("更新粒子数量失败:", e); }
}

function updateParticleSpeed() { safeRender(); }

function updateParticleSize() {
  try {
    if (particlesActor) { updateParticleShape(); safeRender(); }
  } catch (e) { console.error("更新粒子大小失败:", e); }
}

function updateVisibility() {
  try {
    if (streamlinesActor) { streamlinesActor.setVisibility(showLines.value); safeRender(); }
  } catch (e) { console.error("更新可见性失败:", e); }
}

onMounted(async () => {
  try {
    // Wait for DOM to be ready
    await nextTick();
    
    // Ensure container is available
    if (!vtkContainer.value) {
      console.error("VTK container element not found");
      return;
    }

    const rendererInitialized = initRenderer();
    if (rendererInitialized) {
      // Apply analytical defaults after renderer init
      const analyticalStyle = visualStyles.analytical;
      particleStyle.value = analyticalStyle.particleStyle;
      trailLength.value = analyticalStyle.trailLength;
      selectedBg.value = analyticalStyle.bg;
      selectedColorScheme.value = analyticalStyle.colorScheme;
      updateBackground(); // Apply background first
      currentColorScheme = colorSchemes[selectedColorScheme.value]; // Set current scheme

      loadData(); 
      window.addEventListener('resize', () => { 
        if (fullScreenRenderer) fullScreenRenderer.resize(); 
      });
    } else {
      // Retry initialization after a short delay
      setTimeout(() => {
        const retryInit = initRenderer();
        if (retryInit) {
          const analyticalStyle = visualStyles.analytical;
          particleStyle.value = analyticalStyle.particleStyle;
          trailLength.value = analyticalStyle.trailLength;
          selectedBg.value = analyticalStyle.bg;
          selectedColorScheme.value = analyticalStyle.colorScheme;
          updateBackground();
          currentColorScheme = colorSchemes[selectedColorScheme.value];
          loadData();
          window.addEventListener('resize', () => { 
            if (fullScreenRenderer) fullScreenRenderer.resize(); 
          });
        }
      }, 100);
    }
  } catch (e) { 
    console.error("组件挂载初始化失败:", e); 
  }
});
onBeforeUnmount(() => {
  try {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (fullScreenRenderer) { 
      try { fullScreenRenderer.delete(); } 
      catch (e) { console.warn("删除渲染器失败:", e); } 
    }
    window.removeEventListener('resize', () => {});
  } catch (e) { console.error("组件卸载清理失败:", e); }
});
</script>

<style scoped>
.flow-particle-test {
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

.controls:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.control-tabs {
  display: flex;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(248, 249, 250, 0.8);
  border-radius: 12px 12px 0 0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 14px 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  opacity: 0.6;
  transition: all 0.3s ease;
  border-bottom: 2px solid transparent;
  color: #666;
  user-select: none;
}

.tab.active {
  opacity: 1;
  border-color: #007bff;
  color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.tab:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
  opacity: 0.8;
}

.control-content {
  padding: 20px;
}

.controls div {
  margin-bottom: 16px;
}

.controls div:last-child {
  margin-bottom: 0;
}

.controls label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: #444;
}

.controls input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e9ecef;
  outline: none;
  margin: 8px 0;
  accent-color: #007bff;
  cursor: pointer;
}

.controls input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.range-value {
  display: inline-block;
  background: #f8f9fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
  border: 1px solid #e9ecef;
}

.controls select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  background: white;
  color: #333;
  border: 1px solid #dee2e6;
  font-size: 13px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.controls select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.controls input[type="color"] {
  width: 50px;
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  background: white;
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

.legend {
  position: absolute;
  bottom: 30px;
  right: 30px;
  width: 220px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
}

.legend-title {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  text-align: center;
}

.legend-gradient {
  width: 100%;
  height: 16px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  margin-bottom: 8px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 11px;
  color: #6c757d;
  font-weight: 500;
}

.controls::-webkit-scrollbar { 
  width: 6px; 
}

.controls::-webkit-scrollbar-track { 
  background: rgba(0, 0, 0, 0.05); 
  border-radius: 3px; 
}

.controls::-webkit-scrollbar-thumb { 
  background: rgba(0, 0, 0, 0.2); 
  border-radius: 3px; 
}

.controls::-webkit-scrollbar-thumb:hover { 
  background: rgba(0, 0, 0, 0.3); 
}

@media screen and (max-width: 768px) {
  .controls { 
    width: 280px; 
    max-height: 70vh;
    top: 15px;
    right: 15px;
  }
  
  .legend { 
    width: 180px; 
    bottom: 20px;
    right: 20px;
  }
  
  .legend-labels span { 
    font-size: 10px; 
  }
  
  .control-content {
    padding: 16px;
  }
  
  .tab {
    padding: 12px 6px;
    font-size: 12px;
  }
}

@media screen and (max-width: 480px) {
  .controls {
    width: calc(100vw - 30px);
    max-height: 60vh;
  }
  
  .legend {
    width: 160px;
    bottom: 15px;
    right: 15px;
  }
}
</style>