/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-17 00:19:57
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-05 19:51:17
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\demClipper.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// routes/demClipper.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const gdal = require('gdal-async');
const { v4: uuidv4 } = require('uuid');

const CHINA_DEM_ROOT = path.join(__dirname, '../China_Dem');
const DEM_INDEX_PATH = path.join(__dirname, '../../temp/china_dem_index.json');
let chinaDemIndexCache = null;
let chinaDemIndexBuildPromise = null;

const listTifFilesRecursive = async (dir) => {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listTifFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.tif' || ext === '.tiff') results.push(fullPath);
    }
  }
  return results;
};

const computeDatasetBounds = (ds) => {
  const gt = ds.geoTransform;
  if (!gt || gt.length !== 6) return null;

  const originX = gt[0];
  const pixelWidth = gt[1];
  const originY = gt[3];
  const pixelHeight = gt[5];
  const width = ds.rasterSize.x;
  const height = ds.rasterSize.y;

  const x1 = originX;
  const y1 = originY;
  const x2 = originX + pixelWidth * width;
  const y2 = originY + pixelHeight * height;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return { minX, minY, maxX, maxY };
};

const intersects = (a, b) => {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
};

const ensureChinaDemIndex = async () => {
  if (chinaDemIndexCache) return chinaDemIndexCache;
  if (chinaDemIndexBuildPromise) return chinaDemIndexBuildPromise;

  chinaDemIndexBuildPromise = (async () => {
    try {
      if (await fs.pathExists(DEM_INDEX_PATH)) {
        const cached = await fs.readJson(DEM_INDEX_PATH);
        if (Array.isArray(cached) && cached.length > 0) {
          chinaDemIndexCache = cached;
          return chinaDemIndexCache;
        }
      }
    } catch (err) {
      console.warn('[DEM] 读取 china_dem_index.json 失败，将重建索引:', err.message);
    }

    if (!await fs.pathExists(CHINA_DEM_ROOT)) {
      throw new Error(`China_Dem 数据目录不存在: ${CHINA_DEM_ROOT}`);
    }

    const files = await listTifFilesRecursive(CHINA_DEM_ROOT);
    if (!files.length) {
      throw new Error(`China_Dem 目录下未找到任何 tif: ${CHINA_DEM_ROOT}`);
    }

    console.log(`[DEM] 正在构建 China_Dem 索引，共 ${files.length} 个 tif...`);
    const index = [];
    for (const filePath of files) {
      let ds = null;
      try {
        ds = await gdal.openAsync(filePath);
        const bounds = computeDatasetBounds(ds);
        if (!bounds) continue;
        index.push({
          path: filePath,
          bounds,
        });
      } catch (err) {
        console.warn(`[DEM] 读取 DEM 元信息失败，将跳过: ${filePath} (${err.message})`);
      } finally {
        try { ds?.close?.(); } catch {}
      }
    }

    await fs.ensureDir(path.dirname(DEM_INDEX_PATH));
    await fs.writeJson(DEM_INDEX_PATH, index, { spaces: 2 });
    console.log(`[DEM] China_Dem 索引构建完成: ${index.length} 条，已写入 ${DEM_INDEX_PATH}`);
    chinaDemIndexCache = index;
    return chinaDemIndexCache;
  })();

  try {
    return await chinaDemIndexBuildPromise;
  } finally {
    chinaDemIndexBuildPromise = null;
  }
};

