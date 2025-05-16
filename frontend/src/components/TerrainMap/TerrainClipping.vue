<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-15 20:11:00
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-15 20:30:54
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\TerrainClipping.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div v-show="visible" class="terrain-clipping-panel" :class="{ visible }">
    <div class="panel-header">
      <h3><i class="el-icon-crop"></i> 地形裁剪工具</h3>
      <el-button type="text" @click="$emit('update:visible', false)" class="close-button">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="panel-body">
      <!-- 切换模式选项卡 -->
      <div class="mode-tabs">
        <div 
          class="mode-tab" 
          :class="{ active: clippingMode === 'drag' }"
          @click="clippingMode = 'drag'"
        >
          <i class="el-icon-mouse"></i> 拖拽选择
        </div>
        <div 
          class="mode-tab" 
          :class="{ active: clippingMode === 'manual' }"
          @click="clippingMode = 'manual'"
        >
          <i class="el-icon-edit"></i> 手动输入
        </div>
      </div>

      <!-- 拖拽选择模式 -->
      <div v-if="clippingMode === 'drag'" class="drag-mode-container">
        <div class="instruction-card">
          <div class="instruction-icon">
            <i class="el-icon-mouse"></i>
          </div>
          <div class="instruction-content">
            <h4>拖拽选择裁剪区域</h4>
            <p>在地形上点击并拖拽来选择正方形裁剪区域，系统将自动保持正方形比例。</p>
            <div class="drag-actions">
              <el-button type="primary" @click="startDragSelection" :disabled="isDragSelectionActive">
                开始选择
              </el-button>
              <el-button type="danger" v-if="isDragSelectionActive" @click="cancelDragSelection">
                取消选择
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 手动输入模式 -->
      <div v-else class="manual-mode-container">
        <!-- 坐标格式切换 -->
        <div class="format-selector">
          <span class="format-label">坐标格式:</span>
          <el-radio-group v-model="coordFormat" size="small">
            <el-radio-button label="decimal">十进制度数</el-radio-button>
            <el-radio-button label="dms">度分秒</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 数据范围提示 -->
        <div class="bounds-card">
          <div class="bounds-header">
            <i class="el-icon-info-filled"></i> 可用范围
          </div>
          <div class="bounds-content">
            <div class="bounds-row">
              <span class="bounds-label">纬度:</span>
              <span class="bounds-value">{{ formatDEMBound('minLat') }} 至 {{ formatDEMBound('maxLat') }}</span>
            </div>
            <div class="bounds-row">
              <span class="bounds-label">经度:</span>
              <span class="bounds-value">{{ formatDEMBound('minLon') }} 至 {{ formatDEMBound('maxLon') }}</span>
            </div>
          </div>
        </div>

        <!-- 十进制坐标输入 -->
        <div v-if="coordFormat === 'decimal'" class="decimal-inputs">
          <div class="coord-section">
            <h4 class="section-title">纬度范围</h4>
            <div class="coord-input-group">
              <div class="coord-input-row">
                <span class="coord-label">最小值:</span>
                <el-input-number
                  v-model="minLat"
                  :min="demMinLat"
                  :max="maxLat - 0.001"
                  :precision="6"
                  :step="0.001"
                  controls-position="right"
                  @change="onMinLatChange"
                  class="coord-input"
                />
                <div class="fine-controls">
                  <el-tooltip content="微调减小" placement="top">
                    <el-button size="small" circle @click="adjustValue('minLat', -0.001)">
                      <i class="el-icon-minus"></i>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="微调增加" placement="top">
                    <el-button size="small" circle @click="adjustValue('minLat', 0.001)">
                      <i class="el-icon-plus"></i>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
              <div class="coord-input-row">
                <span class="coord-label">最大值:</span>
                <el-input-number
                  v-model="maxLat"
                  :min="minLat + 0.001"
                  :max="demMaxLat"
                  :precision="6"
                  :step="0.001"
                  controls-position="right"
                  @change="onMaxLatChange"
                  class="coord-input"
                />
                <div class="fine-controls">
                  <el-tooltip content="微调减小" placement="top">
                    <el-button size="small" circle @click="adjustValue('maxLat', -0.001)">
                      <i class="el-icon-minus"></i>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="微调增加" placement="top">
                    <el-button size="small" circle @click="adjustValue('maxLat', 0.001)">
                      <i class="el-icon-plus"></i>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>

          <div class="coord-section">
            <h4 class="section-title">经度范围</h4>
            <div class="coord-input-group">
              <div class="coord-input-row">
                <span class="coord-label">最小值:</span>
                <el-input-number
                  v-model="minLon"
                  :min="demMinLon"
                  :max="maxLon - 0.001"
                  :precision="6"
                  :step="0.001"
                  controls-position="right"
                  @change="onMinLonChange"
                  class="coord-input"
                />
                <div class="fine-controls">
                  <el-tooltip content="微调减小" placement="top">
                    <el-button size="small" circle @click="adjustValue('minLon', -0.001)">
                      <i class="el-icon-minus"></i>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="微调增加" placement="top">
                    <el-button size="small" circle @click="adjustValue('minLon', 0.001)">
                      <i class="el-icon-plus"></i>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
              <div class="coord-input-row">
                <span class="coord-label">最大值:</span>
                <el-input-number
                  v-model="maxLon"
                  :min="minLon + 0.001"
                  :max="demMaxLon"
                  :precision="6"
                  :step="0.001"
                  controls-position="right"
                  @change="onMaxLonChange"
                  class="coord-input"
                />
                <div class="fine-controls">
                  <el-tooltip content="微调减小" placement="top">
                    <el-button size="small" circle @click="adjustValue('maxLon', -0.001)">
                      <i class="el-icon-minus"></i>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="微调增加" placement="top">
                    <el-button size="small" circle @click="adjustValue('maxLon', 0.001)">
                      <i class="el-icon-plus"></i>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 度分秒坐标输入 -->
        <div v-else class="dms-inputs">
          <div class="coord-section">
            <h4 class="section-title">纬度范围 (北纬)</h4>
            <div class="dms-input-group">
              <div class="dms-row">
                <span class="dms-label">最小值:</span>
                <div class="dms-units">
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLatDMS.deg"
                      :min="0"
                      :max="90"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">度</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLatDMS.min"
                      :min="0"
                      :max="59"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">分</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLatDMS.sec"
                      :min="0"
                      :max="59.999"
                      :precision="3"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">秒</span>
                  </div>
                </div>
              </div>
              
              <div class="dms-row">
                <span class="dms-label">最大值:</span>
                <div class="dms-units">
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLatDMS.deg"
                      :min="0"
                      :max="90"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">度</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLatDMS.min"
                      :min="0"
                      :max="59"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">分</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLatDMS.sec"
                      :min="0"
                      :max="59.999"
                      :precision="3"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLatChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">秒</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="coord-section">
            <h4 class="section-title">经度范围 (东经)</h4>
            <div class="dms-input-group">
              <div class="dms-row">
                <span class="dms-label">最小值:</span>
                <div class="dms-units">
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLonDMS.deg"
                      :min="0"
                      :max="180"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">度</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLonDMS.min"
                      :min="0"
                      :max="59"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">分</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="minLonDMS.sec"
                      :min="0"
                      :max="59.999"
                      :precision="3"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMinLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">秒</span>
                  </div>
                </div>
              </div>
              
              <div class="dms-row">
                <span class="dms-label">最大值:</span>
                <div class="dms-units">
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLonDMS.deg"
                      :min="0"
                      :max="180"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">度</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLonDMS.min"
                      :min="0"
                      :max="59"
                      :precision="0"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">分</span>
                  </div>
                  <div class="dms-unit">
                    <el-input-number
                      v-model="maxLonDMS.sec"
                      :min="0"
                      :max="59.999"
                      :precision="3"
                      controls-position="right"
                      @change="updateDecimalFromDMS(); onMaxLonChange();"
                      class="dms-input"
                    />
                    <span class="dms-unit-label">秒</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 正方形提示区域 -->
      <div v-if="clippingMode === 'manual' && isAdjusting" class="square-status-card">
        <div class="square-status-icon">
          <i class="el-icon-refresh"></i>
        </div>
        <div class="square-status-content">
          <div class="square-status-title">正方形调整中</div>
          <div class="square-status-details">
            <div class="status-metric">
              <span>纬度跨度: {{ ((maxLat - minLat) * 111.32).toFixed(2) }} km</span>
            </div>
            <div class="status-metric">
              <span>经度跨度: {{ ((maxLon - minLon) * 111.32 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)).toFixed(2) }} km</span>
            </div>
          </div>
          <div class="square-check">
            <i class="el-icon-check"></i> 保持正方形比例
          </div>
        </div>
      </div>

      <!-- 预览信息区域 -->
      <div v-if="isPreviewActive" class="preview-card">
        <div class="preview-header">
          <div class="preview-icon">
            <i class="el-icon-view"></i>
          </div>
          <h4>裁剪预览</h4>
        </div>
        <div class="preview-content">
          <div class="preview-metric">
            <span class="metric-label">坐标范围:</span>
            <span class="metric-value">{{ formatArea() }}</span>
          </div>
          <div class="preview-metric">
            <span class="metric-label">地面尺寸:</span>
            <span class="metric-value">每边约 {{ ((maxLat - minLat) * 111.32).toFixed(2) }} 公里</span>
          </div>
          <div class="preview-metric">
            <span class="metric-label">预计数据点:</span>
            <span class="metric-value">{{ estimatedDataPoints.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div class="actions-container">
        <div class="primary-actions">
          <el-button type="primary" @click="previewCrop">
            <i class="el-icon-view"></i> 预览区域
          </el-button>
          <el-button type="success" :disabled="!isPreviewActive" @click="applyCrop">
            <i class="el-icon-check"></i> 应用裁剪
          </el-button>
          <el-button @click="resetCrop">
            <i class="el-icon-refresh"></i> 重置
          </el-button>
        </div>
      </div>

      <el-divider></el-divider>

      <!-- 保存区域 -->
      <div class="save-section">
        <h4 class="save-title"><i class="el-icon-download"></i> 保存裁剪后的地形</h4>
        <div class="save-container">
          <div class="save-row">
            <span class="save-label">文件名:</span>
            <el-input v-model="saveName" placeholder="输入文件名" class="save-input"></el-input>
          </div>
          <div class="save-row">
            <span class="save-label">格式:</span>
            <el-select v-model="saveFormat" class="save-select">
              <el-option label="GeoTIFF (.tif)" value="geotiff" />
              <el-option label="ASCII Grid (.asc)" value="asc" />
            </el-select>
          </div>
          <div class="save-row">
            <el-checkbox v-model="preserveGeoreference">保留地理参考</el-checkbox>
          </div>
          <div class="save-action">
            <el-button type="primary" :disabled="!isCropped" @click="saveClippedTerrain" class="save-button">
              <i class="el-icon-download"></i> 保存
            </el-button>
          </div>
        </div>
      </div>
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
  const lonDistanceKm = lonDiff * 111.32 * Math.cos(centerLat * Math.PI / 180);

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

// 在TerrainClipping.vue中修改enforceSquareRatio函数
const enforceSquareRatio = () => {
  // 确保有有效值
  if (!minLat.value || !maxLat.value || !minLon.value || !maxLon.value) return;

  // 计算中心点
  const centerLat = (minLat.value + maxLat.value) / 2;
  const centerLon = (minLon.value + maxLon.value) / 2;

  // 当前尺寸
  const latSpan = maxLat.value - minLat.value;
  const lonSpan = maxLon.value - minLon.value;

  // 计算实际距离
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
  width: 380px;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease;
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.terrain-clipping-panel.visible {
  right: 24px;
  transform: translateY(0) scale(1);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  color: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-button {
  color: white;
}

.panel-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

/* 模式选项卡 */
.mode-tabs {
  display: flex;
  background: #f0f4fa;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid #e0e7ff;
}

.mode-tab {
  flex: 1;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.mode-tab.active {
  background: #3b82f6;
  color: white;
}

.mode-tab:not(.active) {
  color: #4b5563;
}

.mode-tab:not(.active):hover {
  background: #e0e7ff;
}

/* 拖拽模式样式 */
.instruction-card {
  display: flex;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.instruction-icon {
  font-size: 24px;
  color: #4f46e5;
  margin-right: 16px;
  padding-top: 4px;
}

.instruction-content h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 16px;
}

.instruction-content p {
  margin: 0 0 16px 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.5;
}

.drag-actions {
  display: flex;
  gap: 8px;
}

/* 坐标格式选择器 */
.format-selector {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.format-label {
  font-size: 14px;
  font-weight: 500;
  margin-right: 8px;
  color: #374151;
}

/* 数据范围卡片 */
.bounds-card {
  background: #f0f9ff;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid #bae6fd;
}

.bounds-header {
  background: #0ea5e9;
  color: white;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bounds-content {
  padding: 12px;
}

.bounds-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
}

.bounds-row:last-child {
  margin-bottom: 0;
}

.bounds-label {
  font-weight: 500;
  color: #1f2937;
}

.bounds-value {
  color: #4b5563;
}

/* 十进制输入框样式 */
.coord-section {
  margin-bottom: 16px;
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
}

.coord-input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.coord-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coord-label {
  width: 60px;
  font-size: 14px;
  color: #4b5563;
}

.coord-input {
  flex: 1;
}

.fine-controls {
  display: flex;
  gap: 4px;
}

/* 度分秒输入框样式 */
.dms-input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dms-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dms-label {
  font-size: 14px;
  color: #4b5563;
  font-weight: 500;
}

.dms-units {
  display: flex;
  gap: 8px;
}

.dms-unit {
  flex: 1;
  position: relative;
}

.dms-input {
  width: 100%;
}

.dms-unit-label {
  position: absolute;
  right: 35px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: #6b7280;
}

/* 正方形状态卡片 */
.square-status-card {
  display: flex;
  background: #ecfdf5;
  border-radius: 8px;
  padding: 12px;
  margin: 16px 0;
  border: 1px solid #a7f3d0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { background-color: #ecfdf5; }
  50% { background-color: #d1fae5; }
  100% { background-color: #ecfdf5; }
}

.square-status-icon {
  font-size: 24px;
  color: #059669;
  margin-right: 12px;
  display: flex;
  align-items: center;
}

.square-status-icon i {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.square-status-content {
  flex: 1;
}

.square-status-title {
  font-weight: 500;
  color: #047857;
  margin-bottom: 8px;
}

.square-status-details {
  font-size: 13px;
  color: #065f46;
  margin-bottom: 8px;
}

.status-metric {
  margin-bottom: 4px;
}

.square-check {
  font-weight: 500;
  color: #047857;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(5, 150, 105, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-flex;
}

/* 预览卡片 */
.preview-card {
  background: #eff6ff;
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
  border: 1px solid #bfdbfe;
}

.preview-header {
  background: #3b82f6;
  color: white;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-header h4 {
  margin: 0;
  font-size: 15px;
}

.preview-content {
  padding: 12px;
}

.preview-metric {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.preview-metric:last-child {
  margin-bottom: 0;
}

.metric-label {
  font-weight: 500;
  color: #1f2937;
}

.metric-value {
  color: #4b5563;
}

/* 按钮样式 */
.actions-container {
  margin: 16px 0;
}

.primary-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 保存区域 */
.save-section {
  margin-top: 16px;
}

.save-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  color: #1f2937;
  font-size: 16px;
}

.save-container {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.save-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.save-label {
  width: 70px;
  font-size: 14px;
  color: #4b5563;
}

.save-input,
.save-select {
  flex: 1;
}

.save-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.save-button {
  width: 120px;
}

/* 输入框美化 */
:deep(.el-input-number .el-input__inner) {
  text-align: left;
}

:deep(.el-radio-button__inner) {
  padding: 8px 15px;
}

/* 滚动条美化 */
.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 按钮图标间距 */
.el-button i {
  margin-right: 4px;
}
</style>