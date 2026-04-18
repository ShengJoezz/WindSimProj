<template>
  <div class="lab-viewer">
    <div class="toolbar">
      <div class="toolbar-item">
        <span class="label">高度</span>
        <el-select
          v-model="selectedHeight"
          class="select"
          :disabled="loading || !availableHeights.length"
          @change="loadScene"
        >
          <el-option
            v-for="height in availableHeights"
            :key="height"
            :label="`${height} m`"
            :value="height"
          />
        </el-select>
      </div>

      <div class="toolbar-item">
        <span class="label">流线模式</span>
        <el-radio-group v-model="streamlineStyle" size="small" @change="handleRenderOptionsChange">
          <el-radio-button value="tube">Tube</el-radio-button>
          <el-radio-button value="line">Line</el-radio-button>
        </el-radio-group>
      </div>

      <div class="toolbar-item toolbar-item--wide">
        <span class="label">展示流线数</span>
        <el-slider
          v-model="displayLineBudget"
          :min="80"
          :max="360"
          :step="20"
          show-input
          input-size="small"
          @change="handleRenderOptionsChange"
        />
      </div>

      <div class="toolbar-item">
        <span class="label">粒子动画</span>
        <el-switch v-model="showParticles" @change="rebuildParticleSystem" />
      </div>

      <div class="toolbar-item">
        <span class="label">刷新</span>
        <el-button type="primary" plain :loading="loading" @click="loadScene">重载</el-button>
      </div>
    </div>

    <div class="viewer-shell">
      <div ref="vtkContainer" class="vtk-host"></div>

      <div v-if="loading" class="overlay overlay--loading">
        <div class="spinner"></div>
        <div class="overlay-title">{{ loadingText }}</div>
      </div>

      <div v-else-if="errorMessage" class="overlay overlay--error">
        <div class="overlay-title">实验页加载失败</div>
        <div class="overlay-text">{{ errorMessage }}</div>
        <el-button type="primary" @click="loadScene">重试</el-button>
      </div>

      <div class="chip-row">
        <div class="chip">
          <span>流线文件</span>
          <strong>{{ streamlineFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>切片文件</span>
          <strong>{{ surfaceFileLabel }}</strong>
        </div>
        <div class="chip">
          <span>策略</span>
          <strong>{{ renderLabel }}</strong>
        </div>
      </div>

      <div class="legend">
        <div class="legend-top">
          <span>JET</span>
          <span>速度大小 (m/s)</span>
        </div>
        <div class="legend-bar" :style="legendBarStyle"></div>
        <div class="legend-ticks">
          <span v-for="tick in legendTicks" :key="tick">{{ tick }}</span>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span>原始流线</span>
        <strong>{{ rawLineCount }}</strong>
      </div>
      <div class="stat">
        <span>展示流线</span>
        <strong>{{ displayedLineCount }}</strong>
      </div>
      <div class="stat">
        <span>展示点数</span>
        <strong>{{ displayedPointCount }}</strong>
      </div>
      <div class="stat">
        <span>活动粒子</span>
        <strong>{{ liveParticleCount }}</strong>
      </div>
      <div class="stat">
        <span>速度范围</span>
        <strong>{{ speedRangeLabel }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkCellArray from '@kitware/vtk.js/Common/Core/CellArray';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkGlyph3DMapper from '@kitware/vtk.js/Rendering/Core/Glyph3DMapper';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkTubeFilter from '@kitware/vtk.js/Filters/General/TubeFilter';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import { ColorMode, ScalarMode } from '@kitware/vtk.js/Rendering/Core/Mapper/Constants';

import { SIMULATION_JET_STOPS, buildCssGradient } from '@/utils/colormaps';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const vtkContainer = ref(null);
const availableHeights = ref([]);
const selectedHeight = ref(null);
const streamlineStyle = ref('tube');
const displayLineBudget = ref(180);
const showParticles = ref(true);
const loading = ref(false);
const loadingText = ref('正在读取实验数据...');
const errorMessage = ref('');
const rawLineCount = ref(0);
const displayedLineCount = ref(0);
const displayedPointCount = ref(0);
const liveParticleCount = ref(0);
const speedRange = ref({ min: 0, max: 1 });

let fullScreenRenderer = null;
let renderer = null;
let renderWindow = null;
let rawSurfaceData = null;
let rawStreamlineData = null;
let surfaceActor = null;
let streamlineActor = null;
let particleActor = null;
let particleStates = [];
let particlePoints = null;
let particlePolyData = null;
let particleBuffer = null;
let animationFrameId = null;
let displayState = null;
const handleWindowResize = () => fullScreenRenderer?.resize();

const streamlineFileLabel = computed(() => (
  selectedHeight.value ? `internal_${selectedHeight.value}m_web.vtp` : '-'
));

const surfaceFileLabel = computed(() => (
  selectedHeight.value ? `${selectedHeight.value}.vtp` : '-'
));

const renderLabel = computed(() => (
  `${streamlineStyle.value === 'tube' ? 'Tube' : 'Line'}${showParticles.value ? ' + 粒子' : ''}`
));

const legendBarStyle = computed(() => ({
  background: buildCssGradient(SIMULATION_JET_STOPS, '90deg'),
}));

const legendTicks = computed(() => {
  const min = Number(speedRange.value.min ?? 0);
  const max = Number(speedRange.value.max ?? 1);
  const safeMax = Math.abs(max - min) < 1e-6 ? min + 1 : max;
  return Array.from({ length: 5 }, (_, index) => (
    (min + ((safeMax - min) * index) / 4).toFixed(2)
  ));
});

const speedRangeLabel = computed(() => (
  `${Number(speedRange.value.min ?? 0).toFixed(2)} ~ ${Number(speedRange.value.max ?? 1).toFixed(2)} m/s`
));

function safeRender() {
  if (renderWindow) renderWindow.render();
}

function normalizeRange(range) {
  const min = Number(range?.[0] ?? 0);
  const maxRaw = Number(range?.[1] ?? min + 1);
  const max = Math.abs(maxRaw - min) < 1e-6 ? min + 1 : maxRaw;
  return { min, max };
}

function ensureSpeedMagnitude(dataSet) {
  const pointData = dataSet?.getPointData?.();
  const cellData = dataSet?.getCellData?.();

  const existingPoint = pointData?.getArrayByName?.('speedMagnitude');
  if (existingPoint) return { association: 'point', range: normalizeRange(existingPoint.getRange()) };

  const existingCell = cellData?.getArrayByName?.('speedMagnitude');
  if (existingCell) return { association: 'cell', range: normalizeRange(existingCell.getRange()) };

  const vectorArray = pointData?.getArrayByName?.('U') || cellData?.getArrayByName?.('U');
  const holder = pointData?.getArrayByName?.('U') ? pointData : cellData;
  const association = pointData?.getArrayByName?.('U') ? 'point' : 'cell';
  if (!vectorArray || !holder) return null;

  const values = vectorArray.getData();
  const tupleCount = vectorArray.getNumberOfTuples();
  const compCount = vectorArray.getNumberOfComponents();
  const speeds = new Float32Array(tupleCount);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < tupleCount; index += 1) {
    const offset = index * compCount;
    const ux = Number(values[offset] ?? 0);
    const uy = Number(values[offset + 1] ?? 0);
    const uz = Number(values[offset + 2] ?? 0);
    const magnitude = Math.sqrt((ux * ux) + (uy * uy) + (uz * uz));
    speeds[index] = magnitude;
    if (magnitude < min) min = magnitude;
    if (magnitude > max) max = magnitude;
  }

  const magnitudeArray = vtkDataArray.newInstance({
    name: 'speedMagnitude',
    values: speeds,
    numberOfComponents: 1,
  });
  holder.addArray(magnitudeArray);
  if (association === 'point' && holder.setScalars) holder.setScalars(magnitudeArray);
  dataSet.modified();
  return { association, range: normalizeRange([min, max]) };
}

function mergeRanges(...ranges) {
  const valid = ranges.filter((item) => item && Number.isFinite(item.min) && Number.isFinite(item.max));
  if (!valid.length) return { min: 0, max: 1 };
  return normalizeRange([
    Math.min(...valid.map((item) => item.min)),
    Math.max(...valid.map((item) => item.max)),
  ]);
}

async function loadPolyData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`读取失败: ${url}`);
  const buffer = await response.arrayBuffer();
  const reader = vtkXMLPolyDataReader.newInstance();
  reader.parseAsArrayBuffer(buffer);
  return reader.getOutputData(0);
}

