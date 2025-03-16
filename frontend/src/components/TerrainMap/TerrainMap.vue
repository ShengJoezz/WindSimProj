<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 17:12:18
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:01:11
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TerrainMap.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<!-- TerrainMap.vue -->
<template>
  <div class="map-wrapper">
    <!-- Terrain Rendering Area -->
    <div
      class="terrain-renderer"
      ref="terrainContainer"
      style="height: 100%; width: 100%"
    >
      <!-- 移除 debug overlay -->
    </div>

    <div v-if="!hasGeoTIFF" class="terrain-loading">
      <el-loading text="加载地形中..." />
    </div>

    <!-- Top Toolbar -->
    <TopToolbar
      @toggle-sidebar="toggleSidebar"
      @add-turbine="handleAddTurbineClick"
    />

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
    <TerrainInfo
      v-if="hasGeoTIFF"
      :elevationLabels="elevationLabels"
      :geographicBounds="formattedGeoBounds"
    />

    <!-- Turbine Tooltip -->
    <TurbineTooltip
      v-if="hoveredTurbine"
      :turbine="hoveredTurbine"
      :position="tooltipPos"
    />
  </div>
</template>

<script setup>
/**
 * TerrainMap.vue
 *
 * 主组件，负责初始化 Three.js 场景，并集成所有子组件。
 */

import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from "vue";
import { useRoute, onBeforeRouteLeave } from 'vue-router';
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
import lodash from 'lodash';

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
const hasRendererInitialized = ref(false);

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

// 缓存颜色映射
const elevationColorCache = new Map();

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
    minLat:
      typeof caseStore.minLatitude === "number"
        ? caseStore.minLatitude.toFixed(6)
        : "N/A",
    maxLat:
      typeof caseStore.maxLatitude === "number"
        ? caseStore.maxLatitude.toFixed(6)
        : "N/A",
    minLon:
      typeof caseStore.minLongitude === "number"
        ? caseStore.minLongitude.toFixed(6)
        : "N/A",
    maxLon:
      typeof caseStore.maxLongitude === "number"
        ? caseStore.maxLongitude.toFixed(6)
        : "N/A",
  };
});

// 方法

