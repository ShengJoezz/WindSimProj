<!-- frontend/src/components/TerrainMap.vue -->
<template>
  <div class="map-wrapper">
    <!-- Terrain Rendering Area -->
    <div class="terrain-renderer" ref="terrainContainer"></div>

    <!-- Top Toolbar -->
    <TopToolbar @toggle-sidebar="toggleSidebar" @add-turbine="handleAddTurbineClick" />

    <!-- Left Sidebar: Control Panel -->
    <ControlPanel
      v-model:visible="sidebars.control"
      :wireframe="wireframe"
      @toggle-wireframe="toggleWireframe"
      :bladeRotation="bladeRotation"
      :rotationSpeed="rotationSpeed"
      @reset-camera="resetCamera"
      @update-blade-rotation="bladeRotation = $event"
      @update-rotation-speed="rotationSpeed = $event"
    />

    <!-- Right Sidebar: Wind Turbine Management -->
    <WindTurbineManagement
      v-model:visible="sidebars.management"
      :windTurbines="caseStore.windTurbines"
      :geographicBounds="formattedGeoBounds"
      @focus-turbine="focusOnTurbine"
      @delete-turbine="confirmDeleteTurbine"
      @add-turbine="addWindTurbineToScene"
      @import-turbines="handleBulkImport"
    />

    <!-- Terrain Info Box -->
    <TerrainInfo v-if="hasGeoTIFF" :elevationLabels="elevationLabels" :geographicBounds="formattedGeoBounds" />

    <!-- Turbine Tooltip -->
    <TurbineTooltip v-if="hoveredTurbine" :turbine="hoveredTurbine" :position="tooltipPos" />
  </div>
</template>

<script setup>
/**
 * TerrainMap.vue
 *
 * 主组件，负责初始化 Three.js 场景，并集成所有子组件。
 */

import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import { useCaseStore } from "../../store/caseStore";
import TopToolbar from "./TopToolbar.vue";
import ControlPanel from "./ControlPanel.vue";
import WindTurbineManagement from "./WindTurbineManagement.vue";
import TerrainInfo from "./TerrainInfo.vue";
import TurbineTooltip from "./TurbineTooltip.vue";
import axios from "axios";
import { fromArrayBuffer } from "geotiff";
import Papa from "papaparse";
import * as TWEEN from "@tweenjs/tween.js";

// 初始化 Store 和 Route
const caseStore = useCaseStore();
const route = useRoute();

// 引用和响应式变量
const terrainContainer = ref(null);
const hasGeoTIFF = ref(false);
const wireframe = ref(false);
const bladeRotation = ref(true);
const rotationSpeed = ref(1.0);
const sidebars = ref({
  control: false,
  management: false,
});
const hoveredTurbine = ref(null);
const tooltipPos = ref({ x: 0, y: 0 });

// Three.js 变量
let scene, camera, renderer, controls;
let terrainMesh = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const turbineMeshes = ref(new Map());
let animationFrameId = null;

// 地形颜色配置
const elevationColors = [
  "#193C17", // 深绿 - 低海拔
  "#2B573A",
  "#527D54",
  "#C4A484",
  "#8B4513",
  "#F5F5F5", // 浅灰白 - 高海拔(雪)
];

// 计算属性
const elevationLabels = computed(() => {
  const range = caseStore.maxElevation - caseStore.minElevation;
  const step = range / 4;
  return [
    Math.round(caseStore.minElevation),
    Math.round(caseStore.minElevation + step),
    Math.round(caseStore.minElevation + step * 2),
    Math.round(caseStore.minElevation + step * 3),
    Math.round(caseStore.maxElevation),
  ];
});

const formattedGeoBounds = computed(() => {
  return {
    minLat: typeof caseStore.minLatitude === 'number' ? caseStore.minLatitude.toFixed(6) : "N/A",
    maxLat: typeof caseStore.maxLatitude === 'number' ? caseStore.maxLatitude.toFixed(6) : "N/A",
    minLon: typeof caseStore.minLongitude === 'number' ? caseStore.minLongitude.toFixed(6) : "N/A",
    maxLon: typeof caseStore.maxLongitude === 'number' ? caseStore.maxLongitude.toFixed(6) : "N/A",
  };
});

// 方法

