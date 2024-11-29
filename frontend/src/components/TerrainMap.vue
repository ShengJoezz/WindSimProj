<!-- frontend/src/components/TerrainMap.vue -->
<template>
  <div class="map-container">
    <!-- Terrain Rendering Area -->
    <div id="terrain-container" ref="terrainContainer"></div>
    
    <!-- Controls Panel -->
    <div class="controls-panel" v-if="hasGeoTIFF">
      <!-- Camera Controls -->
      <el-button-group class="control-group">
        <el-tooltip content="重置视角" placement="top">
          <el-button icon="el-icon-refresh" size="small" @click="resetCamera" class="control-button">
          </el-button>
        </el-tooltip>
        <el-tooltip :content="wireframe ? '关闭网格' : '开启网格'" placement="top">
          <el-button 
            :icon="wireframe ? 'el-icon-s-grid-remove' : 'el-icon-s-grid'" 
            size="small" 
            @click="toggleWireframe" 
            class="control-button">
          </el-button>
        </el-tooltip>
      </el-button-group>

      <!-- Wind Turbine Addition Form -->
      <el-card class="turbine-form-card" shadow="hover">
        <el-form :model="turbineForm" label-width="60px" @submit.native.prevent="submitTurbine" class="turbine-form">
          <el-form-item label="纬度">
            <el-input 
              v-model="turbineForm.latitude" 
              placeholder="请输入纬度" 
              prefix-icon="el-icon-s-location"
              step="0.000001"
              type="text">
            </el-input>
          </el-form-item>
          <el-form-item label="经度">
            <el-input 
              v-model="turbineForm.longitude" 
              placeholder="请输入经度" 
              prefix-icon="el-icon-s-location"
              step="0.000001"
              type="text">
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-button 
              type="primary" 
              icon="el-icon-plus" 
              @click="submitTurbine">
              添加风机
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
    
    <!-- Legend and Information Panel -->
    <div v-if="hasGeoTIFF" class="info-panel">
      <!-- Elevation Legend -->
      <div class="legend-section">
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

      <!-- Geographic Bounds Section -->
      <div class="geo-bounds-section">
        <h4>地理范围</h4>
        <div class="bounds-container">
          <div class="bounds-item">
            <span class="label">纬度:</span>
            <span class="value">{{ formattedGeoBounds.minLat }}° - {{ formattedGeoBounds.maxLat }}°</span>
          </div>
          <div class="bounds-item">
            <span class="label">经度:</span>
            <span class="value">{{ formattedGeoBounds.minLon }}° - {{ formattedGeoBounds.maxLon }}°</span>
          </div>
        </div>
      </div>

      <!-- Wind Turbines List with Deletion Option -->
      <div class="turbines-list-section">
        <h4>已放置的风机</h4>
        <ul class="turbines-list">
          <li v-for="turbine in windTurbines" :key="turbine.id">
            <span>风机 {{ turbine.id }}: 纬度 {{ turbine.latitude }}°, 经度 {{ turbine.longitude }}°</span>
            <el-button 
              type="danger" 
              icon="el-icon-delete" 
              size="mini" 
              @click="deleteWindTurbine(turbine.id)">
              删除
            </el-button>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- Default View When No GeoTIFF is Loaded -->
    <div v-else class="default-view">
      <p>请选择一个工况以查看详细信息。</p>
    </div>
  </div>
</template>

<script setup>
/**
 * TerrainMap.vue
 * 
 * This component renders a 3D terrain from a GeoTIFF file and allows users
 * to add and delete wind turbines by inputting their latitude and longitude.
 * 
 * Wind turbines are managed locally within the component without relying on
 * the Pinia store, making this setup ideal until backend functionalities are implemented.
 */

import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElLoading, ElMessage, ElTooltip, ElCard } from 'element-plus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import axios from 'axios';
import { fromArrayBuffer } from 'geotiff';

// References to DOM Elements
const terrainContainer = ref(null);

// Routing
const route = useRoute();

// Three.js Variables
let scene, camera, renderer, controls;
let terrainMesh = null;

// Reactive State Variables
const hasGeoTIFF = ref(false);
const minElevation = ref(0);
const maxElevation = ref(1000);
const wireframe = ref(false);

// Reactive State Variables for Geographic Bounds (to be dynamically set)
const minLatitude = ref(null);
const maxLatitude = ref(null);
const minLongitude = ref(null);
const maxLongitude = ref(null);

// Wind Turbines State
const windTurbines = ref([]);

