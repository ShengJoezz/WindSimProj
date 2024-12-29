const express = require("express");
const router = express.Router();
const Joi = require("joi");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { spawn } = require("child_process");
const checkCalculationStatus = require("../middleware/statusCheck");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require('express-rate-limit');
const { knownTasks } = require('../utils/tasks');

// 应用速率限制器到所有路由
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 每个 IP 在 15 分钟内最多 100 个请求
});
router.use(limiter);

// 验证 caseId 的 schema
const caseIdSchema = Joi.string()
  .alphanum()
  .min(1)
  .max(50)
  .required()
  .messages({
    "string.alphanum": "Case ID must only contain alphanumeric characters",
    "string.min": "Case ID must be at least 1 character long",
    "string.max": "Case ID must be at most 50 characters long",
    "any.required": "Case ID is required",
  });

// Multer 配置
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


// 辅助函数，验证 case ID
const validateCaseId = (req, res, next) => {
  const { error, value } = caseIdSchema.validate(req.params.caseId);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  req.params.caseId = value; // 使用验证后的值
  next();
};

// 应用验证 caseId 的中间件
router.use("/:caseId", validateCaseId);

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
 * 2. 获取所有工况
 * GET /api/cases
 */
router.get("/", async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsPath)) {
      return res.json({ cases: [] });
    }
    const caseNames = await fs.promises.readdir(uploadsPath, {
      withFileTypes: true,
    });
    const cases = caseNames
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
    res.json({ cases });
  } catch (error) {
    console.error("获取工况列表失败:", error);
    res.status(500).json({ success: false, message: "获取工况列表失败" });
  }
});

/**
 * 3. 获取特定工况的风力涡轮机列表
 * GET /api/cases/:caseId/wind-turbines/list
 */
router.get("/:caseId/wind-turbines/list", async (req, res) => {
  const { caseId } = req.params;
  const turbinesJsonPath = path.join(
    __dirname,
    "../uploads",
    caseId,
    "windTurbines.json"
  );

  try {
    if (!fs.existsSync(turbinesJsonPath)) {
      console.log(`未找到工况 ${caseId} 的风机数据`);
      return res.json({ windTurbines: [] });
    }

    const data = await fs.promises.readFile(turbinesJsonPath, "utf-8");
    const windTurbines = JSON.parse(data);
    console.log(`找到工况 ${caseId} 的风机数据`);
    res.json({ windTurbines });
  } catch (err) {
    console.error("读取风机 JSON 文件失败:", err);
    res.status(500).json({
      success: false,
      message: "读取风机数据失败",
    });
  }
});

/**
 * 4. 保存特定工况的风力涡轮机
 * POST /api/cases/:caseId/wind-turbines
 */
router.post("/:caseId/wind-turbines", async (req, res) => {
  const { caseId } = req.params;
  const windTurbines = req.body;
  if (!windTurbines) {
    return res.status(400).json({ success: false, message: "风机数据缺失" });
  }

  const turbinesJsonPath = path.join(
    __dirname,
    "../uploads",
    caseId,
    "windTurbines.json"
  );

  try {
    await fs.promises.writeFile(
      turbinesJsonPath,
      JSON.stringify(windTurbines, null, 2),
      "utf-8"
    );
    res.json({ success: true, message: "风机数据保存成功" });
  } catch (error) {
    console.error("保存风机数据失败:", error);
    res.status(500).json({ success: false, message: "保存风机数据失败" });
  }
});

/**
 * 5. 获取特定工况的地形文件
 * GET /api/cases/:caseId/terrain
 */
router.get("/:caseId/terrain", (req, res) => {
  const { caseId } = req.params;

  if (!caseId || caseId === "undefined" || caseId === "null") {
    return res.status(400).json({
      success: false,
      message: "请先选择工况",
    });
  }

  const casePath = path.join(__dirname, "../uploads", caseId);

  if (!fs.existsSync(casePath)) {
    return res.status(404).json({
      success: false,
      message: "工况不存在",
    });
  }

  const terrainFilePath = path.join(casePath, "terrain.tif");

  if (!fs.existsSync(terrainFilePath)) {
    return res.status(404).json({
      success: false,
      message: "未找到地形数据",
    });
  }

  res.sendFile(terrainFilePath, {
    headers: { "Content-Type": "image/tiff" },
  }, (err) => {
    if (err) {
      console.error("发送GeoTIFF文件失败:", err);
      res.status(500).json({
        success: false,
        message: "服务器错误",
      });
    }
  });
});