// 切换侧边栏
const toggleSidebar = (type) => {
  if (type === "control") {
    sidebars.value.management = false;
  } else if (type === "management") {
    sidebars.value.control = false;
  }
  sidebars.value[type] = !sidebars.value[type];
};

// 处理添加风机按钮点击
const handleAddTurbineClick = () => {
  sidebars.value.management = true;
};

// 切换线框模式
const toggleWireframe = () => {
  wireframe.value = !wireframe.value;
  if (terrainMesh) {
    terrainMesh.material.wireframe = wireframe.value;
  }
};

// 重置摄像机位置
const resetCamera = () => {
  if (terrainMesh) {
    const box = new THREE.Box3().setFromObject(terrainMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const distance = Math.max(size.x, size.z) * 1.2;
    const height = size.y * 1.5;

    camera.position.set(center.x + distance, center.y + height, center.z + distance);
    controls.target.copy(center);
    controls.update();
  }
};

// 聚焦到指定风机
const focusOnTurbine = (turbine) => {
  const turbineGroup = turbineMeshes.value.get(turbine.id);
  if (turbineGroup) {
    const position = turbineGroup.position.clone();
    position.y += turbine.hubHeight;

    new TWEEN.Tween(camera.position)
      .to(
        {
          x: position.x + 200,
          y: position.y + 100,
          z: position.z + 200,
        },
        1000
      )
      .easing(TWEEN.Easing.Cubic.Out)
      .start();

    new TWEEN.Tween(controls.target)
      .to(
        {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        1000
      )
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
  }
};

// 确认删除风机
const confirmDeleteTurbine = (turbine) => {
  ElMessageBox.confirm(
    `确定要删除风机 "${turbine.name}" 吗？`,
    "删除确认",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }
  )
    .then(async () => {
      await caseStore.removeWindTurbine(turbine.id);
      deleteWindTurbineFromScene(turbine.id);
      ElMessage.success(`风机 ${turbine.name} 已被删除`);
    })
    .catch(() => {});
};

// 添加风机到 Three.js 场景
const addWindTurbineToScene = (turbine) => {
  const { latitude, longitude } = turbine;
  const { x, z } = mapLatLonToXZ(latitude, longitude);
  const terrainHeight = getTerrainHeight(x, z);

  if (terrainHeight === null) {
    ElMessage.error("无法获取地形高度，风机无法放置。");
    return;
  }

  const hubHeight = turbine.hubHeight;
  const rotorDiameter = turbine.rotorDiameter;
  const bladeLength = rotorDiameter / 2;
  const name = turbine.name;

  const turbineGroup = new THREE.Group();

  // 桅杆
  const towerGeometry = new THREE.CylinderGeometry(2, 4, hubHeight, 32);
  const towerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.position.y = hubHeight / 2 + 1;
  tower.castShadow = true;
  tower.receiveShadow = true;

  // 机舱
  const nacelleGeometry = new THREE.BoxGeometry(8, 8, 15);
  const nacelleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const nacelle = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
  nacelle.position.y = hubHeight + 4;
  nacelle.castShadow = true;
  nacelle.receiveShadow = true;

  // 叶片
  const bladeGeometry = new THREE.BoxGeometry(1, bladeLength, 2);
  const bladeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.set(0, hubHeight + 5, 0);
    blade.rotation.z = (i * 2 * Math.PI) / 3;
    blade.castShadow = true;
    blade.receiveShadow = true;

    blade.rotateY(Math.PI / 10);

    turbineGroup.add(blade);
  }

  turbineGroup.add(tower);
  turbineGroup.add(nacelle);

  turbineGroup.position.set(x, terrainHeight, z);
  scene.add(turbineGroup);

  turbineMeshes.value.set(turbine.id, turbineGroup);
};

// 从场景中删除风机
const deleteWindTurbineFromScene = (turbineId) => {
  const turbineGroup = turbineMeshes.value.get(turbineId);
  if (turbineGroup) {
    turbineGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    scene.remove(turbineGroup);
    turbineMeshes.value.delete(turbineId);
  }
};

