<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-19 22:25:10
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-06-19 17:35:01
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TerrainMap.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

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

    <div v-if="terrainLoadState !== 'loaded'" class="terrain-loading">
      <div v-if="terrainLoadState === 'loading'" class="loading-content" role="status" aria-live="polite">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <div class="loading-text">加载地形中...</div>
      </div>

      <el-empty
        v-else-if="terrainLoadState === 'missing'"
        description="未找到地形文件，请先上传 terrain.tif"
      >
        <el-button type="primary" @click="goToCases">返回工况列表</el-button>
      </el-empty>

      <el-empty v-else description="地形加载失败，请检查文件或服务器日志">
        <el-button type="primary" @click="reloadTerrain">重试加载</el-button>
      </el-empty>
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
      :geographicBounds="rawGeoBounds"
      @focus-turbine="focusOnTurbine"
      @delete-turbine="confirmDeleteTurbine"
      @add-turbine="handleAddTurbineFromManagement"
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

import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import { Loading } from '@element-plus/icons-vue';
import { useCaseStore } from "../../store/caseStore";
import TopToolbar from "./TopToolbar.vue";
import ControlPanel from "./ControlPanel.vue";
import WindTurbineManagement from "./WindTurbineManagement.vue";
import TerrainInfo from "./TerrainInfo.vue";
import TurbineTooltip from "./TurbineTooltip.vue";
// import TerrainClipping from "./TerrainClipping.vue"; // Removed TerrainClipping Component
import axios from "axios";
import { fromArrayBuffer } from "geotiff";
import * as TWEEN from "@tweenjs/tween.js";
import lodash from 'lodash';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"; // Step 2: Import GLTFLoader

// Debug flags and settings
const ROTATION_TEST_MODE = false; // Set to true to test rotation axes
// 2: info, 3: errors (production default)
const LOG_LEVEL = import.meta.env.DEV ? 2 : 3;

// Turbine Scaling Constants
const MIN_SCALE_FACTOR = 0.5; // Minimum scale factor when far away
const MAX_SCALE_FACTOR = 1.0; // Maximum scale factor when close
const MIN_DISTANCE_FOR_SCALING = 500; // Distance at which scaling starts
const MAX_DISTANCE_FOR_SCALING = 2000; // Distance at which minimum scale is reached


// Logging function with level control
const log = (level, message, ...args) => {
  if (level < LOG_LEVEL) return;
  const prefix = level >= 3 ? '[ERROR]' : '[INFO]';
  if (level >= 3) console.error(prefix, message, ...args);
  else console.log(prefix, message, ...args);
};

// 初始化 Store 和 Route
const caseStore = useCaseStore();
const route = useRoute();
const router = useRouter();

// 引用和响应式变量
const terrainContainer = ref(null);
const hasGeoTIFF = ref(false);
const terrainLoadState = ref('loading'); // loading | loaded | missing | error
const wireframe = ref(false);
const bladeRotation = ref(true);
const rotationSpeed = ref(1.0);
const sidebars = ref({
  control: false,
  management: false,
  // terrainClipping: false, // Removed terrainClipping from sidebars state
});
const hoveredTurbine = ref(null);
const tooltipPos = ref({ x: 0, y: 0 });
const hasRendererInitialized = ref(false);
const isSceneInitialized = ref(false); // Track if scene is initialized
// const cropPreviewActive = ref(false); // Removed
// const cropPreviewBounds = ref(null); // Removed
// let cropPreviewMesh = null; // Removed
const queuedTurbines = ref([]); // Queue turbines to add after scene is ready
// const isDragSelectionActive = ref(false); // Removed
// const terrainClipping = ref(null); // Removed


// GLTF Model references  // Step 3: Add Model Variables
let windTurbineModel = null;
let isModelLoading = false;

// Three.js 变量
let scene = null; // Initialize as null
let camera = null; // Initialize as null
let renderer = null; // Initialize as null
let controls = null;
let terrainMesh = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const turbineMeshes = ref(new Map());
let animationFrameId = null;
let addTurbineCounter = 0; // 在 setup 顶部添加计数器

// 用于跟踪正在处理的风机ID
const processingTurbineIds = ref(new Set());

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

// [新增] 创建一个用于逻辑计算的计算属性
const rawGeoBounds = computed(() => {
  return {
    minLat: caseStore.minLatitude, // <-- 直接使用原始数字
    maxLat: caseStore.maxLatitude,
    minLon: caseStore.minLongitude,
    maxLon: caseStore.maxLongitude,
  };
});

const goToCases = () => {
  router.push({ name: "Cases" });
};

const reloadTerrain = async () => {
  const caseId = caseStore.caseId || route.params.caseId;
  if (!caseId) return;
  await loadGeoTIFF(caseId);
};

// 方法

