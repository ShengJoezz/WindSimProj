<template>
  <div class="visualization-lab">
    <el-card shadow="hover" class="hero-card">
      <template #header>
        <div class="hero-header">
          <h2>可视化实验路由</h2>
          <span class="route-badge">/visualization-lab</span>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="该页面仅用于新库验证，不接入业务流程，也不替换现有结果展示。"
        description="若控制台出现 Tracking Prevention blocked access to storage，多数情况下只是浏览器隐私策略提示，不一定是功能失败原因。"
      />

      <div class="hero-actions">
        <el-button type="primary" :loading="loading" @click="initializeCesiumWind">
          初始化 Cesium + cesium-wind
        </el-button>
        <el-button :disabled="!hasActiveScene" @click="destroyScene">
          销毁场景
        </el-button>
      </div>
    </el-card>

    <div class="panel-grid">
      <el-card shadow="never">
        <template #header>
          <strong>实验参数</strong>
        </template>
        <div class="control-block">
          <span class="control-label">粒子数量: {{ particleCount }}</span>
          <el-slider v-model="particleCount" :min="500" :max="8000" :step="100" />
        </div>
        <div class="control-block">
          <span class="control-label">速度缩放: {{ velocityScale.toFixed(5) }}</span>
          <el-slider v-model="velocityScale" :min="0.00002" :max="0.0002" :step="0.00001" />
        </div>
        <div class="control-block">
          <span class="control-label">线宽: {{ lineWidth.toFixed(1) }}</span>
          <el-slider v-model="lineWidth" :min="0.5" :max="4" :step="0.1" />
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <strong>状态</strong>
        </template>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="Cesium">
            {{ dependencyStatus.cesium }}
          </el-descriptions-item>
          <el-descriptions-item label="Cesium 来源">
            {{ dependencySource.cesium }}
          </el-descriptions-item>
          <el-descriptions-item label="cesium-wind">
            {{ dependencyStatus.cesiumWind }}
          </el-descriptions-item>
          <el-descriptions-item label="cesium-wind 来源">
            {{ dependencySource.cesiumWind }}
          </el-descriptions-item>
          <el-descriptions-item label="场景状态">
            {{ sceneStatus }}
          </el-descriptions-item>
          <el-descriptions-item label="最近日志">
            {{ lastLog }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>

    <el-card shadow="hover" class="viewer-card">
      <template #header>
        <div class="viewer-header">
          <strong>Cesium Wind 沙盒</strong>
          <span>Mock 数据驱动，便于快速验证效果与性能</span>
        </div>
      </template>
      <div ref="viewerContainerRef" class="viewer-container"></div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';

const CESIUM_VERSION = '1.138.0';
const CESIUM_WIND_VERSION = '1.0.4';
const CESIUM_BASE_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`,
  `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/`,
];
const CESIUM_WIND_SCRIPT_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/cesium-wind@${CESIUM_WIND_VERSION}/dist/cesium-wind.js`,
  `https://unpkg.com/cesium-wind@${CESIUM_WIND_VERSION}/dist/cesium-wind.js`,
];

const viewerContainerRef = ref(null);
const loading = ref(false);
const sceneStatus = ref('未初始化');
const lastLog = ref('等待初始化');
const dependencyStatus = ref({
  cesium: '未加载',
  cesiumWind: '未加载',
});
const dependencySource = ref({
  cesium: '-',
  cesiumWind: '-',
});

const particleCount = ref(2500);
const velocityScale = ref(0.00008);
const lineWidth = ref(1.4);

let viewer = null;
let windLayer = null;

const hasActiveScene = computed(() => Boolean(viewer) && sceneStatus.value === '运行中');

const scriptLoaders = new Map();

