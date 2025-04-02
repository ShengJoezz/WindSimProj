<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-02 17:18:17
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 17:22:36
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ComprehensiveVizTester.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="comprehensive-tester">
      <h2>Comprehensive Visualization Tester</h2>
      <p>Case ID: {{ caseId }}</p>
  
      <!-- Controls -->
      <el-card shadow="never" class="controls-card">
        <el-row :gutter="20" align="middle">
          <!-- Library -->
          <el-col :xs="24" :sm="6">
            <el-radio-group v-model="selectedLibrary" size="small" @change="handleSelectionChange" :disabled="loadingSlice || loadingMeta">
              <el-radio-button label="plotly">Plotly</el-radio-button>
              <el-radio-button label="echarts">ECharts</el-radio-button>
            </el-radio-group>
          </el-col>
          <!-- Chart Type -->
          <el-col :xs="24" :sm="6">
            <el-radio-group v-model="selectedChartType" size="small" @change="handleSelectionChange" :disabled="loadingSlice || loadingMeta">
              <el-radio-button label="heatmap">Heatmap</el-radio-button>
              <el-radio-button label="scatter">Scatter</el-radio-button>
            </el-radio-group>
          </el-col>
          <!-- Height Slider -->
          <el-col :xs="24" :sm="12">
            <div class="slider-control">
              <span class="slider-label">Height (m): {{ currentHeight?.toFixed(1) }}</span>
              <el-slider
                v-model="currentHeight"
                :min="minHeight"
                :max="maxHeight"
                :step="heightStep"
                :debounce="350"
                :disabled="loadingMeta || loadingSlice || heightLevels.length === 0"
                @input="handleHeightSliderInput"
                :format-tooltip="(val) => `${val?.toFixed(1)} m`"
                style="flex-grow: 1;"
              />
            </div>
          </el-col>
        </el-row>
      </el-card>
  
      <!-- Chart Display -->
      <el-card shadow="hover" class="chart-card">
         <template #header>
              <div class="chart-card-header">
                   <span>{{ libraryDisplay }} - {{ chartTypeDisplay }}</span>
                   <div class="perf-stats">
                       <span v-if="fetchTime > 0" :title="`Time to fetch data for H=${currentHeight?.toFixed(1)}m`">Fetch: {{ fetchTime.toFixed(0) }} ms</span>
                       <span v-if="renderTime > 0" title="Approximate JS time to render chart">Render: {{ renderTime.toFixed(0) }} ms</span>
                       <span v-if="totalPoints > 0" title="Number of data points rendered">Points: {{ totalPoints.toLocaleString() }}</span>
                   </div>
              </div>
         </template>
  
         <div v-if="loadingMeta || loadingSlice" class="loading-indicator">
           <el-icon class="is-loading"><Loading /></el-icon>
           <span>{{ loadingMeta ? 'Loading Metadata...' : 'Loading Slice Data...' }}</span>
         </div>
         <div v-else-if="error" class="error-indicator">
           <el-alert type="error" :title="error" :closable="false" show-icon/>
         </div>
         <div v-else-if="!sliceData" class="no-data-indicator">
           <span>Metadata loaded, but no slice data available yet or failed to load.</span>
         </div>
         <!-- Single Chart Container -->
         <div ref="chartContainerRef" class="chart-container"></div>
      </el-card>
  
       <!-- Notes -->
       <div class="notes">
         <h3>Testing Notes:</h3>
         <ul>
           <li>Use DevTools (Network/Performance) for detailed analysis.</li>
           <li>Observe UI responsiveness during slider interaction.</li>
           <li>Compare Fetch/Render times between configurations.</li>
           <li>Note visual differences and potential downsampling effects (especially in scatter plots).</li>
           <li>Fetch time includes client cache check + network request (if miss) + JSON parse by browser. Render time is JS execution for chart update.</li>
           <li>**Check Console:** Look for "Metadata content check" and error logs during rendering.</li>
           <li>**Verify `metadata.json`:** Ensure `uploads/{caseId}/visualization_cache/metadata.json` exists and contains a valid `extent` array within the `metadata` object (e.g., `"extent": [-5.0, 5.0, -4.0, 4.0]`).</li>
         </ul>
       </div>
  
    </div>
  </template>
  
  <script setup>
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import { ElCard, ElRow, ElCol, ElSlider, ElRadioGroup, ElRadioButton, ElIcon, ElAlert, ElMessage } from 'element-plus'; // Removed unused imports
  import { Loading } from '@element-plus/icons-vue';
  import Plotly from 'plotly.js-dist-min';
  import * as echarts from 'echarts/core';
  import { GridComponent, TooltipComponent, VisualMapComponent, TitleComponent } from 'echarts/components';
  import { HeatmapChart, ScatterChart } from 'echarts/charts';
  import { CanvasRenderer } from 'echarts/renderers';
  import { UniversalTransition } from 'echarts/features';
  import { debounce } from 'lodash-es';
  import { getMetadata, getSliceData, clearClientCaseCache } from '@/services/visualizationService'; // Adjust path
  
  // Register ECharts components
  echarts.use([
      GridComponent, TooltipComponent, VisualMapComponent, TitleComponent,
      HeatmapChart, ScatterChart, CanvasRenderer, UniversalTransition
  ]);
  
  // --- IMPORTANT: Set Case ID for testing ---
  const caseId = ref('2131'); // <<<<<< USE YOUR CASE ID
  
  // --- Component State ---
  const loadingMeta = ref(true);
  const loadingSlice = ref(false);
  const error = ref(null);
  const metadata = ref(null);
  const sliceData = ref(null);
  const currentHeight = ref(10); // Default, will be updated by metadata
  const selectedLibrary = ref('echarts');
  const selectedChartType = ref('scatter');
  
  // Performance Metrics
  const fetchTime = ref(0);
  const renderTime = ref(0);
  const totalPoints = ref(0);
  
  // Chart Refs and Instances
  const chartContainerRef = ref(null);
  let currentChartInstance = null;
  
  // Computed properties
  const heightLevels = computed(() => metadata.value?.heightLevels || []);
  const minHeight = computed(() => heightLevels.value[0] ?? 10);
  const maxHeight = computed(() => heightLevels.value[heightLevels.value.length - 1] ?? 200);
  const heightStep = computed(() => heightLevels.value.length > 1 ? Math.round((heightLevels.value[1] - heightLevels.value[0])*10)/10 : 10);
  const libraryDisplay = computed(() => selectedLibrary.value === 'plotly' ? 'Plotly.js' : 'ECharts');
  const chartTypeDisplay = computed(() => selectedChartType.value === 'heatmap' ? 'Heatmap' : 'Scatter');
  
  // --- Methods ---
  
  const loadMeta = async () => {
    console.log("loadMeta started");
    loadingMeta.value = true;
    error.value = null;
    metadata.value = null;
    sliceData.value = null;
    cleanupChart();
    try {
      metadata.value = await getMetadata(caseId.value);
      console.log("Metadata content check:", JSON.stringify(metadata.value)); // Log fetched metadata
      if (!metadata.value || typeof metadata.value !== 'object') {
          throw new Error("Invalid metadata structure received.");
      }
      if (!metadata.value.extent || !Array.isArray(metadata.value.extent) || metadata.value.extent.length !== 4) {
          console.error("Metadata is missing or has invalid 'extent' property:", metadata.value);
          throw new Error("Metadata loaded, but 'extent' property is missing or invalid. Check precompute script and metadata.json.");
      }
       if (!metadata.value.xCoords || !metadata.value.yCoords) {
          console.error("Metadata is missing coordinates:", metadata.value);
          throw new Error("Metadata loaded, but 'xCoords' or 'yCoords' are missing.");
      }
  
      if (heightLevels.value.length > 0) {
        const initialHeight = minHeight.value;
        currentHeight.value = initialHeight;
        await loadSlice(initialHeight, true);
      } else {
        console.warn("No height levels found in metadata.");
        error.value = "No height levels available for this case.";
      }
    } catch (err) {
      console.error("Meta Error:", err);
      error.value = `Failed to load metadata: ${err.message}`;
      ElMessage.error(error.value);
    } finally {
      loadingMeta.value = false;
      console.log("loadMeta finished");
    }
  };
  
  const loadSlice = async (height, isInitialLoad = false) => {
    if (!metadata.value || loadingSlice.value) return;
    if (!isInitialLoad) { loadingSlice.value = true; }
    error.value = null;
    sliceData.value = null; // Clear previous slice
    // Don't cleanup chart here, renderChart will do it
    const fetchStartTime = performance.now();
    try {
      const closestHeight = heightLevels.value.reduce((prev, curr) =>
          Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev
      );
      currentHeight.value = closestHeight; // Ensure slider reflects actual height
  
      console.log(`Fetching slice for H=${closestHeight.toFixed(1)}m`);
      sliceData.value = await getSliceData(caseId.value, closestHeight);
      fetchTime.value = performance.now() - fetchStartTime;
      console.log(`Slice data fetched in ${fetchTime.value.toFixed(0)}ms`);
  
      // **Crucial Check:** Ensure sliceData has necessary properties
      if (!sliceData.value || !sliceData.value.values || !Array.isArray(sliceData.value.values)) {
          console.error("Invalid slice data received:", sliceData.value);
          throw new Error("Received invalid or incomplete slice data from the server.");
      }
  
      await nextTick();
      renderChart();
    } catch (err) {
      console.error("Slice Error:", err);
      error.value = `Failed to load slice data for height ${height.toFixed(1)}m: ${err.message}`;
      sliceData.value = null;
      cleanupChart();
      fetchTime.value = performance.now() - fetchStartTime;
      renderTime.value = 0;
      totalPoints.value = 0;
      ElMessage.error(error.value);
    } finally {
      loadingSlice.value = false;
    }
  };
  
  const handleHeightSliderInput = debounce(async (newHeight) => {
     await loadSlice(newHeight);
  }, 350);
  
  const handleSelectionChange = () => {
      console.log(`Selection changed: Lib=${selectedLibrary.value}, Type=${selectedChartType.value}`);
      if (sliceData.value) { // Only re-render if we actually have data
          renderChart();
      } else if (!loadingMeta.value && !loadingSlice.value) {
          // Attempt to load slice if no data is present and not currently loading
          loadSlice(currentHeight.value);
      }
  };
  
  const cleanupChart = () => {
    const startTime = performance.now();
    try {
        const activeLibrary = selectedLibrary.value; // Capture current library *before* potential async changes
        if (currentChartInstance) {
            if (activeLibrary === 'plotly' && chartContainerRef.value?.layout) {
                Plotly.purge(chartContainerRef.value);
                console.log("Plotly chart purged.");
            } else if (activeLibrary === 'echarts' && currentChartInstance.__disposeHandler) {
                currentChartInstance.__disposeHandler();
                console.log("ECharts instance disposed.");
            }
        }
         if (chartContainerRef.value) {
            chartContainerRef.value.innerHTML = '';
         }
    } catch(e) {
        console.warn("Error during chart cleanup:", e);
    } finally {
        currentChartInstance = null;
        renderTime.value = performance.now() - startTime;
    }
  };
  
  const renderChart = () => {
    cleanupChart();
    // **Crucial Check**: Ensure both metadata AND sliceData are loaded before proceeding
    if (loadingMeta.value || loadingSlice.value || !sliceData.value || !metadata.value || !chartContainerRef.value) {
       console.warn("RenderChart: Aborting - dependencies not ready.", {loadingMeta: loadingMeta.value, loadingSlice: loadingSlice.value, hasSlice: !!sliceData.value, hasMeta: !!metadata.value, hasRef: !!chartContainerRef.value});
       // Optionally clear performance metrics if aborting
       renderTime.value = 0;
       totalPoints.value = 0;
       return;
    }
     // **Additional Check for essential metadata properties**
     if (!metadata.value.extent || !metadata.value.xCoords || !metadata.value.yCoords) {
         error.value = "Render Aborted: Metadata is missing essential properties (extent, xCoords, yCoords).";
         console.error(error.value, metadata.value);
         ElMessage.error(error.value);
         return;
     }
     // **Additional Check for essential sliceData properties**
      if (!sliceData.value.values || !Array.isArray(sliceData.value.values)) {
         error.value = "Render Aborted: Slice data is missing or invalid.";
         console.error(error.value, sliceData.value);
         ElMessage.error(error.value);
         return;
     }
  
  
    console.log(`Rendering: ${selectedLibrary.value} ${selectedChartType.value} for H=${currentHeight.value.toFixed(1)}m`);
    const renderStartTime = performance.now();
    error.value = null; // Clear previous render errors
  
    try {
        if (selectedLibrary.value === 'plotly') {
          if (selectedChartType.value === 'heatmap') {
            renderPlotlyHeatmap();
          } else {
            renderPlotlyScatter();
          }
          currentChartInstance = chartContainerRef.value; // Store ref
        } else { // ECharts
          currentChartInstance = initEChartsInstance(chartContainerRef); // Use helper
          if(!currentChartInstance) throw new Error("Failed to initialize ECharts instance");
  
          if (selectedChartType.value === 'heatmap') {
            renderEChartsHeatmap();
          } else {
            renderEChartsScatter();
          }
        }
        renderTime.value = performance.now() - renderStartTime;
        console.log(`Render complete: ${renderTime.value.toFixed(1)} ms, Points: ${totalPoints.value}`);
  
    } catch(err) {
        console.error(`Error during ${selectedLibrary.value} ${selectedChartType.value} render:`, err);
        error.value = `Render Error: ${err.message}. Check console for details.`;
        renderTime.value = performance.now() - renderStartTime;
        totalPoints.value = 0;
        ElMessage.error(error.value);
    }
  };
  
  // --- Specific Render Functions ---
  
  const renderPlotlyHeatmap = () => {
    // Check required data
    if (!sliceData.value?.values || !metadata.value?.extent || !metadata.value?.xCoords || !metadata.value?.yCoords) {
        throw new Error("Missing data for Plotly Heatmap rendering.");
    }
    const { values } = sliceData.value;
    const { vmin, vmax, xCoords, yCoords, extent } = metadata.value;
    totalPoints.value = (values?.length || 0) * (values?.[0]?.length || 0);
  
    const trace = { x: xCoords, y: yCoords, z: values, type: 'heatmap', colorscale: 'Jet', zmin: vmin, zmax: vmax, hoverongaps: false };
    const layout = { title: null, xaxis: { title: 'X (km)', range: [extent[0], extent[1]] }, yaxis: { title: 'Y (km)', range: [extent[2], extent[3]], scaleanchor: 'x', scaleratio: 1 }, autosize: true, margin: { t: 10, l: 50, b: 40, r: 20 } };
    const config = { responsive: true, displaylogo: false };
    Plotly.react(chartContainerRef.value, [trace], layout, config);
  };
  
  const renderPlotlyScatter = () => {
      if (!sliceData.value?.values || !metadata.value?.extent || !metadata.value?.xCoords || !metadata.value?.yCoords) {
        throw new Error("Missing data for Plotly Scatter rendering.");
      }
    const { values } = sliceData.value;
    const { vmin, vmax, xCoords, yCoords, extent } = metadata.value;
    const scatterX = [], scatterY = [], scatterColor = [], scatterText = [];
    const MAX_POINTS = 50000;
    const total = (values?.length || 0) * (values?.[0]?.length || 0);
    let stepX = 1, stepY = 1;
    if (total > MAX_POINTS) { const r = Math.sqrt(total / MAX_POINTS); stepX = Math.max(1, Math.floor(r)); stepY = Math.max(1, Math.floor(r)); }
  
    for (let i = 0; i < values.length; i += stepY) {
      for (let j = 0; j < values[i].length; j += stepX) {
         if (values[i]?.[j] != null && xCoords?.[j] != null && yCoords?.[i] != null) {
          scatterX.push(xCoords[j]); scatterY.push(yCoords[i]); scatterColor.push(values[i][j]);
          scatterText.push(`X: ${xCoords[j].toFixed(2)}<br>Y: ${yCoords[i].toFixed(2)}<br>Speed: ${values[i][j].toFixed(2)}`);
         }
      }
    }
    totalPoints.value = scatterX.length;
  
    const trace = { x: scatterX, y: scatterY, mode: 'markers', type: 'scattergl', marker: { color: scatterColor, colorscale: 'Jet', cmin: vmin, cmax: vmax, size: 5, opacity: 0.7, colorbar: { title: 'Speed', titleside: 'right', tickfont: {size: 9}, titlefont:{size: 10} } }, hoverinfo: 'text', text: scatterText };
    const layout = { title: null, xaxis: { title: 'X (km)', range: [extent[0], extent[1]] }, yaxis: { title: 'Y (km)', range: [extent[2], extent[3]], scaleanchor: 'x', scaleratio: 1 }, autosize: true, margin: { t: 10, l: 50, b: 40, r: 20 }, hovermode: 'closest' };
    const config = { responsive: true, displaylogo: false };
    Plotly.react(chartContainerRef.value, [trace], layout, config);
  };
  
  const renderEChartsHeatmap = () => {
      if (!sliceData.value?.values || !metadata.value?.extent || !metadata.value?.xCoords || !metadata.value?.yCoords) {
          throw new Error("Missing data for ECharts Heatmap rendering.");
      }
    const { values } = sliceData.value;
    const { vmin, vmax, xCoords, yCoords } = metadata.value;
    const heatmapData = [];
    for (let i = 0; i < values.length; i++) { for (let j = 0; j < values[i].length; j++) { if (values[i]?.[j] != null) heatmapData.push([j, i, values[i][j]]); } }
    totalPoints.value = heatmapData.length;
    const labelStepX = Math.max(1, Math.floor(xCoords.length / 10));
    const labelStepY = Math.max(1, Math.floor(yCoords.length / 10));
     // Ensure labels align with data indices, show limited labels
    const xAxisLabels = Array(xCoords.length).fill('').map((_, i) => (i % labelStepX === 0) ? xCoords[i]?.toFixed(1) : '');
    const yAxisLabels = Array(yCoords.length).fill('').map((_, i) => (i % labelStepY === 0) ? yCoords[i]?.toFixed(1) : '');
  
    const option = {
      tooltip: { formatter: p => p.value?.length===3 ? `X: ${xCoords[p.value[0]]?.toFixed(2)}<br>Y: ${yCoords[p.value[1]]?.toFixed(2)}<br>Speed: ${p.value[2]?.toFixed(2)}` : '' },
      grid: { left: '8%', right: '8%', bottom: '15%', top: '8%' },
      xAxis: { type: 'category', data: xAxisLabels, splitArea: { show: false }, axisLabel: { interval: 0, rotate: 30, fontSize: 9 }, name: 'X (km)', nameLocation:'middle', nameGap: 25, nameTextStyle:{fontSize:10} }, // Show all generated labels
      yAxis: { type: 'category', data: yAxisLabels, splitArea: { show: false }, axisLabel: { interval: 0, fontSize: 9 }, name: 'Y (km)', nameLocation:'middle', nameGap: 35, nameTextStyle:{fontSize:10} }, // Show all generated labels
      visualMap: { min: vmin, max: vmax, calculable: true, orient: 'horizontal', left: 'center', bottom: '2%', inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] }, itemWidth: 15, itemHeight: 100, textStyle:{fontSize:9}},
      series: [{ name: 'Speed', type: 'heatmap', data: heatmapData, progressive: 5000, animation: false }]
    };
    currentChartInstance.setOption(option, { notMerge: true });
  };
  
  const renderEChartsScatter = () => {
      if (!sliceData.value?.values || !metadata.value?.extent || !metadata.value?.xCoords || !metadata.value?.yCoords) {
          throw new Error("Missing data for ECharts Scatter rendering.");
      }
    const { values } = sliceData.value;
    const { vmin, vmax, xCoords, yCoords, extent } = metadata.value;
    const scatterData = [];
    const MAX_POINTS = 50000;
    const total = (values?.length || 0) * (values?.[0]?.length || 0);
    let stepX = 1, stepY = 1;
    if (total > MAX_POINTS) { const r = Math.sqrt(total / MAX_POINTS); stepX = Math.max(1, Math.floor(r)); stepY = Math.max(1, Math.floor(r)); }
  
    for (let i = 0; i < values.length; i += stepY) {
      for (let j = 0; j < values[i].length; j += stepX) {
        if (values[i]?.[j] != null && xCoords?.[j] != null && yCoords?.[i] != null) {
          scatterData.push([xCoords[j], yCoords[i], values[i][j]]);
        }
      }
    }
    totalPoints.value = scatterData.length;
  
    const option = {
      tooltip: { formatter: p => p.value?.length===3 ? `X: ${p.value[0]?.toFixed(2)}<br>Y: ${p.value[1]?.toFixed(2)}<br>Speed: ${p.value[2]?.toFixed(2)}` : '' },
      grid: { left: '8%', right: '10%', bottom: '15%', top: '8%' },
      xAxis: { type: 'value', name: 'X (km)', min: extent[0], max: extent[1], nameTextStyle:{fontSize:10}, axisLabel:{fontSize:9} },
      yAxis: { type: 'value', name: 'Y (km)', min: extent[2], max: extent[3], nameTextStyle:{fontSize:10}, axisLabel:{fontSize:9} },
      visualMap: { min: vmin, max: vmax, calculable: true, dimension: 2, orient: 'vertical', right: 10, top: 'center', inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] }, itemHeight: 150, textStyle:{fontSize:9} },
      series: [{ name: 'Speed', type: 'scatter', data: scatterData, symbolSize: 5, itemStyle: { opacity: 0.7 }, large: true, sampling: 'lttb', progressive: 4000, progressiveThreshold: 8000 }]
    };
    currentChartInstance.setOption(option, { notMerge: true });
  };
  
  // Helper to init/dispose ECharts instance
  const initEChartsInstance = (ref) => {
      // Dispose previous ECharts instance if it exists and belongs to ECharts
      if (currentChartInstance && typeof currentChartInstance.dispose === 'function' && currentChartInstance !== chartContainerRef.value ) { // Check if it's an ECharts instance
           currentChartInstance.__disposeHandler?.();
      }
      if (ref.value) {
          const newInstance = echarts.init(ref.value, null, { renderer: 'canvas' });
          const resizeHandler = debounce(() => newInstance?.resize(), 150);
          window.addEventListener('resize', resizeHandler);
          // Store disposer directly on the instance
          newInstance.__disposeHandler = () => {
              console.log("Disposing ECharts instance and removing listener");
              window.removeEventListener('resize', resizeHandler);
              if(newInstance && !newInstance.isDisposed()){
                   newInstance.dispose();
              }
          };
          return newInstance;
      }
      return null;
  };
  
  // Resize handler
  const handleResize = debounce(() => {
      if (selectedLibrary.value === 'echarts' && currentChartInstance && typeof currentChartInstance.resize === 'function' && !currentChartInstance.isDisposed?.()) {
           currentChartInstance.resize();
      } else if (selectedLibrary.value === 'plotly' && chartContainerRef.value?.layout) {
          Plotly.Plots.resize(chartContainerRef.value);
      }
  }, 200);
  
  // --- Lifecycle Hooks ---
  onMounted(() => {
    loadMeta();
    window.addEventListener('resize', handleResize);
  });
  
  onUnmounted(() => {
    cleanupChart(); // Ensure cleanup on unmount
    window.removeEventListener('resize', handleResize);
  });
  
  // Watcher for Case ID change
  watch(() => caseId.value, (newId, oldId) => {
      if (newId && newId !== oldId) {
          console.log(`Tester: Case ID changed to ${newId}. Reloading.`);
          cleanupChart();
          sliceData.value = null;
          metadata.value = null;
          loadingMeta.value = true; // Set loadingMeta during reload
          loadMeta();
      }
  }, { immediate: false });
  
  </script>
  
  <style scoped>
  /* ... (Keep the styles from the previous ComprehensiveVizTester.vue example) ... */
  .comprehensive-tester { padding: 15px; background-color: #f4f6f9; height: calc(100vh - 60px); display: flex; flex-direction: column; gap: 15px; }
  h2 { margin: 0 0 5px 0; font-size: 1.2em; }
  p { margin: 0 0 10px 0; font-size: 0.9em; color: #666; }
  .controls-card { padding: 10px 15px; flex-shrink: 0; }
  .el-row { align-items: center; gap: 10px 0; }
  .slider-control { display: flex; align-items: center; gap: 10px; }
  .slider-label { font-size: 13px; color: #606266; white-space: nowrap; }
  .el-radio-group { display: flex; }
  .el-radio-button :deep(.el-radio-button__inner) { font-size: 12px; padding: 8px 10px; }
  .chart-card { flex-grow: 1; display: flex; flex-direction: column; min-height: 400px; overflow: hidden; }
  .chart-card :deep(.el-card__header) { padding: 8px 15px; border-bottom: 1px solid #eee; }
  .chart-card :deep(.el-card__body) { flex-grow: 1; padding: 5px; display: flex; justify-content: center; align-items: center; position: relative; }
  .chart-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: bold; }
  .perf-stats { font-size: 10px; font-weight: normal; color: #888; display: flex; gap: 10px; }
  .perf-stats span { background-color: #eee; padding: 2px 5px; border-radius: 3px; }
  .loading-indicator, .error-indicator, .no-data-indicator { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; justify-content: center; align-items: center; color: #666; text-align: center; padding: 20px; }
  .loading-indicator .el-icon { margin-bottom: 8px; font-size: 24px;}
  .error-indicator .el-alert { max-width: 90%; }
  .no-data-indicator span { font-style: italic; color: #aaa; }
  .chart-container { width: 100%; height: 100%; min-height: 350px; } /* Adjusted min-height */
  .notes { margin-top: 15px; padding: 12px; background-color: #eef2f7; border-radius: 4px; font-size: 12px; color: #555; line-height: 1.5; flex-shrink: 0; }
  .notes h3 { margin: 0 0 8px 0; font-size: 13px; }
  .notes ul { padding-left: 18px; margin: 0; }
  @media (max-width: 768px) { .el-col { margin-bottom: 10px; } .slider-control { flex-direction: column; align-items: flex-start; } }
  </style>