// Load the wind turbine GLTF model  // Step 4: Create Model Loading Function
const loadWindTurbineModel = (retryCount = 3) => {
  if (windTurbineModel) return Promise.resolve(windTurbineModel);
  if (isModelLoading) {
    // Return a new promise that waits for the current loading to complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (windTurbineModel) {
          clearInterval(checkInterval);
          resolve(windTurbineModel);
        } else if (!isModelLoading) {
          clearInterval(checkInterval);
          reject(new Error("Model loading failed"));
        }
      }, 200);
    });
  }

  isModelLoading = true;
  return new Promise((resolve, reject) => {
    log(2, '[MODEL-LOADER] Starting model load attempt'); // Modified log
    const loader = new GLTFLoader();

    loader.load(
      '/models/wind_turbine/scene.gltf',
      (gltf) => {
        log(2, '[MODEL-LOADER] Wind turbine model loaded successfully'); // Modified log
        const model = gltf.scene;

        // --- Debugging Model Structure ---
        log(2, '--- Model Summary ---'); // Modified log
        const stats = {meshes: 0, groups: 0, byLevel: {}};
        (function countObjects(obj, depth = 0) {
          if (obj.isMesh) stats.meshes++;
          if (obj.isGroup) stats.groups++;

          stats.byLevel[depth] = (stats.byLevel[depth] || 0) + 1;

          if (obj.children) {
            obj.children.forEach(child => countObjects(child, depth + 1));
          }
        })(model);
        log(2, `[MODEL-SUMMARY] Model contains ${stats.meshes} meshes in ${stats.groups} groups`); // Modified log
        log(2, '[MODEL-SUMMARY] Objects by hierarchy level:', stats.byLevel); // Modified log


        // Mesh geometry analysis
        log(2, '[MODEL-ANALYSIS] Analyzing wind turbine components');
        model.traverse(child => {
          if (child.isMesh) {
            log(2, `[MODEL-ANALYSIS] Mesh: ${child.name}`, {
              vertexCount: child.geometry.attributes.position.count,
              boundingBox: new THREE.Box3().setFromObject(child).getSize(new THREE.Vector3())
            });

            // Check if main unit might contain blade geometry
            if (child.name === 'Main_Unit_WindTurbine_PBR_0' &&
                child.geometry.attributes.position.count > 1000) {
              log(2, '[MODEL-ANALYSIS] Main unit has significant geometry that may include static blades');
            }
          }
        });

        // Detailed model analysis
        log(2, '[MODEL-DETAIL] Detailed analysis of wind turbine components');
        model.traverse((child) => {
          if (child.isMesh) {
            // Analyze mesh orientation
            const worldMatrix = new THREE.Matrix4();
            child.updateMatrixWorld(true);
            worldMatrix.copy(child.matrixWorld);

            // Extract rotation in degrees for clearer understanding
            const rotation = new THREE.Euler().setFromRotationMatrix(worldMatrix);
            const rotationDegrees = {
              x: (rotation.x * 180 / Math.PI).toFixed(1),
              y: (rotation.y * 180 / Math.PI).toFixed(1),
              z: (rotation.z * 180 / Math.PI).toFixed(1)
            };

            log(2, `[MODEL-DETAIL] ${child.name}:`, {
              position: child.position,
              rotation: rotationDegrees,
              scale: child.scale,
            });

            // Analyze local vs world coordinates to understand how the model is positioned
            if (child.name === 'Blades_WindTurbine_PBR_0') {
              log(2, '[MODEL-DETAIL] Blade local axes orientation in world space:');

              // Extract axes from world matrix
              const xAxis = new THREE.Vector3();
              const yAxis = new THREE.Vector3();
              const zAxis = new THREE.Vector3();
              worldMatrix.extractBasis(xAxis, yAxis, zAxis);

              log(2, '  X-axis:', xAxis);
              log(2, '  Y-axis:', yAxis);
              log(2, '  Z-axis:', zAxis);
              log(2, 'This information shows which world direction each blade axis points toward');
            }
          }
        });


        model.scale.set(0.01, 0.01, 0.01);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });

        // Material analysis
        log(2, '[MODEL-MATERIALS] Analyzing model materials:'); // Added material analysis
        const materialsByType = {};
        model.traverse(child => {
          if (child.isMesh) {
            const matType = child.material ? child.material.type : 'unknown';
            materialsByType[matType] = (materialsByType[matType] || 0) + 1;

            // Check for material issues
            if (child.material && (child.material.transparent || child.material.opacity < 1)) {
              log(2, `  - [MODEL-MATERIALS] ${child.name} has transparent material:`, {
                type: child.material.type,
                opacity: child.material.opacity,
                transparent: child.material.transparent
              });
            }
          }
        });
        log(2, '[MODEL-MATERIALS] Material count by type:', materialsByType); // Added material analysis


        // Store for future use
        windTurbineModel = model;
        isModelLoading = false;
        resolve(model);
      },
      // Progress callback - REMOVE or MODIFY
      (xhr) => {
        // Only log at 25%, 50%, 75%, 100% instead of continuous updates
        const percent = Math.round(xhr.loaded / xhr.total * 100);
        if (percent % 25 === 0) {
          log(2, `[MODEL-LOADER] Loading model: ${percent}% loaded`); // Modified log
        }
      },
      // Error callback
      (error) => {
        console.error('[MODEL-LOADER] Error loading GLTF model:', error); // Modified log
        isModelLoading = false;

        if (retryCount > 0) {
          log(2, `[MODEL-LOADER] Retrying model load, ${retryCount} attempts remaining`); // Modified log
          // Wait a bit before retrying
          setTimeout(() => {
            loadWindTurbineModel(retryCount - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject(error);
        }
      }
    );
  });
};

// Add this function to your code to properly handle the model components
const optimizeWindTurbineModel = (modelGroup) => {
  // Get turbine ID for logging
  const turbineId = modelGroup.userData?.turbineId || 'unknown';

  // Track what components we found for debugging
  const components = {
    blades: false,
    mainUnit: false
  };

  // Find all relevant components
  modelGroup.traverse((child) => {
    // Handle blade component (to be rotated)
    // Handle blade component (to be rotated)
if (child.name === 'Blades_WindTurbine_PBR_0') {
  components.blades = true;
  // Ensure blade component is visible and properly set up for rotation
  child.visible = true;

  // 改进：叶片颜色和材质 - 简洁版
  if (child.isMesh && child.material) {
    // 设置为纯白色
    child.material.color.set(0xFFFFFF);
    // 适度调整材质属性
    if (child.material.metalness !== undefined) {
      child.material.metalness = 0.1;
      child.material.roughness = 0.3;
    }
  }
}

// Handle main unit (static parts)
else if (child.name === 'Main_Unit_WindTurbine_PBR_0') {
  components.mainUnit = true;
  // Ensure main unit is visible
  child.visible = true;

  // 主体设为浅灰色
  if (child.isMesh && child.material) {
    // Clone the material to avoid affecting other instances
    child.material = child.material.clone();

    // 设置为浅灰色
    child.material.color.set(0xEEEEEE);

    if (child.material.metalness !== undefined) {
      child.material.metalness = 0.2;
      child.material.roughness = 0.5;
    }

    child.material.transparent = false;
    child.material.opacity = 1.0;
  }
}

// 塔筒部分
else if (child.name.includes('Tower') || child.name.includes('Base')) {
  if (child.isMesh && child.material) {
    child.material = child.material.clone();

    // 设置为灰色
    child.material.color.set(0xDDDDDD);

    if (child.material.metalness !== undefined) {
      child.material.metalness = 0.4;
      child.material.roughness = 0.6;
    }
  }
}
  });

  // Log what we found for debugging
  log(2, `[TURBINE-OPTIMIZE-${turbineId}] Components found:`, components);

  return modelGroup;
};


// Find the blade components in the model // Step 5: Identify Blade Components
const findBladeComponents = (model) => {
  // Add a unique identifier for debugging multiple turbines
  const modelId = model.userData?.turbineId || 'unknown';
  log(2, `[BLADE-FINDER-${modelId}] Looking for blade components`); // Added log

  const blades = [];

  // Use a more comprehensive approach to find the blades
  // Check both by name and by analyzing geometry complexity
  model.traverse((child) => {
    // Primary check - exact name match
    if (child.name === 'Blades_WindTurbine_PBR_0') {
      log(2, `[BLADE-FINDER-${modelId}] Found blade component by name: ${child.name}`);
      blades.push(child);
    }
    // Backup check - find objects that look like blades based on their properties
    else if (child.isMesh &&
            !child.name.includes('Main') &&
            child.name.toLowerCase().includes('blade')) {
      log(2, `[BLADE-FINDER-${modelId}] Found potential blade by naming pattern: ${child.name}`);
      blades.push(child);
    }
  });

  if (blades.length === 0) {
    log(3, `[BLADE-FINDER-${modelId}] No blade components found.`);
  } else {
    log(2, `[BLADE-FINDER-${modelId}] Found ${blades.length} blade components:`,
      blades.map(b => b.name));
  }

  return blades;
};