function ensureCss(href) {
  if (document.querySelector(`link[data-viz-lab="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.vizLab = href;
  document.head.appendChild(link);
}

function ensureScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptLoaders.has(url)) return scriptLoaders.get(url);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.vizLab = url;
    script.onload = () => {
      if (window[globalName]) {
        resolve(window[globalName]);
        return;
      }
      reject(new Error(`脚本已加载但找不到全局对象: ${globalName}`));
    };
    script.onerror = () => reject(new Error(`脚本加载失败: ${url}`));
    document.head.appendChild(script);
  });

  const guardedPromise = promise.catch((error) => {
    scriptLoaders.delete(url);
    throw error;
  });

  scriptLoaders.set(url, guardedPromise);
  return guardedPromise;
}

async function loadCesiumFromCandidates() {
  const errors = [];
  for (const baseUrl of CESIUM_BASE_CANDIDATES) {
    const cssUrl = `${baseUrl}Widgets/widgets.css`;
    const jsUrl = `${baseUrl}Cesium.js`;
    try {
      window.CESIUM_BASE_URL = baseUrl;
      ensureCss(cssUrl);
      const Cesium = await ensureScript(jsUrl, 'Cesium');
      return { Cesium, source: jsUrl };
    } catch (error) {
      errors.push(`${jsUrl} -> ${error.message}`);
    }
  }
  throw new Error(`Cesium 加载失败。${errors.join(' | ')}`);
}

async function loadCesiumWindFromCandidates() {
  const errors = [];
  for (const url of CESIUM_WIND_SCRIPT_CANDIDATES) {
    try {
      const CesiumWind = await ensureScript(url, 'CesiumWind');
      return { CesiumWind, source: url };
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
    }
  }
  throw new Error(`cesium-wind 加载失败。${errors.join(' | ')}`);
}

function buildMockWindData() {
  const nx = 80;
  const ny = 40;
  const lo1 = 70;
  const lo2 = 140;
  const la1 = 55;
  const la2 = 15;
  const dx = (lo2 - lo1) / (nx - 1);
  const dy = (la1 - la2) / (ny - 1);
  const uData = [];
  const vData = [];

  for (let y = 0; y < ny; y += 1) {
    const lat = la1 - y * dy;
    for (let x = 0; x < nx; x += 1) {
      const lon = lo1 + x * dx;
      const u = Math.cos(lat * Math.PI / 180) * 6 + Math.sin(lon * Math.PI / 90) * 2;
      const v = Math.sin(lat * Math.PI / 180) * 4 + Math.cos(lon * Math.PI / 120) * 2;
      uData.push(u);
      vData.push(v);
    }
  }

  const baseHeader = {
    parameterCategory: 2,
    nx,
    ny,
    lo1,
    la1,
    lo2,
    la2,
    dx,
    dy,
    refTime: '2026-01-01 00:00:00',
  };

  return [
    { header: { ...baseHeader, parameterNumber: 2 }, data: uData },
    { header: { ...baseHeader, parameterNumber: 3 }, data: vData },
  ];
}

async function initializeCesiumWind() {
  if (!viewerContainerRef.value) return;

  loading.value = true;
  sceneStatus.value = '初始化中';
  lastLog.value = '正在加载依赖...';

  try {
    const cesiumResult = await loadCesiumFromCandidates();
    dependencyStatus.value.cesium = `已加载 (${CESIUM_VERSION})`;
    dependencySource.value.cesium = cesiumResult.source;

    const cesiumWindResult = await loadCesiumWindFromCandidates();
    dependencyStatus.value.cesiumWind = `已加载 (${CESIUM_WIND_VERSION})`;
    dependencySource.value.cesiumWind = cesiumWindResult.source;

    destroyScene();

    const Cesium = cesiumResult.Cesium;
    const CesiumWind = cesiumWindResult.CesiumWind;

    viewer = new Cesium.Viewer(viewerContainerRef.value, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    viewer.scene.imageryLayers.removeAll();
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0f172a');
    viewer.scene.fog.enabled = false;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(105, 34, 4000000),
      duration: 0,
    });

    const windData = buildMockWindData();
    const options = {
      velocityScale: velocityScale.value,
      lineWidth: lineWidth.value,
      paths: particleCount.value,
      maxAge: 90,
      colorScale: [
        'rgb(36,104,180)',
        'rgb(60,157,194)',
        'rgb(128,205,193)',
        'rgb(151,218,168)',
        'rgb(198,231,181)',
        'rgb(238,247,217)',
        'rgb(255,238,159)',
        'rgb(252,217,125)',
        'rgb(255,182,100)',
        'rgb(252,150,75)',
        'rgb(250,112,52)',
        'rgb(245,64,32)',
        'rgb(237,45,28)',
        'rgb(220,24,32)',
        'rgb(180,0,35)',
      ],
    };

    windLayer = new CesiumWind.WindLayer(windData, options);
    windLayer.addTo(viewer);

    sceneStatus.value = '运行中';
    lastLog.value = `Cesium Wind 已启动（${dependencySource.value.cesiumWind}）`;
  } catch (error) {
    console.error('Visualization lab init failed:', error);
    sceneStatus.value = '初始化失败';
    lastLog.value = error.message || '未知错误';
    ElMessage.error(`实验场景初始化失败: ${lastLog.value}`);
  } finally {
    loading.value = false;
  }
}

function destroyScene() {
  try {
    if (windLayer) {
      if (typeof windLayer.remove === 'function') {
        windLayer.remove();
      } else if (typeof windLayer.removeFrom === 'function' && viewer) {
        windLayer.removeFrom(viewer);
      }
    }
  } catch (error) {
    console.warn('Wind layer destroy warning:', error);
  } finally {
    windLayer = null;
  }

  if (viewer && typeof viewer.isDestroyed === 'function' && !viewer.isDestroyed()) {
    viewer.destroy();
  }
  viewer = null;
  sceneStatus.value = '已销毁';
  lastLog.value = '场景资源已释放';
}

onBeforeUnmount(() => {
  destroyScene();
});
</script>

<style scoped>
.visualization-lab {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #e5edf8;
}

.hero-card {
  border: 1px solid rgba(120, 172, 255, 0.2);
  background: linear-gradient(160deg, rgba(21, 35, 60, 0.95), rgba(12, 20, 35, 0.95));
}

.hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-header h2 {
  margin: 0;
  font-size: 20px;
  color: #d7e8ff;
}

.route-badge {
  font-size: 12px;
  color: #a8c5ff;
  background: rgba(76, 127, 211, 0.2);
  border: 1px solid rgba(109, 159, 241, 0.4);
  border-radius: 999px;
  padding: 2px 10px;
}

.hero-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.control-block + .control-block {
  margin-top: 14px;
}

.control-label {
  display: inline-block;
  margin-bottom: 6px;
  color: #b8c9e5;
}

.viewer-card {
  border: 1px solid rgba(120, 172, 255, 0.2);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: #dce8ff;
}

.viewer-header span {
  font-size: 12px;
  color: #98afd5;
}

.viewer-container {
  width: 100%;
  height: 68vh;
  min-height: 420px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(106, 151, 230, 0.25);
}

@media (max-width: 960px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .viewer-container {
    height: 56vh;
    min-height: 360px;
  }
}
</style>