function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function createDisplayState(polyData, maxLines, pointStride = 8) {
  const lines = polyData?.getLines?.()?.getData?.();
  const points = polyData?.getPoints?.()?.getData?.();
  const speeds = polyData?.getPointData?.()?.getArrayByName?.('speedMagnitude')?.getData?.();
  if (!lines?.length || !points?.length) return null;

  let totalLines = 0;
  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1 + count;
    totalLines += 1;
  }

  const step = Math.max(1, Math.ceil(totalLines / Math.max(1, maxLines)));
  const outPoints = [];
  const outLines = [];
  const outSpeeds = [];
  const trajectories = [];
  let nextPointId = 0;
  let lineIndex = 0;

  for (let cursor = 0; cursor < lines.length;) {
    const count = Number(lines[cursor] ?? 0);
    cursor += 1;
    const ids = lines.slice(cursor, cursor + count);
    cursor += count;

    if (count < 2 || lineIndex % step !== 0) {
      lineIndex += 1;
      continue;
    }

    const sampledIds = [];
    for (let index = 0; index < ids.length; index += pointStride) sampledIds.push(Number(ids[index]));
    const lastId = Number(ids[ids.length - 1]);
    if (sampledIds[sampledIds.length - 1] !== lastId) sampledIds.push(lastId);
    if (sampledIds.length < 2) {
      lineIndex += 1;
      continue;
    }

    const trajectoryPoints = [];
    const segmentLengths = [];
    let pathLength = 0;
    outLines.push(sampledIds.length);

    sampledIds.forEach((pointId) => {
      const offset = pointId * 3;
      const point = {
        x: Number(points[offset] ?? 0),
        y: Number(points[offset + 1] ?? 0),
        z: Number(points[offset + 2] ?? 0),
        speed: Number(speeds?.[pointId] ?? 0),
      };
      if (trajectoryPoints.length > 0) {
        const segmentLength = distance3(trajectoryPoints[trajectoryPoints.length - 1], point);
        segmentLengths.push(segmentLength);
        pathLength += segmentLength;
      }
      trajectoryPoints.push(point);
      outPoints.push(point.x, point.y, point.z);
      outSpeeds.push(point.speed);
      outLines.push(nextPointId);
      nextPointId += 1;
    });

    if (pathLength > 1e-6) trajectories.push({ points: trajectoryPoints, segmentLengths, length: pathLength });
    lineIndex += 1;
  }

  const displayPolyData = vtkPolyData.newInstance();
  const displayPoints = vtkPoints.newInstance();
  displayPoints.setData(Float32Array.from(outPoints), 3);
  displayPolyData.setPoints(displayPoints);
  displayPolyData.setLines(vtkCellArray.newInstance({ values: Uint32Array.from(outLines) }));
  const speedArray = vtkDataArray.newInstance({
    name: 'speedMagnitude',
    values: Float32Array.from(outSpeeds),
    numberOfComponents: 1,
  });
  displayPolyData.getPointData().addArray(speedArray);
  displayPolyData.getPointData().setScalars(speedArray);

  return {
    polyData: displayPolyData,
    trajectories,
    totalLines,
    displayedLines: trajectories.length,
    displayedPoints: outSpeeds.length,
  };
}