// Helper function to log the complete model structure (No longer used directly, summary is used instead)
const logModelStructure = (model, indent = 0) => {
  const prefix = ' '.repeat(indent);
  log(2, `${prefix}${model.name || 'unnamed'} (${model.type || 'no type'})`);

  if (model.children) {
    model.children.forEach(child => {
      logModelStructure(child, indent + 2);
    });
  }
};


// 切换侧边栏
const toggleSidebar = (type) => {
  log(2,
    "Toggling sidebar:",
    type,
    "Current state:",
    sidebars.value[type]
  );

  // Close other sidebars when opening a new one
  Object.keys(sidebars.value).forEach((key) => {
    if (key !== type) {
      sidebars.value[key] = false;
    }
  });

  // Toggle the target sidebar
  sidebars.value[type] = !sidebars.value[type];

  // Removed logic for terrainClipping and cancelCropPreview
};

// 处理添加风机按钮点击
const handleAddTurbineClick = () => {
  sidebars.value.management = true;
};

// MODIFY: handleAddTurbineFromManagement (now triggers store update)
const handleAddTurbineFromManagement = async (turbineData) => {
  log(2, '[TerrainMap] handleAddTurbineFromManagement received event with:', turbineData);
  try {
    // Call the store action to add the turbine
    await caseStore.addWindTurbine(turbineData); // Let the store handle backend interaction
    log(2, '[TerrainMap] Turbine add requested to store. Watcher will update scene.');
    // The watcher below will handle adding the mesh to the scene
  } catch (error) {
    log(3, '[TerrainMap] Error requesting turbine add to store:', error);
    ElMessage.error('添加风机到 Store 失败');
  }
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
      await caseStore.deleteWindTurbine(turbine.id);
      deleteWindTurbineFromScene(turbine.id);
      ElMessage.success(`风机 ${turbine.name} 已被删除`);
    })
    .catch(() => {});
};

// Add wind turbine to Three.js scene // Step 6: Modify the Wind Turbine Creation Function
const addWindTurbineToScene = async (turbine) => {
  const callId = ++addTurbineCounter; // 为每次调用分配唯一 ID
  log(2, `[ADD_TURBINE #${callId}] Attempting to add turbine ID: ${turbine.id}, Name: ${turbine.name}`);

  // 检查当前是否已添加或正在添加这个风机
  if (turbineMeshes.value.has(turbine.id) || processingTurbineIds.value.has(turbine.id)) {
    log(2, `[ADD_TURBINE #${callId}] Skipped: Turbine ${turbine.id} already exists or is being processed.`);
    return;
  }

  // 标记为正在处理
  processingTurbineIds.value.add(turbine.id);

  // 检查场景状态
  if (!isSceneInitialized.value || !scene) {
    log(3, `[ADD_TURBINE #${callId}] Warning: Scene not ready. Queuing turbine ${turbine.id}.`);
    queuedTurbines.value.push(turbine);
    processingTurbineIds.value.delete(turbine.id); // 从 processing 中移除，因为已加入队列
    return;
  }
  log(2, `[ADD_TURBINE #${callId}] Scene is ready.`);

  try {
    // 检查模型加载状态
    log(2, `[ADD_TURBINE #${callId}] Checking model... isModelLoading: ${isModelLoading}, windTurbineModel exists: ${!!windTurbineModel}`);
    if (!windTurbineModel && !isModelLoading) {
        log(2, `[ADD_TURBINE #${callId}] Model not loaded and not loading, starting load...`);
        // 注意: loadWindTurbineModel 返回 Promise，需要 await
        await loadWindTurbineModel();
    } else if (isModelLoading) {
        log(2, `[ADD_TURBINE #${callId}] Model is currently loading, awaiting completion...`);
        // 等待正在进行的加载完成
        await loadWindTurbineModel(); // 调用会返回等待 Promise
    }

    if (!windTurbineModel) {
      throw new Error(`[ADD_TURBINE #${callId}] Wind turbine model failed to load after waiting.`);
    }
    log(2, `[ADD_TURBINE #${callId}] Model is ready.`);

    log(2, `[ADD_TURBINE #${callId}] Cloning model for turbine ${turbine.id}...`);
    let turbineGroup = windTurbineModel.clone();
    turbineGroup.userData.turbineId = turbine.id;
    turbineGroup.userData.hubHeight = turbine.hubHeight;
    turbineGroup.userData.baseScale = 0.01; // Store base scale
    // ... 其他 userData 设置 ...
    log(2, `[ADD_TURBINE #${callId}] Model cloned.`);

    // IMPROVED: Find blade components with direct name matching
    log(2, `[ADD_TURBINE #${callId}] Finding blade components...`);
    const bladeComponents = findBladeComponents(turbineGroup); // Using improved blade finder
    turbineGroup.userData.bladeComponents = bladeComponents;
    log(2, `[ADD_TURBINE #${callId}] Blade components found: ${bladeComponents.length}`);

    turbineGroup.traverse((child) => {
      if (child.isMesh) {
        // 确保材质已克隆，避免影响其他风机
        if (child.material) {
          child.material = child.material.clone();
        }

        if (child.name === 'Blades_WindTurbine_PBR_0') {
          // 叶片设为白色，轻微反光
          if (child.material) {
            child.material.color.set(0xFFFFFF);
            // 调整材质属性使其更逼真
            if (child.material.metalness !== undefined) {
              child.material.metalness = 0.1;  // 低金属感
              child.material.roughness = 0.4;  // 适中的粗糙度
            }
          }
        } else if (child.name === 'Main_Unit_WindTurbine_PBR_0') {
          // 主体设为浅灰色
          if (child.material) {
            child.material.color.set(0xF0F0F0);
            // 调整材质属性
            if (child.material.metalness !== undefined) {
              child.material.metalness = 0.2;
              child.material.roughness = 0.6;
            }
          }
        } else if (child.name.includes('Base') || child.name.includes('Tower')) {
          // 底座或塔架设为稍深的灰色
          if (child.material) {
            child.material.color.set(0xDDDDDD);
            if (child.material.metalness !== undefined) {
              child.material.metalness = 0.3;
              child.material.roughness = 0.7;
            }
          }
        }

        // 确保所有部件默认没有发光效果
        if (child.material && child.material.emissive) {
          child.material.emissive.set(0x000000);
        }
      }
    });

    // IMPORTANT FIX: Optimize the model to handle potential duplicate blades
    log(2, `[ADD_TURBINE #${callId}] Optimizing model...`);
    turbineGroup = optimizeWindTurbineModel(turbineGroup);
    log(2, `[ADD_TURBINE #${callId}] Model optimized.`);


    // Get position from lat/lon
    log(2, `[ADD_TURBINE #${callId}] Calculating position...`);
    const { x, z } = mapLatLonToXZ(turbine.latitude, turbine.longitude);
    const terrainHeight = getTerrainHeight(x, z);

    if (terrainHeight !== null) {
      // Position turbine
      log(2, `[ADD_TURBINE #${callId}] Positioning turbine at terrain height...`);
      turbineGroup.position.set(x, terrainHeight, z);

      // ⚠️ CUSTOMIZATION REQUIRED: Adjust Y position or rotation if needed
      // If model doesn't sit properly on terrain, adjust Y offset
      // turbineGroup.position.y += yourOffsetValue;

      // Random rotation for variety
      turbineGroup.rotation.y =Math.PI * 2;

      log(2, `[ADD_TURBINE #${callId}] Adding turbine group to scene...`);
      scene.add(turbineGroup);
      log(2, `[ADD_TURBINE #${callId}] Adding turbine to turbineMeshes Map...`);
      turbineMeshes.value.set(turbine.id, turbineGroup);
      log(2, `[ADD_TURBINE #${callId}] Turbine ${turbine.id} added successfully.`);
    } else {
      log(3, `[ADD_TURBINE #${callId}] Warning: Cannot get terrain height for turbine ${turbine.id}. Creating fallback.`);
      createFallbackTurbine(turbine);
    }
  } catch (error) {
    log(3, `[ADD_TURBINE #${callId}] Error adding turbine ${turbine.id}:`, error);
    createFallbackTurbine(turbine);
  } finally {
    // 无论成功或失败，都从正在处理集合中移除
    processingTurbineIds.value.delete(turbine.id);
  }
};

