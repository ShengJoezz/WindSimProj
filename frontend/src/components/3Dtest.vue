<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-25 22:34:45
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-26 15:41:44
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\3Dtest.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="flow-particle-test">
      <div ref="vtkContainer" class="vtk-container"></div>
      
      <div class="controls">
        <div class="control-content">
          <div>
            <label for="file-select">流线文件:</label>
            <select id="file-select" v-model="selectedFile" @change="loadData">
              <option value="internal_75m_web.vtp ">1米高度切片</option>
              <option value="internal_dense.vtp">完整流场</option>
            </select>
          </div>
          
          <div>
            <label for="terrain-select">地形显示:</label>
            <select id="terrain-select" v-model="terrainVisibility" @change="updateTerrainVisibility">
              <option value="visible">显示</option>
              <option value="transparent">半透明</option>
              <option value="hidden">隐藏</option>
            </select>
          </div>
          
          <div>
            <label for="bg-select">背景:</label>
            <select id="bg-select" v-model="selectedBg" @change="updateBackground">
              <option value="dark">深蓝</option>
              <option value="black">纯黑</option>
              <option value="gradient">深色渐变</option>
              <option value="light">浅色</option>
            </select>
          </div>
          
          <div>
            <label for="particle-count">粒子数量:</label>
            <input id="particle-count" type="range" min="500" max="5000" step="100" v-model.number="particleCount" @change="updateParticles">
            <span>{{ particleCount }}</span>
          </div>
          
          <div>
            <label for="particle-speed">粒子速度:</label>
            <input id="particle-speed" type="range" min="0.1" max="3" step="0.1" v-model.number="particleSpeed">
            <span>{{ particleSpeed }}</span>
          </div>
          
          <div>
            <label for="particle-size">粒子大小:</label>
            <input id="particle-size" type="range" min="5" max="30" step="1" v-model.number="particleSize" @change="updateParticles">
            <span>{{ particleSize }}</span>
          </div>
          
          <div>
            <label for="trail-length">尾迹长度:</label>
            <input id="trail-length" type="range" min="5" max="25" step="1" v-model.number="trailLength" @change="updateParticles">
            <span>{{ trailLength }}</span>
          </div>
          
          <div>
            <label>
              <input type="checkbox" v-model="showLines" @change="updateVisibility">
              显示流线
            </label>
          </div>
        </div>
        
        <div class="info-panel">
          <div>流线数: {{ streamlines.length }}</div>
          <div>粒子数: {{ particles.length }}</div>
        </div>
      </div>
      
      <div v-if="loading" class="loading-indicator">加载中...</div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
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
  import vtkLookupTable from '@kitware/vtk.js/Common/Core/LookupTable';
  
  // 组件状态
  const vtkContainer = ref(null);
  const loading = ref(false);
  
  // 文件选择
  const selectedFile = ref('internal_dense.vtp');
  
  // 简化的控制选项
  const particleCount = ref(2000);
  const particleSpeed = ref(1.0);
  const particleSize = ref(15.0);
  const trailLength = ref(15);
  const showLines = ref(false);
  
  // 背景设置
  const selectedBg = ref('dark');
  const bgColors = {
    dark: [0.02, 0.02, 0.1],
    black: [0.0, 0.0, 0.0],
    gradient: 'gradient',
    light: [0.95, 0.95, 0.98]
  };
  
  // 地形显示模式
  const terrainVisibility = ref('transparent');
  
  // VTK实例
  let renderer = null;
  let renderWindow = null;
  let fullScreenRenderer = null;
  let streamlinesActor = null;
  let particlesActor = null;
  let trailsActor = null;
  let terrainActor = null;
  let streamlinesData = null;
  let terrainData = null;
  let animationFrameId = null;
  let particles = [];
  let streamlines = [];
  let flowVectors = [];
  let modelScale = 1.0;
  let maxVelocityMagnitude = 1.0;
  let minVelocityMagnitude = 0.0;
  
  // 基础路径
  const STREAMLINE_URL = 'http://localhost:5000/uploads/test/run/VTK/run_10/';
  const TERRAIN_URL = 'http://localhost:5000/uploads/test/run/postProcessing/Data/20.vtp';
  
  // 安全渲染函数
  function safeRender() {
    if (renderWindow) {
      try {
        renderWindow.render();
      } catch (e) {
        console.warn("渲染失败:", e);
      }
    }
  }
  
  // 初始化3D渲染器
  function initRenderer() {
    try {
      if (fullScreenRenderer) {
        fullScreenRenderer.delete();
      }
      
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
      
      if (bgColor === 'gradient') {
        createGradientBackground();
      }
      
      console.log("渲染器初始化完成");
      return true;
    } catch (e) {
      console.error("初始化渲染器失败:", e);
      return false;
    }
  }
  
  // 创建渐变背景
  function createGradientBackground() {
    const container = vtkContainer.value;
    if (container) {
      container.style.background = 'linear-gradient(to bottom, #050533 0%, #050533 35%, #101030 100%)';
    }
  }
  
  // 获取当前背景颜色
  function getBgColor() {
    return bgColors[selectedBg.value];
  }
  
  // 更新背景颜色
  function updateBackground() {
    if (!renderer) return;
    
    try {
      const bgColor = getBgColor();
      
      if (bgColor === 'gradient') {
        createGradientBackground();
        renderer.setBackground([0.02, 0.02, 0.1]);
      } else {
        const container = vtkContainer.value;
        if (container) {
          container.style.background = '';
        }
        renderer.setBackground(bgColor);
      }
      
      // 更新流线颜色
      if (streamlinesActor) {
        const isDarkBg = selectedBg.value !== 'light';
        streamlinesActor.getProperty().setColor(
          isDarkBg ? 0.6 : 0.2,
          isDarkBg ? 0.6 : 0.3,
          isDarkBg ? 0.9 : 0.6
        );
        streamlinesActor.getProperty().setOpacity(0.2);
      }
      
      // 更新地形颜色
      if (terrainActor) {
        const isDarkBg = selectedBg.value !== 'light';
        terrainActor.getProperty().setColor(
          isDarkBg ? 0.2 : 0.8,
          isDarkBg ? 0.2 : 0.8,
          isDarkBg ? 0.28 : 0.85
        );
      }
      
      safeRender();
    } catch (e) {
      console.error("更新背景失败:", e);
    }
  }
  
  // 更新地形显示状态
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
    } catch (e) {
      console.error("更新地形可见性失败:", e);
    }
  }
  
  // 加载流线数据
  async function loadData() {
    loading.value = true;
    
    try {
      clearScene();
      
      const streamlineUrl = `${STREAMLINE_URL}${selectedFile.value}`;
      console.log(`加载流线数据: ${streamlineUrl}`);
      
      const response = await axios.get(streamlineUrl, { responseType: 'arraybuffer' });
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      streamlinesData = reader.getOutputData(0);
      
      console.log(`流线数据加载成功，包含 ${streamlinesData.getNumberOfPoints()} 个点和 ${streamlinesData.getNumberOfCells()} 条线`);
      
      // 计算模型尺度
      const bounds = streamlinesData.getBounds();
      modelScale = Math.sqrt(
        Math.pow(bounds[1] - bounds[0], 2) +
        Math.pow(bounds[3] - bounds[2], 2) +
        Math.pow(bounds[5] - bounds[4], 2)
      ) / 100;
      
      // 提取流线数据
      extractStreamlinesFromVTP();
      
      // 创建流线渲染器
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(streamlinesData);
      
      streamlinesActor = vtkActor.newInstance();
      streamlinesActor.setMapper(mapper);
      
      const isDarkBg = selectedBg.value !== 'light';
      streamlinesActor.getProperty().setColor(
        isDarkBg ? 0.6 : 0.2,
        isDarkBg ? 0.6 : 0.3,
        isDarkBg ? 0.9 : 0.6
      );
      streamlinesActor.getProperty().setOpacity(0.2);
      streamlinesActor.setVisibility(showLines.value);
      renderer.addActor(streamlinesActor);
      
      // 加载地形数据
      if (!terrainData) {
        await loadTerrainData();
      }
      
      // 初始化粒子系统
      console.log(`流线提取完成，共${streamlines.length}条流线，开始初始化粒子系统`);
      initParticleSystem();
      
      renderer.resetCamera();
      safeRender();
      
    } catch (error) {
      console.error('加载流线数据失败:', error);
    } finally {
      loading.value = false;
    }
  }
  
  // 加载地形数据
  async function loadTerrainData() {
    try {
      console.log(`加载地形数据: ${TERRAIN_URL}`);
      
      const response = await axios.get(TERRAIN_URL, { responseType: 'arraybuffer' });
      const reader = vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(response.data);
      terrainData = reader.getOutputData(0);
      
      console.log(`地形数据加载成功，包含 ${terrainData.getNumberOfPoints()} 个点和 ${terrainData.getNumberOfCells()} 个面`);
      
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(terrainData);
      
      terrainActor = vtkActor.newInstance();
      terrainActor.setMapper(mapper);
      
      const isDarkBg = selectedBg.value !== 'light';
      terrainActor.getProperty().setColor(
        isDarkBg ? 0.2 : 0.8,
        isDarkBg ? 0.2 : 0.8,
        isDarkBg ? 0.28 : 0.85
      );
      
      updateTerrainVisibility();
      renderer.addActor(terrainActor);
    } catch (error) {
      console.error('加载地形数据失败:', error);
      terrainData = null;
    }
  }
  
  // 清理场景
  function clearScene() {
    if (streamlinesActor) {
      renderer.removeActor(streamlinesActor);
      streamlinesActor = null;
    }
    
    if (particlesActor) {
      renderer.removeActor(particlesActor);
      particlesActor = null;
    }
    
    if (trailsActor) {
      renderer.removeActor(trailsActor);
      trailsActor = null;
    }
    
    if (terrainActor) {
      renderer.removeActor(terrainActor);
      terrainActor = null;
    }
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    streamlines = [];
    flowVectors = [];
    particles = [];
  }
  
  // 从VTP数据中提取流线 - 修复版本
  function extractStreamlinesFromVTP() {
    streamlines = [];
    flowVectors = [];
    maxVelocityMagnitude = 0.1;
    minVelocityMagnitude = Infinity;
    
    if (!streamlinesData) return;
    
    // 获取速度数据
    let velocityData = null;
    try {
      const pointData = streamlinesData.getPointData();
      
      // 尝试获取U向量场
      try {
        velocityData = pointData.getArray('U');
        if (velocityData) {
          console.log(`获取速度场U成功, 包含${velocityData.getNumberOfComponents()}分量`);
        }
      } catch (e) {
        console.warn("获取U失败，尝试其他方法:", e);
        
        // 检查常见的速度场名称
        const velocityFieldNames = ['U', 'Velocity', 'velocity', 'V', 'v', 'vel'];
        
        try {
          const arrays = pointData.getArrays ? pointData.getArrays() : [];
          console.log("可用的数据数组数量:", arrays.length);
          
          for (let i = 0; i < arrays.length; i++) {
            const array = arrays[i];
            const name = array.getName();
            console.log(`找到数组: ${name}`);
            
            if (velocityFieldNames.includes(name)) {
              velocityData = array;
              console.log(`找到速度场数据: ${name}`);
              break;
            }
          }
        } catch (e) {
          console.warn("获取数组列表失败:", e);
        }
      }
    } catch (e) {
      console.warn("获取点数据失败:", e);
    }
    
    // 提取流线
    try {
      const polys = streamlinesData.getPolys();
      const points = streamlinesData.getPoints().getData();
      const nPoints = streamlinesData.getNumberOfPoints();
      
      if (polys && polys.getData && polys.getData().length > 0) {
        const cellData = polys.getData();
        console.log(`多边形数据大小: ${cellData.length}`);
        
        let i = 0;
        while (i < cellData.length) {
          const size = cellData[i++];
          if (size < 2) {
            i += size;
            continue;
          }
          
          const line = [];
          const vectors = [];
          
          // 收集点和速度向量
          for (let j = 0; j < size; j++) {
            const pointId = cellData[i++];
            
            if (pointId * 3 + 2 >= points.length) {
              console.warn(`点索引超出范围: ${pointId}`);
              continue;
            }
            
            const point = [
              points[pointId * 3],
              points[pointId * 3 + 1],
              points[pointId * 3 + 2]
            ];
            line.push(point);
            
            // 获取速度数据
            let vector = [0, 0, 0];
            let validVelocity = false;
            let velocityMagnitude = 0;
            
            if (velocityData && velocityData.getData && pointId * 3 + 2 < velocityData.getData().length) {
              const vx = velocityData.getData()[pointId * 3];
              const vy = velocityData.getData()[pointId * 3 + 1];
              const vz = velocityData.getData()[pointId * 3 + 2];
              velocityMagnitude = Math.sqrt(vx*vx + vy*vy + vz*vz);
              
              if (velocityMagnitude > 0.0001) {
                vector = [vx, vy, vz];
                validVelocity = true;
                maxVelocityMagnitude = Math.max(maxVelocityMagnitude, velocityMagnitude);
                minVelocityMagnitude = Math.min(minVelocityMagnitude, velocityMagnitude);
              }
            } else if (j < size - 1) {
              // 使用相邻点计算方向
              const nextPointId = cellData[i];
              if (nextPointId * 3 + 2 < points.length) {
                const nextPoint = [
                  points[nextPointId * 3],
                  points[nextPointId * 3 + 1],
                  points[nextPointId * 3 + 2]
                ];
                
                const dx = nextPoint[0] - point[0];
                const dy = nextPoint[1] - point[1];
                const dz = nextPoint[2] - point[2];
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (len > 0.0001) {
                  vector = [dx/len, dy/len, dz/len];
                  velocityMagnitude = len;
                  validVelocity = true;
                  maxVelocityMagnitude = Math.max(maxVelocityMagnitude, velocityMagnitude);
                  minVelocityMagnitude = Math.min(minVelocityMagnitude, velocityMagnitude);
                }
              }
            }
            
            vectors.push({ 
              vector, 
              magnitude: velocityMagnitude,
              valid: validVelocity
            });
          }
          
          // 只添加至少有2个点的流线
          if (line.length >= 2) {
            streamlines.push(line);
            flowVectors.push(vectors);
          }
        }
        
        console.log(`从多边形数据中提取了 ${streamlines.length} 条流线`);
        console.log(`速度范围: ${minVelocityMagnitude.toFixed(4)} - ${maxVelocityMagnitude.toFixed(4)}`);
      }
    } catch (e) {
      console.error("从多边形数据提取流线失败:", e);
    }
    
    // 如果没有成功提取流线，创建备用流线
    if (streamlines.length === 0) {
      console.log("未能提取流线，创建示例流线...");
      createSampleStreamlines();
    }
  }
  
  // 创建示例流线（备用方案）
  function createSampleStreamlines() {
    try {
      const bounds = streamlinesData.getBounds();
      const center = [
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2
      ];
      
      const size = [
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4]
      ];
      
      // 创建几条示例流线
      for (let i = 0; i < 20; i++) {
        const line = [];
        const vectors = [];
        
        // 随机起点
        const startX = center[0] + (Math.random() - 0.5) * size[0] * 0.8;
        const startY = center[1] + (Math.random() - 0.5) * size[1] * 0.8;
        const startZ = center[2] + (Math.random() - 0.5) * size[2] * 0.8;
        
        // 创建流线点
        for (let j = 0; j < 20; j++) {
          const point = [
            startX + j * size[0] * 0.02,
            startY + Math.sin(j * 0.3) * size[1] * 0.1,
            startZ + j * size[2] * 0.01
          ];
          line.push(point);
          
          // 创建简单的向量
          const vector = [1, Math.cos(j * 0.3) * 0.2, 0.1];
          vectors.push({
            vector,
            magnitude: 1.0,
            valid: true
          });
        }
        
        streamlines.push(line);
        flowVectors.push(vectors);
      }
      
      maxVelocityMagnitude = 1.0;
      minVelocityMagnitude = 0.1;
      
      console.log(`创建了 ${streamlines.length} 条示例流线`);
    } catch (e) {
      console.error("创建示例流线失败:", e);
    }
  }
  
  // 初始化粒子系统
  function initParticleSystem() {
    try {
      console.log("开始初始化粒子系统，粒子数:", particleCount.value);
      console.log("可用流线数:", streamlines.length);
      
      if (streamlines.length === 0) {
        console.error("没有可用的流线数据，无法创建粒子");
        return;
      }
      
      // 创建粒子
      particles = [];
      createParticles();
      
      console.log(`成功创建粒子: ${particles.length}`);
      
      if (particles.length === 0) {
        console.error("粒子创建失败");
        return;
      }
      
      // 创建球形粒子几何体
      const particleSource = vtkSphereSource.newInstance({
        thetaResolution: 16,
        phiResolution: 16,
        radius: particleSize.value * modelScale * 0.3,
        latLongTessellation: true
      });
      
      // 创建颜色表
      const lut = vtkLookupTable.newInstance();
      lut.setHueRange(0.6, 0); // 蓝到红
      lut.setValueRange(0.8, 1.0);
      lut.setSaturationRange(0.7, 1.0);
      lut.setAlphaRange(0.9, 1.0);
      
      if (typeof lut.build === 'function') {
        lut.build();
      }
      
      // 创建粒子PolyData
      const particlePolyData = vtkPolyData.newInstance();
      const particlePoints = vtkPoints.newInstance();
      particlePolyData.setPoints(particlePoints);
      
      updateParticleData(particlePolyData);
      
      // 创建粒子Glyph映射器
      const glyph3DMapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
        scaleArray: 'velocity',
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
      
      // 创建粒子Actor
      particlesActor = vtkActor.newInstance();
      particlesActor.setMapper(glyph3DMapper);
      particlesActor.getProperty().setOpacity(0.9);
      particlesActor.getProperty().setAmbient(0.7);
      particlesActor.getProperty().setDiffuse(0.9);
      particlesActor.getProperty().setSpecular(0.9);
      
      renderer.addActor(particlesActor);
      console.log("粒子Actor创建并添加到场景");
      
      // 创建粒子尾迹
      if (trailLength.value > 0) {
        createParticleTrails();
        console.log("粒子尾迹创建完成");
      }
      
      // 启动粒子动画
      startParticleAnimation();
    } catch (e) {
      console.error("初始化粒子系统失败:", e);
    }
  }
  
  // 创建粒子 - 均匀分布所有流线
  function createParticles() {
    if (streamlines.length === 0) {
      console.error("没有流线数据，无法创建粒子");
      return;
    }
    
    try {
      particles = [];
      
      // 计算每条流线分配的粒子数
      const particlesPerLine = Math.max(1, Math.floor(particleCount.value / streamlines.length));
      const remainingParticles = particleCount.value - (particlesPerLine * streamlines.length);
      
      console.log(`每条流线分配${particlesPerLine}个粒子，剩余${remainingParticles}个粒子`);
      
      for (let i = 0; i < streamlines.length; i++) {
        const line = streamlines[i];
        const vectors = flowVectors[i] || [];
        
        if (line.length < 2) continue;
        
        // 为当前流线分配粒子数量
        let currentParticleCount = particlesPerLine;
        if (i < remainingParticles) {
          currentParticleCount++; // 剩余粒子分配给前几条流线
        }
        
        // 为每条流线创建粒子
        for (let j = 0; j < currentParticleCount; j++) {
          // 在流线上均匀分布
          const progress = j / Math.max(1, currentParticleCount - 1);
          const targetIndex = progress * (line.length - 1);
          const segmentIndex = Math.floor(targetIndex);
          const t = targetIndex - segmentIndex;
          
          // 确保索引有效
          const actualSegmentIndex = Math.min(segmentIndex, line.length - 2);
          const actualT = Math.max(0, Math.min(1, t));
          
          const p0 = line[actualSegmentIndex];
          const p1 = line[actualSegmentIndex + 1];
          
          // 线性插值位置
          const position = [
            p0[0] + actualT * (p1[0] - p0[0]),
            p0[1] + actualT * (p1[1] - p0[1]),
            p0[2] + actualT * (p1[2] - p0[2])
          ];
          
          // 计算方向和速度
          let velocity = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
          let normalizedSpeed = 0.5; // 默认中等速度
          
          // 如果有速度数据，使用实际速度
          if (vectors.length > actualSegmentIndex && vectors[actualSegmentIndex].valid) {
            const v0 = vectors[actualSegmentIndex];
            const v1 = vectors[Math.min(actualSegmentIndex + 1, vectors.length - 1)];
            
            if (v1.valid) {
              // 插值速度向量
              velocity = [
                v0.vector[0] + actualT * (v1.vector[0] - v0.vector[0]),
                v0.vector[1] + actualT * (v1.vector[1] - v0.vector[1]),
                v0.vector[2] + actualT * (v1.vector[2] - v0.vector[2])
              ];
              
              // 计算归一化速度
              const magnitude = v0.magnitude + actualT * (v1.magnitude - v0.magnitude);
              normalizedSpeed = Math.max(0, Math.min(1, 
                (magnitude - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude)
              ));
            } else {
              velocity = [...v0.vector];
              normalizedSpeed = Math.max(0, Math.min(1, 
                (v0.magnitude - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude)
              ));
            }
          } else {
            // 标准化方向向量
            const speed = Math.sqrt(velocity[0] * velocity[0] + velocity[1] * velocity[1] + velocity[2] * velocity[2]);
            if (speed > 0) {
              velocity[0] /= speed;
              velocity[1] /= speed;
              velocity[2] /= speed;
            } else {
              velocity = [1, 0, 0]; // 默认向右
            }
          }
          
          particles.push({
            lineIndex: i,
            segmentIndex: actualSegmentIndex,
            t: actualT,
            position: [...position],
            velocity: [...velocity],
            normalizedSpeed: normalizedSpeed,
            trail: Array(Math.max(1, trailLength.value)).fill().map(() => [...position])
          });
        }
      }
      
      console.log(`创建了 ${particles.length} 个粒子分布在 ${streamlines.length} 条流线上`);
    } catch (e) {
      console.error("创建粒子失败:", e);
    }
  }
  
  // 更新粒子数据
  function updateParticleData(polyData) {
    try {
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
      
      polyData.getPointData().addArray(
        vtkDataArray.newInstance({
          name: 'velocity',
          values: velocities,
          numberOfComponents: 3
        })
      );
      
      polyData.getPointData().addArray(
        vtkDataArray.newInstance({
          name: 'speed',
          values: speeds,
          numberOfComponents: 1
        })
      );
    } catch (e) {
      console.error("更新粒子数据失败:", e);
    }
  }
  
  // 创建粒子尾迹
  function createParticleTrails() {
    try {
      if (trailsActor) {
        renderer.removeActor(trailsActor);
      }
      
      if (trailLength.value <= 0 || particles.length === 0) return;
      
      const trailsPolyData = vtkPolyData.newInstance();
      const trailsPoints = vtkPoints.newInstance();
      trailsPolyData.setPoints(trailsPoints);
      
      const lineColors = new Float32Array(particles.length * trailLength.value * 3);
      const lines = new Uint32Array(particles.length * (1 + trailLength.value));
      
      let pointOffset = 0;
      let lineOffset = 0;
      
      for (let i = 0; i < particles.length; i++) {
        // 设置亮丽的尾迹颜色
        for (let j = 0; j < trailLength.value; j++) {
          const fadeRatio = j / Math.max(1, trailLength.value - 1);
          const alpha = 1.0 - fadeRatio * 0.7;
          
          lineColors[(pointOffset + j) * 3] = 0.3 + 0.7 * alpha;     // 红色
          lineColors[(pointOffset + j) * 3 + 1] = 0.6 * alpha;       // 绿色
          lineColors[(pointOffset + j) * 3 + 2] = 1.0 * alpha;       // 蓝色
        }
        
        lines[lineOffset++] = trailLength.value;
        for (let j = 0; j < trailLength.value; j++) {
          lines[lineOffset++] = pointOffset + j;
        }
        
        pointOffset += trailLength.value;
      }
      
      trailsPoints.setData(new Float32Array(particles.length * trailLength.value * 3));
      trailsPolyData.getLines().setData(lines);
      
      trailsPolyData.getPointData().setScalars(
        vtkDataArray.newInstance({
          name: 'colors',
          values: lineColors,
          numberOfComponents: 3
        })
      );
      
      const trailsMapper = vtkMapper.newInstance();
      trailsMapper.setInputData(trailsPolyData);
      trailsMapper.setColorModeToDirectScalars();
      
      trailsActor = vtkActor.newInstance();
      trailsActor.setMapper(trailsMapper);
      trailsActor.getProperty().setOpacity(0.8);
      
      try {
        trailsActor.getProperty().setLineWidth(2.0);
      } catch (e) {
        console.warn("设置线宽失败:", e);
      }
      
      renderer.addActor(trailsActor);
    } catch (e) {
      console.error("创建粒子尾迹失败:", e);
    }
  }
  
  // 启动粒子动画
  function startParticleAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    function animate() {
      try {
        updateParticlePositions();
        safeRender();
        animationFrameId = requestAnimationFrame(animate);
      } catch (e) {
        console.error("粒子动画更新失败:", e);
        setTimeout(() => {
          animationFrameId = requestAnimationFrame(animate);
        }, 1000);
      }
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  // 更新粒子位置
  function updateParticlePositions() {
    if (!streamlinesData || !particlesActor || particles.length === 0 || streamlines.length === 0) return;
    
    try {
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // 移动粒子
        const moveDistance = 0.01 * particleSpeed.value;
        particle.t += moveDistance;
        
        // 如果到达线段末端
        while (particle.t >= 1.0) {
          particle.t -= 1.0;
          particle.segmentIndex++;
          
          const line = streamlines[particle.lineIndex];
          
          // 如果到达流线末端，重置到开始
          if (particle.segmentIndex >= line.length - 1) {
            particle.segmentIndex = 0;
            particle.t = 0;
            
            // 重置尾迹
            const resetPosition = [...line[0]];
            particle.trail = Array(Math.max(1, trailLength.value)).fill().map(() => [...resetPosition]);
            continue;
          }
        }
        
        // 更新位置
        const line = streamlines[particle.lineIndex];
        const vectors = flowVectors[particle.lineIndex] || [];
        const segmentIdx = Math.min(particle.segmentIndex, line.length - 2);
        const p0 = line[segmentIdx];
        const p1 = line[segmentIdx + 1];
        
        particle.position = [
          p0[0] + particle.t * (p1[0] - p0[0]),
          p0[1] + particle.t * (p1[1] - p0[1]),
          p0[2] + particle.t * (p1[2] - p0[2])
        ];
        
        // 更新速度方向
        if (vectors.length > segmentIdx && vectors[segmentIdx].valid) {
          const v0 = vectors[segmentIdx];
          const v1 = vectors[Math.min(segmentIdx + 1, vectors.length - 1)];
          
          if (v1.valid) {
            particle.velocity = [
              v0.vector[0] + particle.t * (v1.vector[0] - v0.vector[0]),
              v0.vector[1] + particle.t * (v1.vector[1] - v0.vector[1]),
              v0.vector[2] + particle.t * (v1.vector[2] - v0.vector[2])
            ];
            
            const magnitude = v0.magnitude + particle.t * (v1.magnitude - v0.magnitude);
            particle.normalizedSpeed = Math.max(0, Math.min(1, 
              (magnitude - minVelocityMagnitude) / (maxVelocityMagnitude - minVelocityMagnitude)
            ));
          } else {
            particle.velocity = [...v0.vector];
          }
        } else {
          // 使用线段方向
          particle.velocity = [
            p1[0] - p0[0],
            p1[1] - p0[1],
            p1[2] - p0[2]
          ];
          
          const speed = Math.sqrt(
            particle.velocity[0] * particle.velocity[0] + 
            particle.velocity[1] * particle.velocity[1] + 
            particle.velocity[2] * particle.velocity[2]
          );
          
          if (speed > 0) {
            particle.velocity[0] /= speed;
            particle.velocity[1] /= speed;
            particle.velocity[2] /= speed;
          }
        }
        
        // 更新尾迹
        if (trailLength.value > 0) {
          particle.trail.unshift([...particle.position]);
          if (particle.trail.length > trailLength.value) {
            particle.trail.pop();
          }
        }
      }
      
      // 更新粒子数据
      const polyData = particlesActor.getMapper().getInputData(0);
      updateParticleData(polyData);
      polyData.modified();
      
      // 更新尾迹
      if (trailsActor && trailLength.value > 0) {
        updateTrails();
      }
    } catch (e) {
      console.error("更新粒子位置失败:", e);
    }
  }
  
  // 更新尾迹
  function updateTrails() {
    try {
      if (trailLength.value <= 0) return;
      
      const trailsPolyData = trailsActor.getMapper().getInputData();
      const points = trailsPolyData.getPoints();
      const pointsData = new Float32Array(particles.length * trailLength.value * 3);
      const colors = new Float32Array(particles.length * trailLength.value * 3);
      
      let pointIndex = 0;
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        if (!particle.trail || particle.trail.length === 0) {
          pointIndex += trailLength.value;
          continue;
        }
        
        for (let j = 0; j < Math.min(particle.trail.length, trailLength.value); j++) {
          const point = particle.trail[j];
          if (!point) continue;
          
          const index = pointIndex * 3;
          
          pointsData[index] = point[0];
          pointsData[index + 1] = point[1];
          pointsData[index + 2] = point[2];
          
          // 渐变颜色效果
          const fadeRatio = j / Math.max(1, trailLength.value - 1);
          const fadeEffect = 1.0 - fadeRatio * 0.7;
          
          // 基于速度的颜色
          const speed = particle.normalizedSpeed;
          colors[index] = speed * fadeEffect + 0.3 * fadeEffect;        // 红色分量
          colors[index + 1] = (1 - speed) * 0.6 * fadeEffect;           // 绿色分量  
          colors[index + 2] = (1 - speed) * fadeEffect + 0.7 * fadeEffect; // 蓝色分量
          
          pointIndex++;
        }
      }
      
      points.setData(pointsData, 3);
      trailsPolyData.getPointData().getScalars().setData(colors);
      trailsPolyData.modified();
    } catch (e) {
      console.error("更新尾迹失败:", e);
    }
  }
  
  // 更新粒子数量
  function updateParticles() {
    try {
      if (streamlinesData && streamlines.length > 0) {
        if (particlesActor) {
          renderer.removeActor(particlesActor);
          particlesActor = null;
        }
        
        if (trailsActor) {
          renderer.removeActor(trailsActor);
          trailsActor = null;
        }
        
        initParticleSystem();
      }
    } catch (e) {
      console.error("更新粒子数量失败:", e);
    }
  }
  
  // 更新可见性
  function updateVisibility() {
    try {
      if (streamlinesActor) {
        streamlinesActor.setVisibility(showLines.value);
        safeRender();
      }
    } catch (e) {
      console.error("更新可见性失败:", e);
    }
  }
  
  // 组件挂载时初始化
  onMounted(() => {
    try {
      const rendererInitialized = initRenderer();
      
      if (rendererInitialized) {
        loadData();
        
        window.addEventListener('resize', () => {
          if (fullScreenRenderer) {
            fullScreenRenderer.resize();
          }
        });
      }
    } catch (e) {
      console.error("组件挂载初始化失败:", e);
    }
  });
  
  // 组件卸载前清理
  onBeforeUnmount(() => {
    try {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (fullScreenRenderer) {
        try {
          fullScreenRenderer.delete();
        } catch (e) {
          console.warn("删除渲染器失败:", e);
        }
      }
      
      window.removeEventListener('resize', () => {});
    } catch (e) {
      console.error("组件卸载清理失败:", e);
    }
  });
  </script>
  
  <style scoped>
  .flow-particle-test {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .vtk-container {
    width: 100%;
    height: 100%;
  }
  
  .controls {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 8px;
    color: white;
    z-index: 10;
    width: 280px;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3),
                0 0 60px rgba(0, 100, 255, 0.1);
    border: 1px solid rgba(80, 120, 255, 0.15);
    font-family: 'Arial', sans-serif;
  }
  
  .control-content {
    padding: 12px;
  }
  
  .controls div {
    margin-bottom: 12px;
  }
  
  .controls label {
    display: inline-block;
    width: 100px;
    margin-right: 8px;
    font-size: 13px;
  }
  
  .controls input[type="range"] {
    width: 110px;
    vertical-align: middle;
    accent-color: #4fc3f7;
  }
  
  .controls select {
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(40, 44, 52, 0.9);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .info-panel {
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .loading-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 18px;
    backdrop-filter: blur(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  /* 响应式设计 */
  @media screen and (max-width: 600px) {
    .controls {
      width: 240px;
    }
  }
  </style>
