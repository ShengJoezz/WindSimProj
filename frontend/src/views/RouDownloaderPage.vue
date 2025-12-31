
<template>
  <div class="page-container">
    <div class="content-wrapper">
      <!-- 地图拾取器卡片 -->
      <el-card class="map-card" shadow="hover">
        <template #header>
          <div class="card-header card-header-row">
            <span>地图坐标拾取器</span>
            <div class="map-toggle">
              <el-switch
                v-model="useMap"
                active-text="地图开"
                inactive-text="地图关"
              />
            </div>
          </div>
        </template>
        <el-alert
          v-if="useMap && tileLoadError"
          title="地图瓦片加载失败：可能处于离线/内网环境。你可以关闭地图，或在构建时设置 VITE_LEAFLET_TILE_URL 指向可用的瓦片服务。"
          type="warning"
          show-icon
          class="tile-error-alert"
          @close="tileLoadError = false"
        />
        <div v-if="useMap" id="map-container" style="height: 750px; width: 100%; border-radius: 4px;">
          <l-map
            ref="map"
            v-model:zoom="zoom"
            :center="mapCenter"
            @moveend="onMapMoveEnd"
          >
            <l-tile-layer
              :url="tileUrl"
              layer-type="base"
              name="OpenStreetMap"
              :attribution="tileAttribution"
              @tileerror="onTileError"
            ></l-tile-layer>
            <l-marker :lat-lng="markerLatLng" draggable @moveend="onMarkerDragEnd"></l-marker>
          </l-map>
        </div>
        <div v-else class="map-disabled-hint">
          <p>地图已关闭（离线/内网部署）。你仍可直接在右侧输入经纬度与半径下载粗糙度文件。</p>
        </div>
      </el-card>

      <!-- 参数输入卡片 -->
      <el-card class="downloader-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>粗糙度文件数据库</span>
          </div>
        </template>
        
        <div class="form-section">
          <p class="card-description">在左侧地图上选择地点，或直接输入坐标和半径。</p>
          
          <el-form label-position="top" @submit.prevent="handleDownloadRou">
            <el-form-item label="中心点纬度 (Latitude)">
              <el-input-number v-model="lat" placeholder="例如: 30.5" :precision="6" :controls="false" style="width: 100%;" />
            </el-form-item>
            
            <el-form-item label="中心点经度 (Longitude)">
              <el-input-number v-model="lon" placeholder="例如: 114.3" :precision="6" :controls="false" style="width: 100%;" />
            </el-form-item>
            
            <el-form-item label="半径 (Radius in meters)">
              <el-input-number v-model="radius" placeholder="例如: 5000" :min="100" :step="100" style="width: 100%;" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="handleDownloadRou" :loading="isLoading" style="width: 100%;" size="large">
                {{ isLoading ? '正在生成...' : '下载粗糙度文件' }}
              </el-button>
            </el-form-item>
          </el-form>
          
          <el-alert
            v-if="errorMessage"
            :title="errorMessage"
            type="error"
            show-icon
            @close="errorMessage = ''"
            class="error-alert"
          />
        </div>

        <el-divider />

        <div class="mapping-section">
            <h4 class="mapping-title">土地利用与粗糙度映射关系</h4>
            <p class="mapping-description">下表展示了土地利用分类(CLCD)与空气动力学粗糙度长度(z₀)的对应关系，该数据是生成粗糙度文件的核心依据。</p>
            <el-table :data="mappingData" stripe border height="250" v-loading="isMappingLoading" header-cell-class-name="header-cell">
                <el-table-column prop="id" label="土地类型ID" width="120" align="center" />
                <el-table-column prop="name" label="地表类型" align="center" />
                <el-table-column prop="z0" label="粗糙度值 z₀ (m)" align="center" />
            </el-table>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import axios from 'axios';
import { ElCard, ElForm, ElFormItem, ElInputNumber, ElButton, ElAlert, ElDivider, ElTable, ElTableColumn, ElSwitch } from 'element-plus';

import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer, LMarker } from "@vue-leaflet/vue-leaflet";
import L from 'leaflet';

try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  });
} catch (e) {
  console.error("Leaflet icon fix failed:", e);
}

const lat = ref(30.52);
const lon = ref(114.31);
const radius = ref(5000);
const isLoading = ref(false);
const errorMessage = ref('');

const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_ATTRIBUTION =
  "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

