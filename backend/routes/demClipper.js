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
    fileSize: 100 * 1024 * 1024, // 限制100MB
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

    // 验证参数
    if (!minX || !minY || !maxX || !maxY) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少裁切坐标参数 (minX, minY, maxX, maxY)' 
      });
    }

    // 源文件和目标文件路径
    const srcFilePath = req.file.path;
    const outputId = uuidv4();
    const outputDir = path.join(__dirname, '../../clipped');
    fs.ensureDirSync(outputDir);
    const outputFilePath = path.join(outputDir, `clipped_${outputId}.tif`);

    console.log('裁切参数:', { minX, minY, maxX, maxY });
    console.log('源文件:', srcFilePath);
    console.log('目标文件:', outputFilePath);

    // 使用GDAL执行裁切
    srcDataset = await gdal.openAsync(srcFilePath);
    
    // 获取源投影和地理变换
    let srcProjection = null;
    try {
      srcProjection = srcDataset.srs ? srcDataset.srs.wkt : null;
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
    const xOffset = Math.floor((parseFloat(minX) - originX) / pixelWidth);
    const yOffset = Math.floor((parseFloat(maxY) - originY) / pixelHeight);
    const clipWidth = Math.ceil((parseFloat(maxX) - parseFloat(minX)) / pixelWidth);
    const clipHeight = Math.ceil((parseFloat(maxY) - parseFloat(minY)) / Math.abs(pixelHeight));

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