// Create geometric turbine as fallback
const createFallbackTurbine = (turbine) => {
  // Check if scene exists and is initialized
  if (!isSceneInitialized.value || !scene) {
    console.error("Cannot create fallback turbine: Scene is not initialized");
    queuedTurbines.value.push(turbine);
    return;
  }
  // Your existing geometric turbine code
  const turbineGroup = new THREE.Group();
  turbineGroup.userData.turbineId = turbine.id;
  turbineGroup.userData.hubHeight = turbine.hubHeight;

  // Tower
  const towerGeometry = new THREE.CylinderGeometry(
    3, 4.5, turbine.hubHeight, 32, 8, true
  );
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

  // Nacelle group
  const nacelleGroup = new THREE.Group();
  nacelleGroup.position.y = turbine.hubHeight;

  // Main nacelle body
  const nacelleGeometry = new THREE.BoxGeometry(12, 5, 7);
  const nacelleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdddddd,
    metalness: 0.9,
    roughness: 0.4,
    clearcoat: 0.4
  });
  const nacelle = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
  nacelleGroup.add(nacelle);

  // Nacelle top decoration
  const topGeometry = new THREE.CylinderGeometry(1.5, 2, 2, 8);
  const top = new THREE.Mesh(topGeometry, nacelleMaterial);
  top.position.y = 3;
  nacelleGroup.add(top);

  turbineGroup.add(nacelleGroup);

  // Blade group
  const bladesGroup = new THREE.Group();
  bladesGroup.name = "bladesGroup";
  bladesGroup.position.set(0, turbine.hubHeight, 0);

  // Blade shape
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
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

  // Create 3 blades
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.rotation.x = 0.12;
    bladesGroup.add(blade);
  }

  // Hub
  const hubGeometry = new THREE.SphereGeometry(2, 32, 32);
  const hub = new THREE.Mesh(hubGeometry, nacelleMaterial);
  bladesGroup.add(hub);

  turbineGroup.add(bladesGroup);

  // Position turbine
  const { x, z } = mapLatLonToXZ(turbine.latitude, turbine.longitude);
  const terrainHeight = getTerrainHeight(x, z);

  if (terrainHeight !== null) {
    turbineGroup.position.set(x, terrainHeight, z);
  } else {
    turbineGroup.position.set(x, 0, z);
  }

  scene.add(turbineGroup);
  turbineMeshes.value.set(turbine.id, turbineGroup);
};


// 从场景中删除风机
const deleteWindTurbineFromScene = (turbineId) => {
  log(2, `[DELETE_TURBINE] Deleting turbine ID: ${turbineId}`);
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
    log(2, `[DELETE_TURBINE] Turbine ID: ${turbineId} deleted successfully.`);
  } else {
    log(2, `[DELETE_TURBINE] Turbine ID: ${turbineId} not found in turbineMeshes.`);
  }
};

// Removed toggleTerrainClipping function

