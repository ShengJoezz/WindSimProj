<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-19 22:26:46
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 15:25:41
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TerrainClipping.vue
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div v-show="visible" class="terrain-clipping-panel" :class="{ visible }">
    <div class="panel-header">
      <h3>地形裁剪 (正方形)</h3>
      <el-button type="text" @click="$emit('update:visible', false)">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="panel-body">
      <el-form label-position="top">
        <el-form-item label="坐标格式">
          <el-radio-group v-model="coordFormat">
            <el-radio-button label="decimal">十进制度数</el-radio-button>
            <el-radio-button label="dms">度分秒</el-radio-button>
          </el-radio-group>
          <div class="bounds-info">
            <div class="bounds-title">有效数据范围:</div>
            <div>纬度: {{ formatDEMBound('minLat') }} - {{ formatDEMBound('maxLat') }}</div>
            <div>经度: {{ formatDEMBound('minLon') }} - {{ formatDEMBound('maxLon') }}</div>
          </div>
        </el-form-item>

        <!-- 添加拖拽裁剪模式切换 -->
        <div class="clipping-mode-selector">
          <el-radio-group v-model="clippingMode">
            <el-radio-button label="manual">手动输入</el-radio-button>
            <el-radio-button label="drag">拖拽选择</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 拖拽提示 -->
        <div v-if="clippingMode === 'drag'" class="drag-instructions">
          <div class="instruction-icon">
            <i class="el-icon-mouse"></i>
          </div>
          <div class="instruction-text">
            <p>点击并拖拽地图以选择裁剪区域</p>
            <p>将自动保持正方形比例</p>
            <el-button type="primary" size="small" @click="startDragSelection">开始选择</el-button>
            <el-button v-if="isDragSelectionActive" type="danger" size="small" @click="cancelDragSelection">取消选择</el-button>
          </div>
        </div>

        <!-- Synchronization info display -->
        <div class="synchronization-info" v-if="isAdjusting && clippingMode === 'manual'">
          <div class="sync-animation">
            <span class="sync-icon">⟲</span>
            <span>同步调整中</span>
          </div>
          <div class="sync-detail">
            <div class="sync-metric">
              <span>纬度跨度:</span>
              <strong>{{ ((maxLat - minLat) * 111.32).toFixed(2) }} km</strong>
            </div>
            <div class="sync-metric">
              <span>经度跨度:</span>
              <strong>{{ ((maxLon - minLon) * 111.32 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)).toFixed(2) }} km</strong>
            </div>
            <div class="sync-status" :class="{ 'sync-equal': isSquare }">
              <span v-if="isSquare">✓ 保持正方形</span>
              <span v-else>◯ 调整为正方形</span>
            </div>
          </div>
        </div>

        <!-- Decimal format coordinates -->
        <template v-if="coordFormat === 'decimal' && clippingMode === 'manual'">
          <el-form-item :label="`最小纬度 (范围: ${formatDEMBound('minLat')})`">
            <div class="input-with-controls">
              <el-input-number
                v-model="minLat"
                :min="demMinLat"
                :max="maxLat - 0.001"
                :precision="6"
                :step="0.001"
                controls-position="right"
                @change="onMinLatChange"
              />
              <div class="input-controls">
                <el-button size="small" @click="adjustValue('minLat', -0.001)">−</el-button>
                <el-button size="small" @click="adjustValue('minLat', 0.001)">+</el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item :label="`最小经度 (范围: ${formatDEMBound('minLon')})`">
            <div class="input-with-controls">
              <el-input-number
                v-model="minLon"
                :min="demMinLon"
                :max="maxLon - 0.001"
                :precision="6"
                :step="0.001"
                controls-position="right"
                @change="onMinLonChange"
              />
              <div class="input-controls">
                <el-button size="small" @click="adjustValue('minLon', -0.001)">−</el-button>
                <el-button size="small" @click="adjustValue('minLon', 0.001)">+</el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item :label="`最大纬度 (范围: ${formatDEMBound('maxLat')})`">
            <div class="input-with-controls">
              <el-input-number
                v-model="maxLat"
                :min="minLat + 0.001"
                :max="demMaxLat"
                :precision="6"
                :step="0.001"
                controls-position="right"
                @change="onMaxLatChange"
              />
              <div class="input-controls">
                <el-button size="small" @click="adjustValue('maxLat', -0.001)">−</el-button>
                <el-button size="small" @click="adjustValue('maxLat', 0.001)">+</el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item :label="`最大经度 (范围: ${formatDEMBound('maxLon')})`">
            <div class="input-with-controls">
              <el-input-number
                v-model="maxLon"
                :min="minLon + 0.001"
                :max="demMaxLon"
                :precision="6"
                :step="0.001"
                controls-position="right"
                @change="onMaxLonChange"
              />
              <div class="input-controls">
                <el-button size="small" @click="adjustValue('maxLon', -0.001)">−</el-button>
                <el-button size="small" @click="adjustValue('maxLon', 0.001)">+</el-button>
              </div>
            </div>
          </el-form-item>
        </template>

        <!-- DMS format coordinates - Completely restructured to fix occlusion -->
        <template v-else-if="coordFormat === 'dms' && clippingMode === 'manual'">
          <div class="coordinate-section">
            <h4 class="section-heading">纬度坐标 (北纬)</h4>

            <div class="coordinate-row">
              <div class="coordinate-label">最小值:</div>
              <div class="dms-input-container">
                <div class="dms-unit">
                  <el-input-number
                    v-model="minLatDMS.deg"
                    :min="0"
                    :max="90"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLatChange();" />
                  <div class="dms-symbol">°</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="minLatDMS.min"
                    :min="0"
                    :max="59"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLatChange();" />
                  <div class="dms-symbol">'</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="minLatDMS.sec"
                    :min="0"
                    :max="59.999"
                    :precision="3"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLatChange();" />
                  <div class="dms-symbol">"</div>
                </div>
              </div>
            </div>

            <div class="coordinate-row">
              <div class="coordinate-label">最大值:</div>
              <div class="dms-input-container">
                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLatDMS.deg"
                    :min="0"
                    :max="90"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLatChange();" />
                  <div class="dms-symbol">°</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLatDMS.min"
                    :min="0"
                    :max="59"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLatChange();" />
                  <div class="dms-symbol">'</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLatDMS.sec"
                    :min="0"
                    :max="59.999"
                    :precision="3"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLatChange();" />
                  <div class="dms-symbol">"</div>
                </div>
              </div>
            </div>

            <h4 class="section-heading">经度坐标 (东经)</h4>

            <div class="coordinate-row">
              <div class="coordinate-label">最小值:</div>
              <div class="dms-input-container">
                <div class="dms-unit">
                  <el-input-number
                    v-model="minLonDMS.deg"
                    :min="0"
                    :max="180"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLonChange();" />
                  <div class="dms-symbol">°</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="minLonDMS.min"
                    :min="0"
                    :max="59"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLonChange();" />
                  <div class="dms-symbol">'</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="minLonDMS.sec"
                    :min="0"
                    :max="59.999"
                    :precision="3"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMinLonChange();" />
                  <div class="dms-symbol">"</div>
                </div>
              </div>
            </div>

            <div class="coordinate-row">
              <div class="coordinate-label">最大值:</div>
              <div class="dms-input-container">
                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLonDMS.deg"
                    :min="0"
                    :max="180"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLonChange();" />
                  <div class="dms-symbol">°</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLonDMS.min"
                    :min="0"
                    :max="59"
                    :precision="0"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLonChange();" />
                  <div class="dms-symbol">'</div>
                </div>

                <div class="dms-unit">
                  <el-input-number
                    v-model="maxLonDMS.sec"
                    :min="0"
                    :max="59.999"
                    :precision="3"
                    controls-position="right"
                    class="dms-input"
                    @change="updateDecimalFromDMS(); onMaxLonChange();" />
                  <div class="dms-symbol">"</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <el-form-item>
          <el-button type="primary" @click="previewCrop">预览裁剪区域</el-button>
          <el-button type="success" :disabled="!isPreviewActive" @click="applyCrop">应用裁剪</el-button>
          <el-button @click="resetCrop">重置</el-button>
        </el-form-item>

        <!-- Improved preview information with square indicator -->
        <el-form-item v-if="isPreviewActive" label="预览">
          <div class="preview-info">
            <div class="preview-square-indicator">
              <div class="square-icon"></div>
              <span>正方形裁剪区域</span>
            </div>
            <p><strong>坐标范围:</strong> {{ formatArea() }}</p>
            <p><strong>地面尺寸:</strong> 每边约 {{ ((maxLat - minLat) * 111.32).toFixed(2) }} 公里</p>
            <p><strong>预计数据点:</strong> {{ estimatedDataPoints.toLocaleString() }}</p>
          </div>
        </el-form-item>

        <el-divider />

        <el-form-item label="保存裁剪后的地形">
          <el-input v-model="saveName" placeholder="文件名" />
          <div class="save-options">
            <el-checkbox v-model="preserveGeoreference">保留地理参考</el-checkbox>
            <el-select v-model="saveFormat" style="width: 150px">
              <el-option label="GeoTIFF" value="geotiff" />
              <el-option label="ASCII Grid" value="asc" />
            </el-select>
            <el-button type="primary" :disabled="!isCropped" @click="saveClippedTerrain">保存</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// Define props
