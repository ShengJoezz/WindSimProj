// backend/routes/cases.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer 配置：先上传到临时目录
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
    // 根据文件类型确定文件名
    if (file.fieldname === 'terrainFile') {
      cb(null, 'terrain.tif');
    } else {
      cb(null, file.originalname);
    }
  }
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
  }
}).fields([
  { name: 'terrainFile', maxCount: 1 },
]);

// 1. 创建新工况
router.post('/', (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer 错误
      console.error('Multer Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    } else if (err) {
      // 其他错误
      console.error('Upload Error:', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    console.log('Received form data:', req.body);
    console.log('Received files:', req.files);

    const caseName = req.body.caseName;
    if (!caseName) {
      return res.status(400).json({ success: false, message: '工况名称不能为空' });
    }

    // 创建目标目录
    const targetDir = path.join(__dirname, '../uploads', caseName);
    fs.mkdirSync(targetDir, { recursive: true });

    // 移动 terrainFile 从临时目录到目标目录
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

    res.json({ success: true, message: '工况创建成功' });
  });
});

// 2. 获取所有工况列表
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

// 3. 获取指定工况的风机数据列表
router.get('/:caseId/wind-turbines/list', (req, res) => {
  const { caseId } = req.params;
  const turbinesJsonPath = path.join(__dirname, '../uploads', caseId, 'windTurbines.json');
  
  // 检查风机数据文件是否存在
  if (!fs.existsSync(turbinesJsonPath)) {
    console.log(`No wind turbines data found for case: ${caseId}`);
    return res.json({ windTurbines: [] }); // 如果文件不存在，返回空数组
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(turbinesJsonPath, 'utf-8'));
    console.log(`Wind turbines data found for case: ${caseId}`);
    res.json({ windTurbines: data });
  } catch (err) {
    console.error('读取风机 JSON 文件失败:', err);
    res.status(500).json({ windTurbines: [] }); // 发生错误时，也返回空数组
  }
});

// 4. 获取指定工况的地形图
router.get('/:caseId/terrain', (req, res) => {
  const { caseId } = req.params;

  // 验证caseId
  if (!caseId || caseId === 'undefined' || caseId === 'null') {
    return res.status(400).json({
      success: false,
      message: '请先选择工况'
    });
  }

  const casePath = path.join(__dirname, '../uploads', caseId);

  // 检查工况目录是否存在
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

// 5. 删除工况
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

// 6. 获取工况参数
router.get('/:caseId/parameters', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);
  const parametersPath = path.join(casePath, 'parameters.json');

  try {
    // 检查参数文件是否存在
    if (fs.existsSync(parametersPath)) {
      const parameters = JSON.parse(fs.readFileSync(parametersPath, 'utf-8'));
      res.json({
        success: true,
        parameters: {
          caseName: caseId, // 使用工况文件夹名作为工况名称
          ...parameters
        }
      });
    } else {
      // 如果参数文件不存在，返回默认参数
      res.json({
        success: true,
        parameters: {
          caseName: caseId,
          calculationDomain: {
            width: 10000,
            height: 800
          },
          conditions: {
            windDirection: 0,
            inletWindSpeed: 10
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
            scale: 0.001
          },
          simulation: {
            cores: 1,
            steps: 100
          },
          postProcessing: {
            resultLayers: 10,
            layerSpacing: 20,
            layerDataWidth: 1000,
            layerDataHeight: 1000
          }
        }
      });
    }
  } catch (error) {
    console.error('获取参数失败:', error);
    res.status(500).json({
      success: false,
      message: '获取参数失败'
    });
  }
});

// 7. 保存工况参数
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

// 8. 获取计算结果
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

// 9. 开始计算
router.post('/:caseId/calculate', (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, '../uploads', caseId);

  try {
    // 检查工况是否存在
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({
        success: false,
        message: '工况不存在'
      });
    }

    // 在这里可以添加启动计算的逻辑
    // 例如：创建一个模拟的计算结果
    const mockResults = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      metrics: {
        totalPower: Math.random() * 100,
        averageWindSpeed: Math.random() * 10 + 5
      }
    };

    // 保存模拟结果
    fs.writeFileSync(
      path.join(casePath, 'results.json'),
      JSON.stringify(mockResults, null, 2)
    );

    res.json({
      success: true,
      message: '计算已启动'
    });
  } catch (error) {
    console.error('启动计算失败:', error);
    res.status(500).json({
      success: false,
      message: '启动计算失败'
    });
  }
});

// 10. 检查 info.json 是否存在
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

// 11. 下载现有的 info.json
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

// 12. 生成并下载 info.json
router.post('/:caseId/info', async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const { parameters, windTurbines } = req.body;

    console.log(`Received /info POST request for caseId: ${caseId}`);
    console.log('Parameters:', parameters);
    console.log('Wind Turbines:', windTurbines);

    // Input Validation
    if (!parameters || !windTurbines) {
      console.warn('Missing parameters or wind turbine data');
      return res.status(400).json({ error: 'Missing parameters or wind turbine data' });
    }

    // Construct info.json
    const infoJson = {
      key: caseId,
      domain: {
        lt: parameters.calculationDomain.width,
        h: parameters.calculationDomain.height
      },
      wind: {
        angle: parameters.conditions.windDirection,
        speed: parameters.conditions.inletWindSpeed
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
        scale: parameters.grid.scale
      },
      simulation: {
        core: parameters.simulation.cores,
        step_count: parameters.simulation.steps
      },
      post: {
        numh: parameters.postProcessing.resultLayers,
        dh: parameters.postProcessing.layerSpacing,
        width: parameters.postProcessing.layerDataWidth,
        height: parameters.postProcessing.layerDataHeight
      },
      turbines: windTurbines.map(turbine => ({
        id: turbine.name,
        lon: turbine.longitude,
        lat: turbine.latitude,
        hub: turbine.hubHeight,
        d: turbine.rotorDiameter,
        x: turbine.mesh.position.x,
        y: turbine.mesh.position.z, // y in json is z in Three.js
        type: "GWH191-6.7" // Or turbine.type if you have that property
      }))
    };

   // Define case directory
   const casePath = path.join(__dirname, '../uploads', caseId);

   // Ensure case directory exists
   fs.mkdirSync(casePath, { recursive: true });

   // Path to info.json
   const infoJsonPath = path.join(casePath, 'info.json');

   // Check if info.json already exists to prevent overwriting
   if (fs.existsSync(infoJsonPath)) {
     console.warn('info.json 已存在，无法重新生成');
     return res.status(400).json({ error: 'info.json 已存在，无法重新生成' });
   }

   // Save info.json to the filesystem
   fs.writeFileSync(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');
   console.log(`info.json 已保存到 ${infoJsonPath}`);

   // Set headers for download
   res.setHeader('Content-disposition', 'attachment; filename=info.json');
   res.setHeader('Content-type', 'application/json');

   // Send the info.json as a response
   return res.send(JSON.stringify(infoJson, null, 2));

 } catch (error) {
   console.error("生成和保存 info.json 失败:", error);
   return res.status(500).json({ error: '生成和保存 info.json 失败' });
 }
});

module.exports = router;