// 将经纬度映射到 XZ 坐标
const mapLatLonToXZ = (latitude, longitude) => {
  if (
    typeof caseStore.minLatitude !== 'number' ||
    typeof caseStore.maxLatitude !== 'number' ||
    typeof caseStore.minLongitude !== 'number' ||
    typeof caseStore.maxLongitude !== 'number'
  ) {
    console.warn("GeoTIFF bounds are not set.");
    return { x: 0, z: 0 };
  }

  const longitudeRatio =
    (longitude - caseStore.minLongitude) /
    (caseStore.maxLongitude - caseStore.minLongitude);
  const latitudeRatio =
    (latitude - caseStore.minLatitude) /
    (caseStore.maxLatitude - caseStore.minLatitude);

  const clampedLongitudeRatio = Math.min(Math.max(longitudeRatio, 0), 1);
  const clampedLatitudeRatio = Math.min(Math.max(latitudeRatio, 0), 1);

  const terrainSize = 1000;

  const x = (clampedLongitudeRatio - 0.5) * terrainSize;
  const z = (clampedLatitudeRatio - 0.5) * terrainSize;

  return { x, z };
};

// 获取指定 XZ 坐标的地形高度
const getTerrainHeight = (x, z) => {
  const localRaycaster = new THREE.Raycaster();

  const rayOrigin = new THREE.Vector3(x, 10000, z);
  const rayDirection = new THREE.Vector3(0, -1, 0);

  localRaycaster.set(rayOrigin, rayDirection.normalize());

  const intersects = localRaycaster.intersectObject(terrainMesh);
  if (intersects.length > 0) {
    return intersects[0].point.y;
  } else {
    console.warn("未能找到地形高度，风机无法准确放置。");
    return null;
  }
};

// 加载 GeoTIFF 数据
const loadGeoTIFF = async (caseId) => {
  const loadingInstance = ElLoading.service({
    lock: true,
    text: "加载地形数据中...",
    spinner: "el-icon-loading",
    background: "rgba(0, 0, 0, 0.7)",
  });

  try {
    const response = await axios.get(`/api/cases/${caseId}/terrain`, {
      responseType: "arraybuffer",
    });
    const arrayBuffer = response.data;

    // 使用 geotiff.js 解析 GeoTIFF
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]

    // 更新 Store 中的地理边界
    caseStore.minLongitude = bbox[0];
    caseStore.minLatitude = bbox[1];
    caseStore.maxLongitude = bbox[2];
    caseStore.maxLatitude = bbox[3];

    // 读取栅格数据
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = rasters[0];

    // 数据下采样以限制数据点数量
    const maxDataPoints = 120000;
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

    // 设置地形高程范围
    caseStore.minElevation = Math.min(...downsampledData);
    caseStore.maxElevation = Math.max(...downsampledData);

    // 创建地形几何体
    const geometry = new THREE.PlaneGeometry(
      1000,
      1000,
      downsampledWidth - 1,
      downsampledHeight - 1
    );
    geometry.rotateX(-Math.PI / 2);

    // 设置顶点高度
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < downsampledData.length; i++) {
      positions[i * 3 + 1] = downsampledData[i] / 5; // 高度缩放
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // 颜色映射
    const colors = [];
    for (let i = 0; i < downsampledData.length; i++) {
      const elevation = downsampledData[i];
      const color = getElevationColor(elevation);
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    // 材质
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: wireframe.value,
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

    // 重置摄像机以聚焦地形
    resetCamera();
  } catch (error) {
    console.error("加载 GeoTIFF 失败", error);
    hasGeoTIFF.value = false;

    if (caseId) {
      ElMessage.error("加载 GeoTIFF 数据失败");
    }
  } finally {
    loadingInstance.close();
  }
};

// 获取地形颜色
const getElevationColor = (elevation) => {
  const colorStops = [
    { threshold: 0, color: elevationColors[0] },
    { threshold: 0.2, color: elevationColors[1] },
    { threshold: 0.4, color: elevationColors[2] },
    { threshold: 0.6, color: elevationColors[3] },
    { threshold: 0.8, color: elevationColors[4] },
    { threshold: 1.0, color: elevationColors[5] },
  ];

  const normalizedElevation =
    (elevation - caseStore.minElevation) /
    (caseStore.maxElevation - caseStore.minElevation);
  const clamped = Math.min(Math.max(normalizedElevation, 0), 1);

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (clamped <= colorStops[i + 1].threshold) {
      const t =
        (clamped - colorStops[i].threshold) /
        (colorStops[i + 1].threshold - colorStops[i].threshold);
      const color1 = hexToRgb(colorStops[i].color);
      const color2 = hexToRgb(colorStops[i + 1].color);
      return new THREE.Color(
        color1.r + (color2.r - color1.r) * t,
        color1.g + (color2.g - color1.g) * t,
        color1.b + (color2.b - color1.b) * t
      );
    }
  }
  return hexToRgb(colorStops[colorStops.length - 1].color);
};