/**
 * 6. 删除工况
 * DELETE /api/cases/:caseId
 */
router.delete("/:caseId", async (req, res) => {
    const { caseId } = req.params;
    console.log("Attempting to delete case:", caseId);
  
    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: "工况ID不能为空"
      });
    }
  
    const casePath = path.join(__dirname, "../uploads", caseId);
    console.log("Case path:", casePath);
  
    try {
      // 检查工况是否存在
      if (!fs.existsSync(casePath)) {
        return res.status(404).json({
          success: false,
          message: "工况不存在"
        });
      }
  
      // 删除工况目录
      await fs.promises.rm(casePath, { recursive: true, force: true });
      console.log("Successfully deleted case directory");
  
      res.json({
        success: true,
        message: "工况删除成功"
      });
  
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(500).json({
        success: false,
        message: "删除工况失败",
        error: error.message
      });
    }
  });

/**
 * 7. 获取特定工况的参数
 * GET /api/cases/:caseId/parameters
 */
router.get("/:caseId/parameters", async (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const parametersPath = path.join(casePath, "parameters.json");
  const infoJsonPath = path.join(casePath, "info.json");

  try {
    let parameters = {};

    if (fs.existsSync(parametersPath)) {
      const parametersData = await fs.promises.readFile(
        parametersPath,
        "utf-8"
      );
      parameters = JSON.parse(parametersData);
    }

    if (fs.existsSync(infoJsonPath)) {
      const infoData = await fs.promises.readFile(infoJsonPath, "utf-8");
      const info = JSON.parse(infoData);
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
            deltaT: 1
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
    console.error("获取参数失败:", error);
    res.status(500).json({
      success: false,
      message: "获取参数失败",
    });
  }
});

/**
 * 8. 保存特定工况的参数
 * POST /api/cases/:caseId/parameters
 */
router.post("/:caseId/parameters", async (req, res) => {
  const { caseId } = req.params;
  const parameters = req.body;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const parametersPath = path.join(casePath, "parameters.json");

  try {
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({
        success: false,
        message: "工况不存在",
      });
    }

    await fs.promises.writeFile(
      parametersPath,
      JSON.stringify(parameters, null, 2)
    );

    res.json({
      success: true,
      message: "参数保存成功",
    });
  } catch (error) {
    console.error("保存参数失败:", error);
    res.status(500).json({
      success: false,
      message: "保存参数失败",
    });
  }
});

/**
 * 9. 获取特定工况的仿真结果
 * GET /api/cases/:caseId/results
 */
router.get("/:caseId/results", async (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const resultsPath = path.join(casePath, "results.json");

  try {
    if (!fs.existsSync(resultsPath)) {
      return res.json({
        success: true,
        results: null,
        message: "暂无计算结果",
      });
    }

    const resultsData = await fs.promises.readFile(resultsPath, "utf-8");
    const results = JSON.parse(resultsData);
    res.json({
      success: true,
      results: results,
    });
  } catch (error) {
    console.error("获取结果失败:", error);
    res.status(500).json({
      success: false,
      message: "获取结果失败",
    });
  }
});

/**
 * 10. 启动特定工况的计算
 * POST /api/cases/:caseId/calculate
 */