// Form Data for Adding Wind Turbines
const turbineForm = ref({
  latitude: '',
  longitude: ''
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
};

/**
 * Animation loop to render the scene continuously.
 */
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
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
    // For simplicity, assuming GeoTIFF is in geographic coordinates (degrees)
    // If in projected coordinates, a CRS transformation would be required

    // Assigning geographic bounds based on GeoTIFF metadata
    minLongitude.value = bbox[0];
    minLatitude.value = bbox[1];
    maxLongitude.value = bbox[2];
    maxLatitude.value = bbox[3];

    // Expected Range: Latitude: 20° - 50°, Longitude: -130° - -60°
    // Verify if extracted bounds match expectations
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
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Set the origin of the ray above the terrain
  const rayOrigin = new THREE.Vector3(x, 10000, z); // Far above to ensure intersection
  const rayDirection = new THREE.Vector3(0, -1, 0); // Downwards

  raycaster.set(rayOrigin, rayDirection.normalize());

  // Perform intersection
  const intersects = raycaster.intersectObject(terrainMesh);
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
 */
const addWindTurbine = (latitude, longitude) => {
  const { x, z } = mapLatLonToXZ(latitude, longitude);

  // Retrieve terrain height at (x, z)
  const terrainHeight = getTerrainHeight(x, z);
  if (terrainHeight === null) {
    ElMessage.error('无法获取地形高度，风机无法放置。');
    return;
  }

  // Define the height of the wind turbine
  const turbineHeight = 120; // Height of the turbine

  // Create turbine geometry (a simple cylinder representing the tower)
  const geometry = new THREE.CylinderGeometry(2.5, 2.5, turbineHeight, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const turbine = new THREE.Mesh(geometry, material);
  turbine.castShadow = true;
  turbine.receiveShadow = true;

  // Position the turbine so that its base rests on the terrain
  const yPosition = terrainHeight + turbineHeight / 2;
  turbine.position.set(x, yPosition, z);

  // Add to scene
  scene.add(turbine);

  // Add to wind turbines list with high precision
  windTurbines.value.push({
    id: windTurbines.value.length + 1,
    latitude: parseFloat(latitude.toFixed(6)),
    longitude: parseFloat(longitude.toFixed(6)),
    mesh: turbine
  });

  ElMessage.success('风机已成功添加');
};

/**
 * Deletes a wind turbine from the scene based on its ID.
 * @param {Number} turbineId - The unique identifier of the turbine to delete.
 */
const deleteWindTurbine = (turbineId) => {
  const index = windTurbines.value.findIndex(turbine => turbine.id === turbineId);
  if (index !== -1) {
    // Remove from scene
    scene.remove(windTurbines.value[index].mesh);
    windTurbines.value[index].mesh.geometry.dispose();
    windTurbines.value[index].mesh.material.dispose();

    // Remove from list
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
const submitTurbine = () => {
  const latitude = parseFloat(turbineForm.value.latitude);
  const longitude = parseFloat(turbineForm.value.longitude);

  // Basic Validation
  if (
    isNaN(latitude) || 
    isNaN(longitude) ||
    latitude < -90 || 
    latitude > 90 ||
    longitude < -180 || 
    longitude > 180
  ) {
    ElMessage.warning('请输入有效的纬度和经度值。纬度范围为-90到90，经度范围为-180到180。');
    return;
  }

  // Check if coordinates are within GeoTIFF bounds
  if (
    latitude < minLatitude.value || 
    latitude > maxLatitude.value ||
    longitude < minLongitude.value || 
    longitude > maxLongitude.value
  ) {
    ElMessage.error(`风机坐标超出地理范围。有效范围: 纬度 ${minLatitude.value.toFixed(6)}° - ${maxLatitude.value.toFixed(6)}°, 经度 ${minLongitude.value.toFixed(6)}° - ${maxLongitude.value.toFixed(6)}°。`);
    return;
  }

  // Add Wind Turbine
  addWindTurbine(latitude, longitude);

  // Reset Form
  turbineForm.value.latitude = '';
  turbineForm.value.longitude = '';
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
});

// Compute Elevation Labels for Legend
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

// Compute Latitude and Longitude Bounds for Display with 6 Decimal Precision
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
.map-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%);
}

/* Terrain Container Styling */
#terrain-container {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
  overflow: hidden;
}

/* Controls Panel Styling */
.controls-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 250px;
}

.control-group {
  display: flex;
  justify-content: space-between;
}

.control-button {
  background-color: #ffffff;
  border: none;
  color: #333333;
  transition: background-color 0.3s, color 0.3s;
}

.control-button:hover {
  background-color: #3f51b5;
  color: #ffffff;
}

/* Turbine Form Card Styling */
.turbine-form-card {
  padding: 10px;
  border: none;
}

.turbine-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Info Panel Styling */
.info-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 300px;
}

/* Legend Section */
.legend-section h4,
.geo-bounds-section h4,
.turbines-list-section h4 {
  margin: 0 0 8px 0;
  color: #333333;
  font-size: 16px;
  font-weight: 600;
}

.color-bar {
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
}

/* Elevation Labels Styling */
.elevation-labels {
  margin-top: 8px;
  position: relative;
}

.label-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  padding-right: 16px; /* Space for units */
}

.elevation-label {
  font-size: 14px;
  color: #333333;
  font-weight: 500;
  transition: color 0.3s;
}

.elevation-label:hover {
  color: #6a11cb;
}

/* Geographic Bounds Section Styling */
.geo-bounds-section .bounds-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bounds-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #555555;
}

.label {
  font-weight: 500;
  margin-right: 8px;
}

.value {
  color: #333333;
}

/* Turbines List Section Styling */
.turbines-list-section .turbines-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 150px;
  overflow-y: auto;
}

.turbines-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #e0e0e0;
}

.turbines-list li:last-child {
  border-bottom: none;
}

.turbines-list span {
  font-size: 14px;
  color: #333333;
}

.el-button--danger {
  padding: 2px 6px;
}

/* Default View Styling */
.default-view {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #666666;
  font-size: 16px;
  text-align: center;
}

/* Enhanced Buttons */
.el-button--primary {
  background-image: linear-gradient(45deg, #6a11cb 0%, #2575fc 100%);
  border: none;
}

.el-button--primary:hover {
  background-image: linear-gradient(45deg, #2575fc 0%, #6a11cb 100%);
}

/* Input Field Adjustment to Prevent Wrapping */
.el-form-item {
  margin-bottom: 12px;
}
</style>