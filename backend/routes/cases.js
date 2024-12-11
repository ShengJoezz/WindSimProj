const express = require('express');
const router = express.Router();
const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process'); 

// Multer 存储配置：首先上传到临时目录
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
    // 根据文件类型定义文件名
    if (file.fieldname === 'terrainFile') {
      cb(null, 'terrain.tif'); // 标准化地形文件名
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
      // Multer 特定错误
      console.error('Multer Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    } else if (err) {
      // 其他错误
      console.error('Upload Error:', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    const caseName = req.body.caseName;
    if (!caseName) {
      return res.status(400).json({ success: false, message: '工况名称不能为空' });
    }

    // 创建目标目录
    const targetDir = path.join(__dirname, '../uploads', caseName);
    fs.mkdirSync(targetDir, { recursive: true });

    // 将 terrainFile 从临时目录移动到目标目录
    if (req.files['terrainFile'] && req.files['terrainFile'][0]) {
      const terrainFile = req.files['terrainFile'][0];
      const tempPath = terrainFile.path;
      const targetPath = path.join(targetDir, terrainFile.filename);
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

  // 检查 windTurbines.json 是否存在
  if (!fs.existsSync(turbinesJsonPath)) {
    console.log(`No wind turbines data found for case: ${caseId}`);
    return res.json({ windTurbines: [] }); // 如果文件不存在，则返回空数组
  }

  try {
    const data = JSON.parse(fs.readFileSync(turbinesJsonPath, 'utf-8'));
    console.log(`Wind turbines data found for case: ${caseId}`);
    res.json({ windTurbines: data });
  } catch (err) {
    console.error('读取风机 JSON 文件失败:', err);
    res.status(500).json({ windTurbines: [] }); // 发生错误时返回空数组
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

  // 验证 caseId
  if (!caseId || caseId === 'undefined' || caseId === 'null') {
    return res.status(400).json({
      success: false,
      message: '请先选择工况'
    });
  }

  const casePath = path.join(__dirname, '../uploads', caseId);

  // 检查案例目录是否存在
  if (!fs.existsSync(casePath)) {
    return res.status(404).json({
      success: false,
      message: '工况不存在'
    });
  }

  const terrainFilePath = path.join(casePath, 'terrain.tif');

  // 检查地形文件是否存在
  if (!fs.existsSync(terrainFilePath)) {
    return res.status(404).json({
      success: false,
      message: '未找到地形数据'
    });
  }

  res.sendFile(terrainFilePath, {
    headers: { 'Content-Type': 'image/tiff' }
  }, (err) => {
    if (err) {
      console.error('发送GeoTIFF文件失败:', err);
      res.status(500).json({
        success: false,
        message: '服务器错误'
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
      // 检查目录内容
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
      error: err.message
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
  const infoJsonPath = path.join(casePath, 'info.json'); // 添加 info.json 路径

  try {
    let parameters = {};

    // 读取 parameters.json
    if (fs.existsSync(parametersPath)) {
      parameters = JSON.parse(fs.readFileSync(parametersPath, 'utf-8'));
    }

    // 读取 info.json 并合并 center 信息
    if (fs.existsSync(infoJsonPath)) {
      const info = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
      parameters.center = info.center;
      parameters.key = info.key; // 确保 caseName 从 info.json 获取
    }

    if (Object.keys(parameters).length > 0) {
      res.json({
        success: true,
        parameters: {
          caseName: parameters.key || caseId, // 使用 parameters.key 或案例文件夹名称作为工况名称
          ...parameters,
        },
      });
    } else {
      // 如果 parameters.json 不存在，则返回默认参数
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
            lon: null, // 初始为 null，前端进行展示判断
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
        message: '工况不存在'
      });
    }

    // 保存参数到文件
    fs.writeFileSync(parametersPath, JSON.stringify(parameters, null, 2));

    res.json({
      success: true,
      message: '参数保存成功'
    });
  } catch (error) {
    console.error('保存参数失败:', error);
    res.status(500).json({
      success: false,
      message: '保存参数失败'
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
        message: '暂无计算结果'
      });
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('获取结果失败:', error);
    res.status(500).json({
      success: false,
      message: '获取结果失败'
    });
  }
});

/**
 * 10. 启动特定案例的计算
 * POST /api/cases/:caseId/calculate
 */
router.post('/:caseId/calculate', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);

  try {
    // 检查案例是否存在
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({
        success: false,
        message: '工况不存在'
      });
    }

    // 在这里，您将与您的仿真/计算引擎集成。
    // 为了演示，我们将创建模拟结果。

    const mockResults = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      metrics: {
        totalPower: Math.random() * 100, // 示例指标
        averageWindSpeed: Math.random() * 10 + 5 // 示例指标
      }
    };

    // 保存模拟结果
    fs.writeFileSync(
      path.join(casePath, 'results.json'),
      JSON.stringify(mockResults, null, 2)
    );

    res.json({
      success: true,
      message: '计算已完成',
      results: mockResults
    });
  } catch (error) {
    console.error('启动计算失败:', error);
    res.status(500).json({
      success: false,
      message: '启动计算失败'
    });
  }
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
    headers: { 'Content-Type': 'application/json' }
  }, (err) => {
    if (err) {
      console.error('发送 info.json 失败:', err);
      res.status(500).json({ success: false, message: '服务器错误' });
    }
  });
});

