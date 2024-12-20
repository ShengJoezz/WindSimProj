// backend/routes/case.js

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseName = req.body.caseName;
    if (!caseName) {
      return cb(new Error('工况名称不能为空'));
    }
    const uploadPath = path.join(__dirname, '../uploads', caseName);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'terrainFile') {
      cb(null, 'terrain.tif'); // Standardize terrain file name
    } else {
      cb(null, file.originalname);
    }
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const terrainTypes = ['.tif', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'terrainFile') {
      if (!terrainTypes.includes(ext)) {
        return cb(new Error('仅支持 GeoTIFF (.tif, .tiff) 文件'), false);
      }
    }
    cb(null, true);
  },
}).fields([
  { name: 'terrainFile', maxCount: 1 },
]);

/**
 * 1. 创建新案例
 * POST /api/cases
 */
router.post('/', (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      console.error('Multer Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    } else if (err) {
      // Other errors
      console.error('Upload Error:', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }
    const caseName = req.body.caseName;
    if (!caseName) {
      return res.status(400).json({ success: false, message: '工况名称不能为空' });
    }

    // Move terrainFile if necessary
    if (req.files['terrainFile'] && req.files['terrainFile'][0]) {
      const terrainFile = req.files['terrainFile'][0];
      const tempPath = terrainFile.path;
      const targetPath = path.join(path.dirname(tempPath), terrainFile.filename);
      fs.renameSync(tempPath, targetPath);
      console.log(`Moved terrainFile to ${targetPath}`);
    } else {
      console.error('terrainFile is missing');
      return res.status(400).json({ success: false, message: '请上传 GeoTIFF 文件' });
    }
    res.json({ success: true, message: '工况创建成功', caseName: caseName });
  });
});

/**
 * 2. 获取所有案例
 * GET /api/cases
 */
router.get('/', (req, res) => {
  const uploadsPath = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsPath)) {
    return res.json({ cases: [] });
  }
  const caseNames = fs.readdirSync(uploadsPath).filter(name => {
    const casePath = path.join(uploadsPath, name);
    return fs.lstatSync(casePath).isDirectory();
  });
  res.json({ cases: caseNames });
});

/**
 * 3. 获取特定案例的风力涡轮机
 * GET /api/cases/:caseId/wind-turbines/list
 */
router.get('/:caseId/wind-turbines/list', (req, res) => {
  const { caseId } = req.params;
  const turbinesJsonPath = path.join(__dirname, '../uploads', caseId, 'windTurbines.json');

  if (!fs.existsSync(turbinesJsonPath)) {
    console.log(`No wind turbines data found for case: ${caseId}`);
    return res.json({ windTurbines: [] });
  }

  try {
    const data = JSON.parse(fs.readFileSync(turbinesJsonPath, 'utf-8'));
    console.log(`Wind turbines data found for case: ${caseId}`);
    res.json({ windTurbines: data });
  } catch (err) {
    console.error('读取风机 JSON 文件失败:', err);
    res.status(500).json({ windTurbines: [] });
  }
});

/**
 * 4. 保存特定案例的风力涡轮机
 * POST /api/cases/:caseId/wind-turbines
 */
router.post('/:caseId/wind-turbines', async (req, res) => {
  const { caseId } = req.params;
  const windTurbines = req.body;
  if (!windTurbines) {
    return res.status(400).json({ success: false, message: '风机数据缺失' });
  }

  const turbinesJsonPath = path.join(__dirname, '../uploads', caseId, 'windTurbines.json');

  try {
    await fs.promises.writeFile(turbinesJsonPath, JSON.stringify(windTurbines, null, 2), 'utf-8');
    res.json({ success: true, message: '风机数据保存成功' });
  } catch (error) {
    console.error('保存风机数据失败:', error);
    res.status(500).json({ success: false, message: '保存风机数据失败' });
  }
});

/**
 * 5. 获取特定案例的地形文件
 * GET /api/cases/:caseId/terrain
 */
router.get('/:caseId/terrain', (req, res) => {
  const { caseId } = req.params;

  if (!caseId || caseId === 'undefined' || caseId === 'null') {
    return res.status(400).json({
      success: false,
      message: '请先选择工况',
    });
  }

  const casePath = path.join(__dirname, '../uploads', caseId);

  if (!fs.existsSync(casePath)) {
    return res.status(404).json({
      success: false,
      message: '工况不存在',
    });
  }

  const terrainFilePath = path.join(casePath, 'terrain.tif');

  if (!fs.existsSync(terrainFilePath)) {
    return res.status(404).json({
      success: false,
      message: '未找到地形数据',
    });
  }

  res.sendFile(terrainFilePath, {
    headers: { 'Content-Type': 'image/tiff' },
  }, (err) => {
    if (err) {
      console.error('发送GeoTIFF文件失败:', err);
      res.status(500).json({
        success: false,
        message: '服务器错误',
      });
    }
  });
});