const mosaicClipChinaDemByBounds = async ({ minX, minY, maxX, maxY, maxSources = 200 }) => {
  const bounds = { minX, minY, maxX, maxY };
  const index = await ensureChinaDemIndex();
  const sources = index
    .filter(item => item && item.path && item.bounds && intersects(item.bounds, bounds))
    .map(item => item.path);

  if (!sources.length) {
    const err = new Error('未找到覆盖该范围的 China_Dem 数据（范围可能超出数据覆盖区）');
    err.statusCode = 404;
    throw err;
  }

  if (sources.length > maxSources) {
    const err = new Error(`匹配到 ${sources.length} 个 DEM 分片，超过上限 ${maxSources}；请缩小范围后重试。`);
    err.statusCode = 413;
    throw err;
  }

  const outputId = uuidv4();
  const outputDir = path.join(__dirname, '../../clipped');
  await fs.ensureDir(outputDir);
  const outputFilePath = path.join(outputDir, `clipped_${outputId}.tif`);

  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const vrtPath = path.join(tempDir, `dem_mosaic_${outputId}.vrt`);

  let vrtDs = null;
  let outDs = null;
  try {
    // Build VRT (mosaic) then clip to bounds in georeferenced coordinates
    vrtDs = await gdal.buildVRTAsync(vrtPath, sources, ['-resolution', 'highest']);
    outDs = await gdal.translateAsync(outputFilePath, vrtDs, [
      '-projwin', String(minX), String(maxY), String(maxX), String(minY),
      '-of', 'GTiff',
      '-co', 'COMPRESS=DEFLATE',
      '-co', 'TILED=YES',
      '-co', 'BIGTIFF=IF_NEEDED'
    ]);
  } finally {
    try { outDs?.close?.(); } catch {}
    try { vrtDs?.close?.(); } catch {}
    fs.remove(vrtPath).catch(() => {});
  }

  return {
    outputId,
    outputFilePath,
    sourceCount: sources.length,
    sources,
    bounds,
  };
};

// 设置文件上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/tiff' || 
        path.extname(file.originalname).toLowerCase() === '.tif' ||
        path.extname(file.originalname).toLowerCase() === '.tiff') {
      cb(null, true);
    } else {
      cb(new Error('只接受 TIFF/GeoTIFF 文件!'), false);
    }
  },
  limits: {
    // 与前端 Nginx/terrain 上传策略对齐，避免大文件裁切被错误拒绝
    fileSize: 500 * 1024 * 1024, // 500MB
  }
});

