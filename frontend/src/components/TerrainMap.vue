<!-- frontend/src/components/TerrainMap.vue -->
<template>
  <div class="map-wrapper">
    <!-- Terrain Rendering Area -->
    <div class="terrain-renderer" ref="terrainContainer"></div>

    <!-- Top Toolbar -->
    <el-tooltip content="Toggle Control Panel" placement="bottom">
      <el-button
        type="primary"
        @click="toggleSidebar('control')"
        class="toolbar-button top-left-button"
        icon="el-icon-menu"
      ></el-button>
    </el-tooltip>

    <el-tooltip content="Toggle Wind Turbine Management" placement="bottom">
      <el-button
        type="primary"
        @click="toggleSidebar('management')"
        class="toolbar-button top-left-button"
        icon="el-icon-s-operation"
      ></el-button>
    </el-tooltip>

    <!-- Left Sidebar: Control Panel -->
    <el-drawer
      v-model="sidebars.control"
      direction="left"
      size="350px"
      :with-header="false"
      custom-class="sidebar-drawer"
    >
      <div class="sidebar-container">
        <div class="drawer-header">
          <h3>控制面板</h3>
          <el-button
            icon="el-icon-close"
            type="text"
            @click="sidebars.control = false"
          ></el-button>
        </div>

        <el-card class="control-card">
          <div class="card-content">
            <div class="control-group">
              <div class="group-title">地形显示</div>
              <el-button-group class="control-buttons">
                <el-button
                  type="primary"
                  @click="resetCamera"
                  icon="el-icon-refresh"
                >
                  重置视角
                </el-button>
                <el-button
                  :type="wireframe ? 'warning' : 'primary'"
                  @click="toggleWireframe"
                  :icon="wireframe ? 'el-icon-close' : 'el-icon-grid'"
                >
                  {{ wireframe ? '隐藏网格' : '显示网格' }}
                </el-button>
              </el-button-group>
            </div>
          </div>
        </el-card>
      </div>
    </el-drawer>

    <!-- Right Sidebar: Wind Turbine Management -->
    <el-drawer
      v-model="sidebars.management"
      direction="right"
      size="450px"
      :with-header="false"
      custom-class="sidebar-drawer"
    >
      <div class="sidebar-container">
        <div class="drawer-header">
          <h3>风机管理</h3>
          <el-button
            icon="el-icon-close"
            type="text"
            @click="sidebars.management = false"
          ></el-button>
        </div>

        <el-tabs type="border-card" class="management-tabs">
          <el-tab-pane label="添加风机">
            <el-form
              :model="turbineForm"
              :rules="turbineRules"
              ref="turbineFormRef"
              label-position="top"
              class="turbine-form"
            >
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="风机名称" prop="name">
                    <el-input
                      v-model="turbineForm.name"
                      placeholder="请输入风机名称"
                      clearable
                    ></el-input>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="经度" prop="longitude">
                    <el-input
                      v-model.number="turbineForm.longitude"
                      type="number"
                      step="0.000001"
                      placeholder="输入经度"
                      suffix="°"
                      clearable
                    ></el-input>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="纬度" prop="latitude">
                    <el-input
                      v-model.number="turbineForm.latitude"
                      type="number"
                      step="0.000001"
                      placeholder="输入纬度"
                      suffix="°"
                      clearable
                    ></el-input>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="桅杆高度" prop="hubHeight">
                    <el-input
                      v-model.number="turbineForm.hubHeight"
                      type="number"
                      placeholder="输入高度"
                      suffix="m"
                      clearable
                    ></el-input>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="转子直径" prop="rotorDiameter">
                    <el-input
                      v-model.number="turbineForm.rotorDiameter"
                      type="number"
                      placeholder="输入直径"
                      suffix="m"
                      clearable
                    ></el-input>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item class="form-actions">
                <el-button
                  type="primary"
                  @click="submitTurbineForm"
                  class="submit-button"
                  icon="el-icon-plus"
                >
                  添加风机
                </el-button>
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
              >
                <i class="el-icon-upload"></i>
                <div class="upload-text">
                  拖拽文件至此处或<em>点击上传</em>
                </div>
                <div class="upload-hint">支持 .csv 或 .txt 格式文件</div>
              </el-upload>
            </div>
          </el-tab-pane>

          <el-tab-pane label="已安装风机">
            <div class="turbine-list">
              <el-empty
                v-if="!windTurbines.length"
                description="暂无已安装的风机"
              >
              </el-empty>

              <el-table
                v-else
                :data="windTurbines"
                style="width: 100%"
                stripe
                border
                size="mini"
              >
                <el-table-column prop="name" label="风机名称" width="120" />
                <el-table-column prop="longitude" label="经度 (°)" width="100" />
                <el-table-column prop="latitude" label="纬度 (°)" width="100" />
                <el-table-column prop="hubHeight" label="桅杆高度 (m)" width="120" />
                <el-table-column prop="rotorDiameter" label="转子直径 (m)" width="120" />
                <el-table-column label="操作" width="120">
                  <template #default="scope">
                    <el-button
                      size="mini"
                      type="text"
                      icon="el-icon-aim"
                      @click="focusOnTurbine(scope.row)"
                      title="定位风机"
                    ></el-button>
                    <el-button
                      size="mini"
                      type="text"
                      icon="el-icon-delete"
                      @click="confirmDeleteTurbine(scope.row)"
                      title="删除风机"
                    ></el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <!-- Terrain Info Box -->
    <div class="terrain-info" v-if="hasGeoTIFF">
      <el-card class="info-card">
        <div class="info-content">
          <!-- Elevation Legend -->
          <div class="legend-section">
            <div class="section-title">地形高程</div>
            <div class="color-scale">
              <div class="gradient-bar"></div>
              <div class="scale-labels">
                <span v-for="label in elevationLabels" :key="label">
                  {{ label }}m
                </span>
              </div>
            </div>
          </div>

          <!-- Geographic Bounds -->
          <div class="bounds-section">
            <div class="section-title">地理范围</div>
            <div class="bounds-content">
              <div class="bounds-item">
                <span class="label">经度范围:</span>
                <span class="value">
                  {{ formattedGeoBounds.minLon }}° ~ {{ formattedGeoBounds.maxLon }}°
                </span>
              </div>
              <div class="bounds-item">
                <span class="label">纬度范围:</span>
                <span class="value">
                  {{ formattedGeoBounds.minLat }}° ~ {{ formattedGeoBounds.maxLat }}°
                </span>
              </div>
            </div>
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