// 切换侧边栏
const toggleSidebar = (type) => {
  console.log(
    "Toggling sidebar:",
    type,
    "Current state:",
    sidebars.value[type]
  );

  // 关闭其他侧边栏
  Object.keys(sidebars.value).forEach((key) => {
    if (key !== type) {
      sidebars.value[key] = false;
    }
  });

  // 切换目标侧边栏
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
  } else {
    // 添加处理当 `terrainMesh` 不存在时的逻辑
    console.warn("Terrain mesh is not available to reset camera.");
    // 可以选择设置一个默认的摄像机位置和目标
    camera.position.set(0, 1000, 1000);
    controls.target.set(0, 0, 0);
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
  if (turbineMeshes.value.has(turbine.id)) return;

  const turbineGroup = new THREE.Group();
  turbineGroup.userData.turbineId = turbine.id;
  turbineGroup.userData.hubHeight = turbine.hubHeight; // 保存 hubHeight 到 userData

  // 改进的塔架几何体
  const towerGeometry = new THREE.CylinderGeometry(
    3, // 顶部半径稍小
    4.5, // 底部半径稍大
    turbine.hubHeight,
    32, // 更多分段,更圆滑
    8,  // 更多高度分段
    true
  );

  // 使用 MeshPhysicalMaterial 获得更真实的金属外观
  const towerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeeeeee,
    metalness: 0.8,
    roughness: 0.3,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25
  });

  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.position.y = turbine.hubHeight / 2;
  turbineGroup.add(tower);

  // 改进的机舱设计
  const nacelleGroup = new THREE.Group();
  nacelleGroup.position.y = turbine.hubHeight;

  // 主机舱体
  const nacelleGeometry = new THREE.BoxGeometry(12, 5, 7);
  const nacelleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdddddd,
    metalness: 0.9,
    roughness: 0.4,
    clearcoat: 0.4
  });
  const nacelle = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
  nacelleGroup.add(nacelle);

  // 机舱顶部装饰
  const topGeometry = new THREE.CylinderGeometry(1.5, 2, 2, 8);
  const top = new THREE.Mesh(topGeometry, nacelleMaterial);
  top.position.y = 3;
  nacelleGroup.add(top);

  turbineGroup.add(nacelleGroup);

  // 改进的叶片设计
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  // 使用贝塞尔曲线创建更真实的叶片形状
  bladeShape.bezierCurveTo(
    2, 0,
    4, turbine.rotorDiameter/4,
    3, turbine.rotorDiameter/2
  );
  bladeShape.bezierCurveTo(
    2.5, turbine.rotorDiameter/2 + 2,
    -1, turbine.rotorDiameter/4 + 1,
    0, 0
  );

  const extrudeSettings = {
    steps: 1,
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.2,
    bevelSegments: 5
  };

  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.5,
    clearcoat: 0.3
  });

  // 创建叶片组
  const bladesGroup = new THREE.Group();
  bladesGroup.name = "bladesGroup"; // 命名叶片组
  bladesGroup.position.set(0, turbine.hubHeight, 0);

  // 添加3个叶片
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    // 稍微倾斜叶片
    blade.rotation.x = 0.12;
    bladesGroup.add(blade);
  }

  // 添加轮毂
  const hubGeometry = new THREE.SphereGeometry(2, 32, 32);
  const hub = new THREE.Mesh(hubGeometry, nacelleMaterial);
  bladesGroup.add(hub);

  turbineGroup.add(bladesGroup);

  const { x, z } = mapLatLonToXZ(turbine.latitude, turbine.longitude);
  const terrainHeight = getTerrainHeight(x, z);

  if (terrainHeight !== null) {
    turbineGroup.position.set(x, terrainHeight, z);
    scene.add(turbineGroup);
    turbineMeshes.value.set(turbine.id, turbineGroup);
  } else {
    console.warn(`无法获取风机 ${turbine.id} 的地形高度，风机未添加`);
  }
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
    typeof caseStore.minLatitude !== "number" ||
    typeof caseStore.maxLatitude !== "number" ||
    typeof caseStore.minLongitude !== "number" ||
    typeof caseStore.maxLongitude !== "number"
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
  if (!terrainMesh) {
    console.warn("尝试获取地形高度但地形网格不存在");
    return 0; // 返回默认高度而不是null
  }

  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(x, 1000, z);
  const direction = new THREE.Vector3(0, -1, 0);

  raycaster.set(origin, direction);
  const intersects = raycaster.intersectObject(terrainMesh);

  if (intersects.length > 0) {
    return intersects[0].point.y;
  }

  console.warn(`位置 (${x}, ${z}) 找不到地形交叉点, 尝试查找最近点`);
  // Fallback: try nearest point if no direct intersection
  const vertices = terrainMesh.geometry.attributes.position.array;
  let closestHeight = null;
  let minDistance = Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    const vx = vertices[i];
    const vz = vertices[i + 2];
    const distance = Math.sqrt((x - vx) ** 2 + (z - vz) ** 2);

    if (distance < minDistance) {
      minDistance = distance;
      closestHeight = vertices[i + 1];
    }
  }

  return closestHeight !== null ? closestHeight : 0; // 确保始终返回一个数值，默认为0
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
  // 检查缓存中是否存在
  if (elevationColorCache.has(elevation)) {
    return elevationColorCache.get(elevation);
  }
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
      const interpolatedColor = new THREE.Color(
        color1.r + (color2.r - color1.r) * t,
        color1.g + (color2.g - color1.g) * t,
        color1.b + (color2.b - color1.b) * t
      );

      // 缓存颜色
      elevationColorCache.set(elevation, interpolatedColor);
      return interpolatedColor;
    }
  }
  // 超出范围时返回最后一个颜色
  const defaultColor = hexToRgb(colorStops[colorStops.length - 1].color);
  elevationColorCache.set(elevation, defaultColor);
  return defaultColor;
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