function createLookupTable(range) {
  const table = vtkColorTransferFunction.newInstance();
  SIMULATION_JET_STOPS.forEach(([position, rgb]) => {
    const value = range.min + ((range.max - range.min) * position);
    table.addRGBPoint(value, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  });
  return table;
}

function applyScalarColoring(mapper, association, lookupTable) {
  mapper.setLookupTable(lookupTable);
  mapper.setScalarRange(speedRange.value.min, speedRange.value.max);
  mapper.setColorMode(ColorMode.MAP_SCALARS);
  mapper.setInterpolateScalarsBeforeMapping(true);
  mapper.setColorByArrayName('speedMagnitude');
  mapper.setScalarMode(
    association === 'cell' ? ScalarMode.USE_CELL_FIELD_DATA : ScalarMode.USE_POINT_FIELD_DATA,
  );
}

function clearActor(actor) {
  if (actor && renderer) renderer.removeActor(actor);
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function sampleTrajectory(trajectory, distance) {
  const wrapped = ((distance % trajectory.length) + trajectory.length) % trajectory.length;
  let walked = 0;
  for (let index = 0; index < trajectory.segmentLengths.length; index += 1) {
    const length = trajectory.segmentLengths[index];
    const next = walked + length;
    if (wrapped <= next || index === trajectory.segmentLengths.length - 1) {
      const start = trajectory.points[index];
      const end = trajectory.points[index + 1];
      const ratio = length > 1e-6 ? (wrapped - walked) / length : 0;
      return {
        x: start.x + ((end.x - start.x) * ratio),
        y: start.y + ((end.y - start.y) * ratio),
        z: start.z + ((end.z - start.z) * ratio),
      };
    }
    walked = next;
  }
  return trajectory.points[trajectory.points.length - 1];
}

function rebuildParticleSystem() {
  stopAnimation();
  clearActor(particleActor);
  particleActor = null;
  particlePoints = null;
  particlePolyData = null;
  particleBuffer = null;
  particleStates = [];
  liveParticleCount.value = 0;

  if (!showParticles.value || !displayState?.trajectories?.length || !renderer) {
    safeRender();
    return;
  }

  const particleLimit = Math.min(120, displayState.trajectories.length);
  particleStates = Array.from({ length: particleLimit }, (_, index) => {
    const trajectory = displayState.trajectories[index];
    return { trajectory, distance: (trajectory.length * index) / particleLimit, step: Math.max(trajectory.length * 0.0022, 0.8) };
  });
  particleBuffer = new Float32Array(particleLimit * 3);
  particlePoints = vtkPoints.newInstance();
  particlePoints.setData(particleBuffer, 3);
  particlePolyData = vtkPolyData.newInstance();
  particlePolyData.setPoints(particlePoints);

  const mapper = vtkGlyph3DMapper.newInstance();
  mapper.setInputData(particlePolyData);
  mapper.setSourceConnection(vtkSphereSource.newInstance({ radius: 22, thetaResolution: 14, phiResolution: 14 }).getOutputPort());
  mapper.setScaling(false);
  mapper.setOrient(false);

  particleActor = vtkActor.newInstance();
  particleActor.setMapper(mapper);
  particleActor.getProperty().setColor(0.99, 0.95, 0.88);
  particleActor.getProperty().setOpacity(0.92);
  renderer.addActor(particleActor);
  liveParticleCount.value = particleLimit;

  const tick = () => {
    particleStates.forEach((state, index) => {
      const point = sampleTrajectory(state.trajectory, state.distance);
      const offset = index * 3;
      particleBuffer[offset] = point.x;
      particleBuffer[offset + 1] = point.y;
      particleBuffer[offset + 2] = point.z;
      state.distance += state.step;
    });
    particlePoints.modified();
    particlePolyData.modified();
    safeRender();
    animationFrameId = requestAnimationFrame(tick);
  };

  tick();
}

function handleRenderOptionsChange() {
  renderScene(false);
}

function renderScene(resetCamera = false) {
  if (!renderer || !rawSurfaceData || !rawStreamlineData) return;

  clearActor(surfaceActor);
  clearActor(streamlineActor);
  surfaceActor = null;
  streamlineActor = null;

  const surfaceMeta = ensureSpeedMagnitude(rawSurfaceData);
  const streamlineMeta = ensureSpeedMagnitude(rawStreamlineData);
  speedRange.value = mergeRanges(surfaceMeta?.range, streamlineMeta?.range);
  displayState = createDisplayState(rawStreamlineData, displayLineBudget.value);
  rawLineCount.value = Number(displayState?.totalLines ?? 0);
  displayedLineCount.value = Number(displayState?.displayedLines ?? 0);
  displayedPointCount.value = Number(displayState?.displayedPoints ?? 0);

  const lookupTable = createLookupTable(speedRange.value);

  const surfaceMapper = vtkMapper.newInstance();
  surfaceMapper.setInputData(rawSurfaceData);
  if (surfaceMeta) applyScalarColoring(surfaceMapper, surfaceMeta.association, lookupTable);
  surfaceActor = vtkActor.newInstance();
  surfaceActor.setMapper(surfaceMapper);
  surfaceActor.getProperty().setOpacity(0.62);
  renderer.addActor(surfaceActor);

  if (displayState?.polyData) {
    const streamlineMapper = vtkMapper.newInstance();
    if (streamlineStyle.value === 'tube') {
      const tube = vtkTubeFilter.newInstance();
      tube.setInputData(displayState.polyData);
      tube.setRadius(14);
      tube.setNumberOfSides(14);
      tube.update();
      streamlineMapper.setInputData(tube.getOutputData());
    } else {
      streamlineMapper.setInputData(displayState.polyData);
    }
    applyScalarColoring(streamlineMapper, 'point', lookupTable);
    streamlineActor = vtkActor.newInstance();
    streamlineActor.setMapper(streamlineMapper);
    if (streamlineStyle.value === 'line') streamlineActor.getProperty().setLineWidth(2.5);
    renderer.addActor(streamlineActor);
  }

  rebuildParticleSystem();

  if (resetCamera) {
    renderer.resetCamera();
    renderer.getActiveCamera().elevation(14);
    renderer.getActiveCamera().azimuth(18);
    renderer.resetCameraClippingRange();
  }

  safeRender();
}

async function fetchAvailableHeights() {
  const response = await axios.get(`/api/cases/${props.caseId}/list-velocity-files`);
  const heights = (response.data?.files || [])
    .map((fileName) => /^(\d+)\.vtp$/i.exec(String(fileName)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  availableHeights.value = heights;
  if (!heights.length) throw new Error('当前工况没有可用于实验页的切片 VTP 文件。');
  if (!heights.includes(Number(selectedHeight.value))) selectedHeight.value = heights[0];
}

async function loadScene() {
  if (!selectedHeight.value || !renderer) return;
  loading.value = true;
  loadingText.value = `正在读取 ${selectedHeight.value} m 的真实 VTP 数据...`;
  errorMessage.value = '';
  stopAnimation();

  try {
    const surfaceUrl = `/uploads/${props.caseId}/run/postProcessing/Data/${selectedHeight.value}.vtp`;
    const streamlineUrl = `/uploads/${props.caseId}/run/VTK/processed/internal_${selectedHeight.value}m_web.vtp`;
    const [surfaceData, streamlineData] = await Promise.all([
      loadPolyData(surfaceUrl),
      loadPolyData(streamlineUrl),
    ]);
    rawSurfaceData = surfaceData;
    rawStreamlineData = streamlineData;
    renderScene(true);
  } catch (error) {
    console.error('实验页加载失败:', error);
    errorMessage.value = error?.message || '实验数据读取失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function initRenderer() {
  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    container: vtkContainer.value,
    rootContainer: vtkContainer.value,
    background: [0.07, 0.1, 0.14],
    containerStyle: { width: '100%', height: '100%', position: 'absolute', inset: '0' },
  });
  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();
  renderer.setTwoSidedLighting(true);
  renderer.setAutomaticLightCreation(true);
}

onMounted(async () => {
  await nextTick();
  if (!vtkContainer.value) return;
  initRenderer();
  window.addEventListener('resize', handleWindowResize);

  try {
    loading.value = true;
    loadingText.value = '正在读取可用高度列表...';
    await fetchAvailableHeights();
    await loadScene();
  } catch (error) {
    errorMessage.value = error?.message || '初始化实验页失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  stopAnimation();
  window.removeEventListener('resize', handleWindowResize);
  clearActor(surfaceActor);
  clearActor(streamlineActor);
  clearActor(particleActor);
  try {
    fullScreenRenderer?.delete();
  } catch (error) {
    console.warn('释放实验页渲染器失败:', error);
  }
});
</script>

<style scoped>
.lab-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-item--wide {
  grid-column: span 2;
}

.label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.select {
  width: 100%;
}

.viewer-shell {
  position: relative;
  min-height: 720px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
}

.vtk-host {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  backdrop-filter: blur(14px);
}

.overlay--loading {
  background: rgba(15, 23, 42, 0.6);
  color: #f8fafc;
}

.overlay--error {
  background: rgba(15, 23, 42, 0.72);
  color: #fff7ed;
}

.overlay-title {
  font-size: 18px;
  font-weight: 700;
}

.overlay-text {
  max-width: 420px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
}

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 4px solid rgba(255, 255, 255, 0.18);
  border-top-color: #facc15;
  animation: spin 0.9s linear infinite;
}

.chip-row {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  min-width: 150px;
  padding: 10px 14px;
  border-radius: 15px;
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.chip span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.7);
}

.chip strong {
  color: #f8fafc;
  font-size: 13px;
}

.legend {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 4;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 36px));
  padding: 12px 16px 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.95);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.legend-top,
.legend-ticks {
  display: flex;
  justify-content: space-between;
}

.legend-top {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.legend-bar {
  height: 16px;
  border-radius: 999px;
}

.legend-ticks {
  margin-top: 8px;
  font-size: 11px;
  color: #475569;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.stat {
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.stat span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}

.stat strong {
  font-size: 18px;
  color: #0f172a;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .toolbar,
  .stats {
    grid-template-columns: 1fr;
  }

  .toolbar-item--wide {
    grid-column: span 1;
  }

  .viewer-shell {
    min-height: 540px;
  }
}
</style>