import { 
  onMounted, 
  ref, 
  computed, 
  onBeforeUnmount 
} from 'vue';
import { useRoute } from 'vue-router';
import { 
  ElLoading, 
  ElMessage, 
  ElTooltip, 
  ElCard, 
  ElUpload, 
  ElTabs, 
  ElTabPane, 
  ElForm, 
  ElFormItem, 
  ElInput, 
  ElButton, 
  ElDrawer, 
  ElButtonGroup, 
  ElTable, 
  ElEmpty, 
  ElMessageBox, 
  ElDivider, 
  ElRow, 
  ElCol 
} from 'element-plus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import axios from 'axios';
import { fromArrayBuffer } from 'geotiff';
import Papa from 'papaparse';
import * as TWEEN from '@tweenjs/tween.js'; // Ensure tween.js is installed

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
  name: '',
  latitude: '',
  longitude: '',
  hubHeight: 120,
  rotorDiameter: 116
});

// Form Validation Rules for Adding Turbines
const turbineRules = {
  name: [
    { required: true, message: '请输入风机名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  latitude: [
    { required: true, message: '请输入纬度', trigger: 'blur' },
    { type: 'number', message: '纬度必须为数字', trigger: 'blur' },
    { 
      validator: (rule, value, callback) => {
        if (minLatitude.value !== null && maxLatitude.value !== null) {
          if (value < minLatitude.value || value > maxLatitude.value) {
            callback(new Error('纬度超出有效范围'));
            return;
          }
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  longitude: [
    { required: true, message: '请输入经度', trigger: 'blur' },
    { type: 'number', message: '经度必须为数字', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (minLongitude.value !== null && maxLongitude.value !== null) {
          if (value < minLongitude.value || value > maxLongitude.value) {
            callback(new Error('经度超出有效范围'));
            return;
          }
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  hubHeight: [
    { required: true, message: '请输入桅杆高度', trigger: 'blur' },
    { type: 'number', message: '桅杆高度必须为数字', trigger: 'blur' },
    { min: 50, max: 200, message: '桅杆高度在 50 到 200 米之间', trigger: 'blur' }
  ],
  rotorDiameter: [
    { required: true, message: '请输入转子直径', trigger: 'blur' },
    { type: 'number', message: '转子直径必须为数字', trigger: 'blur' },
    { min: 50, max: 200, message: '转子直径在 50 到 200 米之间', trigger: 'blur' }
  ]
};

// Enhanced turbine form reference
const turbineFormRef = ref(null);

// Sidebars Visibility
const sidebars = ref({
  control: false,
  management: false
});

// Elevation Colors Configuration
const elevationColors = [
  '#193C17', // 深绿 - 低海拔
  '#2B573A', // 森林绿
  '#527D54', // 浅绿
  '#C4A484', // 浅棕
  '#8B4513', // 深棕
  '#F5F5F5'  // 浅灰白 - 高海拔(雪)
];

// New animation-related state
const bladeRotation = ref(true);
const rotationSpeed = ref(1.0);

// References to manage animation frame
let animationFrameId = null;

/**
 * Toggles sidebar visibility based on type.
 * @param {String} type - 'control' or 'management'
 */
const toggleSidebar = (type) => {
  sidebars.value[type] = !sidebars.value[type];
};

/**
 * Converts a hexadecimal color string to a THREE.Color object.
 * @param {String} hex - Hexadecimal color string (e.g., '#FF0000').
 * @returns {THREE.Color} - Three.js Color object.
 */
const hexToRgb = (hex) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? new THREE.Color(parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255)
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
    { threshold: 1.0, color: elevationColors[5] }
  ];

  const normalizedElevation = (elevation - minElevation.value) / (maxElevation.value - minElevation.value);
  const clamped = Math.min(Math.max(normalizedElevation, 0), 1);

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (clamped <= colorStops[i + 1].threshold) {
      const t = (clamped - colorStops[i].threshold) / (colorStops[i + 1].threshold - colorStops[i].threshold);
      const color1 = hexToRgb(colorStops[i].color);
      const color2 = hexToRgb(colorStops[i + 1].color);
      return new THREE.Color(
        color1.r + (color2.r - color1.r) * t,
        color1.g + (color2.g - color1.g) * t,
        color1.b + (color2.b - color1.b) * t
      );
    }
  }
  return hexToRgb(colorStops[colorStops.length -1].color);
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
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);
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
  const intersects = raycaster.intersectObjects(windTurbines.value.map(t => t.mesh), true);

  if (intersects.length > 0) {
    const intersected = intersects[0].object.parent; // Assuming mesh is inside a Group
    const turbine = windTurbines.value.find(t => t.mesh === intersected);
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
    windTurbines.value.forEach(turbine => {
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
    text: '加载地形数据中...',
    spinner: 'el-icon-loading',
    background: 'rgba(0, 0, 0, 0.7)',
  });

  try {
    const response = await axios.get(`/api/cases/${caseId}/terrain`, {
      responseType: 'arraybuffer'
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
    console.log('Extracted GeoTIFF Bounds:', bbox);

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
    const geometry = new THREE.PlaneGeometry(1000, 1000, downsampledWidth - 1, downsampledHeight - 1);
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

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Material
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: wireframe.value // Initialize wireframe state
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
    console.error('加载 GeoTIFF 失败', error);
    hasGeoTIFF.value = false;

    // Only show error if caseId was provided
    if (caseId) {
      ElMessage.error('加载 GeoTIFF 数据失败');
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
  if (minLatitude.value === null || maxLatitude.value === null || minLongitude.value === null || maxLongitude.value === null) {
    console.warn('GeoTIFF bounds are not set.');
    return { x: 0, z: 0 };
  }

  // Calculate Ratios with High Precision
  const longitudeRatio = (longitude - minLongitude.value) / (maxLongitude.value - minLongitude.value);
  const latitudeRatio = (latitude - minLatitude.value) / (maxLatitude.value - minLatitude.value);

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
    console.warn('未能找到地形高度，风机无法准确放置。');
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
    ElMessage.error('无法获取地形高度，风机无法放置。');
    return;
  }

  // Enhanced turbine dimensions
  const hubHeight = properties.hubHeight || 120;
  const rotorDiameter = properties.rotorDiameter || 116;
  const bladeLength = rotorDiameter / 2;
  const name = properties.name || `风机${windTurbines.value.length + 1}`;

  const turbineGroup = new THREE.Group();
  turbineGroup.userData = {}; // Initialize userData for potential future use

  // Enhanced tower with segments and materials
  const towerGeometry = new THREE.CylinderGeometry(3, 4.5, hubHeight, 16);
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.5,
    metalness: 0.8
  });
  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.castShadow = true;
  tower.receiveShadow = true;
  tower.position.y = hubHeight / 2;

  // Enhanced nacelle
  const nacelleGeometry = new THREE.BoxGeometry(12, 8, 20);
  const nacelleMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.3,
    metalness: 0.9
  });
  const nacelle = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
  nacelle.position.y = hubHeight;
  nacelle.castShadow = true;

  // Create blades with better geometry
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -2);
  bladeShape.quadraticCurveTo(1, -1, 2, 0);
  bladeShape.quadraticCurveTo(1, 1, 0, 2);
  bladeShape.quadraticCurveTo(-1, 1, -2, 0);
  bladeShape.quadraticCurveTo(-1, -1, 0, -2);

  const bladeExtrudeSettings = {
    steps: 1,
    depth: bladeLength,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.3,
    bevelOffset: 0,
    bevelSegments: 5
  };

  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, bladeExtrudeSettings);

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.6
  });

  // Create three blades with 120-degree spacing
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = hubHeight;
    blade.rotation.z = (Math.PI * 2 / 3) * i;
    blade.castShadow = true;
    turbineGroup.add(blade);
  }

  turbineGroup.add(tower);
  turbineGroup.add(nacelle);
  
  // Position the turbine
  turbineGroup.position.set(x, terrainHeight, z);
  scene.add(turbineGroup);

  // Assign Turbine Data to Mesh for Tooltip
  turbineGroup.userData = {
    name,
    latitude: parseFloat(latitude.toFixed(6)),
    longitude: parseFloat(longitude.toFixed(6)),
    hubHeight,
    rotorDiameter
  };

  // Add to wind turbines list with enhanced properties
  windTurbines.value.push({
    id: windTurbines.value.length + 1,
    name,
    latitude: parseFloat(latitude.toFixed(6)),
    longitude: parseFloat(longitude.toFixed(6)),
    hubHeight,
    rotorDiameter,
    mesh: turbineGroup
  });
};