// 鼠标移动事件处理，用于显示工具提示
const onMouseMove = (event) => {
  if (!renderer || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const turbineObjects = Array.from(turbineMeshes.value.values());
  const intersects = raycaster.intersectObjects(turbineObjects, true);

  if (intersects.length > 0) {
    const intersectedObj = intersects[0].object;
    const turbineGroup = intersectedObj.parent;
    const turbineId = turbineGroup.userData.turbineId;
    const turbine = caseStore.windTurbines.find(t => t.id === turbineId);

    if (turbine) {
      hoveredTurbine.value = turbine;
      tooltipPos.value = {
        x: event.clientX + 10,
        y: event.clientY + 10
      };
    }
  } else {
    hoveredTurbine.value = null;
  }
};

// 创建 throttled 版本
const onMouseMoveThrottled = lodash.throttle(onMouseMove, 100);

// 初始化 Three.js 场景
const initThreeJS = () => {
  console.log('Initializing Three.js scene...');
  if (!terrainContainer.value) {
    console.error('Terrain container not found');
    return;
  }

  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;
  console.log('Container dimensions:', { width, height });

  // Create scene with visible background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // 移除坐标轴辅助
  // addAxesHelper()

  // Initialize camera with debug info
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.position.set(0, 1000, 1000);
  camera.lookAt(0, 0, 0);
  console.log('Camera initialized:', camera.position);

  // Initialize renderer with debug info
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  console.log('Renderer initialized');

  terrainContainer.value.appendChild(renderer.domElement);
  console.log('Renderer added to container');
  hasRendererInitialized.value = true;

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
  renderer.domElement.addEventListener("mousemove", onMouseMoveThrottled, false);

  // 监听窗口大小变化
  window.addEventListener("resize", onWindowResize, false);
};

// 添加坐标轴辅助 (删除 - 不需要了)
// const addAxesHelper = () => {
//     const axesHelper = new THREE.AxesHelper(500);
//       const materials = axesHelper.material;

//  if (Array.isArray(materials)) {
//     materials.forEach(material => {
//       material.linewidth = 2;
//       material.opacity = 0.7;
//       material.transparent = true;
//     });
//   }

//  scene.add(axesHelper);
// };

// 动画循环
let frameCount = 0;
const animate = () => {
  frameCount++;

  animationFrameId = requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
  renderer.render(scene, camera);
   // 叶片旋转
   if (bladeRotation.value) {
  turbineMeshes.value.forEach((turbineGroup) => {
    // 找到叶片组（应该是第三个子对象，index=2）
    const bladesGroup = turbineGroup.children.find(child => child.name === "bladesGroup");
    if (bladesGroup) {
      bladesGroup.rotation.z += 0.01 * rotationSpeed.value;
    }
  });
}
};

// 处理批量导入风机
const handleBulkImport = (turbines) => {
  turbines.forEach((turbine) => {
    caseStore.addWindTurbine(turbine);
    addWindTurbineToScene(turbine);
  });
};

// 窗口大小变化处理
const onWindowResize = () => {
  if (!terrainContainer.value || !camera || !renderer) return;

  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
};

// 清理 Three.js 资源
const disposeThreeResources = () => {
  if (terrainMesh) {
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    scene.remove(terrainMesh);
    terrainMesh = null;
  }

  turbineMeshes.value.forEach((turbineGroup) => {
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
  });
  turbineMeshes.value.clear();

  if (controls) {
    controls.dispose();
    controls = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
};

// 生命周期钩子

const loadAndDisplayTurbines = async () => {
  try {
    // Load turbines from store/backend
    await caseStore.fetchWindTurbines();

    // Optimization: Diff and update turbines instead of clearing all
    const oldTurbineIds = Array.from(turbineMeshes.value.keys());
    const newTurbineIds = caseStore.windTurbines.map(turbine => turbine.id);

    // Identify turbines to remove
    const turbinesToRemove = oldTurbineIds.filter(id => !newTurbineIds.includes(id));
    turbinesToRemove.forEach(id => {
      deleteWindTurbineFromScene(id);
    });

    // Identify turbines to add or update (for simplicity, re-add all new turbines)
    caseStore.windTurbines.forEach(turbine => {
      if (!turbineMeshes.value.has(turbine.id)) {
        addWindTurbineToScene(turbine); // Add only if not already in scene
      }
      // In a real update scenario, you might want to update existing turbine properties here
    });


  } catch (error) {
    console.error('Failed to load and display turbines:', error);
    ElMessage.error('加载风机失败');
  }
};
onMounted(async () => {
    try {
        const { caseId, caseName } = route.params;
         console.log('Route params:', { caseId, caseName });
        await caseStore.initializeCase(caseId, caseName);

       initThreeJS();
       animate();

        if (caseStore.caseId) {
            await loadGeoTIFF(caseStore.caseId);
            await loadAndDisplayTurbines();
          }
         caseStore.connectSocket(caseId);

    } catch (error) {
        console.error('Initialization error:', error);
    }
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (renderer) {
    renderer.domElement.removeEventListener("mousemove", onMouseMoveThrottled, false);
  }
  window.removeEventListener("resize", onWindowResize, false);
    caseStore.disconnectSocket();
  disposeThreeResources();
});
// Add route leave handler
onBeforeRouteLeave((to, from, next) => {
  // Save current state if needed
  caseStore.saveCurrentState();
  next();
});

// Add watch for route changes
watch(
  () => route.params.caseId,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
       await loadAndDisplayTurbines();
    }
  }
);