const tileUrl = String(import.meta.env.VITE_LEAFLET_TILE_URL || '').trim() || DEFAULT_TILE_URL;
const tileAttribution =
  String(import.meta.env.VITE_LEAFLET_TILE_ATTRIBUTION || '').trim() || DEFAULT_ATTRIBUTION;

const useMap = ref(true);
const tileLoadError = ref(false);

const zoom = ref(10);
const mapCenter = ref([lat.value, lon.value]);
const markerLatLng = ref([lat.value, lon.value]);
const map = ref(null);

const mappingData = ref([]);
const isMappingLoading = ref(true);

onMounted(async () => {
    try {
        const response = await axios.get('/api/rou/mapping-data');
        if (response.data.success) {
            mappingData.value = response.data.data;
        }
    } catch (error) {
        console.error("获取映射数据失败:", error);
    } finally {
        isMappingLoading.value = false;
    }
});

watch([lat, lon], ([newLat, newLon]) => {
  if (typeof newLat === 'number' && typeof newLon === 'number') {
    mapCenter.value = [newLat, newLon];
    markerLatLng.value = [newLat, newLon];
  }
});

watch(useMap, async (enabled) => {
  if (!enabled) {
    tileLoadError.value = false;
    return;
  }
  await nextTick();
  const leafletMap = map.value?.leafletObject;
  if (leafletMap && typeof leafletMap.invalidateSize === 'function') {
    leafletMap.invalidateSize();
  }
});

const onMarkerDragEnd = (event) => {
  const newCoords = event.target.getLatLng();
  lat.value = parseFloat(newCoords.lat.toFixed(6));
  lon.value = parseFloat(newCoords.lng.toFixed(6));
};

const onMapMoveEnd = (event) => {
    const newCenter = event.target.getCenter();
    markerLatLng.value = [newCenter.lat, newCenter.lng];
    lat.value = parseFloat(newCenter.lat.toFixed(6));
    lon.value = parseFloat(newCenter.lng.toFixed(6));
}

const onTileError = () => {
  tileLoadError.value = true;
};

const handleDownloadRou = async () => {
  errorMessage.value = '';
  if (lat.value === null || lon.value === null || !radius.value) {
    errorMessage.value = '请输入完整的纬度、经度和半径。';
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.post('/api/rou/download-by-coords', {
      lat: lat.value,
      lon: lon.value,
      radius: radius.value
    }, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rou');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载rou文件时出错:', error);
    if (error.response && error.response.data) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const errorJson = JSON.parse(reader.result);
                errorMessage.value = `生成失败: ${errorJson.message || '未知错误'}`;
            } catch (e) {
                errorMessage.value = '生成失败，无法解析错误信息。';
            }
        };
        reader.onerror = () => {
            errorMessage.value = '生成失败，且无法读取错误响应。';
        };
        reader.readAsText(error.response.data);
    } else {
        errorMessage.value = '生成失败，请检查网络连接或联系管理员。';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style>
/* 定义全局的表头样式 */
.el-table .header-cell {
  background-color: #f5f7fa !important;
  color: #333;
  font-weight: 600;
}
</style>

<style scoped>
.page-container {
  padding: 20px;
  box-sizing: border-box;
  width: 100%;
}

.content-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 25px;
  justify-content: center;
  max-width: 1800px;
  margin: 0 auto;
  align-items: stretch;
}

.map-card {
  flex: 2 1 700px;
  min-width: 500px;
}

.downloader-card {
  flex: 1 1 500px;
  min-width: 450px;
  display: flex;
  flex-direction: column;
}

.card-header {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 600;
}

.card-header-row {
  position: relative;
}

.map-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.card-description {
  text-align: center;
  color: #6c757d;
  margin-top: 0;
  margin-bottom: 25px;
  font-size: 0.9rem;
}

.el-form-item {
  margin-bottom: 20px;
}

.error-alert {
  margin-top: 10px;
}

.tile-error-alert {
  margin-bottom: 12px;
}

.map-disabled-hint {
  height: 750px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #606266;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  text-align: center;
}

.mapping-section {
    margin-top: 20px;
    flex-grow: 1;
}

.mapping-title {
    margin-bottom: 5px; /* 减小与描述的间距 */
    text-align: center;
    color: #303133;
    font-weight: 600;
    font-size: 1.1rem;
}

.mapping-description {
    font-size: 0.85rem;
    color: #909399;
    text-align: center;
    margin-bottom: 15px;
}
</style>