/**
 * Deletes a wind turbine from the scene based on its ID.
 * @param {Number} turbineId - The unique identifier of the turbine to delete.
 */
const deleteWindTurbine = (turbineId) => {
  const index = windTurbines.value.findIndex(turbine => turbine.id === turbineId);
  if (index !== -1) {
    const turbine = windTurbines.value[index];
    
    // Remove from scene
    if (turbine.mesh) {
      // Traverse and dispose of geometries and materials
      turbine.mesh.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      scene.remove(turbine.mesh);
    }

    // Remove from array
    windTurbines.value.splice(index, 1);
    
    ElMessage.success(`风机 ${turbineId} 已被删除`);
  } else {
    ElMessage.warning('未找到指定的风机');
  }
};

/**
 * Handles the submission of the wind turbine form.
 * Validates input and adds the turbine to the scene.
 */
const submitTurbineForm = () => {
  turbineFormRef.value.validate(async (valid) => {
    if (valid) {
      const { name, latitude, longitude, hubHeight, rotorDiameter } = turbineForm.value;
      
      try {
        await addWindTurbine(latitude, longitude, {
          name,
          hubHeight,
          rotorDiameter
        });

        ElMessage.success('风机添加成功');
        turbineFormRef.value.resetFields();
      } catch (error) {
        ElMessage.error('添加风机失败：' + error.message);
      }
    } else {
      ElMessage.warning('请正确填写所有必填项');
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
    
    const distance = Math.max(size.x, size.z) * 1.2; // Reduced multiplier for closer view
    const height = size.y * 1.5; // Adjusted height for better elevation visibility

    camera.position.set(
      center.x + distance,
      center.y + height,
      center.z + distance
    );
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
    text: '正在导入风机数据...',
    background: 'rgba(0, 0, 0, 0.7)'
  });

  try {
    if (fileName.endsWith('.csv')) {
      parsedData = Papa.parse(data, {
        delimiter: ',',
        skipEmptyLines: true
      }).data;
    } else if (fileName.endsWith('.txt')) {
      parsedData = data
        .split('\n')
        .map(line => line.trim().split(/\s+/))
        .filter(line => line.length >= 6);
    }

    // Filter out header row and empty rows
    parsedData = parsedData
      .filter(row => row.length >= 6 && !isNaN(parseFloat(row[2])) && !isNaN(parseFloat(row[1])) && !isNaN(parseFloat(row[3])) && !isNaN(parseFloat(row[4])));

    for (const row of parsedData) {
      const [name, longitude, latitude, hubHeight, rotorDiameter, model] = row;
      const lon = parseFloat(longitude);
      const lat = parseFloat(latitude);
      const hHeight = parseFloat(hubHeight);
      const rDiameter = parseFloat(rotorDiameter);

      if (
        !name ||
        isNaN(lat) || 
        isNaN(lon) ||
        isNaN(hHeight) ||
        isNaN(rDiameter) ||
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
        // Skip invalid entries
        continue;
      }

      // Add turbine with enhanced properties
      await addWindTurbine(lat, lon, {
        name,
        hubHeight: hHeight,
        rotorDiameter: rDiameter
      });
    }

    ElMessage.success(`成功导入 ${parsedData.length} 个风机`);
  } catch (error) {
    console.error('导入风机数据失败:', error);
    ElMessage.error('导入风机数据失败');
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
    
    // Animate camera movement
    new TWEEN.Tween(camera.position)
      .to({
        x: position.x + 200,
        y: position.y + 100,
        z: position.z + 200
      }, 1000)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();

    new TWEEN.Tween(controls.target)
      .to({
        x: position.x,
        y: position.y,
        z: position.z
      }, 1000)
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
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      deleteWindTurbine(turbine.id);
    })
    .catch(() => {
      // User cancelled deletion
    });
};