const props = defineProps({
  visible: Boolean,
  geographicBounds: Object,
});

const emit = defineEmits(['update:visible', 'preview-crop', 'apply-crop', 'save-terrain', 'start-drag-selection', 'cancel-drag-selection']);

// Data
const coordFormat = ref('decimal');
const clippingMode = ref('manual'); // 'manual' 或 'drag'
const isDragSelectionActive = ref(false);
const minLat = ref(null);
const minLon = ref(null);
const maxLat = ref(null);
const maxLon = ref(null);
const minLatDMS = ref({ deg: 0, min: 0, sec: 0 });
const minLonDMS = ref({ deg: 0, min: 0, sec: 0 });
const maxLatDMS = ref({ deg: 0, min: 0, sec: 0 });
const maxLonDMS = ref({ deg: 0, min: 0, sec: 0 });
const isPreviewActive = ref(false);
const isCropped = ref(false);
const estimatedDataPoints = ref(0);
const saveName = ref('cropped_terrain');
const preserveGeoreference = ref(true);
const saveFormat = ref('geotiff');
const lastChangedValue = ref(null);
const isAdjusting = ref(false);

// Square ratio is now always enforced - removed the checkbox option
const maintainSquareRatio = true; // Non-reactive constant, always true

// Computed properties for DEM boundaries
const demMinLat = computed(() => parseFloat(props.geographicBounds?.minLat || "-90"));
const demMinLon = computed(() => parseFloat(props.geographicBounds?.minLon || "-180"));
const demMaxLat = computed(() => parseFloat(props.geographicBounds?.maxLat || "90"));
const demMaxLon = computed(() => parseFloat(props.geographicBounds?.maxLon || "180"));

