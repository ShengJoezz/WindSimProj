<!--
 * @Author: joe 847304926@qq.com
 * @LastEditTime: 2025-05-17 01:18:15
 * @Description: DEM 裁切工具 + 风机点导入 (v11.3 – 修复 clippingCoordinates 空指针)
-->

<template>
    <div class="terrain-clipping-container">
      <h2>DEM 文件裁切工具</h2>
  
      <!-- 1. DEM 上传 -->
      <div class="upload-area" :class="{ 'is-active': isDragging }"
           @dragover.prevent="onDragOver"
           @dragleave.prevent="isDragging=false"
           @drop.prevent="handleFileDrop">
        <input ref="fileInput" type="file" style="display:none"
               accept=".tif,.tiff" @change="handleFileUpload"/>
        <div v-if="!selectedFile" class="upload-hint">
          <i class="el-icon-upload"></i><p>点击或拖拽上传 DEM (.tif)</p>
          <el-button type="primary" @click="triggerFileInput">选择文件</el-button>
        </div>
        <div v-else class="file-selected">
          <div class="file-info"><i class="el-icon-document"></i>{{ selectedFile.name }}</div>
          <el-button size="small" type="danger" @click="resetFileSelection">移除</el-button>
        </div>
      </div>
  
      <!-- 2. 风机点上传 -->
      <div v-if="tifData && !isLoading" class="upload-area turbine-area">
        <input ref="turbineFileInput" type="file" style="display:none"
               accept=".txt,.xls,.xlsx" @change="handleTurbineUpload"/>
        <div v-if="!turbines.length" class="upload-hint">
          <i class="el-icon-upload"></i><p>导入风机坐标 (txt / excel)</p>
          <el-button size="small" @click="turbineFileInput.click()">选择文件</el-button>
        </div>
        <div v-else class="file-selected">
          <div class="file-info"><i class="el-icon-document"></i>已导入 {{ turbines.length }} 台风机</div>
          <el-button size="small" type="danger" @click="clearTurbines">清除</el-button>
        </div>
      </div>
  
      <!-- 3. 进度对话框 -->
      <el-dialog v-model="isLoading" :show-close="false" :close-on-click-modal="false"
                 :close-on-press-escape="false" width="300px" center>
        <div class="loading-content">
          <el-progress type="circle" :percentage="loadingProgress"/>
          <p>{{ loadingMessage }}</p>
        </div>
      </el-dialog>
  
      <!-- 4. 预览 / 裁切 -->
      <div v-if="selectedFile && tifData" class="preview-section">
        <h3>预览与裁切</h3>
        <div class="preview-container">
          <!-- 4-1 预览图 -->
          <div class="preview-image-container" ref="previewContainer">
            <canvas ref="previewCanvas" @mousedown="startDragging"></canvas>
            <!-- 裁切框 -->
            <div v-if="showClippingBox" class="clipping-box"
                 :style="{left:clippingBox.x+'px',top:clippingBox.y+'px',
                          width:clippingBox.size+'px',height:clippingBox.size+'px'}"
                 @mousedown="startDragging">
              <div class="resize-handle" @mousedown.stop="startResizing"/>
            </div>
          </div>
  
          <!-- 4-2 信息 / 控制 -->
          <div class="clipping-controls">
            <div class="dem-info">
              <h4>DEM 信息</h4>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="宽度">{{ tifData.width }} px</el-descriptions-item>
                <el-descriptions-item label="高度">{{ tifData.height }} px</el-descriptions-item>
                <el-descriptions-item label="地理范围">
                  经度: {{ formatCoord(tifData.geoBounds.minX) }} – {{ formatCoord(tifData.geoBounds.maxX) }}<br>
                  纬度: {{ formatCoord(tifData.geoBounds.minY) }} – {{ formatCoord(tifData.geoBounds.maxY) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
  
            <div class="clipping-size-control">
              <h4>裁切设置</h4>
              <div class="size-control">
                <label>裁切框大小 (像素)</label>
                <el-slider v-model="clippingBox.size" :min="minClippingSize" :max="maxClippingSize"
                           :step="10" @input="adjustClippingBoxPosition" show-stops/>
              </div>
  
              <div class="clipping-coordinates">
                <h5>裁切区域 (地理坐标)</h5>
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="西南角">
                    {{ formatCoord(clippingCoordinates.minX) }},
                    {{ formatCoord(clippingCoordinates.minY) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="东北角">
                    {{ formatCoord(clippingCoordinates.maxX) }},
                    {{ formatCoord(clippingCoordinates.maxY) }}
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
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
  import { ElMessage } from 'element-plus';
  import * as GeoTIFF from 'geotiff';
  import * as XLSX from 'xlsx';   // npm i xlsx
  
  /* ---------------- 1. 通用状态 ---------------- */
  const selectedFile = ref(null);
  const isDragging   = ref(false);
  const isLoading    = ref(false);
  const loadingProgress = ref(0);
  const loadingMessage  = ref('');
  
  /* ---------------- 2. DEM ---------------- */
  const tifData         = ref(null);
  const previewCanvas   = ref(null);
  const previewContainer= ref(null);
  const fileInput       = ref(null);
  
  /* ---------------- 3. 裁切框 ---------------- */
  const showClippingBox = ref(false);
  const clippingBox     = reactive({x:0,y:0,size:200});
  const minClippingSize = ref(50);
  const maxClippingSize = ref(500);
  const isDraggingBox   = ref(false);
  const isResizing      = ref(false);
  const dragOffset      = reactive({x:0,y:0});
  const initialBox      = reactive({x:0,y:0,size:0,mouseX:0,mouseY:0});
  
  /* ---------------- 4. 风机 ---------------- */
  const turbineFileInput = ref(null);
  const turbines = ref([]);
  
  /* ---------------- 5. 经纬度⇄像素 (已修复) ---------------- */
  const clippingCoordinates = computed(()=>{
    if (!tifData.value || !tifData.value.geoBounds)      // DEM 未加载
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  
    const canvas = previewCanvas.value;
    if (!canvas || !canvas.width || !canvas.height)       // 画布尚未挂载
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  
    const g = tifData.value.geoBounds;
    const lonPerPx = (g.maxX - g.minX) / canvas.width;
    const latPerPx = (g.maxY - g.minY) / canvas.height; // Note: GeoTIFF origin is usually top-left, latitude increases downwards in pixel space if maxY > minY.
  
    const minLon = g.minX + clippingBox.x * lonPerPx;
    const maxLon = minLon + clippingBox.size * lonPerPx;
    
    // Pixel Y is from top. Geo Y can be from bottom or top.
    // Assuming standard GeoTIFF: geoBounds.minY is bottom, geoBounds.maxY is top.
    // Pixel y=0 corresponds to geoBounds.maxY
    const maxLat = g.maxY - clippingBox.y * latPerPx; 
    const minLat = maxLat - clippingBox.size * latPerPx;
  
    return {minX:minLon,minY:minLat,maxX:maxLon,maxY:maxLat};
  });
  const formatCoord = v => typeof v === 'number' ? v.toFixed(6) : 'N/A';
  
  /* =======================================================================
     6. DEM 读取与预览
  ======================================================================= */
  const triggerFileInput = ()=>fileInput.value?.click();
  const onDragOver = e=>{isDragging.value=true;e.dataTransfer.dropEffect='copy';};
  const handleFileDrop=e=>{isDragging.value=false;e.dataTransfer.files[0]&&processSelectedFile(e.dataTransfer.files[0]);};
  const handleFileUpload=e=>{e.target.files[0]&&processSelectedFile(e.target.files[0]);};
  
  const resetFileSelection=()=>{
    selectedFile.value=null;tifData.value=null;turbines.value=[];
    showClippingBox.value=false;
    if (fileInput.value) fileInput.value.value=''; // Check for null before accessing value
    if (turbineFileInput.value) turbineFileInput.value.value=''; // Check for null
    const ctx = previewCanvas.value?.getContext('2d');
    if (ctx && previewCanvas.value) {
      ctx.clearRect(0,0,previewCanvas.value.width,previewCanvas.value.height);
    }
  };
  
  async function processSelectedFile(file){
    if(!/\.tif{1,2}$/i.test(file.name)){ElMessage.error('请选择 TIF 文件');return;}
    selectedFile.value=file;
    isLoading.value=true;loadingProgress.value=0;loadingMessage.value='加载 DEM…';
    try{await readTifForPreview(file);}catch(e){ElMessage.error(e.message || '读取TIF文件失败');resetFileSelection();}
    finally{isLoading.value=false;}
  }
  
  const readFileAB=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=err=>rej(err);r.readAsArrayBuffer(f);});
  
  async function readTifForPreview(file){
    const ab=await readFileAB(file);loadingProgress.value=20;
    const tiff=await GeoTIFF.fromArrayBuffer(ab);
    const img=await tiff.getImage();loadingProgress.value=40;
    const width=img.getWidth(),height=img.getHeight();
    const gb=img.getBoundingBox(),nodata=img.getGDALNoData(); // gb is [minX, minY, maxX, maxY]
    const dem = (await img.readRasters({ samples:[0] }))[0];
    
    let min=Infinity,max=-Infinity;
    // Ensure dem is iterable and not undefined
    if (dem && typeof dem[Symbol.iterator] === 'function') {
      for(const v of dem) {
          if(v !== nodata && !isNaN(v)){
              min=Math.min(min,v);
              max=Math.max(max,v);
          }
      }
    }
    if(min===Infinity) min=max=0; // Handle case where all data is nodata or no data
  
    tifData.value={
      width,height,
      geoBounds:{minX:gb[0],minY:gb[1],maxX:gb[2],maxY:gb[3]},
      minMaxValues:{min,max},
      demDataForPreview:dem, // This is a TypedArray
      gdalNoData:nodata
    };
  
    await nextTick();
    await renderPreview();
    initializeClippingTool();
    loadingProgress.value=100;loadingMessage.value='预览完成';
  }
  
  /* 6.1 绘制预览 (含风机点 - 采纳修改意见版本) */
  async function renderPreview(){
    if(!tifData.value || !previewCanvas.value || !previewContainer.value) return;
    const cvs = previewCanvas.value, ctx = cvs.getContext('2d');
    const contW = previewContainer.value.clientWidth;
    const ar = tifData.value.width / tifData.value.height;
    cvs.width  = contW;
    cvs.height = contW / ar;
  
    const {demDataForPreview:data,width:dw,height:dh,
           gdalNoData:nodata,minMaxValues:{min,max}} = tifData.value;
    const rng = (max - min) || 1; // Avoid division by zero
  
    const imgData = ctx.createImageData(cvs.width, cvs.height);
    const pix = imgData.data;
  
    const bilinear = (x_img, y_img)=>{ // x_img, y_img are fractional pixel coords in DEM
      const x1=Math.floor(x_img),y1=Math.floor(y_img);
      const x2=Math.min(x1+1,dw-1),y2=Math.min(y1+1,dh-1);
      const fx=x_img-x1,fy=y_img-y1;
  
      // Get values from 1D DEM data array
      const q11_val = data[y1*dw+x1];
      const q21_val = data[y1*dw+x2];
      const q12_val = data[y2*dw+x1];
      const q22_val = data[y2*dw+x2];
      
      if([q11_val,q21_val,q12_val,q22_val].some(v=>v===nodata||isNaN(v))) return nodata;
      
      const r1 = (1-fx)*q11_val + fx*q21_val;
      const r2 = (1-fx)*q12_val + fx*q22_val;
      return (1-fy)*r1 + fy*r2;
    };
  
    const ramp = v=>{ // Renamed from clr as per suggestion
      if(v===nodata||isNaN(v)) return [0,0,0,0]; // RGBA for transparent
      const t = (v-min)/rng;
      // Color stops: [threshold, [R,G,B]]
      const s=[[0,[25,60,23]],[.2,[43,87,58]],[.4,[82,125,84]],[.6,[196,164,132]],[.8,[139,69,19]],[1,[245,245,245]]];
      
      let i=0;
      // Find the segment t falls into
      // Make sure we don't go out of bounds with s[i+1]
      while(i < s.length - 2 && t > s[i+1][0]) {
          i++;
      }
      
      const [t0, c0_arr] = s[i];
      const [t1, c1_arr] = s[i+1];
      
      // Normalize t within the segment
      const k = (t1 - t0 === 0) ? 0 : (t - t0) / (t1 - t0); // Avoid division by zero if t0=t1
      
      const r = Math.round(c0_arr[0] + k * (c1_arr[0] - c0_arr[0]));
      const g = Math.round(c0_arr[1] + k * (c1_arr[1] - c0_arr[1]));
      const b = Math.round(c0_arr[2] + k * (c1_arr[2] - c0_arr[2]));
      
      return [r,g,b,255]; // RGBA
    };
  
    for(let y_cvs=0; y_cvs < cvs.height; y_cvs++){ // y in canvas pixels
      for(let x_cvs=0; x_cvs < cvs.width; x_cvs++){ // x in canvas pixels
        // Map canvas pixel to DEM fractional pixel
        const dem_x = (x_cvs / cvs.width) * dw;
        const dem_y = (y_cvs / cvs.height) * dh;
        
        const elev_val = bilinear(dem_x, dem_y);
        const color_arr  = ramp(elev_val);
        const idx=(y_cvs * cvs.width + x_cvs) * 4;
        pix[idx  ] = color_arr[0]; // R
        pix[idx+1] = color_arr[1]; // G
        pix[idx+2] = color_arr[2]; // B
        pix[idx+3] = color_arr[3]; // A
      }
    }
    ctx.putImageData(imgData,0,0);
  
    if(turbines.value.length) drawTurbinePoints(ctx);   // 再判一次 (as per suggestion)
  }
  
  
  function drawTurbinePoints(ctx){
    if (!tifData.value || !tifData.value.geoBounds || !previewCanvas.value) return; // Defensive checks
    const g=tifData.value.geoBounds,cw=previewCanvas.value.width,ch=previewCanvas.value.height;
    ctx.save();ctx.fillStyle='#ff0000';ctx.strokeStyle='#fff';ctx.lineWidth=1;
    turbines.value.forEach(t=>{
      // Convert lon/lat to canvas pixel coordinates
      // X pixel: (lon - minLon) / (maxLon - minLon) * canvasWidth
      const x_pixel = (t.lon - g.minX) / (g.maxX - g.minX) * cw;
      // Y pixel: (maxLat - lat) / (maxLat - minLat) * canvasHeight (since canvas Y is top-down)
      const y_pixel = (g.maxY - t.lat) / (g.maxY - g.minY) * ch;
      
      ctx.beginPath();ctx.arc(x_pixel, y_pixel, 4, 0, Math.PI*2);ctx.fill();ctx.stroke();
    });ctx.restore();
  }
  
  /* 6.2 裁切框 */
  function initializeClippingTool(){
    const cvs=previewCanvas.value;
    if (!cvs) return; // Guard against null canvas
    maxClippingSize.value=Math.min(cvs.width,cvs.height);
    clippingBox.size=Math.max(minClippingSize.value,Math.min(clippingBox.size,maxClippingSize.value/2));
    centerClippingBox();showClippingBox.value=true;
  }
  const centerClippingBox=()=>{
      const c=previewCanvas.value;
      if (!c) return;
      clippingBox.x=(c.width-clippingBox.size)/2;
      clippingBox.y=(c.height-clippingBox.size)/2;
  };
  const adjustClippingBoxPosition=()=>{
    const c=previewCanvas.value;
    if (!c) return;
    clippingBox.size=Math.min(clippingBox.size,c.width,c.height); // Ensure size isn't > canvas
    clippingBox.x=Math.max(0,Math.min(clippingBox.x,c.width -clippingBox.size));
    clippingBox.y=Math.max(0,Math.min(clippingBox.y,c.height-clippingBox.size));
  };
  const startDragging=e=>{
    if(isResizing.value||!showClippingBox.value || !previewCanvas.value) return;
    const r=previewCanvas.value.getBoundingClientRect();
    const cx=e.clientX-r.left;
    const cy=e.clientY-r.top;
    // Check if click is inside the clipping box
    if(cx>=clippingBox.x&&cx<=clippingBox.x+clippingBox.size&&cy>=clippingBox.y&&cy<=clippingBox.y+clippingBox.size){
      isDraggingBox.value=true;
      dragOffset.x=cx-clippingBox.x;
      dragOffset.y=cy-clippingBox.y;
      document.addEventListener('mousemove',onDrag);
      document.addEventListener('mouseup',stopDragging);
    }
  };
  const onDrag=e=>{
    if(!isDraggingBox.value || !previewCanvas.value) return;
    const r=previewCanvas.value.getBoundingClientRect();
    let newX = e.clientX - r.left - dragOffset.x;
    let newY = e.clientY - r.top - dragOffset.y;
  
    // Constrain dragging within canvas boundaries
    clippingBox.x=Math.max(0,Math.min(newX, previewCanvas.value.width - clippingBox.size));
    clippingBox.y=Math.max(0,Math.min(newY, previewCanvas.value.height- clippingBox.size));
  };
  const stopDragging=()=>{
      isDraggingBox.value=false;
      document.removeEventListener('mousemove',onDrag);
      document.removeEventListener('mouseup',stopDragging);
  };
  const startResizing=e=>{
    if (!previewCanvas.value) return;
    isResizing.value=true;
    Object.assign(initialBox,{...clippingBox,mouseX:e.clientX,mouseY:e.clientY}); // Store initial state
    document.addEventListener('mousemove',onResize);
    document.addEventListener('mouseup',stopResizing);
  };
  const onResize=e=>{
    if(!isResizing.value || !previewCanvas.value) return;
    // For simplicity, only allowing resize from bottom-right (nwse-resize cursor)
    // Change in mouse X position determines new size
    let deltaX = e.clientX - initialBox.mouseX;
    // let deltaY = e.clientY - initialBox.mouseY; // Can use for aspect ratio or diagonal resize
    let newSize = initialBox.size + deltaX; // Or use Math.max(deltaX, deltaY) for square aspect
  
    const c = previewCanvas.value;
    // Max size constraint based on current box position and canvas dimensions
    const dynamicMaxWidth = c.width - initialBox.x;
    const dynamicMaxHeight = c.height - initialBox.y;
    const dynamicMaxSize = Math.min(dynamicMaxWidth, dynamicMaxHeight);
    
    clippingBox.size = Math.max(minClippingSize.value, Math.min(dynamicMaxSize, newSize));
  };
  const stopResizing=()=>{
      isResizing.value=false;
      document.removeEventListener('mousemove',onResize);
      document.removeEventListener('mouseup',stopResizing);
  };
  
  /* 6.3 裁切请求 */
  async function performClipping(){
    if(!selectedFile.value) { ElMessage.warning('请先选择 DEM 文件'); return; }
    if (!clippingCoordinates.value || 
        clippingCoordinates.value.minX === undefined || // Check if coordinates are valid
        clippingCoordinates.value.maxX <= clippingCoordinates.value.minX ||
        clippingCoordinates.value.maxY <= clippingCoordinates.value.minY) {
      ElMessage.error('裁切区域无效，请调整裁切框');
      return;
    }
  
    isLoading.value=true;loadingProgress.value=0;loadingMessage.value='准备裁切…';
    try{
      const {minX,minY,maxX,maxY}=clippingCoordinates.value;
      const fd=new FormData();
      fd.append('demFile',selectedFile.value);
      fd.append('minX',minX.toString()); // Ensure string for FormData
      fd.append('minY',minY.toString());
      fd.append('maxX',maxX.toString());
      fd.append('maxY',maxY.toString());
      loadingProgress.value=20;loadingMessage.value='上传并裁切…';
      
      // Replace with your actual API endpoint
      const res=await fetch('http://localhost:5000/api/dem/clip',{method:'POST',body:fd});
      loadingProgress.value=60;
      
      if(!res.ok) {
          const errorText = await res.text();
          throw new Error(`服务器错误: ${res.status} ${errorText || res.statusText}`);
      }
      
      const json=await res.json();loadingProgress.value=90;
      if(json.success && json.data && json.data.downloadUrl){ // Check json.data existence
        // Ensure the download URL is complete or prefix with base URL if it's relative
        let downloadUrl = json.data.downloadUrl;
        if (!downloadUrl.startsWith('http')) {
            downloadUrl = `http://localhost:5000${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
        }
        window.location.href = downloadUrl;
        ElMessage.success('裁切完成，开始下载');
      }else {
          throw new Error(json.message || '后端返回格式不正确或操作失败');
      }
      loadingProgress.value=100;
    }catch(e){
        ElMessage.error('裁切失败: '+ (e.message || '未知错误'));
        console.error("Clipping error:", e);
    }
    finally{isLoading.value=false;}
  }
  
  /* =======================================================================
     7. 风机文件解析 + 越界校验
  ======================================================================= */
  const handleTurbineUpload=e=>{
    const f=e.target.files[0];
    if(!f){ ElMessage.warning('未选择文件'); return; }
    
    const name=f.name.toLowerCase();
    if(name.endsWith('.txt')) readTurbineTxt(f);
    else if(name.endsWith('.xls')||name.endsWith('.xlsx')) readTurbineExcel(f);
    else ElMessage.error('仅支持 txt / xls / xlsx 格式的风机文件');
    
    if (turbineFileInput.value) turbineFileInput.value.value = ''; // Reset file input
  };
  
  async function readTurbineTxt(file){
      try {
          const text = await file.text();
          parseTurbineLines(text.split(/\r?\n/));
      } catch (error) {
          ElMessage.error('读取 TXT 文件失败: ' + error.message);
      }
  }
  function readTurbineExcel(file){
    const r=new FileReader();
    r.onload=e=>{
      try {
          const wb=XLSX.read(e.target.result,{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}); // header:1 gives array of arrays
          parseTurbineLines(arr.map(row => Array.isArray(row) ? row.join('\t') : '')); // Convert each row array to a tab-separated string
      } catch (error) {
          ElMessage.error('解析 Excel 文件失败: ' + error.message);
      }
    };
    r.onerror = (error) => {
      ElMessage.error('读取 Excel 文件失败: ' + error.message);
    };
    r.readAsArrayBuffer(file);
  }
  
  function parseTurbineLines(lines){
    if(!tifData.value || !tifData.value.geoBounds){ElMessage.error('请先加载 DEM 文件');return;}
    const res=[];
    const g=tifData.value.geoBounds;
    let hasOutOfBounds = false;
    let outOfBoundsCount = 0;
  
    lines.forEach((l, index)=>{
      const lineContent = l.trim();
      if(!lineContent) return; // Skip empty lines
  
      const p=lineContent.split(/\s+/); // Split by any whitespace
      if(p.length < 3) {
          console.warn(`第 ${index + 1} 行格式不正确，跳过: ${l}`);
          return;
      }
      const name = p[0];
      const lon = parseFloat(p[1]);
      const lat = parseFloat(p[2]);
  
      if(isNaN(lon) || isNaN(lat)){
          console.warn(`第 ${index + 1} 行坐标无效，跳过: ${l}`);
          return;
      }
      
      // 越界校验 (per point)
      if(lon < g.minX || lon > g.maxX || lat < g.minY || lat > g.maxY){
        console.warn(`风机 ${name} (${lon}, ${lat}) 超出 DEM 范围 [${g.minX}-${g.maxX}, ${g.minY}-${g.maxY}]`);
        hasOutOfBounds = true;
        outOfBoundsCount++;
        return; // Do not add out-of-bounds turbines
      }
      res.push({name:name,lon:lon,lat:lat});
    });
    
    if(hasOutOfBounds){
      ElMessage.warning(`${outOfBoundsCount} 台风机坐标超出 DEM 范围，已被忽略。`);
    }
  
    if(!res.length && !hasOutOfBounds){ // No valid turbines found and no out-of-bounds ones
      ElMessage.error('未解析到有效风机坐标。请检查文件格式：每行应为 "名称 经度 纬度"，以空格或制表符分隔。');
      return;
    }
    if (!res.length && hasOutOfBounds && outOfBoundsCount === lines.filter(l => l.trim()).length) { // All turbines were out of bounds
       ElMessage.error('所有风机坐标均超出 DEM 范围，未导入任何风机。');
       return;
    }
  
  
    turbines.value=res;
    if (res.length > 0) {
      ElMessage.success(`成功导入 ${res.length} 台风机`);
    }
    renderPreview(); // Re-render preview with new turbines
  }
  const clearTurbines=()=>{
      turbines.value=[];
      renderPreview(); // Re-render to remove turbine points
      ElMessage.info('已清除所有风机点');
  };
  
  /* =======================================================================
     8. 事件
  ======================================================================= */
  const handleResize=()=> {
      if (tifData.value && previewCanvas.value && previewContainer.value) {
          renderPreview(); // Re-render on window resize
          // Adjust clipping box if necessary, e.g. if it becomes too large for new canvas size
          if (showClippingBox.value) {
              initializeClippingTool(); // Recalculate max size and recenter or adjust
          }
      }
  };
  
  onMounted(()=>{
      window.addEventListener('resize',handleResize);
  });
  
  onBeforeUnmount(()=>{
    window.removeEventListener('resize',handleResize);
    // Clean up global event listeners for dragging/resizing if they are active
    document.removeEventListener('mousemove',onDrag);
    document.removeEventListener('mouseup',stopDragging);
    document.removeEventListener('mousemove',onResize);
    document.removeEventListener('mouseup',stopResizing);
  });
  </script>
  
  <style scoped>
  @import url("//unpkg.com/element-plus/dist/index.css");
  
  /* 样式保持与 v11 相同 … */
  .terrain-clipping-container{max-width:1200px;margin:20px auto;padding:20px;background:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);}
  h2{text-align:center;margin-bottom:24px;font-size:1.8em;color:#303133;}
  h3,h4,h5{margin-top:24px;margin-bottom:16px;color:#303133;}h3{font-size:1.5em;}h4{font-size:1.2em;}
  
  .upload-area{border:2px dashed #dcdfe6;border-radius:8px;padding:40px;text-align:center;transition:.3s;background:#f9fafc;cursor:pointer;margin-top:16px;}
  .upload-area:hover,.upload-area.is-active{border-color:#409EFF;background:#f0f7ff;}
  .turbine-area{background:#fff8e5;} /* Light yellow for distinction */
  .upload-hint{display:flex;flex-direction:column;align-items:center;gap:16px;color:#606266;}
  .upload-hint i{font-size:48px;color:#c0c4cc;margin-bottom:8px;} /* Element Plus icon class */
  .file-selected{display:flex;align-items:center;justify-content:space-between;padding:10px;background:#eef6ff;border-radius:4px;}
  .file-info{display:flex;align-items:center;gap:8px;font-weight:500;color:#303133;}
  .file-info i{font-size:20px;color:#409EFF;} /* Element Plus icon class */
  
  .preview-section{margin-top:40px;padding-top:20px;border-top:1px solid #ebeef5;}
  .preview-container{display:flex;flex-wrap:wrap;gap:24px;margin-top:16px;}
  
  .preview-image-container{position:relative;flex:1 1 500px;min-width:300px;border:1px solid #e4e7ed;border-radius:4px;overflow:hidden;background:#f5f7fa; align-self: flex-start;}
  .preview-image-container canvas{display:block;width:100%;height:auto; background-color: #eee;}
  
  .clipping-controls{flex:1 1 300px;min-width:280px;display:flex;flex-direction:column;gap:24px;}
  .dem-info, .clipping-size-control { background-color: #fdfdfd; padding: 15px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);}
  .size-control{display:flex;flex-direction:column;gap:8px;margin:16px 0;}
  .action-buttons{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;}
  
  .clipping-box{position:absolute;border:2px dashed #f56c6c;background:rgba(245,108,108,.15);cursor:move;box-sizing:border-box;}
  .resize-handle{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#f56c6c;border:1px solid #fff;border-radius:50%;cursor:nwse-resize;}
  
  .loading-content{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;}
  .loading-content p{margin-top:20px;font-size:1.1em;color:#303133;}
  
  /* Element UI Icon classes (if not globally available, might need specific import or CDN) */
  .el-icon-upload::before { content: "📤"; /* Placeholder, use actual Element icon content or SVG */}
  .el-icon-document::before { content: "📄"; /* Placeholder */ }
  </style>