// Lifecycle Hooks and Watchers
onMounted(async () => {
  initThreeJS();
  animate();

  // Extract caseId from route
  let extractedCaseId = route.query.caseId || route.params.caseId;

  // Ensure caseId is a string or number
  const validCaseId = typeof extractedCaseId === 'object' ? extractedCaseId.id : extractedCaseId;

  if (validCaseId) {
    await loadGeoTIFF(validCaseId);
  }

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  renderer.domElement.removeEventListener('mousemove', onMouseMove, false);
  window.removeEventListener('resize', onWindowResize, false);
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
    Math.round(maxElevation.value)
  ];
});

/**
 * Compute Latitude and Longitude Bounds for Display with 6 Decimal Precision
 */
const formattedGeoBounds = computed(() => {
  return {
    minLat: minLatitude.value !== null ? minLatitude.value.toFixed(6) : 'N/A',
    maxLat: maxLatitude.value !== null ? maxLatitude.value.toFixed(6) : 'N/A',
    minLon: minLongitude.value !== null ? minLongitude.value.toFixed(6) : 'N/A',
    maxLon: maxLongitude.value !== null ? maxLongitude.value.toFixed(6) : 'N/A'
  };
});
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f7fa;
}

/* Terrain Renderer */
.terrain-renderer {
  width: 100%;
  height: 100%;
}