// Compute if the current selection is a square
const isSquare = computed(() => {
  if (!minLat.value || !maxLat.value || !minLon.value || !maxLon.value) return false;

  const latDiff = maxLat.value - minLat.value;
  const lonDiff = maxLon.value - minLon.value;

  // Calculate real-world distances
  const latDistanceKm = latDiff * 111.32;
  const centerLat = (minLat.value + maxLat.value) / 2;
  const lonDistanceKm = lonDiff * 111.32 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);

  // Check if distances are nearly equal (within 1%)
  return Math.abs(latDistanceKm - lonDistanceKm) / latDistanceKm < 0.01;
});

// Helper functions
const formatDEMBounds = () => {
  return `Lat: ${demMinLat.value.toFixed(6)}° - ${demMaxLat.value.toFixed(6)}°, Lon: ${demMinLon.value.toFixed(6)}° - ${demMaxLon.value.toFixed(6)}°`;
};

const formatDEMBound = (bound) => {
  switch(bound) {
    case 'minLat': return `${demMinLat.value.toFixed(6)}°`;
    case 'maxLat': return `${demMaxLat.value.toFixed(6)}°`;
    case 'minLon': return `${demMinLon.value.toFixed(6)}°`;
    case 'maxLon': return `${demMaxLon.value.toFixed(6)}°`;
    default: return '';
  }
};

