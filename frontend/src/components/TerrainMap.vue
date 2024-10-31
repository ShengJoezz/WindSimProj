<!-- frontend/src/components/TerrainMap.vue -->
<template>
  <div class="map-container">
    <div id="terrain-container" ref="terrainContainer"></div>
    <div v-if="hasGeoTIFF" class="legend">
      <h4>地形高程(m)</h4>
      <div class="legend-container">
        <div class="color-bar"></div>
        <div class="elevation-labels">
          <div class="label-container">
            <span v-for="label in elevationLabels" 
                  :key="label" 
                  class="elevation-label">
              {{ label }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="default-view">
      <p>请选择一个工况以查看详细信息。</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMapStore } from '../store/mapStore';
import { ElLoading, ElMessage } from 'element-plus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import axios from 'axios';
import { fromArrayBuffer } from 'geotiff';

// DOM 引用
const terrainContainer = ref(null);

// 路由和状态管理
const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

// Three.js 基础变量
let scene, camera, renderer, controls;
let terrainMesh = null;

// 状态
const hasGeoTIFF = ref(false);
const minElevation = ref(0);
const maxElevation = ref(1000);

// 颜色映射
const elevationColors = [
  '#193C17', // 深绿 - 低海拔
  '#2B573A', // 森林绿
  '#527D54', // 浅绿
  '#C4A484', // 浅棕
  '#8B4513', // 深棕
  '#F5F5F5'  // 浅灰白 - 高海拔(雪)
];

// 高程到颜色的映射函数
const getElevationColor = (elevation) => {
  const colorStops = [
    { threshold: 0, color: elevationColors[0] },
    { threshold: 0.2, color: elevationColors[1] },
    { threshold: 0.4, color: elevationColors[2] },
    { threshold: 0.6, color: elevationColors[3] },
    { threshold: 0.8, color: elevationColors[4] },
    { threshold: 1.0, color: elevationColors[5] }
  ];

  const normalizedElevation = (elevation - minElevation.value) / (maxElevation.value - minElevation.value);
  const clamped = Math.min(Math.max(normalizedElevation, 0), 1);

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (clamped <= colorStops[i + 1].threshold) {
      const t = (clamped - colorStops[i].threshold) / (colorStops[i + 1].threshold - colorStops[i].threshold);
      const color1 = hexToRgb(colorStops[i].color);
      const color2 = hexToRgb(colorStops[i + 1].color);
      if (color1 && color2) {
        const r = color1.r + (color2.r - color1.r) * t;
        const g = color1.g + (color2.g - color1.g) * t;
        const b = color1.b + (color2.b - color1.b) * t;
        return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
      }
    }
  }
  return colorStops[colorStops.length -1].color;
};

// HEX 转 RGB
const hexToRgb = (hex) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
      }
    : null;
};

// 初始化 Three.js 场景
const initThreeJS = () => {
  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // 创建相机
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.position.set(0, 1000, 1000);
  camera.lookAt(0, 0, 0);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  terrainContainer.value.appendChild(renderer.domElement);

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 3000;
  controls.maxPolarAngle = Math.PI / 2;

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1000, 1000, 1000);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 100;
  directionalLight.shadow.camera.far = 5000;
  directionalLight.shadow.camera.left = -1000;
  directionalLight.shadow.camera.right = 1000;
  directionalLight.shadow.camera.top = 1000;
  directionalLight.shadow.camera.bottom = -1000;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
  scene.add(hemisphereLight);
};

// 动画循环
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