// 将16进制颜色转换为 THREE.Color 对象
const hexToRgb = (hex) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? new THREE.Color(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      )
    : new THREE.Color(0x333333); // 默认颜色
};

// 初始化 Three.js 场景
const initThreeJS = () => {
  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // 创建摄像机
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

  // 创建控件
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 3000;
  controls.maxPolarAngle = Math.PI / 2;

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // 添加方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1000, 1000, 1000);
  directionalLight.castShadow = true;

  // 配置阴影属性
  directionalLight.shadow.camera.near = 100;
  directionalLight.shadow.camera.far = 5000;
  directionalLight.shadow.camera.left = -1000;
  directionalLight.shadow.camera.right = 1000;
  directionalLight.shadow.camera.top = 1000;
  directionalLight.shadow.camera.bottom = -1000;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.bias = -0.0001;

  scene.add(directionalLight);

  // 添加半球光
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
  scene.add(hemisphereLight);

  // 监听鼠标移动事件
  renderer.domElement.addEventListener("mousemove", onMouseMove, false);

  // 监听窗口大小变化
  window.addEventListener("resize", onWindowResize, false);
};

// 动画循环
const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  // 叶片旋转
  if (bladeRotation.value) {
    caseStore.windTurbines.forEach((turbine) => {
      const turbineGroup = turbineMeshes.value.get(turbine.id);
      if (turbineGroup) {
        for (let i = 0; i < 3; i++) {
          const blade = turbineGroup.children[i];
          if (blade) {
            blade.rotation.z += 0.01 * rotationSpeed.value;
          }
        }
      }
    });
  }

  renderer.render(scene, camera);
};

// 处理批量导入风机
const handleBulkImport = (turbines) => {
  turbines.forEach((turbine) => {
    caseStore.addWindTurbine(turbine);
    addWindTurbineToScene(turbine);
  });
};

// 鼠标移动事件处理，用于显示工具提示
const onMouseMove = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 更新工具提示位置
  tooltipPos.value.x = event.clientX + 20;
  tooltipPos.value.y = event.clientY + 20;

  // 光线投射
  raycaster.setFromCamera(mouse, camera);
  const meshes = Array.from(turbineMeshes.value.values()).flatMap(group =>
    group.children.filter(child => child.isMesh)
  );
  const intersects = raycaster.intersectObjects(meshes, true);

  if (intersects.length > 0) {
    const intersected = intersects[0].object.parent; // 假设网格在 Group 内
    const turbineEntry = Array.from(turbineMeshes.value.entries()).find(
      ([id, group]) => group === intersected
    );
    if (turbineEntry) {
      hoveredTurbine.value = caseStore.windTurbines.find(t => t.id === turbineEntry[0]);
      return;
    }
  }

  hoveredTurbine.value = null;
};

// 生命周期钩子
onMounted(async () => {
  const { caseId, caseName } = route.params;
  const queryCaseName = route.query.caseName;

  // 初始化 Case
  await caseStore.initializeCase(caseId, queryCaseName);

  // 初始化 Three.js
  initThreeJS();
  animate();

  if (caseStore.caseId) {
    await loadGeoTIFF(caseStore.caseId);
  }

  // 添加已存在的风机到场景
  caseStore.windTurbines.forEach(turbine => {
    addWindTurbineToScene(turbine);
  });
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  renderer.domElement.removeEventListener("mousemove", onMouseMove, false);
  window.removeEventListener("resize", onWindowResize, false);
  renderer.dispose();
});

// 窗口大小变化处理
const onWindowResize = () => {
  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
};
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f7fa; /* Light gray background */
  overflow: hidden; /* Prevents scrollbars on the main wrapper */
}

.terrain-renderer {
  width: 100%;
  height: 100%;
}

/* 工具栏样式在 TopToolbar.vue 中定义 */

/* 地形信息和工具提示样式在各自的组件中定义 */
</style>