// 上传并裁切DEM文件
router.post('/clip', upload.single('demFile'), async (req, res, next) => {
  let srcDataset = null;
  let outputDataset = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    // 从请求体获取裁切参数
    const { minX, minY, maxX, maxY } = req.body;

    // 验证参数（允许 0）
    const requiredCoords = { minX, minY, maxX, maxY };
    for (const [key, value] of Object.entries(requiredCoords)) {
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({
          success: false,
          message: '缺少裁切坐标参数 (minX, minY, maxX, maxY)'
        });
      }
    }

    const minXNum = Number(minX);
    const minYNum = Number(minY);
    const maxXNum = Number(maxX);
    const maxYNum = Number(maxY);

    if (![minXNum, minYNum, maxXNum, maxYNum].every(Number.isFinite)) {
      return res.status(400).json({
        success: false,
        message: '裁切坐标参数必须是有效的数字 (minX, minY, maxX, maxY)'
      });
    }

    // 源文件和目标文件路径
    const srcFilePath = req.file.path;
    const outputId = uuidv4();
    const outputDir = path.join(__dirname, '../../clipped');
    fs.ensureDirSync(outputDir);
    const outputFilePath = path.join(outputDir, `clipped_${outputId}.tif`);

    console.log('裁切参数:', { minX: minXNum, minY: minYNum, maxX: maxXNum, maxY: maxYNum });
    console.log('源文件:', srcFilePath);
    console.log('目标文件:', outputFilePath);

    // 使用GDAL执行裁切
    srcDataset = await gdal.openAsync(srcFilePath);
    
    // 获取源投影和地理变换
    let srcProjection = null;
    try {
      // gdal-async 的 SpatialReference 使用 toWKT() 导出
      srcProjection = srcDataset.srs && typeof srcDataset.srs.toWKT === 'function'
        ? srcDataset.srs.toWKT()
        : null;
      console.log('源文件投影:', srcProjection ? '有效' : '无效或未定义');
    } catch (err) {
      console.warn('获取源文件投影失败:', err.message);
      srcProjection = null;
    }

    const geoTransform = srcDataset.geoTransform;
    console.log('地理变换:', geoTransform);

    if (!geoTransform || geoTransform.length !== 6) {
      throw new Error('源文件缺少有效的地理变换信息');
    }

    // 计算裁切区域在像素坐标中的位置
    // geoTransform: [originX, pixelWidth, 0, originY, 0, pixelHeight]
    const originX = geoTransform[0];
    const originY = geoTransform[3];
    const pixelWidth = geoTransform[1];
    const pixelHeight = geoTransform[5]; // 通常是负值

    // 计算像素位置
    const xOffset = Math.floor((minXNum - originX) / pixelWidth);
    const yOffset = Math.floor((maxYNum - originY) / pixelHeight);
    const clipWidth = Math.ceil((maxXNum - minXNum) / pixelWidth);
    const clipHeight = Math.ceil((maxYNum - minYNum) / Math.abs(pixelHeight));

    console.log('裁切区域(像素):', { 
      xOffset, yOffset, clipWidth, clipHeight 
    });

    // 验证裁切区域是否有效
    if (xOffset < 0 || yOffset < 0 || 
        clipWidth <= 0 || clipHeight <= 0 || 
        xOffset + clipWidth > srcDataset.rasterSize.x || 
        yOffset + clipHeight > srcDataset.rasterSize.y) {
      throw new Error('裁切区域超出源文件范围或无效');
    }

    // 创建输出数据集
    const driver = gdal.drivers.get('GTiff');
    const bandCount = srcDataset.bands.count();
    const dataType = srcDataset.bands.get(1).dataType;
    
    console.log('源文件信息:', {
      bandCount: bandCount,
      dataType: dataType,
      rasterSize: srcDataset.rasterSize
    });

    // 创建输出数据集前检查参数
    if (clipWidth <= 0 || clipHeight <= 0) {
      throw new Error(`无效的裁切尺寸: ${clipWidth}x${clipHeight}`);
    }

    // 创建包含创建选项的输出数据集
    const creationOptions = [
      'COMPRESS=DEFLATE',
      'TILED=YES',
      'BIGTIFF=IF_NEEDED'
    ];
    
    outputDataset = await driver.createAsync(
      outputFilePath, 
      clipWidth, 
      clipHeight, 
      bandCount,
      dataType,
      creationOptions
    );

    // 设置输出数据集的投影和地理变换
    // 只有当源数据集有有效的空间参考时才设置
    if (srcProjection) {
      try {
        outputDataset.srs = new gdal.SpatialReference(srcProjection);
        console.log('已设置输出文件投影');
      } catch (err) {
        console.warn('设置输出投影失败:', err.message);
      }
    } else {
      console.warn('源文件无有效投影信息，输出文件将不包含投影信息');
    }
    
    // 新的geoTransform，原点移到裁切区域的左上角
    const newOriginX = originX + xOffset * pixelWidth;
    const newOriginY = originY + yOffset * pixelHeight;
    const newGeoTransform = [
      newOriginX, pixelWidth, 0,
      newOriginY, 0, pixelHeight
    ];
    
    outputDataset.geoTransform = newGeoTransform;
    console.log('已设置输出文件地理变换:', newGeoTransform);

    // 复制元数据
    try {
      const metadata = srcDataset.getMetadata();
      for (const key in metadata) {
        if (metadata.hasOwnProperty(key)) {
          outputDataset.setMetadata(key, metadata[key]);
        }
      }
      console.log('已复制元数据');
    } catch (err) {
      console.warn('复制元数据失败:', err.message);
    }

    // 复制NoData值和其他波段信息
    for (let i = 1; i <= bandCount; i++) {
      const srcBand = srcDataset.bands.get(i);
      const dstBand = outputDataset.bands.get(i);
      
      // 复制NoData值
      try {
        const noData = srcBand.noDataValue;
        if (noData !== null && noData !== undefined) {
          dstBand.noDataValue = noData;
          console.log(`波段 ${i} 设置 NoData 值:`, noData);
        }
      } catch (err) {
        console.warn(`设置波段 ${i} NoData 值失败:`, err.message);
      }
      
      // 复制波段元数据
      try {
        const bandMetadata = srcBand.getMetadata();
        for (const key in bandMetadata) {
          if (bandMetadata.hasOwnProperty(key)) {
            dstBand.setMetadata(key, bandMetadata[key]);
          }
        }
      } catch (err) {
        console.warn(`复制波段 ${i} 元数据失败:`, err.message);
      }
      
      // 复制颜色解释
      try {
        dstBand.colorInterpretation = srcBand.colorInterpretation;
      } catch (err) {
        console.warn(`设置波段 ${i} 颜色解释失败:`, err.message);
      }
    }

    // 执行数据复制
    console.log('开始复制栅格数据...');
    
    // 逐波段复制数据
    for (let i = 1; i <= bandCount; i++) {
      const srcBand = srcDataset.bands.get(i);
      const dstBand = outputDataset.bands.get(i);
      
      // 读取源数据
      const data = await srcBand.pixels.readAsync(xOffset, yOffset, clipWidth, clipHeight);
      
      // 写入目标数据
      await dstBand.pixels.writeAsync(0, 0, clipWidth, clipHeight, data);
      console.log(`波段 ${i} 数据已复制`);
    }
    
    console.log('数据复制完成');

    // 计算统计信息
    for (let i = 1; i <= bandCount; i++) {
      try {
        const dstBand = outputDataset.bands.get(i);
        await dstBand.computeStatisticsAsync(true);
        console.log(`波段 ${i} 统计信息已计算`);
      } catch (err) {
        console.warn(`计算波段 ${i} 统计信息失败:`, err.message);
      }
    }

    const srcWidth  = srcDataset.rasterSize.x;
    const srcHeight = srcDataset.rasterSize.y;
    const originalBounds = {
    minX: originX,
    minY: originY + pixelHeight * srcHeight,
    maxX: originX + pixelWidth  * srcWidth,
    maxY: originY
    };
    
    // 关闭数据集
    srcDataset.close();
    outputDataset.close();
    
    console.log('数据集已关闭，文件处理完成');
    
    // 创建下载URL
    const downloadUrl = `/api/dem/download/${outputId}`;
    
    // 返回成功响应
    res.status(200).json({
      success: true,
      message: 'DEM裁切成功',
      data: {
        downloadUrl,
        clipInfo: {
          originalBounds,
          clippedBounds: { 
            minX: parseFloat(minX), 
            minY: parseFloat(minY), 
            maxX: parseFloat(maxX), 
            maxY: parseFloat(maxY) 
          },
          width: clipWidth,
          height: clipHeight
        }
      }
    });

    // 清理上传的原始文件
    setTimeout(() => {
      fs.remove(srcFilePath).catch(err => {
        console.error('清理源文件失败:', err);
      });
    }, 1000);

  } catch (error) {
    console.error('DEM裁切错误:', error);
    
    // 确保关闭打开的数据集
    if (srcDataset) {
      try {
        await srcDataset.close();
      } catch (err) {
        console.error('关闭源数据集失败:', err);
      }
    }
    
    if (outputDataset) {
      try {
        await outputDataset.close();
      } catch (err) {
        console.error('关闭输出数据集失败:', err);
      }
    }
    
    // 尝试清理上传的文件
    if (req.file && req.file.path) {
      fs.remove(req.file.path).catch(err => {
        console.error('清理临时文件失败:', err);
      });
    }
    
    next(error);
  }
});