const decimalToDMS = (decimal, type) => {
  if (decimal === null || isNaN(decimal)) return { deg: 0, min: 0, sec: 0 };

  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = (minutesNotTruncated - minutes) * 60;

  return {
    deg: degrees,
    min: minutes,
    sec: parseFloat(seconds.toFixed(3))
  };
};

const dmsToDecimal = (dms, type) => {
  if (!dms) return 0;

  // Always return positive value (assume N for lat, E for lon)
  let decimal = dms.deg + (dms.min / 60) + (dms.sec / 3600);

  return decimal;
};

const updateDMSFromDecimal = () => {
  minLatDMS.value = decimalToDMS(minLat.value, 'lat');
  minLonDMS.value = decimalToDMS(minLon.value, 'lon');
  maxLatDMS.value = decimalToDMS(maxLat.value, 'lat');
  maxLonDMS.value = decimalToDMS(maxLon.value, 'lon');
};

const updateDecimalFromDMS = () => {
  minLat.value = dmsToDecimal(minLatDMS.value, 'lat');
  minLon.value = dmsToDecimal(minLonDMS.value, 'lon');
  maxLat.value = dmsToDecimal(maxLatDMS.value, 'lat');
  maxLon.value = dmsToDecimal(maxLonDMS.value, 'lon');
  enforceDataBoundaries();
};

// Enforce data boundaries function
const enforceDataBoundaries = () => {
  // Ensure values don't exceed DEM boundaries
  if (minLat.value < demMinLat.value) minLat.value = demMinLat.value;
  if (minLon.value < demMinLon.value) minLon.value = demMinLon.value;
  if (maxLat.value > demMaxLat.value) maxLat.value = demMaxLat.value;
  if (maxLon.value > demMaxLon.value) maxLon.value = demMaxLon.value;

  // Also ensure min values don't exceed max values
  if (minLat.value >= maxLat.value) minLat.value = maxLat.value - 0.001;
  if (minLon.value >= maxLon.value) minLon.value = maxLon.value - 0.001;
};

// Improved enforceSquareRatio function that always runs after any coordinate change
const enforceSquareRatio = () => {
  // 确保有有效值
  if (!minLat.value || !maxLat.value || !minLon.value || !maxLon.value) return;

  // 计算中心点
  const centerLat = (minLat.value + maxLat.value) / 2;
  const centerLon = (minLon.value + maxLon.value) / 2;

  // 当前尺寸
  const latSpan = maxLat.value - minLat.value;
  const lonSpan = maxLon.value - minLon.value;

  // 计算实际距离 (使用Haversine公式更准确)
  const cosLat = Math.cos(centerLat * Math.PI / 180);
  const latDistanceKm = latSpan * 111.32;
  const lonDistanceKm = lonSpan * 111.32 * cosLat;

  // 确定目标尺寸 (取两者的最大值确保不超出原始选区)
  const targetSpanKm = Math.max(latDistanceKm, lonDistanceKm);
  const targetLatSpan = targetSpanKm / 111.32;
  const targetLonSpan = targetSpanKm / (111.32 * cosLat);

  // 计算新坐标，保持中心点不变
  let newMinLat = centerLat - (targetLatSpan / 2);
  let newMaxLat = centerLat + (targetLatSpan / 2);
  let newMinLon = centerLon - (targetLonSpan / 2);
  let newMaxLon = centerLon + (targetLonSpan / 2);

  // 确保新坐标在DEM范围内
  newMinLat = Math.max(newMinLat, demMinLat.value);
  newMaxLat = Math.min(newMaxLat, demMaxLat.value);
  newMinLon = Math.max(newMinLon, demMinLon.value);
  newMaxLon = Math.min(newMaxLon, demMaxLon.value);

  // 应用最终值
  minLat.value = newMinLat;
  maxLat.value = newMaxLat;
  minLon.value = newMinLon;
  maxLon.value = newMaxLon;
};