router.post("/:caseId/calculate", checkCalculationStatus, async (req, res) => {
  const { caseId } = req.params;
  const scriptPath = path.join(__dirname, "../base/run.sh");
  const casePath = path.join(__dirname, "../uploads", caseId);

    if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({ success: false, message: "run.sh 脚本未找到" });
    }

    if (!fs.existsSync(casePath)) {
        return res.status(404).json({ success: false, message: "工况不存在" });
    }

  if (req.calculationStatus === "completed") {
    return res.status(400).json({
      success: false,
      message: "该工况已完成计算，无法重新计算",
    });
  }

  const io = req.app.get("socketio");

    const taskStatuses = {};
    knownTasks.forEach((task) => {
        taskStatuses[task.id] = "pending";
    });


    try {
        // 更新计算状态为 'running'
        const infoJsonPath = path.join(casePath, "info.json");
        if (fs.existsSync(infoJsonPath)) {
            const info = JSON.parse(
                await fs.promises.readFile(infoJsonPath, "utf-8")
            );
            info.calculationStatus = "running";
            await fs.promises.writeFile(
                infoJsonPath,
                JSON.stringify(info, null, 2),
                "utf-8"
            );
            console.log("Updated info.json to mark calculation as running");
        } else {
            console.warn("info.json not found. Cannot update calculation status.");
        }


    // 运行子进程
    const child = spawn("bash", [scriptPath], { cwd: casePath });

    // 创建本次运行的日志文件
    const logFilePath = path.join(casePath, `calculation_log_${Date.now()}.txt`);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    console.log(`Executing run.sh for case: ${caseId}`);

    child.stdout.on("data", (data) => {
        const output = data.toString();
        logStream.write(output);
        io.to(caseId).emit("calculationOutput", output);
        const trimmedOutput = output.trim();
        console.log(`run.sh stdout: ${trimmedOutput}`);


            const taskStartMatch = trimmedOutput.match(/TaskStart:\s+(\w+)/);
            const progressMatch = trimmedOutput.match(
                /Progress:\s+(\d+)%\s+Task:\s+(\w+)/
            );


        if (taskStartMatch) {
          const taskId = taskStartMatch[1];
          if (knownTasks.some((task) => task.id === taskId)) {
            taskStatuses[taskId] = "running";
            io.to(caseId).emit("taskStarted", taskId);
              console.log(`Task started: ${taskId}`);
          } else {
            console.warn(`Unknown task started: ${taskId}`);
          }
        }
          
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
            const taskId = progressMatch[2];
            if (
              !isNaN(percent) &&
              knownTasks.some((task) => task.id === taskId)
            ) {
              if (percent === 100) {
                taskStatuses[taskId] = "completed";
                console.log(`Task completed: ${taskId}`);
              }
              io.to(caseId).emit("calculationProgress", {
                progress: percent,
                taskId: taskId,
              });
                console.log(`Progress: ${percent}% for task: ${taskId}`);
            } else {
                console.warn(`Unknown task progress: ${trimmedOutput}`);
            }
        }
          io.to(caseId).emit("taskUpdate", taskStatuses);
      });

    child.stderr.on("data", (data) => {
      const errorOutput = data.toString();
        logStream.write(`ERROR: ${errorOutput}`);
        console.error(`run.sh stderr: ${errorOutput}`);
      io.to(caseId).emit("calculationError", {
        message: "脚本错误",
        details: errorOutput,
      });
    });

    child.on("close", async (code) => {
        logStream.end();
        if (code === 0) {
            console.log("run.sh completed successfully");


            // 使用 info.json 更新计算状态
            const infoJsonPath = path.join(casePath, "info.json");
            if (fs.existsSync(infoJsonPath)) {
                try {
                  const info = JSON.parse(
                    await fs.promises.readFile(infoJsonPath, "utf-8")
                  );
                  info.calculationStatus = "completed";
                  await fs.promises.writeFile(
                    infoJsonPath,
                    JSON.stringify(info, null, 2),
                    "utf-8"
                  );
                    console.log("Updated info.json to mark calculation as completed");
                } catch (error) {
                  console.error("Failed to update info.json:", error);
                    io.to(caseId).emit("calculationError", {
                        message: "Failed to update calculation status",
                        details: error.message,
                  });
                    return res.status(500).json({
                        success: false,
                        message: "Failed to update calculation status",
                  });
                }
              } else {
                console.warn("info.json not found. Cannot update calculation status.");
                  io.to(caseId).emit("calculationError", {
                        message: "info.json not found",
                    });
                 return res.status(500).json({
                     success: false,
                     message: "info.json not found",
                 });
              }


        io.to(caseId).emit("calculationCompleted", {
            message: "Calculation completed, results are ready",
        });
      res.json({ success: true, message: "Calculation completed" });
    } else {
      console.error(`run.sh exited with code ${code}`);
        io.to(caseId).emit("calculationFailed", {
          message: `Calculation failed with code ${code}`,
        });
      res.status(500).json({
        success: false,
        message: `Calculation failed with code ${code}`,
      });
    }
    });

    child.on("error", (error) => {
        logStream.end();
        console.error(`Error executing run.sh: ${error.message}`);
      io.to(caseId).emit("calculationError", {
        message: "Error executing run.sh",
        details: error.message,
      });
      res
        .status(500)
        .json({ success: false, message: "Error executing run.sh" });
    });
  } catch (error) {
    console.error("计算设置过程中出错:", error);
    io.to(caseId).emit("calculationError", {
      message: "计算设置过程中出错",
      details: error.message,
    });
    res
      .status(500)
      .json({ success: false, message: "计算设置过程中出错" });
  }
});