// 加载并解析 GeoTIFF
const loadGeoTIFF = async (caseId) => {
  const loadingInstance = ElLoading.service({
    lock: true,
    text: '加载地形数据中...',
    spinner: 'el-icon-loading',
    background: 'rgba(0, 0, 0, 0.7)',
  });

  try {
    const response = await axios.get(`/api/cases/${caseId}/terrain`, {
      responseType: 'arraybuffer'
    });
    const arrayBuffer = response.data;

    // 使用 geotiff.js 解析 GeoTIFF
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = rasters[0];

    // 数据下采样处理，避免处理过大数据
    const maxDataPoints = 4096; // 最大数据点数，根据需要调整
    let downsampleFactor = 1;
    const totalPoints = width * height;
    if (totalPoints > maxDataPoints) {
      downsampleFactor = Math.ceil(Math.sqrt(totalPoints / maxDataPoints));
    }

    const downsampledWidth = Math.floor(width / downsampleFactor);
    const downsampledHeight = Math.floor(height / downsampleFactor);
    const downsampledData = [];

    for (let y = 0; y < height; y += downsampleFactor) {
      for (let x = 0; x < width; x += downsampleFactor) {
        downsampledData.push(data[y * width + x]);
      }
    }

    // 设置高程范围
    minElevation.value = Math.min(...downsampledData);
    maxElevation.value = Math.max(...downsampledData);

    // 创建地形几何体
    const geometry = new THREE.PlaneGeometry(1000, 1000, downsampledWidth - 1, downsampledHeight - 1);
    geometry.rotateX(-Math.PI / 2); // 使其水平

    // 设置顶点高度
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < downsampledData.length; i++) {
      positions[i * 3 + 1] = downsampledData[i] / 10; // 缩放高程
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // 颜色映射
    const colors = [];
    for (let i = 0; i < downsampledData.length; i++) {
      const elevation = downsampledData[i];
      const colorHex = getElevationColor(elevation);
      const color = hexToRgb(colorHex);
      if (color) {
        colors.push(color.r, color.g, color.b);
      } else {
        colors.push(0.33, 0.42, 0.18); // 默认绿色
      }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // 材质
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    // 创建地形网格
    if (terrainMesh) {
      scene.remove(terrainMesh);
      terrainMesh.geometry.dispose();
      terrainMesh.material.dispose();
    }
    terrainMesh = new THREE.Mesh(geometry, material);
    scene.add(terrainMesh);

    hasGeoTIFF.value = true;
  } catch (error) {
    console.error('加载 GeoTIFF 失败', error);
    hasGeoTIFF.value = false;

    // 仅在有 caseId 的情况下显示错误
    if (caseId) {
      ElMessage.error('加载 GeoTIFF 数据失败');
    }
  } finally {
    loadingInstance.close();
  }
};

// 添加风机标记
const addWindTurbinesToScene = () => {
  // 清除之前的风机标记（除地形网格外）
  scene.children.forEach(child => {
    if (child.name === 'windTurbine') {
      scene.remove(child);
    }
  });

  // 添加风机标记
  mapStore.windTurbines.forEach(turbine => {
    const spriteMaterial = new THREE.SpriteMaterial({ color: 0xff0000 });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.name = 'windTurbine';

    // 将经纬度转换为 Three.js 坐标
    // 假设地形范围为 [-500, 500] in XZ，需根据实际情况调整
    const x = (turbine.longitude / 360) * 1000; // 简化转换
    const z = (turbine.latitude / 180) * 1000;
    const y = turbine.towerHeight; // 根据高程缩放

    sprite.position.set(x, y, z);
    scene.add(sprite);
  });
};

// 清理地形和风机标记
const clearTerrainAndWindTurbines = () => {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }

  // 清除风机标记
  scene.children.forEach(child => {
    if (child.name === 'windTurbine') {
      scene.remove(child);
    }
  });

  // 重置状态变量
  hasGeoTIFF.value = false;
  minElevation.value = 0;
  maxElevation.value = 1000;
};

// 提取并确保 caseId 为字符串
const currentCaseId = ref(null);

onMounted(async () => {
  initThreeJS();
  animate();

  // 从路由中提取 caseId
  let extractedCaseId = route.query.caseId || route.params.caseId;

  // 检查 extractedCaseId 是否为对象
  if (typeof extractedCaseId === 'object' && extractedCaseId !== null) {
    // 根据实际结构提取正确的 caseId 字段
    // 例如：{ id: '12345' }
    currentCaseId.value = extractedCaseId.id || null;
  } else {
    currentCaseId.value = extractedCaseId;
  }

  if (currentCaseId.value) {
    await loadGeoTIFF(currentCaseId.value);
    await mapStore.loadWindTurbines(currentCaseId.value);
    addWindTurbinesToScene();
  }
  // 不再在 `caseId` 为 null 时显示错误
});

// 监听风机数据变化
watch(() => mapStore.windTurbines, () => {
  addWindTurbinesToScene();
});

// 监听路由参数变化
watch(() => route.query.caseId || route.params.caseId, async (newCaseId) => {
  if (newCaseId) {
    if (typeof newCaseId === 'object' && newCaseId !== null) {
      currentCaseId.value = newCaseId.id || null;
    } else {
      currentCaseId.value = newCaseId;
    }

    if (currentCaseId.value) {
      await loadGeoTIFF(currentCaseId.value);
      await mapStore.loadWindTurbines(currentCaseId.value);
      addWindTurbinesToScene();
    }
  } else {
    // 清理地形和风机标记
    clearTerrainAndWindTurbines();
  }
});

// 计算高程标签
const elevationLabels = computed(() => {
  const range = maxElevation.value - minElevation.value;
  const step = range / 4;
  return [
    Math.round(minElevation.value),
    Math.round(minElevation.value + step),
    Math.round(minElevation.value + step * 2),
    Math.round(minElevation.value + step * 3),
    Math.round(maxElevation.value)
  ];
});
</script>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  left: 200px;
  width: calc(100% - 200px);
  height: 100%;
  z-index: 0;
}

#terrain-container {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
}

.legend {
  position: absolute;
  bottom: 40px;
  right: 40px;
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  min-width: 240px;
}

.legend h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.color-bar {
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    #193C17 0%,
    #2B573A 20%,
    #527D54 40%,
    #C4A484 60%,
    #8B4513 80%,
    #F5F5F5 100%
  );
}

.elevation-labels {
  margin-top: 4px;
  position: relative;
}

.label-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  padding-right: 16px; /* 为单位留出空间 */
}

.elevation-label {
  font-size: 12px;
  color: #666;
  transform: translateX(50%);
  position: relative;
}

.elevation-label:first-child {
  transform: translateX(0);
}

.elevation-label:last-child {
  transform: translateX(0);
}

.default-view {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #666;
  font-size: 16px;
  text-align: center;
}
</style>