// Coordinate change handlers with animation for synchronization feedback
const onMinLatChange = () => {
  lastChangedValue.value = 'minLat';
  isAdjusting.value = true;
  enforceDataBoundaries();
  enforceSquareRatio(); // Always enforce square, not optional

  // Clear the adjustment indicator after a short delay
  setTimeout(() => {
    isAdjusting.value = false;
  }, 600);
};

const onMaxLatChange = () => {
  lastChangedValue.value = 'maxLat';
  isAdjusting.value = true;
  enforceDataBoundaries();
  enforceSquareRatio(); // Always enforce square, not optional

  setTimeout(() => {
    isAdjusting.value = false;
  }, 600);
};

const onMinLonChange = () => {
  lastChangedValue.value = 'minLon';
  isAdjusting.value = true;
  enforceDataBoundaries();
  enforceSquareRatio(); // Always enforce square, not optional

  setTimeout(() => {
    isAdjusting.value = false;
  }, 600);
};

const onMaxLonChange = () => {
  lastChangedValue.value = 'maxLon';
  isAdjusting.value = true;
  enforceDataBoundaries();
  enforceSquareRatio(); // Always enforce square, not optional

  setTimeout(() => {
    isAdjusting.value = false;
  }, 600);
};

const adjustValue = (property, delta) => {
  if (!minLat.value || !maxLat.value || !minLon.value || !maxLon.value) return;

  lastChangedValue.value = property;
  isAdjusting.value = true;

  // Apply the adjustment
  if (property === 'minLat') {
    minLat.value += delta;
    enforceDataBoundaries();
    enforceSquareRatio();
  } else if (property === 'maxLat') {
    maxLat.value += delta;
    enforceDataBoundaries();
    enforceSquareRatio();
  } else if (property === 'minLon') {
    minLon.value += delta;
    enforceDataBoundaries();
    enforceSquareRatio();
  } else if (property === 'maxLon') {
    maxLon.value += delta;
    enforceDataBoundaries();
    enforceSquareRatio();
  }

  setTimeout(() => {
    isAdjusting.value = false;
  }, 600);
};

// Updated formatArea to focus on square dimensions
const formatArea = () => {
  if (!minLat.value || !minLon.value || !maxLat.value || !maxLon.value) {
    return 'N/A';
  }

  const latDiff = Math.abs(maxLat.value - minLat.value).toFixed(6) + '°';
  const lonDiff = Math.abs(maxLon.value - minLon.value).toFixed(6) + '°';

  // Calculate real-world size
  const centerLat = (minLat.value + maxLat.value) / 2;
  const widthKm = Math.abs(maxLon.value - minLon.value) * 111.32 * Math.cos(centerLat * Math.PI / 180);
  const heightKm = Math.abs(maxLat.value - minLat.value) * 111.32;

  return `${latDiff} × ${lonDiff} (≈ ${widthKm.toFixed(2)} km × ${heightKm.toFixed(2)} km)`;
};