/**
 * 6. 删除案例
 * DELETE /api/cases/:caseId
 */
router.delete('/:caseId', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);

  console.log('\n=== DELETE 请求处理 ===');
  console.log('caseId:', caseId);
  console.log('完整路径:', casePath);
  console.log('当前工作目录:', process.cwd());
  console.log('__dirname:', __dirname);

  try {
    const exists = fs.existsSync(casePath);
    console.log('目录是否存在:', exists);

    if (exists) {
      const dirContents = fs.readdirSync(casePath);
      console.log('目录内容:', dirContents);

      fs.rmSync(casePath, { recursive: true, force: true });
      console.log('删除成功');
      res.json({ success: true, message: '工况删除成功' });
    } else {
      console.log('目录不存在');
      res.status(404).json({ success: false, message: '工况不存在' });
    }
  } catch (err) {
    console.error('错误详情:', err);
    res.status(500).json({
      success: false,
      message: '删除工况失败',
      error: err.message,
    });
  }
});

/**
 * 7. 获取特定案例的参数
 * GET /api/cases/:caseId/parameters
 */
router.get('/:caseId/parameters', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);
  const parametersPath = path.join(casePath, 'parameters.json');
  const infoJsonPath = path.join(casePath, 'info.json');

  try {
    let parameters = {};

    if (fs.existsSync(parametersPath)) {
      parameters = JSON.parse(fs.readFileSync(parametersPath, 'utf-8'));
    }

    if (fs.existsSync(infoJsonPath)) {
      const info = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
      parameters.center = info.center;
      parameters.key = info.key;
    }

    if (Object.keys(parameters).length > 0) {
      res.json({
        success: true,
        parameters: {
          caseName: parameters.key || caseId,
          ...parameters,
        },
      });
    } else {
      res.json({
        success: true,
        parameters: {
          caseName: caseId,
          calculationDomain: {
            width: 10000,
            height: 800,
          },
          conditions: {
            windDirection: 0,
            inletWindSpeed: 10,
          },
          grid: {
            encryptionHeight: 210,
            encryptionLayers: 21,
            gridGrowthRate: 1.2,
            maxExtensionLength: 360,
            encryptionRadialLength: 50,
            downstreamRadialLength: 100,
            encryptionRadius: 200,
            encryptionTransitionRadius: 400,
            terrainRadius: 4000,
            terrainTransitionRadius: 5000,
            downstreamLength: 2000,
            downstreamWidth: 600,
            scale: 0.001,
          },
          simulation: {
            cores: 1,
            steps: 100,
          },
          postProcessing: {
            resultLayers: 10,
            layerSpacing: 20,
            layerDataWidth: 1000,
            layerDataHeight: 1000,
          },
          center: {
            lon: null,
            lat: null,
          },
        },
      });
    }
  } catch (error) {
    console.error('获取参数失败:', error);
    res.status(500).json({
      success: false,
      message: '获取参数失败',
    });
  }
});

/**
 * 8. 保存特定案例的参数
 * POST /api/cases/:caseId/parameters
 */
router.post('/:caseId/parameters', (req, res) => {
  const { caseId } = req.params;
  const parameters = req.body;
  const casePath = path.join(__dirname, '../uploads', caseId);
  const parametersPath = path.join(casePath, 'parameters.json');

  try {
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({
        success: false,
        message: '工况不存在',
      });
    }

    fs.writeFileSync(parametersPath, JSON.stringify(parameters, null, 2));

    res.json({
      success: true,
      message: '参数保存成功',
    });
  } catch (error) {
    console.error('保存参数失败:', error);
    res.status(500).json({
      success: false,
      message: '保存参数失败',
    });
  }
});

/**
 * 9. 获取特定案例的仿真结果
 * GET /api/cases/:caseId/results
 */
router.get('/:caseId/results', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);
  const resultsPath = path.join(casePath, 'results.json');

  try {
    if (!fs.existsSync(resultsPath)) {
      return res.json({
        success: true,
        results: null,
        message: '暂无计算结果',
      });
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    res.json({
      success: true,
      results: results,
    });
  } catch (error) {
    console.error('获取结果失败:', error);
    res.status(500).json({
      success: false,
      message: '获取结果失败',
    });
  }
});

/**
 * 10. 启动特定案例的计算
 * POST /api/cases/:caseId/calculate
 */
