<!-- frontend/src/components/TerrainMap.vue -->
<template>
  <div class="map-wrapper">
  <!-- Terrain Rendering Area -->
  <div class="terrain-renderer" ref="terrainContainer"></div>
  
  <!-- Top Toolbar -->
  <div class="top-toolbar">
  <el-button-group>
  <el-button
  type="primary"
  @click="toggleSidebar('control')"
  class="toolbar-button"
  >
  <i class="el-icon-menu"></i> 控制面板
  </el-button>
  <el-button
  type="primary"
  @click="toggleSidebar('management')"
  class="toolbar-button"
  >
  <i class="el-icon-s-operation"></i> 风机管理
  </el-button>
  <el-button
  type="success"
  @click="handleAddTurbineClick"
  class="toolbar-button add-turbine-button"
  >
  <i class="el-icon-plus"></i> 添加风机
  </el-button>
  </el-button-group>
  </div>
  
  <!-- Left Sidebar: Control Panel -->
  <el-drawer
  v-model="sidebars.control"
  direction="ltr"
  size="350px"
  :with-header="false"
  custom-class="sidebar-drawer"
  :before-close="handleDrawerClose"
  >
  <div class="sidebar-container">
  <el-collapse v-model="activeSections" accordion>
  <el-collapse-item name="controlPanel">
  <template #title>
  <h3 class="collapse-title">
  <i class="el-icon-setting"></i> 控制面板
  </h3>
  </template>
  <el-card class="control-card">
  <div class="card-content">
  <div class="control-group">
  <div class="group-title">地形显示</div>
  <el-button-group class="control-buttons">
  <el-button
  type="primary"
  @click="resetCamera"
  icon="el-icon-refresh"
  >重置视角</el-button
  >
  <el-button
  :type="wireframe ? 'warning' : 'primary'"
  @click="toggleWireframe"
  icon="el-icon-s-grid"
  >{{ wireframe ? '隐藏网格' : '显示网格' }}</el-button
  >
  </el-button-group>
  </div>
  <div class="control-group">
  <div class="group-title">风机动画</div>
  <el-row :gutter="12" class="animation-controls">
  <el-col :span="12">
  <el-switch
  v-model="bladeRotation"
  active-text="叶片旋转"
  inactive-text="叶片停止"
  />
  </el-col>
  <el-col :span="12">
  <div class="speed-control">
  <span class="speed-label">旋转速度:</span>
  <el-slider
  v-model="rotationSpeed"
  :min="0.1"
  :max="2"
  :step="0.1"
  />
  </div>
  </el-col>
  </el-row>
  </div>
  </div>
  </el-card>
  </el-collapse-item>
  </el-collapse>
  </div>
  </el-drawer>
  
  <!-- Right Sidebar: Wind Turbine Management -->
  <el-drawer
  v-model="sidebars.management"
  direction="rtl"
  size="450px"
  :with-header="false"
  custom-class="sidebar-drawer"
  :before-close="handleDrawerClose"
  >
  <div class="sidebar-container management-panel">
  <el-collapse v-model="activeSections" accordion>
  <el-collapse-item name="windTurbineManagement">
  <template #title>
  <h3 class="collapse-title">
  <i class="el-icon-wind-power"></i> 风机管理
  </h3>
  </template>
  
  <el-tabs v-model="activeTab" class="management-tabs">
  <!-- 添加风机 Tab -->
  <el-tab-pane label="添加风机" name="add">
  <el-form
  :model="turbineForm"
  :rules="turbineRules"
  ref="turbineFormRef"
  label-position="top"
  class="turbine-form"
  >
  <el-form-item label="风机名称" prop="name">
  <el-input
  v-model="turbineForm.name"
  placeholder="请输入风机名称"
  clearable
  />
  </el-form-item>
  <el-row :gutter="20">
  <el-col :span="12">
  <el-form-item label="经度" prop="longitude">
  <el-input
  v-model.number="turbineForm.longitude"
  type="number"
  step="0.000001"
  placeholder="输入经度 (-180 ~ 180)"
  clearable
  />
  </el-form-item>
  </el-col>
  <el-col :span="12">
  <el-form-item label="纬度" prop="latitude">
  <el-input
  v-model.number="turbineForm.latitude"
  type="number"
  step="0.000001"
  placeholder="输入纬度 (-90 ~ 90)"
  clearable
  />
  </el-form-item>
  </el-col>
  </el-row>
  <el-row :gutter="20">
  <el-col :span="12">
  <el-form-item label="桅杆高度" prop="hubHeight">
  <el-input
  v-model.number="turbineForm.hubHeight"
  type="number"
  placeholder="输入高度 (m)"
  clearable
  />
  </el-form-item>
  </el-col>
  <el-col :span="12">
  <el-form-item label="转子直径" prop="rotorDiameter">
  <el-input
  v-model.number="turbineForm.rotorDiameter"
  type="number"
  placeholder="输入直径 (m)"
  clearable
  />
  </el-form-item>
  </el-col>
  </el-row>
  <el-form-item>
  <el-button
  type="primary"
  @click="submitTurbineForm"
  class="submit-button"
  block
  >添加风机</el-button
  >
  </el-form-item>
  </el-form>
  
  <div class="import-section">
  <el-divider>批量导入</el-divider>
  <el-upload
  class="upload-area"
  drag
  action="#"
  :before-upload="handleFileUpload"
  :show-file-list="false"
  accept=".csv,.txt"
  :on-change="handleUploadChange"
  >
  <i class="el-icon-upload"></i>
  <div class="upload-text">
  拖拽文件至此处或 <em>点击上传</em>
  </div>
  <div class="upload-hint">支持 .csv 或 .txt 格式文件</div>
  <el-link
  type="primary"
  @click="toggleExample"
  class="example-link"
  >{{ showExample ? '隐藏示例' : '查看示例格式' }}</el-link
  >
  <el-alert
  v-if="showExample"
  title="示例格式 (.csv)"
  type="info"
  :closable="false"
  class="example-content"
  >
  <pre>name,longitude,latitude,hubHeight,rotorDiameter
  风机1,-73.985,40.748,120,116
  风机2,-74.006,40.712,130,120</pre>
  </el-alert>
  </el-upload>
  </div>
  </el-tab-pane>
  
  <!-- 已安装风机 Tab -->
  <el-tab-pane label="已安装风机" name="display">
  <div class="turbine-list" v-if="windTurbines.length">
  <el-card
  v-for="turbine in windTurbines"
  :key="turbine.id"
  class="turbine-card"
  >
  <div class="card-header">
  <span class="turbine-name">{{ turbine.name }}</span>
  <div class="turbine-actions">
  <el-button
  type="text"
  icon="el-icon-aim"
  @click="focusOnTurbine(turbine)"
  title="定位风机"
  />
  <el-button
  type="text"
  icon="el-icon-delete"
  @click="confirmDeleteTurbine(turbine)"
  title="删除风机"
  />
  </div>
  </div>
  <div class="turbine-details">
  <div class="detail-item">
  <span class="label">经度:</span>
  <span class="value">{{ turbine.longitude.toFixed(6) }}°</span>
  </div>
  <div class="detail-item">
  <span class="label">纬度:</span>
  <span class="value">{{ turbine.latitude.toFixed(6) }}°</span>
  </div>
  <div class="detail-item">
  <span class="label">桅杆高度:</span>
  <span class="value">{{ turbine.hubHeight }} m</span>
  </div>
  <div class="detail-item">
  <span class="label">转子直径:</span>
  <span class="value">{{ turbine.rotorDiameter }} m</span>
  </div>
  </div>
  </el-card>
  </div>
  <el-empty v-else description="暂无已安装的风机" />
  </el-tab-pane>
  </el-tabs>
  </el-collapse-item>
  </el-collapse>
  </div>
  </el-drawer>
  
  <!-- Terrain Info Box -->
  <div class="terrain-info" v-if="hasGeoTIFF">
  <el-card class="info-card">
  <template #header>
  <div class="card-header">
  <span>地形信息</span>
  </div>
  </template>
  <div class="info-content">
  <!-- Elevation Legend -->
  <div class="legend-section">
  <div class="section-title">地形高程</div>
  <div class="color-scale">
  <div class="gradient-bar"></div>
  <div class="scale-labels">
  <span v-for="label in elevationLabels" :key="label">{{ label }}m</span>
  </div>
  </div>
  </div>
  <!-- Geographic Bounds -->
  <div class="bounds-section">
  <div class="section-title">地理范围</div>
  <el-descriptions :column="1" size="small" border>
  <el-descriptions-item label="经度范围">
  <span class="value-longitude">{{ formattedGeoBounds.minLon }}° ~
  {{ formattedGeoBounds.maxLon }}°</span>
  </el-descriptions-item>
  <el-descriptions-item label="纬度范围">
  <span class="value-latitude">{{ formattedGeoBounds.minLat }}° ~
  {{ formattedGeoBounds.maxLat }}°</span>
  </el-descriptions-item>
  </el-descriptions>
  </div>
  </div>
  </el-card>
  </div>
  
  <!-- Turbine Tooltip -->
  <div
  v-if="hoveredTurbine"
  class="turbine-tooltip"
  :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }"
  >
  <div class="tooltip-title">{{ hoveredTurbine.name }}</div>
  <div class="tooltip-content">
  <div class="tooltip-item">
  <span class="label">经度:</span>
  <span class="value">{{ hoveredTurbine.longitude }}°</span>
  </div>
  <div class="tooltip-item">
  <span class="label">纬度:</span>
  <span class="value">{{ hoveredTurbine.latitude }}°</span>
  </div>
  <div class="tooltip-item">
  <span class="label">桅杆高度:</span>
  <span class="value">{{ hoveredTurbine.hubHeight }}m</span>
  </div>
  <div class="tooltip-item">
  <span class="label">转子直径:</span>
  <span class="value">{{ hoveredTurbine.rotorDiameter }}m</span>
  </div>
  </div>
  </div>
  </div>
  </template>
  
  <script setup>
  /**
  * TerrainMap.vue
  *
  * Enhanced TerrainMap component with improved UI/UX.
  * Features:
  * - Modernized design with optimized layout
  * - Enhanced controls and management sidebars
  * - Responsive design with better integration into parent layout
  * - Improved form validations and user feedback
  * - Enhanced Three.js visualization with tooltips and animations
  */
  
  import { onMounted, ref, computed, onBeforeUnmount, watch } from "vue";
  import { useRoute } from "vue-router";
  import {
  ElLoading,
  ElMessage,
  ElTooltip,
  ElCard,
  ElUpload,
  ElCollapse,
  ElCollapseItem,
  ElForm,
  ElFormItem,
  ElInput,
  ElButton,
  ElDrawer,
  ElButtonGroup,
  ElTabs,
  ElTabPane,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElMessageBox,
  ElSlider,
  ElRow,
  ElCol,
  ElSwitch,
  ElLink,
  ElAlert,
  ElEmpty,
  } from "element-plus";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
  import axios from "axios";
  import { fromArrayBuffer } from "geotiff";
  import Papa from "papaparse";
  import * as TWEEN from "@tweenjs/tween.js"; // Ensure tween.js is installed
  
  const activeTab = ref("add"); // Set default active tab
  
  // References to DOM Elements
  const terrainContainer = ref(null);
  
  // Routing
  const route = useRoute();
  
  // Three.js Variables
  let scene, camera, renderer, controls;
  let terrainMesh = null;
  
  // Raycaster for Tooltip
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // Tooltip State
  const hoveredTurbine = ref(null);
  const tooltipPos = ref({ x: 0, y: 0 });
  
  // Reactive State Variables
  const hasGeoTIFF = ref(false);
  const minElevation = ref(0);
  const maxElevation = ref(1000);
  const wireframe = ref(false);
  
  // Reactive State Variables for Geographic Bounds
  const minLatitude = ref(null);
  const maxLatitude = ref(null);
  const minLongitude = ref(null);
  const maxLongitude = ref(null);
  
  // Wind Turbines State
  const windTurbines = ref([]);
  
  // Form Data for Adding Wind Turbines
  const turbineForm = ref({
  name: "",
  latitude: "",
  longitude: "",
  hubHeight: 120, // Default value
  rotorDiameter: 116, // Default value
  });
  
  // Form Validation Rules for Adding Turbines
  const turbineRules = {
  name: [
  { required: true, message: "请输入风机名称", trigger: "blur" },
  { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" },
  ],
  latitude: [
  { required: true, message: "请输入纬度", trigger: "blur" },
  { type: "number", message: "纬度必须为数字", trigger: "blur" },
  {
  validator: (rule, value, callback) => {
  if (value === null || value === undefined) {
  callback(new Error("请输入纬度"));
  } else if (value < -90 || value > 90) {
  callback(new Error("纬度必须在 -90 到 90 之间"));
  } else if (
  minLatitude.value !== null &&
  maxLatitude.value !== null
  ) {
  if (value < minLatitude.value || value > maxLatitude.value) {
  callback(new Error("纬度超出有效范围"));
  return;
  }
  }
  callback();
  },
  trigger: "blur",
  },
  ],
  longitude: [
  { required: true, message: "请输入经度", trigger: "blur" },
  { type: "number", message: "经度必须为数字", trigger: "blur" },
  {
  validator: (rule, value, callback) => {
  if (value === null || value === undefined) {
  callback(new Error("请输入经度"));
  } else if (value < -180 || value > 180) {
  callback(new Error("经度必须在 -180 到 180 之间"));
  } else if (
  minLongitude.value !== null &&
  maxLongitude.value !== null
  ) {
  if (value < minLongitude.value || value > maxLongitude.value) {
  callback(new Error("经度超出有效范围"));
  return;
  }
  }
  callback();
  },
  trigger: "blur",
  },
  ],
  hubHeight: [
  { required: true, message: "请输入桅杆高度", trigger: "blur" },
  { type: "number", message: "桅杆高度必须为数字", trigger: "blur" },
  ],
  rotorDiameter: [
  { required: true, message: "请输入转子直径", trigger: "blur" },
  { type: "number", message: "转子直径必须为数字", trigger: "blur" },
  ],
  };
  
  // Enhanced turbine form reference
  const turbineFormRef = ref(null);
  
  // Sidebars Visibility
  const sidebars = ref({
  control: false,
  management: false,
  });
  
  // Elevation Colors Configuration
  const elevationColors = [
  "#193C17", // 深绿 - 低海拔
  "#2B573A", // 森林绿
  "#527D54", // 浅绿
  "#C4A484", // 浅棕
  "#8B4513", // 深棕
  "#F5F5F5", // 浅灰白 - 高海拔(雪)
  ];
  
  // New animation-related state
  const bladeRotation = ref(true);
  const rotationSpeed = ref(1.0);
  
  // References to manage animation frame
  let animationFrameId = null;
  
  // Active sections for collapsible panels
  const activeSections = ref(["controlPanel", "windTurbineManagement"]);
  
  // State for showing example data format
  const showExample = ref(false);
  
  /**
  * Toggles sidebar visibility based on type.
  * @param {String} type - 'control' or 'management'
  */
  const toggleSidebar = (type) => {
  // Close other sidebar if open
  if (type === "control") {
  sidebars.value.management = false;
  } else if (type === "management") {
  sidebars.value.control = false;
  }
  
  // Toggle the specified sidebar
  sidebars.value[type] = !sidebars.value[type];
  };
  
  /**
  * Handle add turbine button click
  */
  const handleAddTurbineClick = () => {
  // Ensure the management sidebar is open
  sidebars.value.management = true;
  // Optionally, focus on the first input field of the form
  if (turbineFormRef.value) {
  turbineFormRef.value.$el
  .querySelector("input")
  .focus();
  }
  };
  
  /**
  * Closes the specified drawer.
  * @param {String} type - 'control' or 'management'
  */
  const closeDrawer = (type) => {
  sidebars.value[type] = false;
  };
  
  /**
  * Handles before-close event of the drawers.
  * @param {Function} done - Callback function to proceed with closing.
  */
  const handleDrawerClose = (done) => {
  // Perform any necessary cleanup or confirmation before closing
  done();
  };
  
  /**
  * Converts a hexadecimal color string to a THREE.Color object.
  * @param {String} hex - Hexadecimal color string (e.g., '#FF0000').
  * @returns {THREE.Color} - Three.js Color object.
  */
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
  : new THREE.Color(0x333333); // Default color if invalid
  };
  
  /**
  * Maps elevation values to corresponding colors based on predefined thresholds.
  * @param {Number} elevation - Elevation value in meters.
  * @returns {THREE.Color} - Three.js Color object representing the elevation.
  */
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
  (elevation - minElevation.value) /
  (maxElevation.value - minElevation.value);
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
  
  /**
  * Initializes the Three.js scene, camera, renderer, and controls.
  */
  const initThreeJS = () => {
  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;
  
  // Create Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // Create Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.position.set(0, 1000, 1000);
  camera.lookAt(0, 0, 0);
  
  // Create Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  terrainContainer.value.appendChild(renderer.domElement);
  
  // Create Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 3000;
  controls.maxPolarAngle = Math.PI / 2;
  
  // Add Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  // Add Directional Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1000, 1000, 1000);
  directionalLight.castShadow = true;
  
  // Configure Shadow Properties
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
  
  // Add Hemisphere Light
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
  scene.add(hemisphereLight);
  
  // Event Listener for Mouse Movement
  renderer.domElement.addEventListener("mousemove", onMouseMove, false);
  
  // Add smooth scrolling behavior with reduced sensitivity
  let targetScroll = 0;
  let currentScroll = 0;
  
  const handleMouseWheel = (event) => {
  targetScroll += event.deltaY * 0.25; // Reduced sensitivity
  };
  
  const updateScroll = () => {
  const scrollDifference = targetScroll - currentScroll;
  currentScroll += scrollDifference * 0.1; // Damping factor for smoother effect
  
  if (Math.abs(scrollDifference) > 0.1) {
  const scrollDirection = Math.sign(scrollDifference);
  const zoomAmount = scrollDirection * 10; // Reduced zoom amount
  
  const newDistance = controls.getDistance() + zoomAmount;
  const minDistance = 100;
  const maxDistance = 3000;
  
  // Clamp the new distance to the min/max range
  const clampedDistance = Math.max(
  minDistance,
  Math.min(maxDistance, newDistance)
  );
  
  // Calculate the zoom ratio
  const zoomRatio = clampedDistance / controls.getDistance();
  
  // Apply the zoom to the camera's position
  camera.position.lerpVectors(
  controls.target,
  camera.position,
  zoomRatio
  );
  
  controls.update();
  
  // Continue updating until the difference is negligible
  requestAnimationFrame(updateScroll);
  } else {
  // Reset target scroll when reaching the destination
  targetScroll = currentScroll;
  }
  };
  
  renderer.domElement.addEventListener("wheel", handleMouseWheel, false);
  renderer.domElement.addEventListener("wheel", () => {
  requestAnimationFrame(updateScroll);
  });
  };
  
  /**
  * Handles mouse movement for tooltip display.
  * @param {MouseEvent} event
  */
  const onMouseMove = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Update tooltip position
  tooltipPos.value.x = event.clientX + 20;
  tooltipPos.value.y = event.clientY + 20;
  
  // Raycasting
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
  windTurbines.value.map((t) => t.mesh),
  true
  );
  
  if (intersects.length > 0) {
  const intersected = intersects[0].object.parent; // Assuming mesh is inside a Group
  const turbine = windTurbines.value.find((t) => t.mesh === intersected);
  if (turbine) {
  hoveredTurbine.value = turbine;
  return;
  }
  }
  
  hoveredTurbine.value = null;
  };
  
  /**
  * Animation loop to render the scene continuously.
  */
  const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
  
  if (bladeRotation.value) {
  windTurbines.value.forEach((turbine) => {
  if (turbine.mesh) {
  // Rotate only the blades (assuming they're the first three children)
  for (let i = 0; i < 3; i++) {
  const blade = turbine.mesh.children[i];
  if (blade) {
  blade.rotation.z += 0.01 * rotationSpeed.value;
  }
  }
  }
  });
  }
  
  renderer.render(scene, camera);
  };
  
  /**
  * Loads and parses the GeoTIFF file to create the terrain mesh.
  * @param {String|Number} caseId - Identifier for the case to fetch the corresponding GeoTIFF.
  */
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
  
  // Use geotiff.js to parse GeoTIFF
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  
  // Extract GeoTIFF metadata for geospatial extent
  const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY] in projection units (usually meters)
  
  // Assigning geographic bounds based on GeoTIFF metadata
  minLongitude.value = bbox[0];
  minLatitude.value = bbox[1];
  maxLongitude.value = bbox[2];
  maxLatitude.value = bbox[3];
  
  // Log extracted bounds for debugging
  console.log("Extracted GeoTIFF Bounds:", bbox);
  
  const rasters = await image.readRasters();
  const width = image.getWidth();
  const height = image.getHeight();
  const data = rasters[0];
  
  // Data Downsampling to limit the number of points
  const maxDataPoints = 120000; // maximum number of data points
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
  
  // Set Elevation Range
  minElevation.value = Math.min(...downsampledData);
  maxElevation.value = Math.max(...downsampledData);
  
  // Create Terrain Geometry
  const geometry = new THREE.PlaneGeometry(
  1000,
  1000,
  downsampledWidth - 1,
  downsampledHeight - 1
  );
  geometry.rotateX(-Math.PI / 2); // Make it horizontal
  
  // Set Vertex Heights
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < downsampledData.length; i++) {
  positions[i * 3 + 1] = downsampledData[i] / 5; // Scale elevation
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  
  // Color Mapping
  const colors = [];
  for (let i = 0; i < downsampledData.length; i++) {
  const elevation = downsampledData[i];
  const color = getElevationColor(elevation);
  colors.push(color.r, color.g, color.b);
  }
  
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  
  // Material
  const material = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  wireframe: wireframe.value, // Initialize wireframe state
  });
  
  // Create Terrain Mesh
  if (terrainMesh) {
  scene.remove(terrainMesh);
  terrainMesh.geometry.dispose();
  terrainMesh.material.dispose();
  }
  terrainMesh = new THREE.Mesh(geometry, material);
  scene.add(terrainMesh);
  
  hasGeoTIFF.value = true;
  
  // Optionally, reset camera to fit terrain
  resetCamera();
  } catch (error) {
  console.error("加载 GeoTIFF 失败", error);
  hasGeoTIFF.value = false;
  
  // Only show error if caseId was provided
  if (caseId) {
  ElMessage.error("加载 GeoTIFF 数据失败");
  }
  } finally {
  loadingInstance.close();
  }
  };
  
  /**
  * Maps latitude and longitude to X and Z coordinates on the Three.js terrain using linear interpolation.
  * @param {Number} latitude - Latitude of the wind turbine.
  * @param {Number} longitude - Longitude of the wind turbine.
  * @returns {Object} - X and Z coordinates on the terrain.
  */
  const mapLatLonToXZ = (latitude, longitude) => {
  if (
  minLatitude.value === null ||
  maxLatitude.value === null ||
  minLongitude.value === null ||
  maxLongitude.value === null
  ) {
  console.warn("GeoTIFF bounds are not set.");
  return { x: 0, z: 0 };
  }
  
  // Calculate Ratios with High Precision
  const longitudeRatio =
  (longitude - minLongitude.value) /
  (maxLongitude.value - minLongitude.value);
  const latitudeRatio =
  (latitude - minLatitude.value) /
  (maxLatitude.value - minLatitude.value);
  
  // Ensure ratios are within [0,1]
  const clampedLongitudeRatio = Math.min(Math.max(longitudeRatio, 0), 1);
  const clampedLatitudeRatio = Math.min(Math.max(latitudeRatio, 0), 1);
  
  // Terrain Size
  const terrainSize = 1000; // Size of the terrain in units (as defined in PlaneGeometry)
  
  // Calculate X and Z with high precision
  const x = (clampedLongitudeRatio - 0.5) * terrainSize;
  const z = (clampedLatitudeRatio - 0.5) * terrainSize;
  
  return { x, z };
  };
  
  /**
  * Retrieves the terrain height at a specific (x, z) coordinate using Raycaster.
  * Ensures that the wind turbine is placed precisely on the terrain surface.
  * @param {Number} x - X coordinate.
  * @param {Number} z - Z coordinate.
  * @returns {Number|null} - Y coordinate (height) of the terrain at the specified (x, z), or null if not found.
  */
  const getTerrainHeight = (x, z) => {
  // Initialize Raycaster
  const localRaycaster = new THREE.Raycaster();
  
  // Set the origin of the ray above the terrain
  const rayOrigin = new THREE.Vector3(x, 10000, z); // Far above to ensure intersection
  const rayDirection = new THREE.Vector3(0, -1, 0); // Downwards
  
  localRaycaster.set(rayOrigin, rayDirection.normalize());
  
  // Perform intersection
  const intersects = localRaycaster.intersectObject(terrainMesh);
  if (intersects.length > 0) {
  return intersects[0].point.y;
  } else {
  console.warn("未能找到地形高度，风机无法准确放置。");
  return null;
  }
  };
  
  /**
  * Adds a wind turbine to the Three.js scene based on latitude and longitude.
  * Ensures that the turbine is placed precisely on the terrain surface.
  * @param {Number} latitude - Latitude of the wind turbine.
  * @param {Number} longitude - Longitude of the wind turbine.
  * @param {Object} properties - Additional properties of the turbine.
  */
  const addWindTurbine = async (latitude, longitude, properties = {}) => {
  const { x, z } = mapLatLonToXZ(latitude, longitude);
  const terrainHeight = getTerrainHeight(x, z);
  
  if (terrainHeight === null) {
  ElMessage.error("无法获取地形高度，风机无法放置。");
  return;
  }
  
  // Enhanced turbine dimensions
  const hubHeight = properties.hubHeight || 120;
  const rotorDiameter = properties.rotorDiameter || 116;
  const bladeLength = rotorDiameter / 2;
  const name = properties.name || `风机${windTurbines.value.length + 1}`;
  
  const turbineGroup = new THREE.Group();
  
  // Tower
  const towerGeometry = new THREE.CylinderGeometry(2, 4, hubHeight, 32);
  const towerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.position.y = hubHeight / 2 + 1; // Small offset to avoid z-fighting
  tower.castShadow = true;
  tower.receiveShadow = true;
  
  // Nacelle
  const nacelleGeometry = new THREE.BoxGeometry(8, 8, 15);
  const nacelleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const nacelle = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
  nacelle.position.y = hubHeight + 4;
  nacelle.castShadow = true;
  nacelle.receiveShadow = true;
  
  // Blades
  const bladeGeometry = new THREE.BoxGeometry(1, bladeLength, 2);
  const bladeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  for (let i = 0; i < 3; i++) {
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.set(0, hubHeight + 5, 0);
  blade.rotation.z = (i * 2 * Math.PI) / 3;
  blade.castShadow = true;
  blade.receiveShadow = true;
  
  // Rotate blades around Y axis to be angled
  blade.rotateY(Math.PI / 10);
  
  turbineGroup.add(blade);
  }
  
  turbineGroup.add(tower);
  turbineGroup.add(nacelle);
  
  turbineGroup.position.set(x, terrainHeight, z);
  scene.add(turbineGroup);
  
  turbineGroup.userData = {
  name,
  latitude: parseFloat(latitude.toFixed(6)),
  longitude: parseFloat(longitude.toFixed(6)),
  hubHeight,
  rotorDiameter,
  };
  
  windTurbines.value.push({
  id: windTurbines.value.length + 1,
  name,
  latitude: parseFloat(latitude.toFixed(6)),
  longitude: parseFloat(longitude.toFixed(6)),
  hubHeight,
  rotorDiameter,
  mesh: turbineGroup,
  });
  };
  
  /**
  * Deletes a wind turbine from the scene based on its ID.
  * @param {Number} turbineId - The unique identifier of the turbine to delete.
  */
  const deleteWindTurbine = (turbineId) => {
  const index = windTurbines.value.findIndex(
  (turbine) => turbine.id === turbineId
  );
  if (index !== -1) {
  const turbine = windTurbines.value[index];
  
  // Remove from scene
  if (turbine.mesh) {
  turbine.mesh.traverse((child) => {
  if (child.isMesh) {
  child.geometry.dispose();
  if (Array.isArray(child.material)) {
  child.material.forEach((material) => material.dispose());
  } else {
  child.material.dispose();
  }
  }
  });
  scene.remove(turbine.mesh);
  }
  
  windTurbines.value.splice(index, 1);
  
  ElMessage.success(`风机 ${turbine.name} 已被删除`);
  } else {
  ElMessage.warning("未找到指定的风机");
  }
  };
  
  /**
  * Handles the submission of the wind turbine form.
  * Validates input and adds the turbine to the scene.
  */
  const submitTurbineForm = () => {
  turbineFormRef.value.validate(async (valid) => {
  if (valid) {
  const { name, latitude, longitude, hubHeight, rotorDiameter } =
  turbineForm.value;
  
  try {
  await addWindTurbine(latitude, longitude, {
  name,
  hubHeight,
  rotorDiameter,
  });
  
  ElMessage.success("风机添加成功");
  turbineFormRef.value.resetFields();
  } catch (error) {
  ElMessage.error("添加风机失败：" + error.message);
  }
  } else {
  ElMessage.warning("请正确填写所有必填项");
  return false;
  }
  });
  };
  
  /**
  * Resets the camera position to focus on the terrain with a closer view.
  */
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
  
  /**
  * Toggles the wireframe mode for the terrain mesh.
  */
  const toggleWireframe = () => {
  wireframe.value = !wireframe.value;
  if (terrainMesh) {
  terrainMesh.material.wireframe = wireframe.value;
  }
  };
  
  /**
  * Handles file upload for importing turbine data.
  * Parses CSV/TXT files and adds turbines accordingly.
  * @param {File} file - The uploaded file.
  * @returns {Boolean} - False to prevent automatic upload.
  */
  const handleFileUpload = (file) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
  const content = e.target.result;
  parseTurbineData(content, file.name);
  };
  
  reader.readAsText(file);
  
  return false; // Prevent automatic upload
  };
  
  /**
  * Parses turbine data from CSV or TXT content and adds turbines to the scene.
  * @param {String} data - The content of the uploaded file.
  * @param {String} fileName - The name of the uploaded file.
  */
  const parseTurbineData = async (data, fileName) => {
  let parsedData = [];
  const loadingInstance = ElLoading.service({
  text: "正在导入风机数据...",
  background: "rgba(0, 0, 0, 0.7)",
  });
  
  try {
  if (fileName.endsWith(".csv")) {
  parsedData = Papa.parse(data, {
  delimiter: ",",
  skipEmptyLines: true,
  header: true,
  }).data;
  } else if (fileName.endsWith(".txt")) {
  parsedData = data
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter((line) => line.length >= 5);
  parsedData = parsedData.slice(1).map((row) => ({
  name: row[0],
  longitude: row[1],
  latitude: row[2],
  hubHeight: row[3],
  rotorDiameter: row[4],
  }));
  }
  
  parsedData = parsedData.filter(
  (row) =>
  row.name &&
  !isNaN(parseFloat(row.latitude)) &&
  !isNaN(parseFloat(row.longitude)) &&
  !isNaN(parseFloat(row.hubHeight)) &&
  !isNaN(parseFloat(row.rotorDiameter))
  );
  
  for (const row of parsedData) {
  const lon = parseFloat(row.longitude);
  const lat = parseFloat(row.latitude);
  const hHeight = parseFloat(row.hubHeight);
  const rDiameter = parseFloat(row.rotorDiameter);
  
  if (
  lat < -90 ||
  lat > 90 ||
  lon < -180 ||
  lon > 180 ||
  hHeight <= 0 ||
  rDiameter <= 0 ||
  lat < minLatitude.value ||
  lat > maxLatitude.value ||
  lon < minLongitude.value ||
  lon > maxLongitude.value
  ) {
  continue;
  }
  
  await addWindTurbine(lat, lon, {
  name: row.name,
  hubHeight: hHeight,
  rotorDiameter: rDiameter,
  });
  }
  
  ElMessage.success(`成功导入 ${parsedData.length} 个风机`);
  } catch (error) {
  console.error("导入风机数据失败:", error);
  ElMessage.error("导入风机数据失败");
  } finally {
  loadingInstance.close();
  }
  };
  
  /**
  * Focuses camera on selected turbine
  */
  const focusOnTurbine = (turbine) => {
  if (turbine.mesh) {
  const position = turbine.mesh.position.clone();
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
  
  /**
  * Confirms turbine deletion with dialog
  */
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
  .then(() => {
  deleteWindTurbine(turbine.id);
  })
  .catch(() => {});
  };
  
  // Lifecycle Hooks
  onMounted(async () => {
  initThreeJS();
  animate();
  
  let extractedCaseId = route.query.caseId || route.params.caseId;
  const validCaseId =
  typeof extractedCaseId === "object" ? extractedCaseId.id : extractedCaseId;
  
  if (validCaseId) {
  await loadGeoTIFF(validCaseId);
  }
  
  window.addEventListener("resize", onWindowResize, false);
  });
  
  onBeforeUnmount(() => {
  if (animationFrameId) {
  cancelAnimationFrame(animationFrameId);
  }
  renderer.domElement.removeEventListener("mousemove", onMouseMove, false);
  window.removeEventListener("resize", onWindowResize, false);
  renderer.dispose();
  });
  
  /**
  * Handles window resize to adjust Three.js renderer and camera.
  */
  const onWindowResize = () => {
  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
  };
  
  /**
  * Compute Elevation Labels for Legend
  */
  const elevationLabels = computed(() => {
  const range = maxElevation.value - minElevation.value;
  const step = range / 4;
  return [
  Math.round(minElevation.value),
  Math.round(minElevation.value + step),
  Math.round(minElevation.value + step * 2),
  Math.round(minElevation.value + step * 3),
  Math.round(maxElevation.value),
  ];
  });
  
  /**
  * Compute Latitude and Longitude Bounds for Display with 6 Decimal Precision
  */
  const formattedGeoBounds = computed(() => {
  return {
  minLat: minLatitude.value !== null ? minLatitude.value.toFixed(6) : "N/A",
  maxLat: maxLatitude.value !== null ? maxLatitude.value.toFixed(6) : "N/A",
  minLon: minLongitude.value !== null ? minLongitude.value.toFixed(6) : "N/A",
  maxLon: maxLongitude.value !== null ? maxLongitude.value.toFixed(6) : "N/A",
  };
  });
  
  // Watch for changes in latitude and longitude input fields
  watch(
  [() => turbineForm.value.latitude, () => turbineForm.value.longitude],
  () => {
  turbineFormRef.value.validateField(["latitude", "longitude"]);
  }
  );
  
  /**
  * Toggles the display of example data format
  */
  const toggleExample = () => {
  showExample.value = !showExample.value;
  };
  
  /**
  * Handles upload change to provide immediate feedback
  */
  const handleUploadChange = () => {
  // Additional handling can be added here if needed
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
  
  /* Toolbar Styling */
  .top-toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10; /* Ensure toolbar is above other elements */
  }
  
  .toolbar-button {
  padding: 12px 20px;
  font-size: 14px;
  border-radius: 4px;
  margin-right: 10px;
  background-color: #409eff; /* Primary blue color */
  border-color: #409eff;
  color: white;
  transition: background-color 0.3s, border-color 0.3s; /* Smooth transitions */
  }
  
  .toolbar-button:hover {
  background-color: #66b1ff; /* Slightly darker blue on hover */
  border-color: #66b1ff;
  }
  
  .add-turbine-button {
  background-color: #67c23a; /* Green color for add button */
  border-color: #67c23a;
  }
  
  .add-turbine-button:hover {
  background-color: #85ce61; /* Slightly darker green on hover */
  border-color: #85ce61;
  }
  
  /* Sidebar Styling */
  .sidebar-drawer {
  background: #ffffff;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1); /* Subtle shadow */
  }
  
  .sidebar-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  }
  
  .el-collapse {
  border: none; /* Removes default border from collapse component */
  }
  
  .el-collapse-item__header {
  background-color: #f5f7fa; /* Light gray header background */
  border-bottom: 1px solid #ebeef5; /* Light gray border at the bottom */
  padding: 12px 16px; /* Adjust padding as needed */
  border-radius: 4px 4px 0 0; /* Rounded top corners */
  }
  
  .el-collapse-item__content {
  padding: 16px; /* Adjust content padding as needed */
  border-left: 1px solid #ebeef5;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  border-radius: 0 0 4px 4px; /* Rounded bottom corners */
  }
  
  .collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px; /* Slightly smaller font size */
  font-weight: 600;
  color: #303133;
  margin-bottom: 0;
  }
  
  .drawer-header {
  /* This class is no longer used - remove or repurpose as needed */
  }
  
  /* Control Panel Styling */
  .control-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .card-content {
  padding: 16px;
  }
  
  .control-group {
  margin-bottom: 20px;
  }
  
  .group-title {
  font-size: 15px;
  font-weight: 600;
  color: #606266; /* Gray text */
  margin-bottom: 12px;
  }
  
  .control-buttons {
  display: flex;
  gap: 8px;
  }
  
  .animation-controls {
  margin-top: 10px;
  }
  
  .speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
  }
  
  .speed-label {
  font-size: 14px;
  color: #606266;
  }
  
  /* Wind Turbine Management Styling */
  .management-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  }
  
  .management-tabs .el-tabs__header {
  margin-bottom: 10px;
  }
  
  .tab-content-wrapper {
  overflow-y: auto;
  height: calc(100% - 40px); /* Accounts for tab header height */
  padding-right: 10px;
  }
  
  .turbine-form {
  padding: 10px 20px 20px 20px;
  }
  
  .form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  }
  
  .coordinate-input,
  .dimension-input {
  flex: 1;
  }
  
  .form-actions {
  margin-top: 24px;
  }
  
  .submit-button {
  width: 100%;
  height: 40px;
  background-color: #409eff; /* Primary blue color */
  border-color: #409eff;
  color: white;
  transition: background-color 0.3s, border-color 0.3s;
  }
  
  .submit-button:hover {
  background-color: #66b1ff; /* Slightly darker blue on hover */
  border-color: #66b1ff;
  }
  
  /* Import Section Styling */
  .import-section {
  padding: 20px;
  }
  
  .upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
  }
  
  .upload-area:hover {
  border-color: #409eff;
  }
  
  .upload-area i {
  font-size: 20px;
  color: #909399; /* Light gray icon */
  }
  
  .upload-text {
  margin: 10px 0;
  color: #606266;
  }
  
  .upload-text em {
  color: #409eff; /* Primary blue highlight */
  font-style: normal;
  }
  
  .upload-hint {
  font-size: 12px;
  color: #909399;
  }
  
  .example-link {
  display: block;
  margin-top: 10px;
  text-align: center;
  }
  
  .example-content {
  margin-top: 10px;
  white-space: pre-wrap; /* Allow line breaks in pre tag */
  font-family: monospace;
  }
  
  /* Turbine List Styling */
  .turbine-list {
  padding: 16px;
  overflow-y: auto;
  height: calc(100% - 40px); /* Adjust as needed for tab headers, etc. */
  }
  
  .turbine-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s; /* Add smooth transition */
  }
  
  .turbine-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); /* Darker shadow on hover */
  }
  
  .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  }
  
  .turbine-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  }
  
  .turbine-actions {
  display: flex;
  gap: 8px;
  }
  
  .turbine-actions .el-button {
  padding: 6px; /* Smaller padding for action buttons */
  }
  
  .turbine-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px 16px;
  }
  
  .detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  }
  
  .detail-item .label {
  color: #909399;
  }
  
  .detail-item .value {
  color: #303133;
  font-family: monospace;
  }
  
  /* Terrain Info Styling */
  .terrain-info {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 320px;
  z-index: 10;
  }
  
  .info-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* Add subtle shadow */
  }
  
  .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  }
  
  .info-content {
  padding: 16px;
  }
  
  .section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  }
  
  .color-scale {
  margin-bottom: 20px;
  }
  
  .gradient-bar {
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(
  to right,
  #193c17 0%,
  #2b573a 20%,
  #527d54 40%,
  #c4a484 60%,
  #8b4513 80%,
  #f5f5f5 100%
  );
  margin-bottom: 8px;
  }
  
  .scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
  }
  
  .bounds-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  }
  
  .bounds-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  }
  
  .bounds-item .label {
  color: #909399;
  font-size: 13px;
  }
  
  .bounds-item .value-longitude,
  .bounds-item .value-latitude {
  color: #303133;
  font-family: monospace;
  font-size: 13px;
  }
  
  /* Tooltip Styling */
  .turbine-tooltip {
  position: absolute;
  background: rgba(48, 49, 51, 0.9);
  backdrop-filter: blur(4px);
  padding: 12px;
  border-radius: 8px;
  color: #ffffff;
  pointer-events: none;
  z-index: 100;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .tooltip-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  }
  
  .tooltip-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  }
  
  .tooltip-item .label {
  color: rgba(255, 255, 255, 0.7);
  }
  
  /* Drawer Positioning */
  .el-drawer__wrapper {
  max-width: calc(50% - 20px);
  margin-left: auto; /* Positions it on the right */
  }
  
  .el-drawer__container.ltr .el-drawer__wrapper {
  margin-left: 20px; /* For left positioning */
  margin-right: auto; /* Resets right margin for LTR drawers */
  }
  
  /* Responsive Adjustments */
  @media (max-width: 768px) {
  .terrain-info {
  width: 90%;
  left: 50%;
  transform: translateX(-50%);
  bottom: 10px;
  }
  
  .top-toolbar {
  width: calc(100% - 40px); /* Adjust for padding */
  left: 20px; /* Maintain left position */
  }
  
  .toolbar-button {
  flex: 1; /* Occupy full width on smaller screens */
  margin-right: 5px; /* Reduce margin for better spacing */
  font-size: 12px;
  padding: 10px 12px;
  }
  
  .add-turbine-button {
  margin-right: 0;
  }
  
  .el-drawer__wrapper {
  max-width: calc(100% - 40px); /* Almost full width on smaller screens */
  margin-left: 20px; /* Reset margin for responsiveness */
  margin-right: 20px;
  }
  
  .management-tabs .el-tabs__header {
  flex-wrap: wrap;
  }
  
  .turbine-card {
  padding: 8px;
  }
  
  .card-header {
  padding: 8px 12px;
  }
  
  .turbine-details {
  padding: 8px 12px;
  }
  }
  </style>