// 改进的经纬度到XZ坐标的映射
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

  // 使用球面墨卡托投影或等距圆柱投影进行更准确的坐标转换
  const terrainSize = 1000; // 场景大小

  // 将经纬度规范化到[0,1]范围
  const normalizedLon = (longitude - caseStore.minLongitude) /
                        (caseStore.maxLongitude - caseStore.minLongitude);
  const normalizedLat = (latitude - caseStore.minLatitude) /
                        (caseStore.maxLatitude - caseStore.minLatitude);

  // 应用到场景坐标
  const x = (normalizedLon - 0.5) * terrainSize;
  const z = (normalizedLat - 0.5) * terrainSize;

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
  terrainLoadState.value = 'loading';
  hasGeoTIFF.value = false;
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

	    // 更新 Store 中的地理边界（仅当看起来是经纬度范围）
	    const [minX, minY, maxX, maxY] = bbox;
	    const looksLikeLonLat =
	      Number.isFinite(minX) &&
	      Number.isFinite(minY) &&
	      Number.isFinite(maxX) &&
	      Number.isFinite(maxY) &&
	      minX >= -180 &&
	      maxX <= 180 &&
	      minY >= -90 &&
	      maxY <= 90 &&
	      maxX > minX &&
	      maxY > minY;

	    if (looksLikeLonLat) {
	      caseStore.minLongitude = minX;
	      caseStore.minLatitude = minY;
	      caseStore.maxLongitude = maxX;
	      caseStore.maxLatitude = maxY;
	    } else {
	      const geoKeys = typeof image.getGeoKeys === 'function' ? image.getGeoKeys() : null;
	      console.warn('GeoTIFF bbox does not look like lon/lat:', bbox, geoKeys);
	      caseStore.minLongitude = null;
	      caseStore.minLatitude = null;
	      caseStore.maxLongitude = null;
	      caseStore.maxLatitude = null;
	      ElMessage.warning(
	        '检测到地形文件坐标范围超出经纬度(-180~180, -90~90)。' +
	        '平台当前默认按 EPSG:4326(经纬度) 处理，建议先将 GeoTIFF 转换为 WGS84/EPSG:4326。'
	      );
	    }

	    // 读取栅格数据
	    const rasters = await image.readRasters();
	    const width = image.getWidth();
	    const height = image.getHeight();
    const data = rasters[0];

    // 数据下采样以限制数据点数量
    const maxDataPoints = 100000;
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
	    let minElevation = Infinity;
	    let maxElevation = -Infinity;
	    for (const elevation of downsampledData) {
	      if (typeof elevation !== "number" || Number.isNaN(elevation)) continue;
	      if (elevation < minElevation) minElevation = elevation;
	      if (elevation > maxElevation) maxElevation = elevation;
	    }
	    caseStore.minElevation = Number.isFinite(minElevation) ? minElevation : 0;
	    caseStore.maxElevation = Number.isFinite(maxElevation) ? maxElevation : 0;

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
    terrainLoadState.value = 'loaded';

    // 重置摄像机以聚焦地形
    resetCamera();
  } catch (error) {
    console.error("加载 GeoTIFF 失败", error);
    hasGeoTIFF.value = false;
    terrainLoadState.value = error?.response?.status === 404 ? 'missing' : 'error';

    if (caseId) {
      if (error?.response?.status !== 404) {
        ElMessage.error("加载 GeoTIFF 数据失败");
      }
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

    // Find the top-level parent with turbineId by traversing up the hierarchy
    let currentObj = intersectedObj;
    let turbineGroup = null;

    // Traverse up the parent chain until we find an object with turbineId
    while (currentObj) {
      if (currentObj.userData && currentObj.userData.turbineId) {
        turbineGroup = currentObj;
        break;
      }
      currentObj = currentObj.parent;
    }

    if (turbineGroup) {
      const turbineId = turbineGroup.userData.turbineId;
      const turbine = caseStore.windTurbines.find(t => t.id === turbineId);

      if (turbine) {
        hoveredTurbine.value = turbine;
        tooltipPos.value = {
          x: event.clientX + 10,
          y: event.clientY + 10
        };
        return; // Exit early after finding and setting hoveredTurbine
      }
    }
  }

  // If we reach here, no valid intersection was found
  hoveredTurbine.value = null;
};

// 创建 throttled 版本
const onMouseMoveThrottled = lodash.throttle(onMouseMove, 100);

// 初始化 Three.js 场景
const initThreeJS = () => {
  log(2, '[INIT_THREE_JS] Initializing Three.js scene...');
  // First clean up any existing resources
  disposeThreeResources();
  log(2, '[INIT_THREE_JS] Previous resources disposed.');


  // Then proceed with initialization
  if (!terrainContainer.value) {
    console.error('[INIT_THREE_JS] Terrain container not found');
    isSceneInitialized.value = false;
    return false;
  }

  const width = terrainContainer.value.clientWidth;
  const height = terrainContainer.value.clientHeight;
  log(2, '[INIT_THREE_JS] Container dimensions:', { width, height });

// Create scene with improved background
log(2, '[INIT_THREE_JS] Creating scene...');
scene = new THREE.Scene();
// 稍微柔和的背景色
scene.background = new THREE.Color(0xF0F0F0);
log(2, '[INIT_THREE_JS] Scene created.');


  // Initialize camera with debug info
  log(2, '[INIT_THREE_JS] Initializing camera...');
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.position.set(0, 1000, 1000);
  camera.lookAt(0, 0, 0);
  log(2, '[INIT_THREE_JS] Camera initialized:', camera.position);

  // Initialize renderer with debug info
  log(2, '[INIT_THREE_JS] Initializing renderer...');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  log(2, '[INIT_THREE_JS] Renderer initialized');

  log(2, '[INIT_THREE_JS] Appending renderer to container...');
  terrainContainer.value.appendChild(renderer.domElement);
  log(2, '[INIT_THREE_JS] Renderer appended to container');
  hasRendererInitialized.value = true;

  // 创建控件
  log(2, '[INIT_THREE_JS] Initializing controls...');
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 3000;
  controls.maxPolarAngle = Math.PI / 2;
  log(2, '[INIT_THREE_JS] Controls initialized.');


  // 添加环境光
  log(2, '[INIT_THREE_JS] Adding ambient light...');
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  log(2, '[INIT_THREE_JS] Ambient light added.');


  // 添加方向光
  log(2, '[INIT_THREE_JS] Adding directional light...');
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
  log(2, '[INIT_THREE_JS] Directional light added.');


  // 添加半球光
  log(2, '[INIT_THREE_JS] Adding hemisphere light...');
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
  scene.add(hemisphereLight);
  log(2, '[INIT_THREE_JS] Hemisphere light added.');


   // 监听鼠标移动事件
   log(2, '[INIT_THREE_JS] Adding mouse move event listener...');
  renderer.domElement.addEventListener("mousemove", onMouseMoveThrottled, false);
  log(2, '[INIT_THREE_JS] Mouse move event listener added.');


  // 监听窗口大小变化
  log(2, '[INIT_THREE_JS] Adding window resize event listener...');
  window.addEventListener("resize", onWindowResize, false);
  log(2, '[INIT_THREE_JS] Window resize event listener added.');


  // Consolidated initialization log
  log(2, '[INIT_THREE_JS] Three.js scene initialized:', { // Consolidated initialization log
    containerSize: { width, height },
    camera: { position: camera.position },
    renderer: { antialias: true },
    sceneElements: 'Camera, lights, and controls set up'
  });

  // Set the initialization flag to true
  isSceneInitialized.value = true;
  log(2, '[INIT_THREE_JS] Scene fully initialized. isSceneInitialized.value =', isSceneInitialized.value);
  return true;
};