/* Toolbar Styling */
.top-left-button {
  position: absolute;
  top: 20px;
  left: 20px;
  margin-right: 10px;
}

.toolbar-button {
  padding: 10px;
  border-radius: 50%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: background-color 0.3s;
}

.toolbar-button:hover {
  background-color: #409eff;
}

/* Sidebar Styling */
.sidebar-drawer {
  background: #ffffff;
}

.sidebar-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
}

.drawer-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* Control Panel Styling */
.control-card {
  margin-bottom: 16px;
  border-radius: 8px;
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
  color: #606266;
  margin-bottom: 12px;
}

.control-buttons {
  display: flex;
  gap: 8px;
}

/* Wind Turbine Management Styling */
.management-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.turbine-form {
  padding: 20px 0;
  flex: 1;
  overflow-y: auto;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

/* Import Section Styling */
.import-section {
  padding: 20px 0;
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

.upload-text {
  margin: 10px 0;
  color: #606266;
}

.upload-text em {
  color: #409eff;
  font-style: normal;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

/* Turbine List Styling */
.turbine-list {
  padding: 16px;
  overflow-y: auto;
  height: calc(100% - 40px);
}

.el-table {
  background: #ffffff;
  border-radius: 8px;
}

.el-table th {
  background-color: #f5f7fa;
}

.el-table .cell {
  padding: 8px 16px;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    #193C17 0%,
    #2B573A 20%,
    #527D54 40%,
    #C4A484 60%,
    #8B4513 80%,
    #F5F5F5 100%
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
  font-size: 12px;
  color: #909399;
}

.bounds-item .value {
  color: #303133;
  font-family: monospace;
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

.tooltip-item .value {
  color: #ffffff;
  font-family: monospace;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .terrain-info {
    width: 90%;
    left: 50%;
    transform: translateX(-50%);
    bottom: 10px;
  }

  .top-left-button {
    top: 10px;
    left: 10px;
    margin-right: 8px;
  }

  .toolbar-button {
    padding: 8px;
  }

  .el-table th,
  .el-table .cell {
    padding: 6px 12px;
  }

  .gradient-bar {
    height: 16px;
  }

  .scale-labels {
    font-size: 10px;
  }

  .tooltip-title {
    font-size: 12px;
  }

  .tooltip-item {
    font-size: 10px;
  }
}
</style>