// Actions
const previewCrop = () => {
  if (coordFormat.value === 'dms') {
    updateDecimalFromDMS();
  }

  // Basic validation
  if (!minLat.value || !minLon.value || !maxLat.value || !maxLon.value) {
    ElMessage.warning('请填写所有坐标值');
    return;
  }

  if (minLat.value >= maxLat.value || minLon.value >= maxLon.value) {
    ElMessage.warning('最小坐标必须小于最大坐标');
    return;
  }

  // Make sure we have a square before previewing
  enforceSquareRatio();

  // Calculate estimated data points
  const latDiff = Math.abs(maxLat.value - minLat.value);
  const lonDiff = Math.abs(maxLon.value - minLon.value);
  const origLatDiff = Math.abs(parseFloat(props.geographicBounds.maxLat) - parseFloat(props.geographicBounds.minLat));
  const origLonDiff = Math.abs(parseFloat(props.geographicBounds.maxLon) - parseFloat(props.geographicBounds.minLon));

  const ratio = (latDiff * lonDiff) / (origLatDiff * origLonDiff);
  estimatedDataPoints.value = Math.round(1000000 * ratio); // Assuming original has ~1M points

  // Emit preview event
  emit('preview-crop', {
    minLat: minLat.value,
    minLon: minLon.value,
    maxLat: maxLat.value,
    maxLon: maxLon.value
  });

  isPreviewActive.value = true;
};

const applyCrop = () => {
  // Make sure we're applying a square crop
  enforceSquareRatio();

  emit('apply-crop', {
    minLat: minLat.value,
    minLon: minLon.value,
    maxLat: maxLat.value,
    maxLon: maxLon.value
  });

  isCropped.value = true;
  ElMessage.success('地形裁剪已应用');
};

const resetCrop = () => {
  if (props.geographicBounds) {
    minLat.value = parseFloat(props.geographicBounds.minLat);
    minLon.value = parseFloat(props.geographicBounds.minLon);
    maxLat.value = parseFloat(props.geographicBounds.maxLat);
    maxLon.value = parseFloat(props.geographicBounds.maxLon);
    updateDMSFromDecimal();
  }

  isPreviewActive.value = false;
  isCropped.value = false;
  emit('preview-crop', null);
};

const saveClippedTerrain = () => {
  if (!isCropped.value) {
    ElMessage.warning('请先应用裁剪');
    return;
  }

  if (!saveName.value.trim()) {
    ElMessage.warning('请输入文件名');
    return;
  }

  emit('save-terrain', {
    filename: saveName.value,
    format: saveFormat.value,
    preserveGeoreference: preserveGeoreference.value
  });
};

// 拖拽选择相关方法
const startDragSelection = () => {
  isDragSelectionActive.value = true;
  emit('start-drag-selection');
}

const cancelDragSelection = () => {
  isDragSelectionActive.value = false;
  emit('cancel-drag-selection');
}

// 当接收到拖拽选择的坐标时更新输入框
const updateCoordsFromDragSelection = (bounds) => {
  if (!bounds) return;

  minLat.value = bounds.minLat;
  minLon.value = bounds.minLon;
  maxLat.value = bounds.maxLat;
  maxLon.value = bounds.maxLon;

  // 更新DMS显示
  if (coordFormat.value === 'dms') {
    updateDMSFromDecimal();
  }

  // 预览裁剪区域
  previewCrop();
}

// Watchers
watch(() => props.geographicBounds, (bounds) => {
  if (bounds) {
    minLat.value = parseFloat(bounds.minLat);
    minLon.value = parseFloat(bounds.minLon);
    maxLat.value = parseFloat(bounds.maxLat);
    maxLon.value = parseFloat(bounds.maxLon);

    // Update DMS values
    updateDMSFromDecimal();
  }
}, { immediate: true });

// Watch for format changes
watch(coordFormat, (newFormat) => {
  if (newFormat === 'decimal') {
    updateDecimalFromDMS();
  } else {
    updateDMSFromDecimal();
  }
});