// 动画循环
let frameCount = 0;
const animate = () => {
  frameCount++;

  // Performance instrumentation start
  const startTime = performance.now(); // Performance instrumentation

  animationFrameId = requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  // Turbine Scaling Logic
  const distance = camera.position.distanceTo(controls.target);
  const scaleFactor = THREE.MathUtils.mapLinear(
    distance,
    MIN_DISTANCE_FOR_SCALING,
    MAX_DISTANCE_FOR_SCALING,
    MAX_SCALE_FACTOR,
    MIN_SCALE_FACTOR
  );
  const clampedScaleFactor = THREE.MathUtils.clamp(scaleFactor, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);


  turbineMeshes.value.forEach((turbineGroup) => {
    const baseScale = turbineGroup.userData.baseScale || 0.01; // Default base scale
    turbineGroup.scale.set(baseScale * clampedScaleFactor, baseScale * clampedScaleFactor, baseScale * clampedScaleFactor);
  });


  renderer.render(scene, camera);
   // Blade rotation // Step 7: Update the Animation Function
   if (bladeRotation.value) {
    turbineMeshes.value.forEach((turbineGroup) => {
      if (turbineGroup.userData.bladeComponents && turbineGroup.userData.bladeComponents.length > 0) {
        const bladeComponents = turbineGroup.userData.bladeComponents;

        bladeComponents.forEach(blade => {
          blade.rotation.y += 0.01 * rotationSpeed.value;
        });
      } else {
        // Fallback geometric turbine code (unchanged)
        const bladesGroup = turbineGroup.children.find(child => child.name === "bladesGroup");
        if (bladesGroup) {
          bladesGroup.rotation.z += 0.01 * rotationSpeed.value;
        }
      }
    });
  }
    // Rotation tracking logs
    if (bladeRotation.value && frameCount % 100 === 0) { // Log only every 100 frames
      log(2, `[ROTATION] Frame ${frameCount} - Tracking blade rotations`);
      let i = 0;
      turbineMeshes.value.forEach((turbineGroup, id) => {
        if (i < 3 && turbineGroup.userData.bladeComponents?.length > 0) { // Limit to first 3 turbines
          const blade = turbineGroup.userData.bladeComponents[0];
          log(2, `[ROTATION] Turbine ${id.slice(-4)} rotation:`, {
            x: blade.rotation.x.toFixed(2),
            y: blade.rotation.y.toFixed(2),
            z: blade.rotation.z.toFixed(2)
          });
          i++;
        }
      });
    }


  // Performance instrumentation end
  if (frameCount % 300 === 0) {
    const endTime = performance.now();
    const frameDuration = endTime - startTime;
    const fps = 1000 / frameDuration;
    log(2, `[PERFORMANCE] Frame time: ${frameDuration.toFixed(1)}ms (${fps.toFixed(1)} FPS)`);

    // Report scene complexity
    const meshCount = { total: 0, visible: 0 };
    scene.traverse(obj => {
      if (obj.isMesh) {
        meshCount.total++;
        if (obj.visible) meshCount.visible++;
      }
    });
    log(2, `[PERFORMANCE] Scene contains ${meshCount.visible}/${meshCount.total} visible meshes`);
  }
};

const stopAnimationLoop = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