// 无需上传：按 bbox 从内置 China_Dem 自动拼接并裁切
router.post('/mosaic-clip', async (req, res, next) => {
  try {
    const { minX, minY, maxX, maxY, maxSources } = req.body || {};

    const requiredCoords = { minX, minY, maxX, maxY };
    for (const [key, value] of Object.entries(requiredCoords)) {
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({
          success: false,
          message: '缺少裁切坐标参数 (minX, minY, maxX, maxY)'
        });
      }
    }

    const minXNum = Number(minX);
    const minYNum = Number(minY);
    const maxXNum = Number(maxX);
    const maxYNum = Number(maxY);
    const maxSourcesNum = maxSources === undefined || maxSources === null || maxSources === ''
      ? 200
      : Number(maxSources);

    if (![minXNum, minYNum, maxXNum, maxYNum].every(Number.isFinite) || !Number.isFinite(maxSourcesNum)) {
      return res.status(400).json({
        success: false,
        message: '参数必须是有效数字 (minX, minY, maxX, maxY, maxSources)'
      });
    }
    if (minXNum >= maxXNum || minYNum >= maxYNum) {
      return res.status(400).json({ success: false, message: '无效范围：min 必须小于 max' });
    }
    if (maxSourcesNum <= 0) {
      return res.status(400).json({ success: false, message: 'maxSources 必须为正数' });
    }

    const result = await mosaicClipChinaDemByBounds({
      minX: minXNum,
      minY: minYNum,
      maxX: maxXNum,
      maxY: maxYNum,
      maxSources: maxSourcesNum,
    });

    const downloadUrl = `/api/dem/download/${result.outputId}`;
    return res.status(200).json({
      success: true,
      message: 'DEM 拼接裁切成功',
      data: {
        downloadUrl,
        sourceCount: result.sourceCount,
        clipBounds: result.bounds,
      }
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('DEM mosaic-clip 错误:', error);
    next(error);
  }
});

// 无需上传：按中心点+半径（米）自动拼接并裁切 China_Dem
router.post('/download-by-coords', async (req, res, next) => {
  try {
    const { lat, lon, radius, maxSources } = req.body || {};

    const requiredParams = { lat, lon, radius };
    for (const [key, value] of Object.entries(requiredParams)) {
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({ success: false, message: '缺少经纬度或半径参数 (lat, lon, radius)' });
      }
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const radiusNum = Number(radius);
    const maxSourcesNum = maxSources === undefined || maxSources === null || maxSources === ''
      ? 200
      : Number(maxSources);

    if (![latNum, lonNum, radiusNum].every(Number.isFinite) || !Number.isFinite(maxSourcesNum)) {
      return res.status(400).json({ success: false, message: '参数必须是有效的数字' });
    }
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ success: false, message: '经纬度超出有效范围 (lat: -90~90, lon: -180~180)' });
    }
    if (radiusNum <= 0) {
      return res.status(400).json({ success: false, message: '半径必须为正数（单位：米）' });
    }

    // radius(m) -> bbox(deg) (approx.)
    const metersPerDegLat = 111320;
    const latRad = latNum * Math.PI / 180;
    const metersPerDegLon = metersPerDegLat * Math.cos(latRad);
    const dLat = radiusNum / metersPerDegLat;
    const dLon = metersPerDegLon > 0 ? radiusNum / metersPerDegLon : radiusNum / metersPerDegLat;

    const minY = latNum - dLat;
    const maxY = latNum + dLat;
    const minX = lonNum - dLon;
    const maxX = lonNum + dLon;

    const result = await mosaicClipChinaDemByBounds({ minX, minY, maxX, maxY, maxSources: maxSourcesNum });
    const downloadUrl = `/api/dem/download/${result.outputId}`;

    return res.status(200).json({
      success: true,
      message: 'DEM 拼接裁切成功',
      data: {
        downloadUrl,
        sourceCount: result.sourceCount,
        clipBounds: result.bounds,
        center: { lat: latNum, lon: lonNum },
        radius: radiusNum,
      }
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('DEM download-by-coords 错误:', error);
    next(error);
  }
});

// 下载裁切后的文件
router.get('/download/:id', async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const filePath = path.join(__dirname, '../../clipped', `clipped_${fileId}.tif`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: '文件不存在或已过期' 
      });
    }

    // 设置响应头部
    res.setHeader('Content-Type', 'image/tiff');
    res.setHeader('Content-Disposition', `attachment; filename=clipped_dem.tif`);
    
    // 发送文件
    res.sendFile(filePath);

    // 设置过期清理
    setTimeout(() => {
      fs.remove(filePath).catch(err => {
        console.error('清理裁切文件失败:', err);
      });
    }, 1 * 60 * 60 * 1000); // 1小时后删除

  } catch (error) {
    console.error('文件下载错误:', error);
    next(error);
  }
});

module.exports = router;
