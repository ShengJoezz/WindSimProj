<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 21:47:37
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-01 22:16:28
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\SpeedVisualization.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="speed-visualization-container">
      <div v-if="initialLoading" class="loading-overlay">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <span>Loading Initial Data...</span>
      </div>
      <div v-else-if="error" class="error-overlay">
        <el-alert type="error" :title="error" show-icon :closable="false" />
      </div>
  
      <div class="main-content" v-show="!initialLoading && !error">
        <!-- Loading spinner for height changes -->
        <div v-if="heightLoading" class="mini-loading">
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        </div>
        
        <!-- Controls 控制区域 -->
        <div class="controls-area">
          <el-card shadow="never" class="control-card">
            <div class="control-row">
              <div class="control-group height-slider">
                <label for="height-slider">Height Level (m)</label>
                <el-slider
                  id="height-slider"
                  v-model="currentHeight"
                  :min="minHeight"
                  :max="maxHeight"
                  :step="heightStep"
                  show-input
                  :debounce="300"
                  :disabled="initialLoading"
                  @change="handleHeightChange"
                  :format-tooltip="(val) => `${val.toFixed(1)} m`"
                />
              </div>
              <div class="control-group turbine-select" v-if="turbines && turbines.length > 0">
                <label for="turbine-select">Select Turbine</label>
                <el-select
                  id="turbine-select"
                  v-model="selectedTurbineId"
                  placeholder="Select Turbine"
                  @change="updateSelectedTurbineInfo"
                  clearable
                  filterable
                  :disabled="initialLoading"
                  style="width: 100%;"
                >
                  <el-option label="None" :value="null"></el-option>
                  <el-option
                    v-for="turbine in turbines"
                    :key="turbine.id"
                    :label="turbine.name || turbine.id"
                    :value="turbine.id"
                  />
                </el-select>
              </div>
              <div class="control-group toggle-controls">
                <el-switch
                  v-model="showContours"
                  :disabled="initialLoading"
                  active-text="Contours"
                  @change="redrawMainPlot"
                />
                <el-switch
                  v-model="usePreloadedData"
                  :disabled="initialLoading"
                  active-text="Use Preloaded Data"
                  @change="toggleDataMode"
                />
              </div>
            </div>
          </el-card>
        </div>
  
        <!-- Plots 图表区域 -->
        <div class="plots-area">
          <!-- Main Plot and Info Panel -->
          <div class="plot-row top-row">
            <el-card shadow="hover" class="plot-card main-plot-card">
              <div ref="mainPlot" class="plotly-chart main-plot"></div>
            </el-card>
            <el-card shadow="hover" class="plot-card info-panel-card">
              <h3 class="info-title">Information Panel</h3>
              <div v-if="selectedTurbineInfo" class="info-content">
                <p><strong>Selected:</strong> {{ selectedTurbineInfo.id }}</p>
                <p><strong>Coords:</strong> {{ selectedTurbineInfo.displayCoords }}</p>
                <p><strong>Hub Height:</strong> {{ selectedTurbineInfo.hubHeight?.toFixed(1) }} m</p>
                <p><strong>Diameter:</strong> {{ selectedTurbineInfo.rotorDiameter?.toFixed(1) }} m</p>
                <p><strong>Hub Speed:</strong> {{ selectedTurbineInfo.hubSpeed?.toFixed(2) ?? 'N/A' }} m/s</p>
                <p><strong>Current Speed ({{ currentHeight?.toFixed(1) }}m):</strong> {{ selectedTurbineInfo.currentHeightSpeed?.toFixed(2) ?? 'N/A' }} m/s</p>
                <p v-if="visualizationData?.windAngle"><strong>Wind Direction:</strong> {{ visualizationData.windAngle }}° </p>
              </div>
              <div v-else class="info-content placeholder">
                Select a turbine or click on a marker in the main plot.
              </div>
            </el-card>
          </div>
  
          <!-- Profile and Wake Plots -->
          <div class="plot-row bottom-row">
            <el-card shadow="hover" class="plot-card profile-plot-card">
              <div ref="profilePlot" class="plotly-chart profile-plot"></div>
            </el-card>
            <el-card shadow="hover" class="plot-card wake-plot-card">
              <div ref="wakePlot" class="plotly-chart wake-plot"></div>
            </el-card>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
  import axios from 'axios';
  import Plotly from 'plotly.js-dist-min';
  import { ElMessage, ElSlider, ElSelect, ElOption, ElCard, ElAlert, ElIcon, ElSwitch } from 'element-plus';
  import { Loading } from '@element-plus/icons-vue';
  import { debounce } from 'lodash-es';
  import cloneDeep from 'lodash-es/cloneDeep';
  
  const props = defineProps({
    caseId: {
      type: String,
      required: true,
    },
  });
  
  // DOM refs
  const mainPlot = ref(null);
  const profilePlot = ref(null);
  const wakePlot = ref(null);
  
  // State
  const initialLoading = ref(true);  // 初始加载状态
  const heightLoading = ref(false);  // 高度变化时的加载状态
  const error = ref(null);
  const visualizationData = ref(null);  // 当前高度的数据
  const currentHeight = ref(10);
  const selectedTurbineId = ref(null);
  const showContours = ref(true);
  const usePreloadedData = ref(true);  // 默认使用预加载数据模式
  
  // 预加载数据缓存
  const dataCache = ref({
    metadata: null,         // 元数据（高度范围，风机信息等）
    heightData: {},         // 各高度的速度场数据
    turbineProfiles: {},    // 风机的风廓线数据
    turbineWakes: {},       // 风机的尾流数据
    isLoading: false,       // 缓存是否正在加载中
    loadedHeights: new Set() // 已加载的高度集合
  });
  
  // 缓存颜色映射
  const colorCache = ref(new Map());
  const getColor = (id) => {
    if (colorCache.value.has(id)) {
      return colorCache.value.get(id);
    }
    
    const colorSet = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];
    const newIndex = colorCache.value.size % colorSet.length;
    colorCache.value.set(id, colorSet[newIndex]);
    return colorSet[newIndex];
  };
  
  // Computed properties
  const availableHeights = computed(() => {
    if (dataCache.value.metadata && dataCache.value.metadata.heightLevels) {
      return dataCache.value.metadata.heightLevels;
    }
    return visualizationData.value?.meta?.heightLevels || [];
  });
  
  const minHeight = computed(() => availableHeights.value.length > 0 ? availableHeights.value[0] : 10);
  const maxHeight = computed(() => availableHeights.value.length > 0 ? availableHeights.value[availableHeights.value.length - 1] : 200);
  const heightStep = computed(() => {
    if (availableHeights.value.length > 1) {
      return availableHeights.value[1] - availableHeights.value[0];
    }
    return 10;
  });
  const turbines = computed(() => {
    if (dataCache.value.metadata && dataCache.value.metadata.turbines) {
      return dataCache.value.metadata.turbines;
    }
    return visualizationData.value?.turbines || [];
  });
  const selectedTurbineInfo = computed(() => visualizationData.value?.selectedTurbineInfo || null);
  
  // --- 数据预加载与缓存管理 ---
  
  // 初始化元数据和基本缓存结构
  const initializeCache = async () => {
  if (dataCache.value.isLoading || dataCache.value.metadata) return;
  try {
    dataCache.value.isLoading = true;
    const initialHeight = 10;
    const response = await axios.get(`/api/cases/${props.caseId}/speed-visualization-data`, {
      params: { height: initialHeight }
    });
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Failed to load initial data');
    }
    dataCache.value.metadata = {
      heightLevels: response.data.meta.heightLevels,
      turbines: response.data.turbines,
      vmin: response.data.meta.vmin,
      vmax: response.data.meta.vmax,
      windAngle: response.data.windAngle,
      windDirectionVector: response.data.windDirectionVector,
      scaleFactor: response.data.meta.scaleFactor
    };
    cacheHeightData(initialHeight, response.data);
    if (response.data.meta.heightLevels && response.data.meta.heightLevels.length > 0) {
      currentHeight.value = response.data.meta.heightLevels[0];
    }
    visualizationData.value = response.data;
    // 在数据加载成功后主动更新所有图表
    await updateAllPlots();
    if (usePreloadedData.value) {
      preloadHeightData();
    }
  } catch (err) {
    console.error("Error initializing data cache:", err);
    error.value = err.message || 'Failed to initialize data';
  } finally {
    dataCache.value.isLoading = false;
    initialLoading.value = false;
  }
};
  
  // 缓存单个高度的数据
  const cacheHeightData = (height, data) => {
    if (!data) return;
    
    // 缓存此高度的速度场数据
    dataCache.value.heightData[height] = {
      values: data.sliceData.values,
      xCoords: data.sliceData.xCoords,
      yCoords: data.sliceData.yCoords,
      extent: data.sliceData.extent,
      height: data.sliceData.height
    };
    
    // 记录此高度已加载
    dataCache.value.loadedHeights.add(height);
    
    // 缓存风机数据 (如果是首次见到这些风机)
    if (data.profiles) {
      data.profiles.forEach(profile => {
        if (!dataCache.value.turbineProfiles[profile.id]) {
          dataCache.value.turbineProfiles[profile.id] = profile;
        }
      });
    }
    
    if (data.wakes) {
      data.wakes.forEach(wake => {
        if (!dataCache.value.turbineWakes[wake.id]) {
          dataCache.value.turbineWakes[wake.id] = wake;
        }
      });
    }
  };
  
  // 后台预加载所有高度数据
  const preloadHeightData = async () => {
    if (!dataCache.value.metadata || !dataCache.value.metadata.heightLevels) return;
    
    const heights = dataCache.value.metadata.heightLevels;
    const totalHeights = heights.length;
    let loadedCount = dataCache.value.loadedHeights.size;
    
    // 显示预加载进度
    console.log(`Preloading height data: ${loadedCount}/${totalHeights} loaded`);
    
    // 按批次加载，避免过多并发请求
    const batchSize = 3;
    const batchDelay = 500; // ms
    
    for (let i = 0; i < heights.length; i += batchSize) {
      const batch = heights.slice(i, i + batchSize);
      const batchPromises = batch.map(async (height) => {
        // 跳过已加载的高度
        if (dataCache.value.loadedHeights.has(height)) return;
        
        try {
          const response = await axios.get(`/api/cases/${props.caseId}/speed-visualization-data`, {
            params: { height }
          });
          
          if (response.data && response.data.success) {
            cacheHeightData(height, response.data);
            loadedCount++;
            console.log(`Height ${height}m data loaded. Progress: ${loadedCount}/${totalHeights}`);
          }
        } catch (err) {
          console.warn(`Failed to preload height ${height}m:`, err);
        }
      });
      
      await Promise.all(batchPromises);
      
      // 添加延迟，避免过快发送太多请求
      if (i + batchSize < heights.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    console.log(`Height data preloading completed. ${loadedCount}/${totalHeights} heights loaded.`);
  };
  
  // 从缓存获取某高度的数据
  const getDataForHeight = async (height) => {
    // 如果不使用预加载，直接从服务器获取
    if (!usePreloadedData.value) {
      return fetchVisualizationData(height);
    }
    
    // 检查是否已有缓存
    if (dataCache.value.heightData[height]) {
      console.log(`Using cached data for height ${height}m`);
      
      // 构建完整数据结构
      const cachedData = {
        success: true,
        sliceData: dataCache.value.heightData[height],
        turbines: dataCache.value.metadata.turbines,
        windAngle: dataCache.value.metadata.windAngle,
        windDirectionVector: dataCache.value.metadata.windDirectionVector,
        meta: {
          vmin: dataCache.value.metadata.vmin,
          vmax: dataCache.value.metadata.vmax,
          heightLevels: dataCache.value.metadata.heightLevels,
          scaleFactor: dataCache.value.metadata.scaleFactor
        },
        // 添加此高度下的已选风机数据
        selectedTurbineInfo: selectedTurbineId.value ? getSelectedTurbineInfoFromCache(height) : null
      };
      
      // 添加所有风机的风廓线
      cachedData.profiles = Object.values(dataCache.value.turbineProfiles);
      
      // 添加所有风机的尾流
      cachedData.wakes = Object.values(dataCache.value.turbineWakes);
      
      return cachedData;
    }
    
    // 如果缓存中没有，尝试加载此高度数据
    console.log(`Cache miss for height ${height}m, fetching from server`);
    return fetchVisualizationData(height);
  };
  
  // 从缓存中生成选中风机信息
  const getSelectedTurbineInfoFromCache = (height) => {
    if (!selectedTurbineId.value) return null;
    
    const turbine = dataCache.value.metadata.turbines.find(t => t.id === selectedTurbineId.value);
    if (!turbine) return null;
    
    // 获取风廓线数据
    const profile = dataCache.value.turbineProfiles[selectedTurbineId.value];
    if (!profile) return null;
    
    // 找到最接近目标高度的风速
    let hubSpeed = null;
    let currentHeightSpeed = null;
    
    if (profile && profile.heights && profile.speeds) {
      // 查找轮毂高度的风速
      const hubHeightIndex = profile.heights.findIndex(h => Math.abs(h - turbine.hubHeight) < 0.01);
      if (hubHeightIndex >= 0) {
        hubSpeed = profile.speeds[hubHeightIndex];
      }
      
      // 查找当前高度的风速
      const currentHeightIndex = profile.heights.findIndex(h => Math.abs(h - height) < 0.01);
      if (currentHeightIndex >= 0) {
        currentHeightSpeed = profile.speeds[currentHeightIndex];
      }
    }
    
    return {
      id: turbine.id,
      displayCoords: `(${turbine.x?.toFixed(2)}, ${turbine.y?.toFixed(2)}) km`,
      hubHeight: turbine.hubHeight,
      rotorDiameter: turbine.rotorDiameter,
      hubSpeed: hubSpeed,
      currentHeightSpeed: currentHeightSpeed
    };
  };
  
  // --- Plotting Functions ---
  
  // 绘制主图（风场切片）
  const plotMainSlice = async () => {
    if (!mainPlot.value || !visualizationData.value?.sliceData) return;
    await nextTick();
  
    const { values, xCoords, yCoords, height } = visualizationData.value.sliceData;
    const { vmin, vmax } = visualizationData.value.meta || { vmin: 0, vmax: 15 };
    const turbineData = visualizationData.value.turbines || [];
    const windDir = visualizationData.value.windDirectionVector || [1, 0];
    
    const xLength = xCoords[xCoords.length - 1] - xCoords[0];
    const yLength = yCoords[yCoords.length - 1] - yCoords[0];
    const arrowLength = Math.min(xLength, yLength) * 0.05;
  
    // 基本热图数据
    const plotData = [
      {
        type: 'heatmap',
        z: values,
        x: xCoords,
        y: yCoords,
        colorscale: 'Jet',
        zmin: vmin,
        zmax: vmax,
        colorbar: { title: 'Speed (m/s)' },
        hoverongaps: false,
        name: 'Speed Field',
      },
    ];
  
    // 如果启用等值线，添加等值线图层
    if (showContours.value) {
      plotData.push({
        type: 'contour',
        z: values,
        x: xCoords,
        y: yCoords,
        contours: {
          coloring: 'none',
          showlabels: true,
          labelfont: {
            size: 8,
            color: 'white',
          }
        },
        line: {
          color: 'white',
          width: 1
        },
        showscale: false,
        hoverinfo: 'none',
        name: 'Contours'
      });
    }
  
    // 添加风机标记
    if (turbineData.length > 0) {
      plotData.push({
        type: 'scatter',
        mode: 'markers+text',
        x: turbineData.map(t => t.x),
        y: turbineData.map(t => t.y),
        text: turbineData.map(t => t.name || t.id),
        textposition: 'top center',
        marker: {
          size: turbineData.map(t => selectedTurbineId.value === t.id ? 14 : 10),
          color: turbineData.map(t => selectedTurbineId.value === t.id ? 'yellow' : 'red'),
          symbol: turbineData.map(t => selectedTurbineId.value === t.id ? 'circle' : 'circle-open'),
          line: {
            color: turbineData.map(t => selectedTurbineId.value === t.id ? 'orange' : 'red'),
            width: turbineData.map(t => selectedTurbineId.value === t.id ? 3 : 2)
          }
        },
        hoverinfo: 'text',
        customdata: turbineData.map(t => t.id),
        name: 'Turbines',
        textfont: {
          size: 10,
          color: 'white'
        },
      });
    }
  
    // 创建风向箭头
    const annotations = turbineData.map(t => ({
      x: t.x,
      y: t.y,
      ax: t.x + windDir[0] * arrowLength,
      ay: t.y + windDir[1] * arrowLength,
      xref: 'x',
      yref: 'y',
      axref: 'x',
      ayref: 'y',
      showarrow: true,
      arrowhead: 2,
      arrowsize: 1,
      arrowwidth: 2,
      arrowcolor: 'blue',
      opacity: 0.7
    }));
  
    const layout = {
      title: `Speed Field at ${height?.toFixed(1)} m`,
      xaxis: { title: 'X (km)', constrain: 'domain' },
      yaxis: { title: 'Y (km)', scaleanchor: 'x', scaleratio: 1 },
      autosize: true,
      margin: { l: 50, r: 20, b: 40, t: 50 },
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(240, 240, 240, 0.8)',
      annotations: annotations
    };
  
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
      scrollZoom: true
    };
  
    try {
      if (!mainPlot.value._Plotly) {
        Plotly.newPlot(mainPlot.value, plotData, layout, config);
        
        // 注册点击事件 (仅注册一次)
        mainPlot.value.on('plotly_click', (data) => {
          if (data.points.length > 0) {
            const point = data.points[0];
            // 风机点的曲线索引会因等值线存在而变化
            const markerCurveIndex = showContours.value ? 2 : 1;
            if (point.curveNumber === markerCurveIndex && point.customdata) {
              selectedTurbineId.value = point.customdata;
              updateSelectedTurbineInfo();
            }
          }
        });
      } else {
        Plotly.react(mainPlot.value, plotData, layout, config);
      }
    } catch (err) {
      console.error('Error plotting main slice:', err);
    }
  };
  
  // 绘制风廓线图
  const plotProfile = async () => {
    if (!profilePlot.value || !visualizationData.value?.profiles) return;
    await nextTick();
  
    const profiles = visualizationData.value.profiles || [];
    const plotData = [];
  
    profiles.forEach((p) => {
      const color = getColor(p.id);
      plotData.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: p.speeds,
        y: p.heights,
        name: p.id,
        line: {
          width: selectedTurbineId.value === p.id ? 3 : 1.5,
          color: color,
          shape: 'spline' // 使用样条曲线使曲线更平滑
        },
        marker: {
          size: 4,
          opacity: selectedTurbineId.value === p.id ? 1 : 0.6,
          color: color
        },
        hovertemplate: `<b>${p.id}</b><br>Height: %{y:.1f} m<br>Speed: %{x:.2f} m/s<extra></extra>`
      });
      
      // 标记当前高度位置
      if (p.heights.length > 0) {
        // 找到最接近当前高度的点
        let closestHeightIndex = 0;
        let minDiff = Math.abs(p.heights[0] - currentHeight.value);
        
        for (let i = 1; i < p.heights.length; i++) {
          const diff = Math.abs(p.heights[i] - currentHeight.value);
          if (diff < minDiff) {
            minDiff = diff;
            closestHeightIndex = i;
          }
        }
        
        plotData.push({
          type: 'scatter',
          mode: 'markers',
          x: [p.speeds[closestHeightIndex]],
          y: [p.heights[closestHeightIndex]],
          marker: {
            size: 8,
            color: color,
            symbol: 'square',
            line: {
              color: selectedTurbineId.value === p.id ? 'white' : color,
              width: 2
            }
          },
          showlegend: false,
          hoverinfo: 'none'
        });
      }
    });
  
    const layout = {
      title: 'Wind Speed Profiles at Turbine Locations',
      xaxis: { title: 'Speed (m/s)', autorange: true },
      yaxis: { title: 'Height (m)', autorange: true },
      autosize: true,
      margin: { l: 50, r: 20, b: 40, t: 50 },
      hovermode: 'closest',
      legend: { traceorder: 'normal' },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(240, 240, 240, 0.8)',
      // 添加当前高度参考线
      shapes: [{
        type: 'line',
        xref: 'paper',
        x0: 0,
        y0: currentHeight.value,
        x1: 1,
        y1: currentHeight.value,
        line: {
          color: 'rgba(0, 0, 0, 0.3)',
          width: 1,
          dash: 'dash'
        }
      }]
    };
  
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
      scrollZoom: true
    };
  
    try {
      if (!profilePlot.value._Plotly) {
        Plotly.newPlot(profilePlot.value, plotData, layout, config);
      } else {
        Plotly.react(profilePlot.value, plotData, layout, config);
      }
    } catch (err) {
      console.error('Error plotting profiles:', err);
    }
  };
  
  // 绘制尾流图
  const plotWake = async () => {
    if (!wakePlot.value || !visualizationData.value?.wakes) return;
    await nextTick();
  
    const wakes = visualizationData.value.wakes || [];
    const plotData = [];
  
    wakes.forEach((w) => {
      const color = getColor(w.id);
      
      plotData.push({
        type: 'scatter',
        mode: 'lines',
        x: w.distances,
        y: w.speeds,
        name: w.id,
        line: {
          width: selectedTurbineId.value === w.id ? 3 : 1.5,
          color: color,
          shape: 'spline' // 使用样条曲线使曲线更平滑
        },
        hovertemplate: `<b>${w.id}</b><br>Distance: %{x:.2f} km<br>Speed: %{y:.2f} m/s<extra></extra>`
      });
  
      // 添加风机位置标记
      const zeroIndex = w.distances.findIndex(d => Math.abs(d) < 1e-6);
      if (zeroIndex !== -1) {
        plotData.push({
          type: 'scatter',
          mode: 'markers',
          x: [0],
          y: [w.speeds[zeroIndex]],
          name: `${w.id} Loc`,
          marker: {
            size: selectedTurbineId.value === w.id ? 8 : 6,
            color: color,
            symbol: 'circle'
          },
          showlegend: false,
          hoverinfo: 'skip'
        });
      }
    });
  
    const layout = {
      title: 'Wake Effect: Speed Along Wind Direction (Hub Height)',
      xaxis: { 
        title: 'Distance (km) [Downwind Positive]', 
        autorange: true,
        zeroline: true,
        zerolinecolor: 'rgba(0, 0, 0, 0.3)',
        zerolinewidth: 1
      },
      yaxis: { title: 'Speed (m/s)', autorange: true },
      autosize: true,
      margin: { l: 50, r: 20, b: 40, t: 50 },
      hovermode: 'closest',
      legend: { traceorder: 'normal' },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(240, 240, 240, 0.8)',
    };
  
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
      scrollZoom: true
    };
  
    try {
      if (!wakePlot.value._Plotly) {
        Plotly.newPlot(wakePlot.value, plotData, layout, config);
      } else {
        Plotly.react(wakePlot.value, plotData, layout, config);
      }
    } catch (err) {
      console.error('Error plotting wake analysis:', err);
    }
  };
  
  // 更新所有图表
  const updateAllPlots = async () => {
    try {
      await plotMainSlice();
      await plotProfile();
      await plotWake();
    } catch (err) {
      console.error('Error updating plots:', err);
    }
  };
  
  // 重新绘制主图（用于切换等值线显示）
  const redrawMainPlot = () => {
    plotMainSlice();
  };
  
  // 切换数据模式（实时请求/预加载）
  const toggleDataMode = () => {
    ElMessage({
      message: usePreloadedData.value ? 
               'Using preloaded data mode. Faster interactions but initial loading time.' : 
               'Using real-time data mode. Each height change will make a server request.',
      type: 'info',
      duration: 3000
    });
    
    // 如果切换到预加载模式，但缓存还未初始化，则开始预加载
    if (usePreloadedData.value && 
        dataCache.value.metadata && 
        dataCache.value.loadedHeights.size < availableHeights.value.length) {
      preloadHeightData();
    }
  };
  
  // --- 高度变化处理 ---
  const handleHeightChange = async (newHeight) => {
    if (newHeight === currentHeight.value) return;
    
    heightLoading.value = true;
    
    try {
      // 获取新高度的数据（从缓存或服务器）
      const data = await getDataForHeight(newHeight);
      
      if (data && data.success) {
        visualizationData.value = data;
        await updateAllPlots();
      } else {
        throw new Error(data?.message || 'Failed to get data for this height');
      }
    } catch (err) {
      console.error(`Error changing to height ${newHeight}:`, err);
      ElMessage.error(`Failed to load data for height ${newHeight}m: ${err.message}`);
    } finally {
      heightLoading.value = false;
    }
  };
  
  // --- Data Fetching ---
  const fetchVisualizationData = async (height = null) => {
    const targetHeight = height || currentHeight.value;
    
    if (!props.caseId || targetHeight === null) {
      return { success: false, message: "Case ID or Height not specified." };
    }
    
    try {
      const params = { height: targetHeight };
      if (selectedTurbineId.value) {
        params.selectedTurbineId = selectedTurbineId.value;
      }
      
      const response = await axios.get(`/api/cases/${props.caseId}/speed-visualization-data`, { params });
      
      if (response.data && response.data.success) {
        // 如果在预加载模式下，缓存结果
        if (usePreloadedData.value) {
          cacheHeightData(targetHeight, response.data);
        }
        
        return response.data;
      } else {
        throw new Error(response.data?.message || 'Failed to fetch visualization data');
      }
    } catch (err) {
      console.error(`Error fetching data for height ${targetHeight}:`, err);
      return { 
        success: false, 
        message: err.response?.data?.message || err.message || 'Failed to load data from server.' 
      };
    }
  };
  
  // 更新已选风机信息
  const updateSelectedTurbineInfo = async () => {
  if (!visualizationData.value) return;

  try {
    if (selectedTurbineId.value) {
      if (usePreloadedData.value && dataCache.value.metadata) {
        const turbineInfo = getSelectedTurbineInfoFromCache(currentHeight.value);
        if (turbineInfo) {
          // 使用 lodash.cloneDeep 深拷贝，只复制纯数据（假如 visualizationData.value 中存放的都是纯数据）
          const newData = cloneDeep(visualizationData.value);
          newData.selectedTurbineInfo = turbineInfo;
          visualizationData.value = newData;
          await updateAllPlots();
          return;
        }
      }
      heightLoading.value = true;
      const data = await fetchVisualizationData();
      if (data && data.success) {
        visualizationData.value = data;
        await updateAllPlots();
      } else {
        ElMessage.error(data?.message || 'Failed to update turbine information');
      }
      heightLoading.value = false;
    } else {
      const newData = cloneDeep(visualizationData.value);
      newData.selectedTurbineInfo = null;
      visualizationData.value = newData;
      await updateAllPlots();
    }
  } catch (err) {
    console.error('Error updating turbine info:', err);
    heightLoading.value = false;
  }
};
  
  // --- Watchers ---
  watch(selectedTurbineId, (newId, oldId) => {
    if (newId !== oldId) {
      updateSelectedTurbineInfo();
    }
  });
  
  watch(() => props.caseId, (newCaseId, oldCaseId) => {
    if (newCaseId && newCaseId !== oldCaseId) {
      // 重置所有状态
      visualizationData.value = null;
      dataCache.value = {
        metadata: null,
        heightData: {},
        turbineProfiles: {},
        turbineWakes: {},
        isLoading: false,
        loadedHeights: new Set()
      };
      selectedTurbineId.value = null;
      currentHeight.value = 10;
      initialLoading.value = true;
      error.value = null;
      
      // 初始化新案例数据
      initializeCache();
    }
  });
  
  watch(showContours, () => {
    redrawMainPlot();
  });
  
  // 窗口调整处理函数
  const handleResize = debounce(() => {
    try {
      if (mainPlot.value && mainPlot.value._Plotly) {
        Plotly.Plots.resize(mainPlot.value);
      }
      if (profilePlot.value && profilePlot.value._Plotly) {
        Plotly.Plots.resize(profilePlot.value);
      }
      if (wakePlot.value && wakePlot.value._Plotly) {
        Plotly.Plots.resize(wakePlot.value);
      }
    } catch (err) {
      console.warn('Error resizing plots:', err);
    }
  }, 200);
  
  // --- Lifecycle hooks ---
  onMounted(() => {
    // 初始化数据缓存和预加载
    initializeCache();
    window.addEventListener('resize', handleResize);
  });
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    try {
      if (mainPlot.value && mainPlot.value._Plotly) Plotly.purge(mainPlot.value);
      if (profilePlot.value && profilePlot.value._Plotly) Plotly.purge(profilePlot.value);
      if (wakePlot.value && wakePlot.value._Plotly) Plotly.purge(wakePlot.value);
    } catch (err) {
      console.warn('Error cleaning up Plotly instances:', err);
    }
  });
  </script>
  
  <style scoped>
  .speed-visualization-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 100px);
    position: relative;
    background-color: #f0f2f5;
    padding: 15px;
    gap: 15px;
  }
  
  .loading-overlay, .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 10;
    gap: 10px;
    font-size: 1.1em;
    color: #333;
  }
  
  .mini-loading {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 5;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    padding: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .error-overlay .el-alert {
    max-width: 80%;
  }
  
  .main-content {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    gap: 15px;
    overflow: hidden;
    position: relative;
  }
  
  .controls-area {
    flex-shrink: 0;
  }
  
  .control-card {
    padding: 15px;
    background-color: #fff;
  }
  
  .control-row {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
  }
  
  .control-group {
    flex: 1;
    min-width: 200px;
    margin-bottom: 10px;
  }
  
  .height-slider {
    flex: 2;
  }
  
  .control-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    font-size: 0.9em;
    color: #606266;
  }
  
  .toggle-controls {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 10px;
  }
  
  .el-slider {
    margin-left: 10px;
    margin-right: 10px;
  }
  
  .plots-area {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-height: 0;
  }
  
  .plot-row {
    display: flex;
    gap: 15px;
    flex: 1;
    min-height: 0;
  }
  
  .top-row {
    flex: 1.5;
  }
  .bottom-row {
    flex: 1;
  }
  
  .plot-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .plot-card .el-card__body {
    flex-grow: 1;
    padding: 10px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .plotly-chart {
    width: 100%;
    height: 100%;
    min-height: 250px;
    flex-grow: 1;
  }
  
  .info-panel-card .el-card__body {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .info-title {
    margin: 0 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
    font-size: 1.1em;
    color: #303133;
    text-align: center;
  }
  
  .info-content {
    font-size: 0.9em;
    line-height: 1.6;
    color: #555;
    text-align: center;
  }
  .info-content p {
    margin: 5px 0;
  }
  .info-content strong {
    color: #333;
  }
  
  .info-content.placeholder {
    color: #999;
    font-style: italic;
  }
  
  @media (max-width: 1200px) {
    .control-row {
      flex-direction: column;
    }
    
    .control-group {
      width: 100%;
    }
    
    .toggle-controls {
      flex-direction: row;
      justify-content: flex-start;
    }
  }
  
  @media (max-width: 768px) {
    .speed-visualization-container {
      height: auto;
      padding: 10px;
      gap: 10px;
    }
    .main-content {
      gap: 10px;
    }
    .plot-row {
      flex-direction: column;
      flex: unset;
    }
    .plot-card {
      min-height: 300px;
    }
    .top-row, .bottom-row {
      flex: unset;
    }
  }
  </style>