router.post('/:caseId/calculate', (req, res) => {
  const { caseId } = req.params;
  const scriptPath = path.join(__dirname, '../base/run.sh'); // Path to run.sh
  const casePath = path.join(__dirname, '../uploads', caseId); // Case folder path

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ success: false, message: 'run.sh 脚本未找到' });
  }

  if (!fs.existsSync(casePath)) {
    return res.status(404).json({ success: false, message: '工况不存在' });
  }

  const io = req.app.get('socketio'); // 获取 Socket.io 实例

  // 执行 run.sh 脚本
  const child = spawn('bash', [scriptPath], { cwd: casePath });

  console.log(`正在执行 run.sh 脚本，工作目录: ${casePath}`);

  // 捕捉标准输出
  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`run.sh stdout: ${output}`);

    // 解析进度信息，例如 "Progress: 10%"
    const progressMatch = output.match(/Progress:\s+(\d+)%/);
    if (progressMatch) {
      const percent = parseInt(progressMatch[1], 10);
      if (!isNaN(percent)) {
        io.to(caseId).emit('calculationProgress', percent);
        console.log(`发送进度: ${percent}%`);
      } else if (output.includes('ERROR')) {
        io.to(caseId).emit('calculationError', { message: '脚本执行错误', details: output });
      }
    } else {
      // 其他输出作为日志发送
      io.to(caseId).emit('scriptOutput', output);
    }
  });

  // 捕捉标准错误
  child.stderr.on('data', (data) => {
    const errorOutput = data.toString().trim();
    console.error(`run.sh stderr: ${errorOutput}`);
    io.to(caseId).emit('calculationError', { message: '脚本错误', details: errorOutput });
  });

  // 脚本退出
  child.on('close', (code) => {
    if (code === 0) {
      console.log('run.sh 成功完成');
      // 假设脚本完成后生成 results.json
      const resultsPath = path.join(casePath, 'results.json');
      if (fs.existsSync(resultsPath)) {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
        io.to(caseId).emit('calculationCompleted', results);
      } else {
        io.to(caseId).emit('calculationCompleted', { message: '计算完成，但未找到结果文件' });
      }
      res.json({ success: true, message: '脚本执行成功' });
    } else {
      console.error(`run.sh 以代码 ${code} 退出`);
      io.to(caseId).emit('calculationFailed', { message: `脚本以代码 ${code} 退出` });
      res.status(500).json({ success: false, message: `脚本以代码 ${code} 退出` });
    }
  });

  // 捕捉执行错误
  child.on('error', (error) => {
    console.error(`run.sh 脚本执行错误: ${error.message}`);
    io.to(caseId).emit('calculationError', { message: '脚本执行错误', details: error.message });
    res.status(500).json({ success: false, message: '运行脚本时发生错误' });
  });

  // 防止多次响应
  // 响应仅在 'close' 和 'error' 事件中发送
});

/**
 * 11. 检查特定案例的 info.json 是否存在
 * GET /api/cases/:caseId/info-exists
 */