// 处理批量导入风机
// MODIFY: handleBulkImport (now triggers store update)
const handleBulkImport = async (turbines) => {
  log(2, "[TerrainMap] handleBulkImport received event with turbines:", turbines?.length);

  if (!turbines || !Array.isArray(turbines) || turbines.length === 0) {
    log(3, "[TerrainMap] Invalid bulk import data received.");
    ElMessage.error("导入失败: 无效的风机数据");
    return;
  }

  // Optional: Show loading indicator
  const loading = ElLoading.service({ lock: true, text: '正在导入风机...' });

  try {
    log(2, "[TerrainMap] Requesting bulk add to store...");
    // Call the store action to add turbines
    await caseStore.addBulkWindTurbines(turbines); // Let the store handle backend interaction
    log(2, `[TerrainMap] Bulk add requested to store. Watcher will update scene.`);
    
    // The watcher below will handle adding meshes to the scene
  } catch (error) {
    log(3, "[TerrainMap] Error requesting bulk add to store:", error);
    ElMessage.error(`批量导入请求失败: ${error.message || '未知错误'}`);
  } finally {
    loading?.close(); // Close loading indicator
  }
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

// Clean up Three.js resources // Step 9: Update the Clean-up Function
const disposeThreeResources = () => {
  log(2, '[DISPOSE_RESOURCES] Disposing Three.js resources...');

  // Clean up terrain mesh
  if (terrainMesh) {
    log(2, '[DISPOSE_RESOURCES] Disposing terrain mesh...');
    scene?.remove(terrainMesh);
    terrainMesh.geometry?.dispose();
    terrainMesh.material?.dispose();
    terrainMesh = null;
    log(2, '[DISPOSE_RESOURCES] Terrain mesh disposed.');
  }

  // Clean up turbine models
  log(2, '[DISPOSE_RESOURCES] Disposing turbine models...');
  turbineMeshes.value.forEach((turbineGroup) => {
    turbineGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material?.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
    scene?.remove(turbineGroup);
  });
  turbineMeshes.value.clear();
  log(2, '[DISPOSE_RESOURCES] Turbine models disposed and turbineMeshes Map cleared.');


  // Clean up renderer
  if (renderer) {
    log(2, '[DISPOSE_RESOURCES] Disposing renderer...');
    const canvas = renderer.domElement;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement = null;
    renderer = null;
    log(2, '[DISPOSE_RESOURCES] Renderer disposed.');
  }

  // Clean up scene
  if (scene) {
    log(2, '[DISPOSE_RESOURCES] Disposing scene children...');
    scene.children.forEach(child => scene.remove(child));
    scene = null;
    log(2, '[DISPOSE_RESOURCES] Scene children removed and scene set to null.');
  }

  // Clean up camera
  camera = null;
  log(2, '[DISPOSE_RESOURCES] Camera set to null.');


  // Reset GLTF model
  windTurbineModel = null;
  isModelLoading = false;
  log(2, '[DISPOSE_RESOURCES] GLTF model reset.');

  log(2, '[DISPOSE_RESOURCES] All Three.js resources disposed.');
};

// --- Removed Terrain Cropping Functionality (previewCropArea, cancelCropPreview, applyCropArea, saveClippedTerrain) ---

// --- Removed Terrain Drag Selection Functionality (startDragSelection, cancelDragSelection, onDragSelectionStart, onDragSelectionMove, onDragSelectionEnd, createDragSelectionBox, updateDragSelectionBox, calculateSquareBounds, xzToLatLon) ---

if (import.meta.env.DEV) {
  // --- Debugging Tools ---
  window.debugTurbineRotation = function(turbineIndex = 0, axis = 'z', speed = 1.0) {
    const turbines = Array.from(turbineMeshes.value.values());

    if (turbines.length <= turbineIndex) {
      console.error(`[TEST] No turbine found at index ${turbineIndex}`);
      return;
    }

    const turbine = turbines[turbineIndex];
    const bladeComponent = turbine.userData.bladeComponents?.[0];

    if (!bladeComponent) {
      console.error('[TEST] No blade component found');
      return;
    }

    // Stop automatic rotation
    const originalRotation = bladeRotation.value;
    bladeRotation.value = false;

    // Reset rotations
    bladeComponent.rotation.x = 0;
    bladeComponent.rotation.y = 0;
    bladeComponent.rotation.z = 0;

    console.log(`[TEST] Testing ${axis}-axis rotation on turbine ${turbineIndex}`);

    // Create a testing animation
    const testRotationAnimation = () => {
      const targetRotation = {};
      targetRotation[axis] = Math.PI * 2; // 360 degrees

      new TWEEN.Tween(bladeComponent.rotation)
        .to(targetRotation, 2000 / speed)
        .easing(TWEEN.Easing.Linear.None)
        .onComplete(() => {
          console.log(`[TEST] ${axis}-axis rotation test complete`);
          // Restore original rotation state
          bladeRotation.value = originalRotation;
        })
        .start();
    };

    testRotationAnimation();

    return `Testing ${axis}-axis rotation. The blades should complete a full spin in 2 seconds.`;
  };

  window.toggleComponentVisibility = function(turbineIndex = 0, componentType = 'main') {
    const turbines = Array.from(turbineMeshes.value.values());

    if (turbines.length <= turbineIndex) {
      console.error(`[TEST] No turbine found at index ${turbineIndex}`);
      return;
    }

    const turbine = turbines[turbineIndex];

    if (componentType === 'main') {
      // Find and toggle main unit
      turbine.traverse(child => {
        if (child.name === 'Main_Unit_WindTurbine_PBR_0') {
          child.visible = !child.visible;
          console.log(`[TEST] Main unit visibility: ${child.visible}`);
        }
      });
    } else if (componentType === 'blades') {
      // Toggle blade components
      const bladeComponent = turbine.userData.bladeComponents?.[0];
      if (bladeComponent) {
        bladeComponent.visible = !bladeComponent.visible;
        console.log(`[TEST] Blades visibility: ${bladeComponent.visible}`);
      }
    }

    return `Toggled ${componentType} visibility on turbine ${turbineIndex}`;
  };

  window.clearDebug = function() {
    if (window._debugHelper) {
      window._debugHelper.parent.remove(window._debugHelper);
      window._debugHelper = null;
      log(2, '[DEBUG] Removed debug helpers');
    }
  };
  // --- End Debugging Tools ---
}


// Function to process queued turbines
const processQueuedTurbines = () => {
  if (isSceneInitialized.value && queuedTurbines.value.length > 0) {
    log(2, `[PROCESS_QUEUED_TURBINES] Processing ${queuedTurbines.value.length} queued turbines. Scene initialized: ${isSceneInitialized.value}`);

    // Create a copy of the queue before clearing it
    const turbinesToProcess = [...queuedTurbines.value];
    queuedTurbines.value = []; // Clear the queue

    // Process each turbine
    turbinesToProcess.forEach(turbine => {
      addWindTurbineToScene(turbine);
    });
  } else if (!isSceneInitialized.value) {
    log(2, `[PROCESS_QUEUED_TURBINES] Scene not yet initialized, ${queuedTurbines.value.length} turbines still queued.`);
  } else if (queuedTurbines.value.length === 0) {
    log(2, `[PROCESS_QUEUED_TURBINES] No queued turbines to process.`);
  }
};


// 生命周期钩子

const loadAndDisplayTurbines = async () => {
  log(2, '[LOAD_DISPLAY_TURBINES] Starting load and display turbines.');
  try {
    // Load turbines from store/backend
    log(2, '[LOAD_DISPLAY_TURBINES] Fetching wind turbines from store...');
    await caseStore.fetchWindTurbines();
    log(2, '[LOAD_DISPLAY_TURBINES] Wind turbines fetched.');


    // Optimization: Diff and update turbines instead of clearing all
    const oldTurbineIds = Array.from(turbineMeshes.value.keys());
    const newTurbineIds = caseStore.windTurbines.map(turbine => turbine.id);

    log(2, '[LOAD_DISPLAY_TURBINES] Identifying turbines to remove...');
    // Identify turbines to remove
    const turbinesToRemove = oldTurbineIds.filter(id => !newTurbineIds.includes(id));
    turbinesToRemove.forEach(id => {
      deleteWindTurbineFromScene(id);
    });
    log(2, `[LOAD_DISPLAY_TURBINES] Turbines to remove identified: ${turbinesToRemove.length}.`);

    log(2, '[LOAD_DISPLAY_TURBINES] Identifying turbines to add or update...');
    // Identify turbines to add or update (for simplicity, re-add all new turbines)
    caseStore.windTurbines.forEach(turbine => {
      if (!turbineMeshes.value.has(turbine.id)) {
        addWindTurbineToScene(turbine); // Add only if not already in scene
      }
      // In a real update scenario, you might want to update existing turbine properties here
    });
    log(2, '[LOAD_DISPLAY_TURBINES] Turbines to add/update identified and processed.');


  } catch (error) {
    console.error('[LOAD_DISPLAY_TURBINES] Failed to load and display turbines:', error);
    ElMessage.error('加载风机失败');
  }
  log(2, '[LOAD_DISPLAY_TURBINES] Finished load and display turbines.');
};

const reloadForCaseId = async (newId) => {
  if (!newId) return;

  stopAnimationLoop();
  queuedTurbines.value = [];
  processingTurbineIds.value.clear();
  turbineMeshes.value.clear();

  if (caseStore.caseId !== newId || caseStore.currentCaseId !== newId) {
    await caseStore.initializeCase(newId);
  }

  const initialized = initThreeJS();
  if (!initialized) {
    terrainLoadState.value = 'error';
    return;
  }

  loadWindTurbineModel().catch(error => {
    console.error('[RELOAD_CASE] Failed to preload turbine model:', error);
    ElMessage.warning('风机模型加载失败，将使用简化模型');
  });

  animate();

  await loadGeoTIFF(newId);
  if (terrainLoadState.value === 'loaded') {
    await loadAndDisplayTurbines();
  }
};

onMounted(async () => { // Step 8: Update the onMounted Function
  log(2, '[ON_MOUNTED] Component mounted.');
    try {
        const { caseId, caseName } = route.params;
        log(2, '[ON_MOUNTED] Route params:', { caseId, caseName });

        if (caseId && (caseStore.caseId !== caseId || caseStore.currentCaseId !== caseId)) {
          await caseStore.initializeCase(caseId, caseName);
        }

        const initialized = initThreeJS(); // Initialize Three.js scene first
        if (!initialized) {
          terrainLoadState.value = 'error';
          return;
        }

        // Preload the turbine model
        loadWindTurbineModel().catch(error => {
          console.error('[ON_MOUNTED] Failed to preload turbine model:', error);
          ElMessage.warning('风机模型加载失败，将使用简化模型');
        });

        animate(); // Start animation loop

        if (caseId) {
          await loadGeoTIFF(caseId);
          if (terrainLoadState.value === 'loaded') {
            await loadAndDisplayTurbines(); // Load and display turbines after scene is ready
          }
        } else {
          terrainLoadState.value = 'missing';
        }
    } catch (error) {
        console.error('[ON_MOUNTED] Initialization error:', error);
        terrainLoadState.value = 'error';
    }
    log(2, '[ON_MOUNTED] Component mount process finished.');
});

onBeforeUnmount(() => {
  log(2, '[ON_BEFORE_UNMOUNT] Component unmounting...');

  // 1. Stop animation loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    log(2, '[ON_BEFORE_UNMOUNT] Animation frame cancelled.');
  }

  // 2. Remove event listeners
  if (renderer?.domElement) {
    renderer.domElement.removeEventListener("mousemove", onMouseMoveThrottled, false);
    log(2, '[ON_BEFORE_UNMOUNT] Mousemove event listener removed.');
  }
  window.removeEventListener("resize", onWindowResize, false);
  log(2, '[ON_BEFORE_UNMOUNT] Resize event listener removed.');


  // 3. Clean up Three.js resources
  disposeThreeResources();
  log(2, '[ON_BEFORE_UNMOUNT] Three.js resources disposed.');


  // 4. Clear turbine meshes
  turbineMeshes.value.clear();
  log(2, '[ON_BEFORE_UNMOUNT] Turbine meshes map cleared.');


  // 5. Dispose of controls
  if (controls) {
    controls.dispose();
    controls = null;
    log(2, '[ON_BEFORE_UNMOUNT] OrbitControls disposed.');
  }

  // 6. Clear any pending turbines
  queuedTurbines.value = [];
  log(2, '[ON_BEFORE_UNMOUNT] Queued turbines cleared.');


  // Socket lifecycle is managed at the case wrapper level (CaseDetails).

  // 8. Reset state flags
  isSceneInitialized.value = false;
  hasRendererInitialized.value = false;
  log(2, '[ON_BEFORE_UNMOUNT] State flags reset.');

  log(2, '[ON_BEFORE_UNMOUNT] Component unmount process finished.');
});

