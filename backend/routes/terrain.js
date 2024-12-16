// backend/routes/terrain.js
const express = require('express');
const path = require('path');
const GeoTIFF = require('geotiff');
const cache = require('memory-cache');
const fs = require('fs').promises;

const router = express.Router();

// 缓存配置
const CACHE_DURATION = 3600000; // 1小时缓存

// 获取地形数据元信息
router.get('/:caseId/metadata', async (req, res) => {
  try {
    const filePath = path.join(__dirname, `../data/${req.params.caseId}/terrain.tif`);
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();

    const metadata = {
      width: image.getWidth(),
      height: image.getHeight(),
      bbox,
      minZoom: 0,
      maxZoom: Math.ceil(Math.log2(Math.max(image.getWidth(), image.getHeight()) / 256))
    };

    res.json(metadata);
  } catch (err) {
    console.error('Error getting metadata:', err);
    res.status(500).json({ error: 'Error retrieving terrain metadata' });
  }
});

// 提供完整的 GeoTIFF 数据
router.get('/:caseId/terrain', async (req, res) => {
  try {
    const filePath = path.join(__dirname, `../data/${req.params.caseId}/terrain.tif`);
    const data = await fs.readFile(filePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(data);
  } catch (err) {
    console.error('Error sending GeoTIFF:', err);
    res.status(500).json({ error: 'Error sending terrain data' });
  }
});

// 处理高程数据统计
router.get('/:caseId/statistics', async (req, res) => {
  try {
    const filePath = path.join(__dirname, `../data/${req.params.caseId}/terrain.tif`);
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const data = rasters[0];

    const statistics = {
      min: Math.min(...data),
      max: Math.max(...data),
      mean: data.reduce((a, b) => a + b, 0) / data.length
    };

    res.json(statistics);
  } catch (err) {
    console.error('Error calculating statistics:', err);
    res.status(500).json({ error: 'Error calculating terrain statistics' });
  }
});

module.exports = router;