/**
 * 11. 检查特定工况的 info.json 是否存在
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
 * 12. 下载特定工况的 info.json
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
 * 13. 生成并保存特定工况的 info.json
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

        // 计算中心坐标
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        const centerLon = (minLon + maxLon) / 2;

        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const centerLat = (minLat + maxLat) / 2;

        console.log('Center Coordinates:', { centerLon, centerLat });

        // 构建 info.json 结构
      const infoJson = {
        key: req.params.caseId,
        calculationStatus: 'not_completed', // 初始化计算状态
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


/**
 * 14. 获取特定工况的计算状态
 * GET /api/cases/:caseId/calculation-status
 */
router.get('/:caseId/calculation-status', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');

  console.log('Checking calculation status for case:', caseId);
  console.log('Info.json path:', infoJsonPath);


  if (!fs.existsSync(infoJsonPath)) {
    console.log('Info.json does not exist, returning not_started status');
     return res.json({ calculationStatus: 'not_started' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
    const status = data.calculationStatus || 'not_started';
    console.log('Calculation status:', status);
    res.json({ calculationStatus: status });
  } catch (    error) {
    console.error('Error reading info.json:', error);
    // 返回一个默认状态而不是错误
    res.json({ calculationStatus: 'not_started' });
  }
});


// 存储计算进度
router.post('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

    try {
        await fs.promises.writeFile(progressPath, JSON.stringify(req.body));
        res.json({ success: true });
    } catch (error) {
        console.error('保存计算进度失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// 获取计算进度
router.get('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

    try {
        if (fs.existsSync(progressPath)) {
            const progress = JSON.parse(await fs.promises.readFile(progressPath));
            res.json({ progress });
        } else {
            res.json({ progress: null });
        }
    } catch (error) {
        console.error('获取计算进度失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// 删除计算进度
router.delete('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

    try {
        if (fs.existsSync(progressPath)) {
            await fs.promises.unlink(progressPath);
            res.json({ success: true, message: '计算进度删除成功' });
        } else {
            res.json({ success: true, message: '计算进度文件不存在' });
        }
    } catch (error) {
        console.error('删除计算进度失败:', error);
        res.status(500).json({ success: false, message: '删除计算进度失败', error: error.message });
    }
});
// 获取 OpenFOAM 输出
router.get('/:caseId/openfoam-output', async (req, res) => {
    const { caseId } = req.params;
    const outputPath = path.join(__dirname, `../uploads/${caseId}/openfoam_output.log`);
    try {
        if(fs.existsSync(outputPath)) {
            const output = await fs.promises.readFile(outputPath, 'utf-8');
            res.json({ output });
        } else {
            res.json({output: ''});
        }

    } catch (error) {
        console.error("获取 OpenFOAM 输出失败:", error);
        res.status(500).json({ success: false, error: error.message});
    }
});
module.exports = router;