// 将方法暴露给父组件
defineExpose({
  updateCoordsFromDragSelection
});
</script>

<style scoped>
.terrain-clipping-panel {
  position: absolute;
  top: 24px;
  right: -400px;
  width: 450px;
  height: 60%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.terrain-clipping-panel.visible {
  right: 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
}

.panel-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.bounds-info {
  margin-top: 12px;
  font-size: 13px;
  color: #606266;
  background-color: #f5f7fa;
  padding: 10px 12px;
  border-radius: 4px;
  border-left: 3px solid #909399;
}

.bounds-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: #303133;
}

/* Completely new DMS input layout to fix occlusion */
.coordinate-section {
  margin-bottom: 20px;
  background-color: #f7f9fc;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e6e8ec;
}

.section-heading {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.coordinate-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.coordinate-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.dms-input-container {
  display: flex;
  flex-grow: 1;
  gap: 6px;
}

.dms-unit {
  display: flex;
  align-items: center;
  width: calc(33.333% - 4px);
  position: relative;
}

.dms-input {
  width: 100% !important;
}

.dms-symbol {
  position: absolute;
  right: 35px; /* Adjust based on ElementUI's input number controls */
  font-size: 14px;
  color: #606266;
}

.save-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

/* Improved preview info styling */
.preview-info {
  background: rgba(64, 158, 255, 0.15);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 12px;
  border-left: 4px solid #409EFF;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-info p {
  margin: 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
}

.preview-square-indicator {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 5px;
  background-color: #ecf5ff;
  border-radius: 4px;
}

.square-icon {
  width: 16px;
  height: 16px;
  background-color: #409EFF;
  margin-right: 8px;
}

.input-with-controls {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.input-with-controls .el-input-number {
  flex: 1;
}

.input-controls {
  display: flex;
  flex-direction: column;
  margin-left: 8px;
}

.input-controls .el-button {
  padding: 6px 8px;
  margin: 0;
  border-radius: 4px;
  font-weight: bold;
}

.input-controls .el-button:first-child {
  margin-bottom: 4px;
}

/* Synchronization feedback styles */
.synchronization-info {
  margin: 12px 0;
  padding: 10px;
  background-color: #f0f7ff;
  border-radius: 6px;
  border-left: 3px solid #409EFF;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { background-color: #f0f7ff; }
  50% { background-color: #e6f1ff; }
  100% { background-color: #f0f7ff; }
}

.sync-animation {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
  color: #409EFF;
}

.sync-icon {
  display: inline-block;
  animation: spin 1.5s linear infinite;
  margin-right: 8px;
  font-size: 16px;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.sync-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.sync-metric {
  display: flex;
  justify-content: space-between;
}

.sync-status {
  margin-top: 6px;
  text-align: center;
  padding: 3px;
  background-color: #e0e0e0;
  border-radius: 4px;
  font-weight: 500;
}

.sync-equal {
  background-color: #67c23a;
  color: white;
}

/* Ensure input numbers are styled correctly */
:deep(.el-input-number__input) {
  padding-right: 25px !important;
  text-align: right;
  font-weight: 500;
  font-size: 14px;
}

/* Fix for control buttons */
:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  z-index: 3;
}

:deep(.el-checkbox__label) {
  font-size: 14px;
}

/* 添加新样式 */
.clipping-mode-selector {
  margin: 16px 0;
}

.drag-instructions {
  display: flex;
  padding: 12px;
  background-color: #f0f9ff;
  border-radius: 8px;
  margin: 12px 0;
  border-left: 3px solid #409EFF;
}

.instruction-icon {
  font-size: 24px;
  color: #409EFF;
  margin-right: 12px;
  display: flex;
  align-items: center;
}

.instruction-text p {
  margin: 4px 0;
  font-size: 14px;
  color: #606266;
}

.instruction-text .el-button {
  margin-top: 8px;
}
</style>