/**
 * 验证模式 (Corrected Schema)
 */
const turbineSchema = Joi.object({
  id: Joi.string().required(),
  longitude: Joi.number().required(),
  latitude: Joi.number().required(), // 使用 'latitude' 代替 'lat'
  hubHeight: Joi.number().required(), // 使用 'hubHeight' 代替 'hub'
  rotorDiameter: Joi.number().required(), // 使用 'rotorDiameter' 代替 'd'
  type: Joi.string().optional(),
  name: Joi.string().optional(), // 添加这一行，允许 'name' 为可选字段
});

const schema = Joi.object({
  parameters: Joi.object().required(),
  windTurbines: Joi.array().items(turbineSchema).min(1).required(),
});

// 为了确认 schema 已正确更新，可以打印其描述
console.log("Joi Schema Description:", JSON.stringify(schema.describe(), null, 2));

/**
 * 辅助函数：计算 x 和 y 坐标
 * @param {Number} lon - 经度
 * @param {Number} lat - 纬度
 * @param {Number} centerLon - 中心经度
 * @param {Number} centerLat - 中心纬度
 * @returns {Object} - 包含 x 和 y 的对象
 */
const calculateXY = (lon, lat, centerLon, centerLat) => {
  console.log("calculateXY - Input:", { lon, lat, centerLon, centerLat });
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

  console.log("calculateXY - Output:", { x: projx, y: projy });
  return { x: projx, y: projy };
};

/**
 * 13. 生成并保存特定案例的 info.json
 * POST /api/cases/:caseId/info
 */