// Add visual feedback when hovering over turbines
watch(() => hoveredTurbine.value, (newTurbine, oldTurbine) => {
  if (oldTurbine) {
    const oldMesh = turbineMeshes.value.get(oldTurbine.id);
    if (oldMesh) {
      oldMesh.traverse(child => {
        if (child.isMesh) {
          child.material.emissive.setHex(0x000000);
        }
      });
    }
  }

  if (newTurbine) {
    const newMesh = turbineMeshes.value.get(newTurbine.id);
    if (newMesh) {
      newMesh.traverse(child => {
        if (child.isMesh) {
          child.material.emissive.setHex(0x555555);
        }
      });
    }
  }
});


watch(
  () => caseStore.windTurbines,
  (newTurbines, oldTurbines) => {
    console.log('Wind turbines updated:', newTurbines);

    // Optimization: Diff and update turbines
    if (oldTurbines) {
      const oldTurbineIds = oldTurbines.map(t => t.id);
      const newTurbineIds = newTurbines.map(t => t.id);

      // Identify turbines to remove
      const turbinesToRemove = oldTurbineIds.filter(id => !newTurbineIds.includes(id));
      turbinesToRemove.forEach(id => {
        deleteWindTurbineFromScene(id);
      });

      // Identify turbines to add
      const turbinesToAdd = newTurbines.filter(turbine => !oldTurbineIds.includes(turbine.id));
      turbinesToAdd.forEach(turbine => {
        addWindTurbineToScene(turbine);
      });
    } else {
      // Initial load: Add all turbines
      newTurbines.forEach((turbine) => {
        addWindTurbineToScene(turbine);
      });
    }
  },
  { deep: true }
);
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa, #e4e7ed);
  overflow: hidden;
}

.terrain-renderer {
  width: 100%;
  height: 100%;
  transition: filter 0.3s ease;
}

.terrain-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 32px 48px;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.9);
}

:deep(.el-loading-text) {
  font-size: 16px;
  font-weight: 500;
  color: #409EFF;
  margin-top: 16px;
}

:deep(.el-loading-spinner) {
  transform: scale(1.2);
}
</style>