onBeforeRouteLeave((to, from, next) => {
  log(2, '[ON_BEFORE_ROUTE_LEAVE] Route leaving...');
  // Perform cleanup before route change
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
     log(2, '[ON_BEFORE_ROUTE_LEAVE] Animation frame cancelled.');
  }
  disposeThreeResources();
  log(2, '[ON_BEFORE_ROUTE_LEAVE] Three.js resources disposed.');
  next();
  log(2, '[ON_BEFORE_ROUTE_LEAVE] Route leave process completed.');
});


// Watch for scene initialization to process queued turbines
watch(() => isSceneInitialized.value, (isInitialized) => {
  log(2, `[WATCH_SCENE_INIT] Scene initialization state changed. isInitialized: ${isInitialized}`);
  if (isInitialized) {
    processQueuedTurbines(); // Process queued turbines when scene is ready
  }
});

// Watch for route changes
watch(
  () => route.params.caseId,
  async (newId, oldId) => {
    log(2, `[WATCH_ROUTE_CASE_ID] Route caseId changed. New ID: ${newId}, Old ID: ${oldId}`);
    if (!newId || newId === oldId) {
      log(2, `[WATCH_ROUTE_CASE_ID] Case ID is the same or new ID is null, skipping reload.`);
      return;
    }
    await reloadForCaseId(newId);
  }
);


// 修改 watch 函数中的悬停高亮逻辑
watch(() => hoveredTurbine.value, (newTurbine, oldTurbine) => {
  // 重置之前高亮的风机
  if (oldTurbine) {
    const oldMesh = turbineMeshes.value.get(oldTurbine.id);
    if (oldMesh) {
      oldMesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.emissive) mat.emissive.setHex(0x000000);
            });
          } else if (child.material.emissive) {
            child.material.emissive.setHex(0x000000);
          }
        }
      });
    }
  }

  // 高亮当前悬停的风机
  if (newTurbine) {
    const newMesh = turbineMeshes.value.get(newTurbine.id);
    if (newMesh) {
      newMesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.emissive) mat.emissive.setHex(0x333333);
            });
          } else if (child.material.emissive) {
            child.material.emissive.setHex(0x333333);
          }
        }
      });
    }
  }
});

// REVIEW and KEEP: Watcher for store changes (Handles scene updates)
watch(
  () => caseStore.windTurbines,
  (newTurbines, oldTurbines) => {
    log(2, `[WATCH_TURBINES_STORE] Store turbines changed. New: ${newTurbines?.length}, Old: ${oldTurbines?.length}`);

    const newTurbineMap = new Map(newTurbines?.map(t => [t.id, t]) ?? []);
    const oldTurbineMap = new Map(oldTurbines?.map(t => [t.id, t]) ?? []);

    // Find turbines to remove from scene
    oldTurbineMap.forEach((_, id) => {
      if (!newTurbineMap.has(id)) {
        log(2, `[WATCH_TURBINES_STORE] Deleting turbine from scene: ${id}`);
        deleteWindTurbineFromScene(id); // Function to remove from Three.js
      }
    });

    // Find turbines to add to scene
    newTurbineMap.forEach((turbine, id) => {
      if (!oldTurbineMap.has(id)) {
        log(2, `[WATCH_TURBINES_STORE] Adding turbine to scene: ${turbine.name} (ID: ${id})`);
        addWindTurbineToScene(turbine); // Function to add to Three.js
      }
      // Optional: Handle updates if properties change
      // else { const oldTurbine = oldTurbineMap.get(id); /* Compare and update mesh if needed */ }
    });

    log(2, '[WATCH_TURBINES_STORE] Scene sync based on store changes finished.');
  },
  { deep: true } // Deep watch is crucial here
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

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-icon {
  font-size: 32px;
  color: #409EFF;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 16px;
  font-weight: 600;
  color: #409EFF;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Removed Crop Preview Styles */
/* Removed Drag Selection Styles */

</style>