router.post('/:caseId/info', async (req, res) => {
  console.log("Request Body (Before Validation):", JSON.stringify(req.body, null, 2)); 
  try {
    // 进行数据验证
    const { error, value } = schema.validate(req.body, { abortEarly: false }); // Added abortEarly: false
    if (error) {
      console.error("Validation Error:", error.details);
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({ success: false, message: errorMessages }); // Send all validation errors
    }

    const caseId = req.params.caseId;
    const { parameters, windTurbines } = value;

    // 增加风机数量的检查
    if (!windTurbines || windTurbines.length === 0) {
      return res.status(400).json({ success: false, message: '请先导入至少一个风机' });
    }

    // 提取所有经度和纬度
    const longitudes = windTurbines.map(turbine => turbine.longitude);
    const latitudes = windTurbines.map(turbine => turbine.latitude);

    console.log("Wind Turbines Longitudes:", longitudes);
    console.log("Wind Turbines Latitudes:", latitudes);

    // 计算经度的最大值和最小值
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const centerLon = (minLon + maxLon) / 2;

    // 计算纬度的最大值和最小值
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const centerLat = (minLat + maxLat) / 2;

    console.log("Center Coordinates:", { centerLon, centerLat });

    // 构造 info.json 结构
    const infoJson = {
      key: caseId, // 使用 caseId 作为 key
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
        console.log("Turbine Data:", turbine);
        return {
          id: turbine.id,
          lon: turbine.longitude,
          lat: turbine.latitude, // 使用 'latitude' 作为 'lat'
          hub: turbine.hubHeight, // 使用 'hubHeight' 作为 'hub'
          d: turbine.rotorDiameter, // 使用 'rotorDiameter' 作为 'd'
          x: x,
          y: y,
          type: turbine.type || "GWH191-6.7",
        };
      }),
      center: { // 将中心经纬度作为 info.json 的一部分
        lon: centerLon,
        lat: centerLat,
      },
    };

    console.log("Generated infoJson:", JSON.stringify(infoJson, null, 2)); // 调试日志

    const casePath = path.join(__dirname, '../uploads', caseId);
    fs.mkdirSync(casePath, { recursive: true });

    const infoJsonPath = path.join(casePath, 'info.json');

    fs.writeFileSync(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');
    console.log(`info.json 已保存到 ${infoJsonPath}`);

    res.json({ success: true, message: 'info.json 生成成功' });
  } catch (error) {
    console.error("生成和保存 info.json 失败:", error);
    return res.status(500).json({ success: false, message: '生成和保存 info.json 失败' });
  }
});

/**
 * 14. 运行特定案例的 run.sh 脚本
 * POST /api/cases/:caseId/run
 */
router.post('/:caseId/run', (req, res) => {
  const { caseId } = req.params;
  const scriptPath = path.join(__dirname, '../base/run.sh'); // run.sh 脚本路径
  const casePath = path.join(__dirname, '../uploads', caseId); // 案例文件夹路径

  // 检查 run.sh 是否存在
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ success: false, message: 'run.sh 脚本未找到' });
  }

  // 检查案例文件夹是否存在
  if (!fs.existsSync(casePath)) {
    return res.status(404).json({ success: false, message: '工况不存在' });
  }

  // 获取 Socket.io 实例
  const io = req.app.get('socketio');

  // 执行 run.sh 脚本
  const child = spawn('bash', [scriptPath], { cwd: casePath });

  console.log(`正在执行 run.sh 脚本，工作目录: ${casePath}`);

  // 处理标准输出
  child.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`run.sh stdout: ${output}`);

    // 发送日志消息
    io.to(caseId).emit('log', output.trim());

    // 解析进度信息，例如 "Progress: 10%"
    const progressMatch = output.match(/Progress:\s+(\d+)%/);
    if (progressMatch) {
      const percent = parseInt(progressMatch[1], 10);
      if (!isNaN(percent)) {
        io.to(caseId).emit('calculationProgress', percent);
        console.log(`发送进度: ${percent}%`);
      }
    }
  });

  // 处理标准错误
  child.stderr.on('data', (data) => {
    const errorOutput = data.toString();
    console.error(`run.sh stderr: ${errorOutput}`);
    io.to(caseId).emit('calculationError', { message: '脚本错误', details: errorOutput.trim() });
  });

  // 处理脚本结束
  child.on('close', (code) => {
    if (code === 0) {
      console.log('run.sh 成功完成');
      io.to(caseId).emit('calculationCompleted', { message: '计算完成' });
      res.json({ success: true, message: '脚本执行成功' });
    } else {
      console.error(`run.sh 以代码 ${code} 退出`);
      io.to(caseId).emit('calculationFailed', { message: `脚本以代码 ${code} 退出` });
      res.status(500).json({ success: false, message: `脚本以代码 ${code} 退出` });
    }
  });

  // 处理执行中的错误
  child.on('error', (error) => {
    console.error(`run.sh 脚本执行错误: ${error.message}`);
    io.to(caseId).emit('calculationError', { message: '脚本执行错误', details: error.message });
    res.status(500).json({ success: false, message: '运行脚本时发生错误' });
  });
});


module.exports = router;