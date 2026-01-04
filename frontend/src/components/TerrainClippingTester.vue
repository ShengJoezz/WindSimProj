<!--
 * @Author: joe 847304926@qq.com
 * @LastEditTime: 2025-07-07 12:02:19
 * @Description: DEM 裁切工具 + 风机点导入 (v11.5 -- 修复DMS解析 + 方向字母) + 尺寸信息显示
-->
<template>
    <div class="terrain-clipping-container">
      <h2>地形 DEM 获取与裁剪</h2>

      <el-tabs v-model="activeTab" type="card" class="dem-tabs">
        <el-tab-pane label="获取 DEM（内置中国DEM）" name="download">
          <el-card class="mosaic-card" shadow="never">
            <template #header>
              <div class="mosaic-card-header">从内置 China_Dem 生成 DEM（无需上传）</div>
            </template>

            <el-alert type="info" show-icon :closable="false" class="mosaic-hint">
              <template #title>推荐流程</template>
              <template #default>
                1) 在下方输入范围（方式 A/B）→ 2) 点击“生成并下载” → 3) 回到“新建工况/地形上传”上传此 DEM。
                <br />
                数据坐标系：<code>WGS84 / EPSG:4326（经纬度）</code>；首次使用可能需要构建索引，耗时稍长。
              </template>
            </el-alert>

            <div class="mosaic-mode-row">
              <el-radio-group v-model="mosaicMode" size="small">
                <el-radio-button label="coords">方式 A：中心点 + 半径（米）</el-radio-button>
                <el-radio-button label="bbox">方式 B：BBox（高级）</el-radio-button>
              </el-radio-group>

              <el-button
                v-if="canSyncFromClipBox"
                type="primary"
                link
                @click="syncBboxFromClipBox"
              >
                使用当前裁切框范围填充 BBox
              </el-button>
            </div>

            <el-form v-if="mosaicMode === 'coords'" :inline="true" class="mosaic-form">
              <el-form-item label="纬度">
                <el-input-number v-model="mosaicForm.lat" :min="-90" :max="90" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="经度">
                <el-input-number v-model="mosaicForm.lon" :min="-180" :max="180" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="半径(米)">
                <el-input-number v-model="mosaicForm.radius" :min="100" :step="100" controls-position="right" />
              </el-form-item>
              <el-form-item label="最大分片">
                <el-input-number v-model="mosaicForm.maxSources" :min="1" :max="500" :step="10" controls-position="right" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="isMosaicLoading" @click="downloadMosaicByCoords">生成并下载</el-button>
              </el-form-item>
            </el-form>

            <el-form v-else :inline="true" class="mosaic-form">
              <el-form-item label="minX(经度)">
                <el-input-number v-model="mosaicBbox.minX" :min="-180" :max="180" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="minY(纬度)">
                <el-input-number v-model="mosaicBbox.minY" :min="-90" :max="90" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="maxX(经度)">
                <el-input-number v-model="mosaicBbox.maxX" :min="-180" :max="180" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="maxY(纬度)">
                <el-input-number v-model="mosaicBbox.maxY" :min="-90" :max="90" :step="0.0001" :precision="6" controls-position="right" />
              </el-form-item>
              <el-form-item label="最大分片">
                <el-input-number v-model="mosaicForm.maxSources" :min="1" :max="500" :step="10" controls-position="right" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="isMosaicLoading" @click="downloadMosaicByBbox">生成并下载</el-button>
              </el-form-item>
            </el-form>

            <div v-if="mosaicResult" class="mosaic-result">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="命中分片">{{ mosaicResult.sourceCount }}</el-descriptions-item>
                <el-descriptions-item label="裁切范围">
                  {{ mosaicResult.clipBounds.minX.toFixed(6) }}, {{ mosaicResult.clipBounds.minY.toFixed(6) }} —
                  {{ mosaicResult.clipBounds.maxX.toFixed(6) }}, {{ mosaicResult.clipBounds.maxY.toFixed(6) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="裁切 DEM（上传文件）" name="clip">
          <el-alert type="info" show-icon :closable="false" class="clip-hint">
            <template #title>裁切流程</template>
            <template #default>
              1) 上传 DEM (.tif) → 2) 拖动/缩放裁切框 → 3) 点击“裁切并下载”。如需获取 DEM，请切换到上方“获取 DEM”标签页。
            </template>
          </el-alert>
  
      <!-- 1. DEM 上传 -->
      <div class="upload-area"
           :class="{ 'is-active': isDragging }"
           @dragover.prevent="onDragOver"
           @dragleave.prevent="isDragging=false"
           @drop.prevent="handleFileDrop">
        <input ref="fileInput" type="file" accept=".tif,.tiff" @change="handleFileUpload" hidden />
        <div v-if="!selectedFile" class="upload-hint">
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <p>点击或拖拽上传 DEM (.tif)</p>
          <el-button type="primary" @click="triggerFileInput">选择文件</el-button>
        </div>
        <div v-else class="file-selected">
          <div class="file-info"><el-icon class="file-icon"><Document /></el-icon>{{ selectedFile.name }}</div>
          <el-button size="small" type="danger" @click="resetFileSelection">移除</el-button>
        </div>
      </div>
  
      <!-- 2. 风机上传（支持拖拽） -->
      <div v-if="tifData && !isLoading"
           class="upload-area turbine-area"
           :class="{ 'is-active': turbineDrag }"
           @dragover.prevent="turbineDrag=true"
           @dragleave.prevent="turbineDrag=false"
           @drop.prevent="handleTurbineDrop">
        <input ref="turbineFileInput" type="file" accept=".txt,.xls,.xlsx"
               @change="handleTurbineUpload" hidden />
        <div v-if="!turbines.length" class="upload-hint">
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <p>导入风机坐标 (txt / excel) -- 支持拖拽</p>
          <el-button size="small" @click="turbineFileInput.click()">选择文件</el-button>
        </div>
        <div v-else class="file-selected">
          <div class="file-info"><el-icon class="file-icon"><Document /></el-icon>已导入 {{ turbines.length }} 台风机</div>
          <el-button size="small" type="danger" @click="clearTurbines">清除</el-button>
        </div>
      </div>
  
      <!-- 3. Loading 对话框 -->
      <el-dialog v-model="isLoading" :show-close="false"
                 :close-on-click-modal="false" :close-on-press-escape="false"
                 width="300px" center>
        <div class="loading-content">
          <el-progress type="circle" :percentage="loadingProgress" />
          <p>{{ loadingMessage }}</p>
        </div>
      </el-dialog>
  
      <!-- 4. 预览 & 裁切 -->
      <div v-if="selectedFile && tifData" class="preview-section">
        <h3>预览与裁切</h3>
        <div class="preview-container">
          <!-- 4-1 预览图 -->
          <div class="preview-image-container" ref="previewContainer">
            <canvas ref="previewCanvas" @mousedown="startDragging"></canvas>
            <div v-if="showClippingBox" class="clipping-box"
                 :style="{ left:clippingBox.x+'px', top:clippingBox.y+'px',
                           width:clippingBox.size+'px', height:clippingBox.size+'px' }"
                 @mousedown="startDragging">
              <div class="resize-handle" @mousedown.stop="startResizing"></div>
            </div>
          </div>
  
          <!-- 4-2 信息 / 控制 -->
          <div class="clipping-controls">
            <div class="dem-info">
              <h4>DEM 信息</h4>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="原始尺寸">{{ tifData.width }} × {{ tifData.height }} px</el-descriptions-item>
                <el-descriptions-item label="坐标系">{{ coordSystemText }}</el-descriptions-item>
                <el-descriptions-item label="坐标范围">
                  {{ coordLabels.x }}: {{ formatCoord(tifData.geoBounds.minX) }} -- {{ formatCoord(tifData.geoBounds.maxX) }}<br>
                  {{ coordLabels.y }}: {{ formatCoord(tifData.geoBounds.minY) }} -- {{ formatCoord(tifData.geoBounds.maxY) }}
                </el-descriptions-item>
                <el-descriptions-item label="区域尺寸">
                  {{ formatDistance(geographicSize.width) }} × {{ formatDistance(geographicSize.height) }}
                </el-descriptions-item>
                <el-descriptions-item label="分辨率">
                  {{ formatResolution(pixelResolution.x) }} × {{ formatResolution(pixelResolution.y) }} (m/像素)
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- 新增：裁剪信息 -->
            <div v-if="showClippingBox" class="clipping-info">
              <h4>裁剪信息</h4>
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="裁剪框尺寸">{{ clippingBox.size }} × {{ clippingBox.size }} px (预览)</el-descriptions-item>
                <el-descriptions-item label="实际裁剪尺寸">{{ clippingPixelSize.width }} × {{ clippingPixelSize.height }} px (原图)</el-descriptions-item>
                <el-descriptions-item label="裁剪地理尺寸">
                  {{ formatDistance(clippingGeographicSize.width) }} × {{ formatDistance(clippingGeographicSize.height) }}
                </el-descriptions-item>
                <el-descriptions-item label="数据保留比例">
                  {{ formatPercentage(clippingRatio.pixel) }} (像素) / {{ formatPercentage(clippingRatio.geographic) }} (面积)
                </el-descriptions-item>
              </el-descriptions>
            </div>
  
            <div class="clipping-size-control">
              <h4>裁切设置</h4>
              <div class="size-control">
                <label>裁切框大小 (像素)</label>
                <el-slider v-model="clippingBox.size"
                           :min="minClippingSize" :max="maxClippingSize"
                           :step="10" show-stops @input="adjustClippingBoxPosition" />
              </div>
  
              <div class="clipping-coordinates">
                <h5>裁切区域 (地理坐标)</h5>
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="西南角">
                    {{ formatCoord(clippingCoordinates.minX) }}, {{ formatCoord(clippingCoordinates.minY) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="东北角">
                    {{ formatCoord(clippingCoordinates.maxX) }}, {{ formatCoord(clippingCoordinates.maxY) }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
  
              <div class="action-buttons">
                <el-button type="primary" @click="performClipping">裁切并下载 (后端)</el-button>
                <el-button @click="centerClippingBox">居中裁切框</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
  import { ElMessage } from 'element-plus';
  import * as GeoTIFF from 'geotiff';
  import * as XLSX from 'xlsx';
  
  /* ===== 通用 ===== */
  const selectedFile  = ref(null);
  const isDragging    = ref(false);
  const isLoading     = ref(false);
  const loadingProgress = ref(0);
  const loadingMessage  = ref('');

  const activeTab = ref('download');
  const mosaicMode = ref('coords'); // 'coords' | 'bbox'
  
  /* ===== DEM ===== */
  const tifData           = ref(null);
  const previewCanvas     = ref(null);
  const previewContainer  = ref(null);
  const fileInput         = ref(null);
  
  /* ===== 裁切框 ===== */
  const showClippingBox   = ref(false);
  const clippingBox       = reactive({ x:0, y:0, size:200 });
  const minClippingSize   = ref(50);
  const maxClippingSize   = ref(500);
  const isDraggingBox     = ref(false);
  const isResizing        = ref(false);
  const dragOffset        = reactive({ x:0, y:0 });
  const initialBox        = reactive({ x:0, y:0, size:0, mouseX:0, mouseY:0 });
  
  /* ===== 风机 ===== */
  const turbineFileInput = ref(null);
  const turbines         = ref([]);
  const turbineDrag      = ref(false); 

  /* ===== 内置 China_Dem：拼接 + 裁切下载 ===== */
  const mosaicForm = reactive({
    lat: null,
    lon: null,
    radius: 5000,
    maxSources: 200,
  });
  const mosaicBbox = reactive({
    minX: null,
    minY: null,
    maxX: null,
    maxY: null,
  });
  const isMosaicLoading = ref(false);
  const mosaicResult = ref(null);
  
  /* ========= 新增：尺寸计算相关 ========= */

  const inferCoordSystem = (geoKeys, bounds) => {
    const projectedEpsg = geoKeys?.ProjectedCSTypeGeoKey;
    const geographicEpsg = geoKeys?.GeographicTypeGeoKey;

    if (projectedEpsg) {
      return { type: 'projected', epsg: Number(projectedEpsg) || null, unit: 'm' };
    }

    // Heuristic fallback: if bbox looks like lon/lat degrees, treat as geographic even when GeoKeys are missing.
    const looksGeographic =
      bounds &&
      Math.abs(bounds[0]) <= 180 &&
      Math.abs(bounds[2]) <= 180 &&
      Math.abs(bounds[1]) <= 90 &&
      Math.abs(bounds[3]) <= 90;

    if (geographicEpsg || looksGeographic) {
      return { type: 'geographic', epsg: Number(geographicEpsg) || null, unit: 'deg' };
    }

    return { type: 'projected', epsg: null, unit: 'm' };
  };

  const coordLabels = computed(() => {
    const type = tifData.value?.coordSystem?.type;
    if (type === 'geographic') {
      return { x: '经度', y: '纬度' };
    }
    return { x: 'X', y: 'Y' };
  });

  const coordSystemText = computed(() => {
    const cs = tifData.value?.coordSystem;
    if (!cs) return '--';
    if (cs.type === 'geographic') {
      return cs.epsg ? `地理坐标系 (EPSG:${cs.epsg})` : '地理坐标系 (经纬度)';
    }
    return cs.epsg ? `投影坐标系 (EPSG:${cs.epsg})` : '投影坐标系 (单位: 米)';
  });

  const formatCoord = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '--';
    const type = tifData.value?.coordSystem?.type;
    const precision = type === 'geographic' ? 6 : 2;
    return v.toFixed(precision);
  };
  
  // 地理尺寸计算（原始DEM）
  const geographicSize = computed(() => {
    if (!tifData.value || !tifData.value.geoBounds) {
      return { width: 0, height: 0 };
    }
    const g = tifData.value.geoBounds;

    const coordType = tifData.value?.coordSystem?.type;
    // If bounds are lon/lat degrees, approximate meters with spherical Earth.
    if (coordType === 'geographic') {
      const R = 6371000;
      const midLatRad = ((g.minY + g.maxY) / 2) * Math.PI / 180;
      const deltaLonRad = (g.maxX - g.minX) * Math.PI / 180;
      const deltaLatRad = (g.maxY - g.minY) * Math.PI / 180;
      const width = Math.abs(R * deltaLonRad * Math.cos(midLatRad));
      const height = Math.abs(R * deltaLatRad);
      return { width, height };
    }

    // Projected coordinates (meters) - use raw deltas.
    const width = Math.abs(g.maxX - g.minX);
    const height = Math.abs(g.maxY - g.minY);
    return { width, height };
  });
  
  // 像素分辨率计算
  const pixelResolution = computed(() => {
    if (!tifData.value || !geographicSize.value) {
      return { x: 0, y: 0 };
    }
    return {
      x: geographicSize.value.width / tifData.value.width,
      y: geographicSize.value.height / tifData.value.height
    };
  });
  
  // 裁剪框在原图中的实际像素尺寸
  const clippingPixelSize = computed(() => {
    if (!tifData.value || !previewCanvas.value || !showClippingBox.value) {
      return { width: 0, height: 0 };
    }
    const scaleX = tifData.value.width / previewCanvas.value.width;
    const scaleY = tifData.value.height / previewCanvas.value.height;
    return {
      width: Math.round(clippingBox.size * scaleX),
      height: Math.round(clippingBox.size * scaleY)
    };
  });
  
  // 裁剪区域的地理尺寸
  const clippingGeographicSize = computed(() => {
    if (!clippingCoordinates.value) {
      return { width: 0, height: 0 };
    }
    const coords = clippingCoordinates.value;
    const coordType = tifData.value?.coordSystem?.type;
    if (coordType === 'geographic') {
      const R = 6371000;
      const midLatRad = ((coords.minY + coords.maxY) / 2) * Math.PI / 180;
      const deltaLonRad = (coords.maxX - coords.minX) * Math.PI / 180;
      const deltaLatRad = (coords.maxY - coords.minY) * Math.PI / 180;
      const width = Math.abs(R * deltaLonRad * Math.cos(midLatRad));
      const height = Math.abs(R * deltaLatRad);
      return { width, height };
    }
    const width = Math.abs(coords.maxX - coords.minX);
    const height = Math.abs(coords.maxY - coords.minY);
    return { width, height };
  });
  
  // 裁剪比例计算
  const clippingRatio = computed(() => {
    if (!tifData.value || !clippingPixelSize.value || !geographicSize.value) {
      return { pixel: 0, geographic: 0 };
    }
    const totalPixels = tifData.value.width * tifData.value.height;
    const clippingPixels = clippingPixelSize.value.width * clippingPixelSize.value.height;
    const pixelRatio = clippingPixels / totalPixels;
    
    const totalArea = geographicSize.value.width * geographicSize.value.height;
    const clippingArea = clippingGeographicSize.value.width * clippingGeographicSize.value.height;
    const geographicRatio = clippingArea / totalArea;
    
    return {
      pixel: pixelRatio,
      geographic: geographicRatio
    };
  });
  
  // 格式化函数
  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };
  
  const formatResolution = (resolution) => {
    if (resolution >= 1000) {
      return `${(resolution / 1000).toFixed(3)} km`;
    }
    return `${resolution.toFixed(1)} m`;
  };
  
  const formatPercentage = (ratio) => {
    return `${(ratio * 100).toFixed(2)}%`;
  };
  
  /* ========= 裁切框 → 坐标 ========= */
  const clippingCoordinates = computed(()=>{
    if (!tifData.value || !previewCanvas.value || !previewCanvas.value.width || !previewCanvas.value.height) {
      return {minX:0,minY:0,maxX:0,maxY:0};
    }
    const g  = tifData.value.geoBounds;
    const cw = previewCanvas.value.width;
    const ch = previewCanvas.value.height;
    const xPerPx = (g.maxX - g.minX) / cw;
    const yPerPx = (g.maxY - g.minY) / ch; 
    
    const minX = g.minX + clippingBox.x * xPerPx;
    const maxX = minX + clippingBox.size * xPerPx;
    const maxY = g.maxY - clippingBox.y * yPerPx; 
    const minY = maxY - clippingBox.size * yPerPx;
    
    return {minX, minY, maxX, maxY};
  });
  
  /* ======================================================================
     1. DEM 文件读取与预览
  ====================================================================== */
  const triggerFileInput = () => fileInput.value?.click();
  const onDragOver       = e => { isDragging.value = true; e.dataTransfer.dropEffect='copy'; };
  const handleFileDrop   = e => { 
    isDragging.value=false; 
    const file = e.dataTransfer.files[0];
    if (file) processDEM(file); 
  };
  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (file) processDEM(file);
    if (e.target) e.target.value = '';
  };
  
  async function processDEM(file){
    if(!/\.tif{1,2}$/i.test(file.name)) return ElMessage.error('请选择 TIF DEM');
    selectedFile.value = file;
    isLoading.value = true; loadingMessage.value = '加载 DEM…'; loadingProgress.value = 0;
  
    try{
      const arrayBuffer = await file.arrayBuffer(); loadingProgress.value=20;
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const img  = await tiff.getImage(); loadingProgress.value=40;
  
      const width = img.getWidth(), height = img.getHeight();
      const gb    = img.getBoundingBox();
      const coordSystem = inferCoordSystem(typeof img.getGeoKeys === 'function' ? img.getGeoKeys() : null, gb);
      const nodata= img.getGDALNoData();
      const dem   = (await img.readRasters({ samples:[0] }))[0];
  
      let min=Infinity,max=-Infinity;
      if (dem && typeof dem[Symbol.iterator] === 'function') {
          for(const v of dem) if(v!==nodata && !isNaN(v)){min=Math.min(min,v);max=Math.max(max,v);}
      }
      if(min===Infinity || max === -Infinity){min=max=0;}
  
      tifData.value={
        width,height,
        geoBounds:{minX:gb[0],minY:gb[1],maxX:gb[2],maxY:gb[3]},
        coordSystem,
        minMaxValues:{min,max},
        demDataForPreview:dem,
        gdalNoData:nodata
      };
  
      await nextTick();
      await renderPreview();
      initClipBox();
      loadingProgress.value=100; loadingMessage.value='完成';
    }catch(e){
      ElMessage.error('DEM 解析失败：'+ (e.message || "未知错误"));
      console.error("DEM Processing Error:", e);
      resetFileSelection();
    }finally{ isLoading.value=false; }
  }
  
  function resetFileSelection(){
    selectedFile.value=null; tifData.value=null; turbines.value=[];
    showClippingBox.value=false;
    if (fileInput.value) fileInput.value.value='';
    if (turbineFileInput.value) turbineFileInput.value.value='';
    
    const ctx = previewCanvas.value?.getContext('2d');
    if (ctx && previewCanvas.value) {
      ctx.clearRect(0,0,previewCanvas.value.width,previewCanvas.value.height);
    }
  }
  
  /* ---------------- 预览绘制 ---------------- */
  async function renderPreview(){
    if(!tifData.value||!previewCanvas.value||!previewContainer.value) return;
    const cvs=previewCanvas.value, ctx=cvs.getContext('2d');
    if (previewContainer.value.clientWidth === 0) {
        await nextTick(); 
        if (previewContainer.value.clientWidth === 0) {
            console.warn("Preview container has no width. Skipping render.");
            return;
        }
    }
    const cw=previewContainer.value.clientWidth, ar=tifData.value.width/tifData.value.height;
    cvs.width=cw; cvs.height=cw/ar;
  
    const {demDataForPreview:data,width:dw,height:dh,gdalNoData:nodata,minMaxValues:{min,max}}=tifData.value;
    const rng=(max-min)||1;
  
    const imgData=ctx.createImageData(cvs.width,cvs.height);
    const pix=imgData.data;
  
    const bilinear=(x_dem,y_dem)=>{
      const x1=Math.floor(x_dem),y1=Math.floor(y_dem);
      const x2=Math.min(x1+1,dw-1),y2=Math.min(y1+1,dh-1);
      const fx=x_dem-x1, fy=y_dem-y1;
      
      const q11=data[y1*dw+x1], q21=data[y1*dw+x2], q12=data[y2*dw+x1], q22=data[y2*dw+x2];
      if([q11,q21,q12,q22].some(v=>v===nodata||isNaN(v))) return nodata;
      
      const r1 = (1-fx)*q11 + fx*q21;
      const r2 = (1-fx)*q12 + fx*q22;
      return (1-fy)*r1 + fy*r2;
    };
  
    const ramp=t_norm=>{
      const stops=[[0,[25,60,23]],[.2,[43,87,58]],[.4,[82,125,84]],[.6,[196,164,132]],[.8,[139,69,19]],[1,[245,245,245]]];
      let i=0; 
      while(i < stops.length - 2 && t_norm > stops[i+1][0]) {
          i++;
      }
      const [t0, c0_arr] = stops[i];
      const [t1, c1_arr] = stops[i+1];
      
      const k = (t1 - t0 === 0) ? 0 : (t_norm - t0) / (t1 - t0); 
      
      const r = Math.round(c0_arr[0] + k * (c1_arr[0] - c0_arr[0]));
      const g = Math.round(c0_arr[1] + k * (c1_arr[1] - c0_arr[1]));
      const b = Math.round(c0_arr[2] + k * (c1_arr[2] - c0_arr[2]));
      return [r,g,b];
    }
  
    for(let y_cvs=0;y_cvs<cvs.height;y_cvs++) {
      for(let x_cvs=0;x_cvs<cvs.width;x_cvs++){
        const dem_x = (x_cvs / cvs.width) * dw; 
        const dem_y = (y_cvs / cvs.height) * dh; 
        
        const val = bilinear(dem_x, dem_y);
        const idx=(y_cvs*cvs.width+x_cvs)*4;
  
        if(val===nodata||isNaN(val)){ 
          pix[idx+3]=0; 
          continue; 
        }
        const normalized_val = (val-min)/rng;
        const color_arr = ramp(normalized_val);
        pix[idx  ]=color_arr[0];
        pix[idx+1]=color_arr[1];
        pix[idx+2]=color_arr[2];
        pix[idx+3]=255;
      }
    }
    ctx.putImageData(imgData,0,0);
    if(turbines.value.length) drawTurbines(ctx);
  }
  
  function drawTurbines(ctx){
    if (!tifData.value || !tifData.value.geoBounds || !previewCanvas.value) return;
    const g=tifData.value.geoBounds, cw=previewCanvas.value.width, ch=previewCanvas.value.height;
    ctx.save(); ctx.fillStyle='#ff0000'; ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    turbines.value.forEach(t=>{
      const tx = typeof t.x === 'number' ? t.x : t.lon;
      const ty = typeof t.y === 'number' ? t.y : t.lat;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      const x_pixel=(tx-g.minX)/(g.maxX-g.minX)*cw;
      const y_pixel=(g.maxY-ty)/(g.maxY-g.minY)*ch;
      ctx.beginPath(); ctx.arc(x_pixel,y_pixel,4,0,Math.PI*2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }
  
  /* ---------------- 裁切框工具 ---------------- */
  function initClipBox(){
    const c=previewCanvas.value;
    if (!c) return;
    maxClippingSize.value=Math.min(c.width,c.height);
    clippingBox.size=Math.max(minClippingSize.value, Math.min(clippingBox.size, maxClippingSize.value/2));
    centerClippingBox(); showClippingBox.value=true;
  }
  const centerClippingBox=()=>{ 
      const c=previewCanvas.value; 
      if(!c) return;
      clippingBox.x=(c.width-clippingBox.size)/2; 
      clippingBox.y=(c.height-clippingBox.size)/2; 
  };
  const adjustClippingBoxPosition=()=>{
    const c=previewCanvas.value;
    if(!c) return;
    clippingBox.size=Math.max(minClippingSize.value, Math.min(clippingBox.size,c.width,c.height));
    clippingBox.x=Math.max(0,Math.min(clippingBox.x,c.width -clippingBox.size));
    clippingBox.y=Math.max(0,Math.min(clippingBox.y,c.height-clippingBox.size));
  };
  
  const startDragging=e=>{
    if(isResizing.value||!showClippingBox.value || !previewCanvas.value) return;
    const r=previewCanvas.value.getBoundingClientRect();
    const cx=e.clientX-r.left, cy=e.clientY-r.top;
    if(cx>=clippingBox.x&&cx<=clippingBox.x+clippingBox.size&&cy>=clippingBox.y&&cy<=clippingBox.y+clippingBox.size){
      isDraggingBox.value=true; dragOffset.x=cx-clippingBox.x; dragOffset.y=cy-clippingBox.y;
      document.addEventListener('mousemove',onDrag); document.addEventListener('mouseup',stopDragging);
    }
  };
  const onDrag=e=>{
    if(!isDraggingBox.value || !previewCanvas.value) return;
    const r=previewCanvas.value.getBoundingClientRect();
    clippingBox.x=Math.max(0,Math.min(e.clientX-r.left-dragOffset.x,previewCanvas.value.width -clippingBox.size));
    clippingBox.y=Math.max(0,Math.min(e.clientY-r.top -dragOffset.y,previewCanvas.value.height-clippingBox.size));
  };
  const stopDragging=()=>{isDraggingBox.value=false;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDragging);};
  
  const startResizing=e=>{
    if (!previewCanvas.value) return;
    isResizing.value=true; Object.assign(initialBox,{...clippingBox,mouseX:e.clientX,mouseY:e.clientY});
    document.addEventListener('mousemove',onResize); document.addEventListener('mouseup',stopResizing);
  };
  const onResize=e=>{
    if(!isResizing.value || !previewCanvas.value) return;
    const delta=e.clientX-initialBox.mouseX;
    const c=previewCanvas.value;
    const dynamicMaxPossibleSize = Math.min(c.width-initialBox.x, c.height-initialBox.y);
    const newProposedSize = initialBox.size+delta;
    clippingBox.size=Math.max(minClippingSize.value, Math.min(dynamicMaxPossibleSize, newProposedSize));
  };
  const stopResizing=()=>{isResizing.value=false; document.removeEventListener('mousemove',onResize); document.removeEventListener('mouseup',stopResizing);};

  /* ---------------- 内置 DEM（China_Dem）拼接下载 ---------------- */
  const normalizeDownloadUrl = (downloadUrl) => {
    if (!downloadUrl) return '';
    if (downloadUrl.startsWith('http')) return downloadUrl;
    return downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
  };

  const postJson = async (url, payload) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`服务器错误 ${res.status}: ${text || res.statusText}`);
      }
      throw new Error('后端响应不是 JSON');
    }

    if (!res.ok || !json?.success) {
      throw new Error(json?.message || `服务器错误 ${res.status}`);
    }
    return json;
  };

  const downloadMosaicByCoords = async () => {
    if (mosaicForm.lat === null || mosaicForm.lon === null || mosaicForm.radius === null) {
      ElMessage.warning('请填写纬度/经度/半径后再生成');
      return;
    }

    isMosaicLoading.value = true;
    mosaicResult.value = null;
    try {
      const json = await postJson('/api/dem/download-by-coords', {
        lat: mosaicForm.lat,
        lon: mosaicForm.lon,
        radius: mosaicForm.radius,
        maxSources: mosaicForm.maxSources,
      });
      mosaicResult.value = {
        sourceCount: json.data.sourceCount,
        clipBounds: json.data.clipBounds,
      };
      window.location.href = normalizeDownloadUrl(json.data.downloadUrl);
      ElMessage.success('已生成 DEM，开始下载');
    } catch (e) {
      ElMessage.error('生成失败：' + e.message);
      console.error('DEM download-by-coords error:', e);
    } finally {
      isMosaicLoading.value = false;
    }
  };

  const canSyncFromClipBox = computed(() => {
    const coordType = tifData.value?.coordSystem?.type;
    return Boolean(showClippingBox.value && coordType === 'geographic');
  });

  const syncBboxFromClipBox = () => {
    if (!canSyncFromClipBox.value) return;
    const { minX, minY, maxX, maxY } = clippingCoordinates.value;
    mosaicBbox.minX = Number(minX);
    mosaicBbox.minY = Number(minY);
    mosaicBbox.maxX = Number(maxX);
    mosaicBbox.maxY = Number(maxY);
    mosaicMode.value = 'bbox';
    activeTab.value = 'download';
    ElMessage.success('已使用裁切框范围填充 BBox');
  };

  const downloadMosaicByBbox = async () => {
    const required = [mosaicBbox.minX, mosaicBbox.minY, mosaicBbox.maxX, mosaicBbox.maxY];
    if (required.some(v => v === null || v === undefined || v === '')) {
      ElMessage.warning('请填写完整的 BBox(minX/minY/maxX/maxY) 后再生成');
      return;
    }

    const minX = Number(mosaicBbox.minX);
    const minY = Number(mosaicBbox.minY);
    const maxX = Number(mosaicBbox.maxX);
    const maxY = Number(mosaicBbox.maxY);
    if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX >= maxX || minY >= maxY) {
      ElMessage.error('BBox 无效：请确认 min < max 且为有效数字');
      return;
    }

    isMosaicLoading.value = true;
    mosaicResult.value = null;
    try {
      const json = await postJson('/api/dem/mosaic-clip', {
        minX,
        minY,
        maxX,
        maxY,
        maxSources: mosaicForm.maxSources,
      });
      mosaicResult.value = {
        sourceCount: json.data.sourceCount,
        clipBounds: json.data.clipBounds,
      };
      window.location.href = normalizeDownloadUrl(json.data.downloadUrl);
      ElMessage.success('已生成 DEM，开始下载');
    } catch (e) {
      ElMessage.error('生成失败：' + e.message);
      console.error('DEM mosaic-clip error:', e);
    } finally {
      isMosaicLoading.value = false;
    }
  };
  
  /* ---------------- 裁切请求 ---------------- */
  async function performClipping(){
    if(!selectedFile.value) return ElMessage.warning('请先上传 DEM');
    if (!clippingCoordinates.value || 
        clippingCoordinates.value.minX === undefined || 
        clippingCoordinates.value.maxX <= clippingCoordinates.value.minX ||
        clippingCoordinates.value.maxY <= clippingCoordinates.value.minY) {
      ElMessage.error('裁切区域无效，请调整裁切框');
      return;
    }
    isLoading.value=true; loadingProgress.value=0; loadingMessage.value='裁切中…';
    try{
      const {minX,minY,maxX,maxY}=clippingCoordinates.value;
      const fd=new FormData();
      fd.append('demFile',selectedFile.value);
      fd.append('minX',minX.toString()); fd.append('minY',minY.toString()); 
      fd.append('maxX',maxX.toString()); fd.append('maxY',maxY.toString());
      
      const res=await fetch('/api/dem/clip',{method:'POST',body:fd});
      loadingProgress.value=50;
      if(!res.ok) {
          if (res.status === 413) {
            throw new Error(
              '上传文件过大，服务器拒绝请求（413 Request Entity Too Large）。' +
              '请提高反向代理/Nginx 的 client_max_body_size，并确保后端上传大小限制足够大。' +
              '若使用 Docker 镜像部署，请更新并重新构建/分发镜像后再试。'
            );
          }
          const errorText = await res.text();
          throw new Error(`服务器错误 ${res.status}: ${errorText || res.statusText}`);
      }
      const json=await res.json();
      loadingProgress.value=90;
      if(json.success && json.data && json.data.downloadUrl){
        let downloadUrl = json.data.downloadUrl;
        if (!downloadUrl.startsWith('http') && !downloadUrl.startsWith('/')) {
            downloadUrl = '/' + downloadUrl;
        }
        window.location.href = downloadUrl;
        ElMessage.success('裁切完成，开始下载');
      }else throw new Error(json.message || '后端响应格式错误或操作失败');
      loadingProgress.value=100;
    }catch(e){ 
      ElMessage.error('裁切失败：'+e.message); 
      console.error("Clipping Error:", e);
    }
    finally{ isLoading.value=false; }
  }
  
  /* ======================================================================
     2. 风机文件解析（DMS/方向修复）+ 拖拽
  ====================================================================== */
  const handleTurbineUpload = e => { 
    const file = e.target.files[0];
    if (file) processTurbineFile(file); 
    if (e.target) e.target.value = '';
  };
  const handleTurbineDrop   = e => { 
    turbineDrag.value=false; 
    const file = e.dataTransfer.files[0];
    if (file) processTurbineFile(file); 
  };
  
  function processTurbineFile(file){
    const name=file.name.toLowerCase();
    if(name.endsWith('.txt'))   readTxt(file);
    else if(name.endsWith('.xls')||name.endsWith('.xlsx')) readExcel(file);
    else ElMessage.error('仅支持 txt / xls / xlsx 格式的风机文件');
  }
  
  async function readTxt(file){ 
      try {
          parseLines((await file.text()).split(/\r?\n/)); 
      } catch (e) {
          ElMessage.error('读取 TXT 文件失败: ' + e.message);
      }
  }
  function readExcel(file){
    const r=new FileReader();
    r.onload=e=>{
      try {
          const wb=XLSX.read(e.target.result,{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
          parseLines(rows.map(rArray => Array.isArray(rArray) ? rArray.join('\t') : ''));
      } catch (e) {
          ElMessage.error('解析 Excel 文件失败: ' + e.message);
      }
    };
    r.onerror = (e) => ElMessage.error('读取 Excel 文件时出错: ' + e.message);
    r.readAsArrayBuffer(file);
  }
  
  /* ---- DMS 转十进制度 (来自补丁) ---- */
  function dmsToDecimal(str){
    const cleaned = str.trim()
        .replace(/[NSEWnsew]/ig,'')         // 去方向 (parseCoord会处理符号)
        .replace(/[°º˚]/g,' ')             // 度 (添加了˚)
        .replace(/[′'`'']/g,' ')           // 分 (添加了`'')
        .replace(/[″""]/g,' ');           // 秒 (添加了"");
    const parts = cleaned.trim().split(/\s+/).filter(Boolean).map(Number); // filter(Boolean) to remove empty strings from multiple spaces
    if (parts.some(isNaN) || parts.length === 0) return NaN;
    if (parts.length === 3) return parts[0] + parts[1]/60 + parts[2]/3600;
    if (parts.length === 2) return parts[0] + parts[1]/60;
    if (parts.length === 1) return parts[0];
    return NaN;
  }
  
  /* ---- 新增坐标解析工具 (来自补丁) ---- */
  function parseCoord(str){
    if(!str) return NaN;
    const s = str.trim();
    // 提前判断是否带有度分秒符号或空格分隔的 2~3 个数字
    // 使用 /u 标志以正确处理Unicode字符，例如度符号 °
    const looksLikeDMS = /[°º˚′'`''″""]/u.test(s) || /^\d+(\.\d+)?\s+\d+(\.\d+)?(\s+\d+(\.\d+)?)?/.test(s.replace(/[NSEWnsew]/ig,'').trim());
    let sign = 1;
    if (/[SWsw]/i.test(s)) sign = -1; // 方向转为符号
  
    if (looksLikeDMS){
      const val = dmsToDecimal(s); // dmsToDecimal will strip NSEW again, which is fine
      return isNaN(val) ? NaN : sign * val;
    }
  
    // 对于十进制度，parseFloat会处理数字部分，我们再应用符号
    const num = parseFloat(s.replace(/[NSEWnsew]/ig,'')); // Remove NSEW before parseFloat for decimal
    return isNaN(num) ? NaN : sign * num;
  }
  
  
  /* ---- 解析行 (应用新 parseCoord) ---- */
  function parseLines(lines){
    if(!tifData.value || !tifData.value.geoBounds) return ElMessage.error('请先加载 DEM');
    const g=tifData.value.geoBounds;
    const ok=[];
    let out=0, bad=0;
  
    lines.forEach((line,index)=>{
      const seg=line.trim();
      if(!seg) return;
      
      const p=seg.split(/\s+/);
      if(p.length<3){ bad++; console.warn(`Line ${index+1} invalid format (less than 3 parts): "${line}"`); return; }
      
      const name=p[0];
      const lonStr=p[1], latStr=p[2];
  
      // 使用新的 parseCoord 函数
      const lon = parseCoord(lonStr);
      const lat = parseCoord(latStr);
      
      if(isNaN(lon)||isNaN(lat)){ bad++; console.warn(`Line ${index+1} unparseable coordinates (lon: "${lonStr}", lat: "${latStr}") resolved to (lon: ${lon}, lat: ${lat}): "${line}"`); return; }
  
      if(lon<g.minX||lon>g.maxX||lat<g.minY||lat>g.maxY){ out++; return; }
      ok.push({ name, x: lon, y: lat, lon, lat });
    });
  
    let messages = [];
    if(ok.length) messages.push(`成功导入 ${ok.length} 台风机`);
    if(out)  messages.push(`${out} 台风机超出 DEM 范围，已忽略`);
    if(bad)  messages.push(`${bad} 行格式无法识别或坐标无效，已忽略`);
    
    if (messages.length > 0) {
      ElMessage({
        message: messages.join('。'),
        type: ok.length > 0 && !out && !bad ? 'success' : (ok.length > 0 ? 'warning' : 'error'),
        duration: ok.length > 0 ? 3000 : 5000
      });
    } else if (lines.filter(l => l.trim()).length > 0) {
        ElMessage.error('未解析到任何有效风机数据。请检查文件内容和格式。');
    }
  
    if (ok.length > 0) {
      turbines.value=ok;
    } else if (turbines.value.length > 0 && lines.filter(l=>l.trim()).length > 0) {
      // No change to turbines.value if new import fails but old turbines exist
    } else {
      turbines.value = [];
    }
    renderPreview(); // Always re-render
  }
  const clearTurbines = ()=>{ 
      turbines.value=[]; 
      renderPreview(); 
      ElMessage.info('已清除所有风机点');
  };
  
  /* ====================================================================== */
  const handleResize = () => {
      if (tifData.value && previewCanvas.value && previewContainer.value) {
          renderPreview();
          if (showClippingBox.value) {
              initClipBox();
          }
      }
  };
  onMounted(()=> window.addEventListener('resize',handleResize));
  onBeforeUnmount(()=>{
    window.removeEventListener('resize',handleResize);
    document.removeEventListener('mousemove',onDrag);
    document.removeEventListener('mouseup',stopDragging);
    document.removeEventListener('mousemove',onResize);
    document.removeEventListener('mouseup',stopResizing);
  });
  </script>
  
<style scoped>
  .terrain-clipping-container{max-width:1200px;margin:20px auto;padding:20px;background:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);}
  h2{text-align:center;margin-bottom:24px;font-size:1.8em;color:#303133;}
  h3,h4,h5{margin-top:24px;margin-bottom:16px;color:#303133;} h3{font-size:1.5em;} h4{font-size:1.2em;}
  
  .upload-area{border:2px dashed #dcdfe6;border-radius:8px;padding:40px;text-align:center;transition:.3s;background:#f9fafc;cursor:pointer;margin-top:16px;}
  .upload-area.is-active{border-color:#409EFF;background:#f0f7ff;}
  .turbine-area{background:#fff8e5;}
  .upload-hint{display:flex;flex-direction:column;align-items:center;gap:16px;color:#606266;}
  .upload-icon{font-size:48px;color:#c0c4cc;margin-bottom:8px;}
  .file-selected{display:flex;align-items:center;justify-content:space-between;padding:10px;background:#eef6ff;border-radius:4px;}
  .file-info{display:flex;align-items:center;gap:8px;font-weight:500;color:#303133;}
  .file-icon{font-size:20px;color:#409EFF;}

  .dem-tabs{margin-top:12px;}
  .mosaic-card{border:1px solid #ebeef5;background:#fafcff;}
  .mosaic-card-header{font-weight:600;color:#303133;}
  .mosaic-mode-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:8px 0 12px;flex-wrap:wrap;}
  .mosaic-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;}
  .mosaic-hint{margin-top:12px;}
  .mosaic-result{margin-top:12px;}

  .clip-hint{margin-bottom:12px;}
  
  .preview-section{margin-top:40px;padding-top:20px;border-top:1px solid #ebeef5;}
  .preview-container{display:flex;flex-wrap:wrap;gap:24px;margin-top:16px;}
  .preview-image-container{position:relative;flex:1 1 500px;min-width:300px;border:1px solid #e4e7ed;border-radius:4px;overflow:hidden;background:#f5f7fa; align-self: flex-start;}
  .preview-image-container canvas{display:block;width:100%;height:auto; background-color: #eee;}
  .clipping-controls{flex:1 1 300px;min-width:280px;display:flex;flex-direction:column;gap:24px;}
  .dem-info, .clipping-info, .clipping-size-control { background-color: #fdfdfd; padding: 15px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);}
  
  /* 新增裁剪信息区域样式 */
  .clipping-info { border-left: 4px solid #67c23a; }
  .clipping-info h4 { color: #67c23a; margin-top: 0; }
  
  .clipping-box{position:absolute;border:2px dashed #f56c6c;background:rgba(245,108,108,.15);cursor:move;box-sizing:border-box;}
  .resize-handle{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#f56c6c;border:1px solid #fff;border-radius:50%;cursor:nwse-resize;}
  
  .size-control{display:flex;flex-direction:column;gap:8px;margin:16px 0;}
  .action-buttons{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;}
  
  .loading-content{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;}
  .loading-content p{margin-top:20px;font-size:1.1em;color:#303133;}
  
</style>