router.get('/:caseId/info-exists', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
  console.log(`Received /info-exists request for caseId: ${caseId}`);
  console.log(`Checking info.json path: ${infoJsonPath}`);

  try {
    const exists = fs.existsSync(infoJsonPath);
    console.log(`info.json exists: ${exists}`);
    res.json({ exists });
  } catch (error) {
    console.error(`Error checking info.json: ${error}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 12. 下载特定案例的现有 info.json
 * GET /api/cases/:caseId/info-download
 */
router.get('/:caseId/info-download', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
  if (!fs.existsSync(infoJsonPath)) {
    return res.status(404).json({ success: false, message: 'info.json 不存在' });
  }

  res.sendFile(infoJsonPath, {
    headers: { 'Content-Type': 'application/json' },
  }, (err) => {
    if (err) {
      console.error('发送 info.json 失败:', err);
      res.status(500).json({ success: false, message: '服务器错误' });
    }
  });
});

/**
 * 辅助函数：计算 x 和 y 坐标
 * @param {Number} lon - 经度
 * @param {Number} lat - 纬度
 * @param {Number} centerLon - 中心经度
 * @param {Number} centerLat - 中心纬度
 * @returns {Object} - 包含 x 和 y 的对象
 */
const calculateXY = (lon, lat, centerLon, centerLat) => {
  console.log('calculateXY - Input:', { lon, lat, centerLon, centerLat });
  const EARTH_RADIUS = 6371000; // 地球半径，单位：米
  const RAD_PER_DEG = Math.PI / 180;
  const METER_PER_DEG_LAT = EARTH_RADIUS * RAD_PER_DEG; // 每度纬度对应的米数
  const LONG_LAT_RATIO = Math.cos(centerLat * RAD_PER_DEG); // 经度与纬度的比例因子
  const tempAngle = 0 * RAD_PER_DEG; // 旋转角度，单位：弧度（0 表示不旋转）

  // 计算相对中心的 x 和 y
  const tempX = (lon - centerLon) * METER_PER_DEG_LAT * LONG_LAT_RATIO;
  const tempY = (lat - centerLat) * METER_PER_DEG_LAT;

  // 应用旋转
  const projx = tempX * Math.cos(tempAngle) - tempY * Math.sin(tempAngle);
  const projy = tempY * Math.cos(tempAngle) + tempX * Math.sin(tempAngle);

  console.log('calculateXY - Output:', { x: projx, y: projy });
  return { x: projx, y: projy };
};

/**
 * 13. 生成并保存特定案例的 info.json
 * POST /api/cases/:caseId/info
 */
router.post('/:caseId/info', async (req, res) => {
  console.log('Request Body (Before Validation):', JSON.stringify(req.body, null, 2));
  try {
    // 数据验证
    const turbineSchema = Joi.object({
      id: Joi.string().required(),
      longitude: Joi.number().required(),
      latitude: Joi.number().required(),
      hubHeight: Joi.number().required(),
      rotorDiameter: Joi.number().required(),
      type: Joi.string().optional(),
      name: Joi.string().optional(),
    });
    const schema = Joi.object({
      parameters: Joi.object().required(),
      windTurbines: Joi.array().items(turbineSchema).min(1).required(),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      console.error('Validation Error:', error.details);
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({ success: false, message: errorMessages });
    }

    const { parameters, windTurbines } = value;

    // Extract longitudes and latitudes
    const longitudes = windTurbines.map(turbine => turbine.longitude);
    const latitudes = windTurbines.map(turbine => turbine.latitude);

    console.log('Wind Turbines Longitudes:', longitudes);
    console.log('Wind Turbines Latitudes:', latitudes);

    // Calculate center coordinates
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const centerLon = (minLon + maxLon) / 2;

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const centerLat = (minLat + maxLat) / 2;

    console.log('Center Coordinates:', { centerLon, centerLat });

    // Construct info.json structure
    const infoJson = {
      key: req.params.caseId,
      domain: {
        lt: parameters.calculationDomain.width,
        h: parameters.calculationDomain.height,
      },
      wind: {
        angle: parameters.conditions.windDirection,
        speed: parameters.conditions.inletWindSpeed,
      },
      mesh: {
        h1: parameters.grid.encryptionHeight,
        ceng: parameters.grid.encryptionLayers,
        q1: parameters.grid.gridGrowthRate,
        lc1: parameters.grid.maxExtensionLength,
        lc2: parameters.grid.encryptionRadialLength,
        lc3: parameters.grid.downstreamRadialLength,
        r1: parameters.grid.encryptionRadius,
        r2: parameters.grid.encryptionTransitionRadius,
        tr1: parameters.grid.terrainRadius,
        tr2: parameters.grid.terrainTransitionRadius,
        wakeL: parameters.grid.downstreamLength,
        wakeB: parameters.grid.downstreamWidth,
        scale: parameters.grid.scale,
      },
      simulation: {
        core: parameters.simulation.cores,
        step_count: parameters.simulation.steps,
      },
      post: {
        numh: parameters.postProcessing.resultLayers,
        dh: parameters.postProcessing.layerSpacing,
        width: parameters.postProcessing.layerDataWidth,
        height: parameters.postProcessing.layerDataHeight,
      },
      turbines: windTurbines.map(turbine => {
        const { x, y } = calculateXY(turbine.longitude, turbine.latitude, centerLon, centerLat);
        console.log('Turbine Data:', turbine);
        return {
          id: turbine.id,
          lon: turbine.longitude,
          lat: turbine.latitude,
          hub: turbine.hubHeight,
          d: turbine.rotorDiameter,
          x: x,
          y: y,
          type: turbine.type || 'GWH191-6.7',
        };
      }),
      center: {
        lon: centerLon,
        lat: centerLat,
      },
    };

    console.log('Generated infoJson:', JSON.stringify(infoJson, null, 2));

    const casePath = path.join(__dirname, '../uploads', req.params.caseId);
    fs.mkdirSync(casePath, { recursive: true });
    const infoJsonPath = path.join(casePath, 'info.json');
    fs.writeFileSync(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');
    console.log(`info.json 已保存到 ${infoJsonPath}`);
    res.json({ success: true, message: 'info.json 生成成功' });
  } catch (error) {
    console.error('生成和保存 info.json 失败:', error);
    return res.status(500).json({ success: false, message: '生成和保存 info.json 失败' });
  }
});

module.exports = router;