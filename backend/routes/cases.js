/*
* @Author: joe 847304926@qq.com
* @Date: 2024-12-30 10:58:27
* @LastEditors: joe 847304926@qq.com
* @LastEditTime: 2025-02-29 15:47:21
* @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
* @Description: 后端路由，包含工况创建、参数管理、计算启动及状态持久化机制。
*
* Copyright (c) 2025 by joe, All Rights Reserved.
*/

const express = require("express");
const router = express.Router();
const Joi = require("joi");
const path = require("path");
const fs = require('fs');
const fsPromises = require('fs').promises;
const multer = require("multer");
const { spawn } = require("child_process");
const checkCalculationStatus = require("../middleware/statusCheck");
const rateLimit = require('express-rate-limit');
const { knownTasks } =require('../utils/tasks');
const windTurbinesRouter = require('./windTurbines');
const archiver = require('archiver');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const momenttz = require('moment-timezone');

// 辅助函数
const calculateXY = (lon, lat, centerLon, centerLat) => {
  console.log('calculateXY - Input:', { lon, lat, centerLon, centerLat });
  const EARTH_RADIUS = 6371000;
  const RAD_PER_DEG = Math.PI / 180;
  const METER_PER_DEG_LAT = EARTH_RADIUS * RAD_PER_DEG;
  const LONG_LAT_RATIO = Math.cos(centerLat * RAD_PER_DEG);
  const tempAngle = 0 * RAD_PER_DEG;
  const tempX = (lon - centerLon) * METER_PER_DEG_LAT * LONG_LAT_RATIO;
  const tempY = (lat - centerLat) * METER_PER_DEG_LAT;
  const projx = tempX * Math.cos(tempAngle) - tempY * Math.sin(tempAngle);
  const projy = tempY * Math.cos(tempAngle) + tempX * Math.sin(tempAngle);
  console.log('calculateXY - Output:', { x: projx, y: projy });
  return { x: projx, y: projy };
};

const ensureVTKDirectories = (caseId) => {
  const dirs = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', caseId),
    path.join(__dirname, '..', 'uploads', caseId, 'run'),
    path.join(__dirname, '..', 'uploads', caseId, 'run', 'VTK')
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 将最大请求数提高到1000
  message: '请求过于频繁，请稍后再试',
  skip: (req) => process.env.NODE_ENV !== 'production' // 开发环境跳过限制
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

router.use("/:caseId", (req, res, next) => {
  const { error, value } = caseIdSchema.validate(req.params.caseId);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  req.params.caseId = value;
  next();
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
      cb(null, 'terrain.tif');
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
}).fields([{ name: 'terrainFile', maxCount: 1 }]);

// 1. 创建新工况
router.post('/', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    const caseName = req.body.caseName;
    if (!caseName) {
      return res.status(400).json({ success: false, message: '工况名称不能为空' });
    }
    if (req.files['terrainFile'] && req.files['terrainFile'][0]) {
      console.log("Terrain file uploaded successfully.");
    } else {
      console.error('terrainFile is missing');
      return res.status(400).json({ success: false, message: '请上传 GeoTIFF 文件' });
    }
    res.json({ success: true, message: '工况创建成功', caseName: caseName });
  } catch (err) {
    console.error('Error in creating case:', err);
    res.status(500).json({ success: false, message: err.message || '文件处理失败' });
  }
});

// 2. 获取所有工况
router.get("/", async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsPath)) {
      return res.json({ cases: [] });
    }
    const caseNames = await fsPromises.readdir(uploadsPath, { withFileTypes: true });
    const cases = caseNames.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    res.json({ cases });
  } catch (error) {
    console.error("获取工况列表失败:", error);
    res.status(500).json({ success: false, message: "获取工况列表失败" });
  }
});

// 3. 获取特定工况的地形文件
router.get("/:caseId/terrain", (req, res) => {
  const { caseId } = req.params;
  if (!caseId || caseId === "undefined" || caseId === "null") {
    return res.status(400).json({ success: false, message: "请先选择工况" });
  }
  const casePath = path.join(__dirname, "../uploads", caseId);
  if (!fs.existsSync(casePath)) {
    return res.status(404).json({ success: false, message: "工况不存在" });
  }
  const terrainFilePath = path.join(casePath, "terrain.tif");
  if (!fs.existsSync(terrainFilePath)) {
    return res.status(404).json({ success: false, message: "未找到地形数据" });
  }
  res.sendFile(terrainFilePath, { headers: { "Content-Type": "image/tiff" } }, (err) => {
    if (err) {
      console.error("发送GeoTIFF文件失败:", err);
      res.status(500).json({ success: false, message: "服务器错误" });
    }
  });
});

// 4. 删除工况
router.delete("/:caseId", async (req, res) => {
  const { caseId } = req.params;
  console.log("Attempting to delete case:", caseId);
  if (!caseId) {
    return res.status(400).json({ success: false, message: "工况ID不能为空" });
  }
  const casePath = path.join(__dirname, "../uploads", caseId);
  try {
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({ success: false, message: "工况不存在" });
    }
    await fsPromises.rm(casePath, { recursive: true, force: true });
    console.log("Successfully deleted case directory");
    res.json({ success: true, message: "工况删除成功" });
  } catch (error) {
    console.error("Error deleting case:", error);
    res.status(500).json({ success: false, message: "删除工况失败", error: error.message });
  }
});

// 5. 获取特定工况的参数
router.get("/:caseId/parameters", async (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const parametersPath = path.join(casePath, "parameters.json");
  const infoJsonPath = path.join(casePath, "info.json");
  try {
    let parameters = {};
    if (fs.existsSync(parametersPath)) {
      const parametersData = await fsPromises.readFile(parametersPath, "utf-8");
      parameters = JSON.parse(parametersData);
    }
    if (fs.existsSync(infoJsonPath)) {
      const infoData = await fsPromises.readFile(infoJsonPath, "utf-8");
      const info = JSON.parse(infoData);
      parameters.center = info.center;
      parameters.key = info.key;
    }
    if (Object.keys(parameters).length > 0) {
      res.json({ success: true, parameters: { caseName: parameters.key || caseId, ...parameters } });
    } else {
      res.json({
        success: true,
        parameters: {
          caseName: caseId,
          calculationDomain: { width: 10000, height: 800 },
          conditions: { windDirection: 0, inletWindSpeed: 10 },
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
          simulation: { cores: 1, steps: 100, deltaT: 1 },
          postProcessing: {
            resultLayers: 10,
            layerSpacing: 20,
            layerDataWidth: 1000,
            layerDataHeight: 1000,
          },
          center: { lon: null, lat: null },
        },
      });
    }
  } catch (error) {
    console.error("获取参数失败:", error);
    res.status(500).json({ success: false, message: "获取参数失败" });
  }
});

// 6. 保存特定工况的参数
router.post("/:caseId/parameters", async (req, res) => {
  const { caseId } = req.params;
  const parameters = req.body;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const parametersPath = path.join(casePath, "parameters.json");
  try {
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({ success: false, message: "工况不存在" });
    }
    await fsPromises.writeFile(parametersPath, JSON.stringify(parameters, null, 2));
    res.json({ success: true, message: "参数保存成功" });
  } catch (error) {
    console.error("保存参数失败:", error);
    res.status(500).json({ success: false, message: "保存参数失败" });
  }
});

// 7. 获取特定工况的仿真结果
router.get("/:caseId/results", async (req, res) => {
  const { caseId } = req.params;
  const casePath = path.join(__dirname, "../uploads", caseId);
  const resultsPath = path.join(casePath, "results.json");
  try {
    if (!fs.existsSync(resultsPath)) {
      return res.json({ success: true, results: null, message: "暂无计算结果" });
    }
    const resultsData = await fsPromises.readFile(resultsPath, "utf-8");
    const results = JSON.parse(resultsData);
    res.json({ success: true, results: results });
  } catch (error) {
    console.error("获取结果失败:", error);
    res.status(500).json({ success: false, message: "获取结果失败" });
  }
});

// 8. 启动特定工况的计算（含持久化进度机制）
router.post("/:caseId/calculate", checkCalculationStatus, async (req, res) => {
  const { caseId } = req.params;
  const scriptPath = path.join(__dirname, "../base/run.sh");
  const casePath = path.join(__dirname, "../uploads", caseId);
  const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ success: false, message: "run.sh 脚本未找到" });
  }
  if (!fs.existsSync(casePath)) {
    return res.status(404).json({ success: false, message: "工况不存在" });
  }
  if (req.calculationStatus === "completed") {
    return res.status(400).json({ success: false, message: "该工况已完成计算，无法重新计算" });
  }

  const io = req.app.get("socketio");

  // 初始化任务状态（使用对象）
  const taskStatuses = {};
  knownTasks.forEach(task => {
    taskStatuses[task.id] = "pending";
  });

  // 更新 info.json 状态
  const infoJsonPath = path.join(casePath, "info.json");
  if (fs.existsSync(infoJsonPath)) {
    try {
      const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
      info.calculationStatus = "running";
      await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
      console.log("Updated info.json to mark calculation as running");
    } catch (err) {
      console.warn("更新 info.json 失败:", err);
    }
  } else {
    console.warn("info.json not found. Cannot update calculation status.");
  }

  try {
    // 使用 stdbuf -oL 保证行缓冲，进程内立即输出
    const child = spawn("bash", [scriptPath], { cwd: casePath, shell: false });
    const logFilePath = path.join(casePath, `calculation_log_${Date.now()}.txt`);
    const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
    console.log(`Executing run.sh for case: ${caseId}`);

    child.stdout.on("data", async (data) => {
      const lines = data.toString().split("\n").filter(line => line.trim() !== "");
      for (const line of lines) {
        if (line.startsWith('{')) { // Check if line *might* be JSON
          try {
            const msg = JSON.parse(line);
            if (msg.action === "taskStart") {
              const taskId = msg.taskId;
              if (knownTasks.some(task => task.id === taskId)) {
                taskStatuses[taskId] = "running";
                io.to(caseId).emit("taskStarted", taskId);
                console.log(`Task started: ${taskId}`);
              }
            } else if (msg.action === "progress") {
              if (msg.progress === "ERROR") {
                const taskId = msg.taskId;
                taskStatuses[taskId] = "error";
                io.to(caseId).emit("calculationError", { message: "脚本错误", taskId });
                console.error(`Task error: ${taskId}`);
              } else {
                const percent = parseInt(msg.progress, 10);
                const taskId = msg.taskId;
                if (!isNaN(percent) && knownTasks.some(task => task.id === taskId)) {
                  if (percent === 100) {
                    taskStatuses[taskId] = "completed";
                    console.log(`Task completed: ${taskId}`);
                  }
                  io.to(caseId).emit("calculationProgress", { progress: percent, taskId });
                  const progressData = {
                    isCalculating: true,
                    progress: percent,
                    tasks: taskStatuses,
                    outputs: [], // 可根据需要累加输出
                    timestamp: Date.now(),
                    completed: false,
                  };
                  try {
                    await fsPromises.writeFile(progressPath, JSON.stringify(progressData, null, 2));
                  } catch (err) {
                    console.error("写入计算进度文件失败:", err);
                    return res.status(500).json({ success: false, message: "Failed to save calculation progress", error: err.message });
                  }
                }
              }
            } else if (msg.action === "info") {
              io.to(caseId).emit("calculationOutput", msg.message); // Handle 'info' action as before
            }
          } catch (e) {
            io.to(caseId).emit("calculationOutput", line); // Emit the line as plain text
          }
        } else {
          // Treat lines that don't start with '{' as plain text output
          io.to(caseId).emit("calculationOutput", line); // Emit as plain text
        }
      }
      io.to(caseId).emit("taskUpdate", taskStatuses);
    });

    child.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      logStream.write(`ERROR: ${errorOutput}`);
      console.error(`run.sh stderr: ${errorOutput}`);
      io.to(caseId).emit("calculationError", { message: "脚本错误", details: errorOutput });
    });

    child.on("close", async (code) => {
      logStream.end();
      if (code === 0) {
        console.log("run.sh completed successfully");
        const finalProgressData = {
          isCalculating: false,
          progress: 100,
          tasks: taskStatuses,
          outputs: [],
          completed: true,
          timestamp: Date.now(),
        };
        try {
          await fsPromises.writeFile(progressPath, JSON.stringify(finalProgressData, null, 2));
        } catch (err) {
          console.error("写入最终计算进度失败:", err);
          return res.status(500).json({ success: false, message: "Failed to save final calculation progress", error: err.message });
        }
        if (fs.existsSync(infoJsonPath)) {
          try {
            const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
            info.calculationStatus = "completed";
            await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
            console.log("Updated info.json to mark calculation as completed");
          } catch (error) {
            console.error("Failed to update info.json:", error);
            io.to(caseId).emit("calculationError", { message: "Failed to update calculation status", details: error.message });
            return res.status(500).json({ success: false, message: "Failed to update calculation status" });
          }
        } else {
          console.warn("info.json not found. Cannot update calculation status.");
          io.to(caseId).emit("calculationError", { message: "info.json not found" });
          return res.status(500).json({ success: false, message: "info.json not found" });
        }
        io.to(caseId).emit("calculationCompleted", { message: "Calculation completed, results are ready" });
        res.json({ success: true, message: "Calculation completed" });
      } else {
        console.error(`run.sh exited with code ${code}`);
        io.to(caseId).emit("calculationFailed", { message: `Calculation failed with code ${code}` });
        res.status(500).json({ success: false, message: `Calculation failed with code ${code}` });
      }
    });

    child.on("error", (error) => {
      logStream.end();
      console.error(`Error executing run.sh: ${error.message}`);
      io.to(caseId).emit("calculationError", { message: "Error executing run.sh", details: error.message });
      res.status(500).json({ success: false, message: "Error executing run.sh" });
    });
  } catch (error) {
    console.error("计算设置过程中出错:", error);
    io.to(caseId).emit("calculationError", { message: "计算设置过程中出错", details: error.message });
    res.status(500).json({ success: false, message: "计算设置过程中出错" });
  }
});

// 11. 检查特定工况的 info.json 是否存在
router.get('/:caseId/info-exists', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
  try {
    const exists = fs.existsSync(infoJsonPath);
    res.json({ exists });
  } catch (error) {
    console.error(`Error checking info.json: ${error}`);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 12. 下载特定工况的 info.json
router.get('/:caseId/info-download', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
  if (!fs.existsSync(infoJsonPath)) {
    return res.status(404).json({ success: false, message: 'info.json 不存在' });
  }
  res.sendFile(infoJsonPath, { headers: { 'Content-Type': 'application/json' } }, (err) => {
    if (err) {
      console.error('发送 info.json 失败:', err);
      res.status(500).json({ success: false, message: '服务器错误' });
    }
  });
});

// 13. 生成并保存特定工况的 info.json
router.post('/:caseId/info', async (req, res) => {
  try {
    const turbineSchema = Joi.object({
      id: Joi.string().required(),
      longitude: Joi.number().required(),
      latitude: Joi.number().required(),
      hubHeight: Joi.number().required(),
      rotorDiameter: Joi.number().required(),
      model: Joi.string().optional(),
      type: Joi.string().optional(),
      name: Joi.string().optional(),
    });
    const schema = Joi.object({
      parameters: Joi.object().required(),
      windTurbines: Joi.array().items(turbineSchema).min(1).required(),
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({ success: false, message: errorMessages });
    }
    const { parameters, windTurbines } = value;
    const longitudes = windTurbines.map(turbine => turbine.longitude);
    const latitudes = windTurbines.map(turbine => turbine.latitude);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const centerLon = (minLon + maxLon) / 2;
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const centerLat = (minLat + maxLat) / 2;
    const infoJson = {
      key: req.params.caseId,
      calculationStatus: 'not_completed',
      domain: { lt: parameters.calculationDomain.width, h: parameters.calculationDomain.height },
      wind: { angle: parameters.conditions.windDirection, speed: parameters.conditions.inletWindSpeed },
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
      simulation: { core: parameters.simulation.cores, step_count: parameters.simulation.steps, deltaT: parameters.simulation.deltaT },
      post: {
        numh: parameters.postProcessing.resultLayers,
        dh: parameters.postProcessing.layerSpacing,
        width: parameters.postProcessing.layerDataWidth,
        height: parameters.postProcessing.layerDataHeight,
      },
      turbines: windTurbines.map(turbine => {
        const { x, y } = calculateXY(turbine.longitude, turbine.latitude, centerLon, centerLat);
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
      center: { lon: centerLon, lat: centerLat },
    };
    const casePath = path.join(__dirname, '../uploads', req.params.caseId);
    fs.mkdirSync(casePath, { recursive: true });
    const infoJsonPath = path.join(casePath, 'info.json');
    fs.writeFileSync(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');
    res.json({ success: true, message: 'info.json 生成成功' });
  } catch (error) {
    console.error('生成和保存 info.json 失败:', error);
    return res.status(500).json({ success: false, message: '生成和保存 info.json 失败' });
  }
});

// 14. 获取特定工况的计算状态
router.get('/:caseId/calculation-status', (req, res) => {
  const { caseId } = req.params;
  const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
  if (!fs.existsSync(infoJsonPath)) {
    return res.json({ calculationStatus: 'not_started' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
    const status = data.calculationStatus || 'not_started';
    res.json({ calculationStatus: status });
  } catch (error) {
    console.error('Error reading info.json:', error);
    res.json({ calculationStatus: 'not_started' });
  }
});

// 存储计算进度
router.post('/:caseId/calculation-progress', async (req, res) => {
  const { caseId } = req.params;
  const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
  try {
    await fs.promises.writeFile(progressPath, JSON.stringify(req.body, null, 2));
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

// 保存风机状态
router.post('/:caseId/state', async (req, res) => {
  const { caseId } = req.params;
  const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);
  try {
    await fs.promises.writeFile(statePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: '风机状态保存成功' });
  } catch (error) {
    console.error('保存风机状态失败:', error);
    res.status(500).json({ success: false, message: '保存风机状态失败', error: error.message });
  }
});

// 获取风机状态
router.get('/:caseId/state', async (req, res) => {
  const { caseId } = req.params;
  const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);
  try {
    if (fs.existsSync(statePath)) {
      const stateData = await fs.promises.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData);
      res.json({ success: true, windTurbines: state.windTurbines });
    } else {
      res.json({ success: true, windTurbines: [] });
    }
  } catch (error) {
    console.error('获取风机状态失败:', error);
    res.status(500).json({ success: false, message: '获取风机状态失败', error: error.message });
  }
});

// 修改获取VTK文件列表的路由
router.get('/:caseId/vtk-files', async (req, res) => {
  const { caseId } = req.params;
  const vtkPath = path.join(__dirname, '../uploads', caseId, 'run', 'VTK');
  try {
    if (!fs.existsSync(vtkPath)) {
      console.log(`VTK directory not found: ${vtkPath}`);
      return res.status(404).json({ success: false, error: 'VTK directory not found', path: vtkPath });
    }
    const files = fs.readdirSync(vtkPath);
    const vtkFiles = files.filter(f => f.endsWith('.vtk') || f.endsWith('.vtu') || f.endsWith('.vtm'));
    console.log(`Found VTK files in ${vtkPath}:`, vtkFiles);
    res.json({ success: true, files: vtkFiles });
  } catch (error) {
    console.error('Error reading VTK directory:', error);
    res.status(500).json({ success: false, error: 'Error reading VTK directory', message: error.message });
  }
});

router.use('/:caseId', (req, res, next) => {
  ensureVTKDirectories(req.params.caseId);
  next();
});

// 主要的VTK文件处理路由
router.get('/:caseId/VTK/*', async (req, res) => {
  const { caseId } = req.params;
  const filePath = path.join(__dirname, '../uploads', caseId, 'run/VTK', req.params[0]);
  try {
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return res.status(404).json({ success: false, error: 'VTK file not found', path: filePath });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.json' ? 'application/json' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('Error reading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error reading file', details: error.message });
      }
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving VTK file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 列出可用的VTK文件
router.get('/:caseId/list-vtk-files', async (req, res) => {
  const { caseId } = req.params;
  const vtkPath = path.join(__dirname, '../uploads', caseId, 'run', 'VTK');
  try {
    if (!fs.existsSync(vtkPath)) {
      return res.status(404).json({ success: false, error: 'VTK directory not found', path: vtkPath });
    }
    const getVtkFiles = (dir) => {
      let results = [];
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(getVtkFiles(fullPath));
        } else {
          const ext = path.extname(file).toLowerCase();
          if (['.vtk', '.vtu', '.vtp', '.vtm'].includes(ext)) {
            results.push(fullPath.replace(vtkPath + '/', ''));
          }
        }
      }
      return results;
    };
    const vtkFiles = getVtkFiles(vtkPath);
    res.json({ success: true, files: vtkFiles, baseDirectory: vtkPath });
  } catch (error) {
    console.error('Error listing VTK files:', error);
    res.status(500).json({ success: false, error: 'Failed to list VTK files', details: error.message });
  }
});

router.post('/:caseId/process-vtk', async (req, res) => {
  const { caseId } = req.params;
  const inputPath = path.join(__dirname, '../uploads', caseId, 'run/VTK/run_0/internal.vtu');
  const outputDir = path.join(__dirname, '../uploads', caseId, 'run/VTK/processed');
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const pythonProcess = spawn('python3', [
      path.join(__dirname, '../utils/process_vtk.py'),
      inputPath,
      outputDir
    ]);
    let outputData = '';
    let errorData = '';
    pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); });
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) { resolve(); } else { reject(new Error(`Python process exited with code ${code}: ${errorData}`)); }
      });
    });
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, 'metadata.json'), 'utf8'));
    res.json({ success: true, metadata });
  } catch (error) {
    console.error('Error processing VTK file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 新增接口：获取特定工况的速度场 vtp 文件列表
 * 目录位置：uploads/{caseId}/run/postProcessing/Data
 * 仅返回文件名中包含 'U_field' 且后缀为 .vtp 的文件
 */
router.get('/:caseId/list-velocity-files', async (req, res) => {
  const { caseId } = req.params;
  const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');
  try {
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({
        success: false,
        message: '目录不存在',
        path: dataPath
      });
    }
    const files = await fsPromises.readdir(dataPath);
    // 过滤出包含 U_field 且后缀为 .vtp 的文件（可根据实际情况调整过滤规则）
    const velocityFiles = files.filter(file => file.endsWith('.vtp'));
    res.json({ success: true, files: velocityFiles });
  } catch (error) {
    console.error('Error reading velocity files:', error);
    res.status(500).json({
      success: false,
      message: '读取速度场文件失败',
      details: error.message
    });
  }
});

// 列出当前工况 Output 目录下的指定三个文件
router.get('/:caseId/list-output-files', async (req, res) => {
  const { caseId } = req.params;
  const outputPath = path.join(__dirname, '../uploads', caseId, 'run', 'Output');
  try {
    if (!fs.existsSync(outputPath)) {
      return res.status(404).json({ success: false, message: 'Output目录不存在', path: outputPath });
    }
    const files = await fsPromises.readdir(outputPath);
    const validFiles = files.filter(file =>
      ['Output02-realHigh', 'Output04-U-P-Ct-fn(INIT)', 'Output06-U-P-Ct-fn(ADJUST)'].includes(file)
    );
    res.json({ success: true, files: validFiles, baseDirectory: outputPath });
  } catch (error) {
    console.error('Error listing Output files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 读取指定文件内容
router.get('/:caseId/output-file/:fileName', async (req, res) => {
  const { caseId, fileName } = req.params;
  const outputPath = path.join(__dirname, '../uploads', caseId, 'run', 'Output', fileName);
  try {
    if (!fs.existsSync(outputPath)) {
      return res.status(404).json({ success: false, message: 'Output文件不存在', path: outputPath });
    }
    const content = await fsPromises.readFile(outputPath, 'utf-8');
    res.json({ success: true, content });
  } catch (error) {
    console.error('Error reading output file:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 导出所有速度场文件为ZIP
router.get('/:caseId/export-velocity-layers', async (req, res) => {
  const { caseId } = req.params;
  const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');
  
  if (!fs.existsSync(dataPath)) {
    return res.status(404).json({ success: false, message: '数据目录不存在' });
  }
  
  try {
    // 获取所有VTP文件
    const files = fs.readdirSync(dataPath).filter(file => file.endsWith('.vtp'));
    
    if (files.length === 0) {
      return res.status(404).json({ success: false, message: '未找到VTP文件' });
    }
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${caseId}_velocity_layers.zip`);
    
    // 创建ZIP归档
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    // 添加所有文件到ZIP
    for (const file of files) {
      const filePath = path.join(dataPath, file);
      archive.file(filePath, { name: `${file}` });
    }
    
    // 完成ZIP并发送
    await archive.finalize();
  } catch (error) {
    console.error('创建ZIP文件失败:', error);
    // 如果响应头尚未发送，返回错误
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '创建ZIP文件失败', error: error.message });
    }
  }
});

// 获取完整风机性能数据（用于PDF报告）
router.get('/:caseId/turbine-performance-data', async (req, res) => {
  const { caseId } = req.params;
  try {
    // 获取风机位置数据
    const realHighPath = path.join(__dirname, `../uploads/${caseId}/run/Output/Output02-realHigh`);
    // 获取初始性能数据
    const initPerfPath = path.join(__dirname, `../uploads/${caseId}/run/Output/Output04-U-P-Ct-fn(INIT)`);
    // 获取调整后性能数据
    const adjPerfPath = path.join(__dirname, `../uploads/${caseId}/run/Output/Output06-U-P-Ct-fn(ADJUST)`);
    
    // 检查文件是否存在
    if (!fs.existsSync(realHighPath) || !fs.existsSync(initPerfPath) || !fs.existsSync(adjPerfPath)) {
      return res.status(404).json({ success: false, message: '风机性能数据文件不存在' });
    }
    
    // 读取文件内容
    const realHighContent = await fsPromises.readFile(realHighPath, 'utf-8');
    const initPerfContent = await fsPromises.readFile(initPerfPath, 'utf-8');
    const adjPerfContent = await fsPromises.readFile(adjPerfPath, 'utf-8');
    
    res.json({
      success: true,
      data: {
        realHigh: realHighContent,
        initPerf: initPerfContent,
        adjPerf: adjPerfContent
      }
    });
  } catch (error) {
    console.error('获取风机性能数据失败:', error);
    res.status(500).json({ success: false, message: '获取风机性能数据失败', error: error.message });
  }
});

// 服务器端PDF报告生成
router.post('/:caseId/generate-pdf-report', async (req, res) => {
  const { caseId } = req.params;
  console.log(`开始为工况 ${caseId} 生成PDF报告`);
  try {
    // 确认目录存在
    const casePath = path.join(__dirname, '../uploads', caseId);
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({ success: false, message: '工况不存在' });
    }
    
    // 读取各类必要数据
    // 1. 读取参数
    const parametersPath = path.join(casePath, 'parameters.json');
    let parameters = null;
    if (fs.existsSync(parametersPath)) {
      parameters = JSON.parse(await fsPromises.readFile(parametersPath, 'utf-8'));
    } else {
      // 使用默认参数
      parameters = {
        calculationDomain: { width: 10000, height: 800 },
        conditions: { windDirection: 0, inletWindSpeed: 10 },
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
        simulation: { cores: 1, steps: 100, deltaT: 1 },
        postProcessing: {
          resultLayers: 10,
          layerSpacing: 20,
          layerDataWidth: 1000,
          layerDataHeight: 1000,
        }
      };
    }
    
    // 2. 读取info.json获取工况名称和计算状态
    const infoJsonPath = path.join(casePath, 'info.json');
    let caseName = caseId;
    let calculationStatus = 'not_started';
    let centerCoordinates = { lon: null, lat: null };
    if (fs.existsSync(infoJsonPath)) {
      const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
      caseName = info.key || caseId;
      calculationStatus = info.calculationStatus || 'not_started';
      centerCoordinates = info.center || { lon: null, lat: null };
    }
    
    // 3. 获取风机数据
    const turbineStatePath = path.join(casePath, 'turbine_state.json');
    let windTurbines = [];
    if (fs.existsSync(turbineStatePath)) {
      const state = JSON.parse(await fsPromises.readFile(turbineStatePath, 'utf-8'));
      windTurbines = state.windTurbines || [];
    }
    
    // 4. 获取计算进度
    const progressPath = path.join(casePath, 'calculation_progress.json');
    let overallProgress = 0;
    if (fs.existsSync(progressPath)) {
      const progress = JSON.parse(await fsPromises.readFile(progressPath, 'utf-8'));
      overallProgress = progress.progress || 0;
    }
    
    // 5. 获取结果数据（如果有）
    const resultsPath = path.join(casePath, 'results.json');
    let results = {};
    if (fs.existsSync(resultsPath)) {
      results = JSON.parse(await fsPromises.readFile(resultsPath, 'utf-8'));
    }
    
    // 6. 获取风机性能数据
    let turbinePerformance = {
      turbineCount: windTurbines.length,
      avgSpeed: null,
      totalPower: null,
      avgCt: null
    };
    
    // 尝试从Output文件中提取风机性能数据
    const adjPerfPath = path.join(casePath, 'run/Output/Output06-U-P-Ct-fn(ADJUST)');
    if (fs.existsSync(adjPerfPath)) {
      try {
        const adjPerfContent = await fsPromises.readFile(adjPerfPath, 'utf-8');
        const lines = adjPerfContent.split('\n').filter(line => line.trim() !== '');
        
        // 排除标题行，计算平均值
        const dataLines = lines.slice(1);
        if (dataLines.length > 0) {
          let totalSpeed = 0;
          let totalPower = 0;
          let totalCt = 0;
          
          for (const line of dataLines) {
            const values = line.trim().split(/\s+/);
            if (values.length >= 4) {
              totalSpeed += parseFloat(values[1]) || 0;
              totalPower += parseFloat(values[2]) || 0;
              totalCt += parseFloat(values[3]) || 0;
            }
          }
          
          turbinePerformance.avgSpeed = (totalSpeed / dataLines.length).toFixed(2);
          turbinePerformance.totalPower = totalPower.toFixed(2);
          turbinePerformance.avgCt = (totalCt / dataLines.length).toFixed(3);
        }
      } catch (error) {
        console.error('提取风机性能数据失败:', error);
      }
    }
    
    // 生成中心坐标字符串
    let centerCoordinatesText = "经度: N/A, 纬度: N/A";
    if (centerCoordinates.lon && centerCoordinates.lat) {
      centerCoordinatesText = `经度: ${centerCoordinates.lon.toFixed(6)}, 纬度: ${centerCoordinates.lat.toFixed(6)}`;
    } else if (windTurbines.length > 0) {
      // 如果没有中心坐标但有风机，计算中心点
      try {
        const longitudes = windTurbines.map(turbine => parseFloat(turbine.longitude));
        const latitudes = windTurbines.map(turbine => parseFloat(turbine.latitude));
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        centerCoordinatesText = `经度: ${centerLon.toFixed(6)}, 纬度: ${centerLat.toFixed(6)}`;
      } catch (error) {
        console.error('计算中心坐标失败:', error);
      }
    }
    
    // 获取当前日期时间（中国时区）
    const now = momenttz().tz('Asia/Shanghai');
    const dateStr = now.format('YYYY-MM-DD');
    const timeStr = now.format('HH:mm:ss');
    
    // 准备报告数据
    const reportData = {
      caseId,
      caseName,
      centerCoordinates: centerCoordinatesText,
      dateGenerated: dateStr,
      timeGenerated: timeStr,
      parameters,
      turbines: windTurbines,
      status: {
        calculationStatus,
        progress: overallProgress,
        statusText: getStatusText(calculationStatus)
      },
      results,
      turbineStats: turbinePerformance
    };
    
   // 使用二进制流处理
   const pdfBuffer = await generatePDF(reportData);
    
   if (!pdfBuffer || pdfBuffer.length < 1000) {
     throw new Error(`PDF生成失败或内容不完整 (${pdfBuffer ? pdfBuffer.length : 0} bytes)`);
   }
   
   // 直接以二进制流发送，不使用res.send()
   res.writeHead(200, {
     'Content-Type': 'application/pdf',
     'Content-Length': pdfBuffer.length,
     'Content-Disposition': `attachment; filename="${encodeURIComponent(caseName || caseId)}_report.pdf"`
   });
   res.end(pdfBuffer);
   
   console.log(`PDF报告生成成功，大小: ${pdfBuffer.length} bytes`);
 } catch (error) {
   console.error('生成PDF报告失败:', error);
   res.status(500).json({ 
     success: false, 
     message: '生成PDF报告失败',
     error: error.message 
   });
 }
});

// 获取计算状态文本
function getStatusText(status) {
  switch (status) {
    case 'running':
      return '计算进行中';
    case 'completed':
      return '计算已完成';
    case 'error':
      return '计算出错';
    case 'not_started':
    case 'not_completed':
      return '未开始计算';
    default:
      return '未知状态';
  }
}

// 生成PDF的函数
// Generate PDF using Puppeteer
async function generatePDF(data) {
  try {
    // Read the template
    const templatePath = path.join(__dirname, '../templates/report-template.html');
    const templateContent = await fsPromises.readFile(templatePath, 'utf-8');
    
    // Register Handlebars helpers
    handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });
    
    handlebars.registerHelper('gt', function(a, b) {
      return a > b;
    });
    
    // Add status color
    if (data.status) {
      switch(data.status.calculationStatus) {
        case 'completed':
          data.status.statusColor = '#10b981';
          break;
        case 'running':
          data.status.statusColor = '#3b82f6';
          break;
        case 'error':
          data.status.statusColor = '#ef4444';
          break;
        default:
          data.status.statusColor = '#6b7280';
      }
    }
    
    // Compile the template
    const template = handlebars.compile(templateContent);
    
    // Render HTML
    const html = template(data);
    
    // For debugging - save the rendered HTML
    const debugHtmlPath = path.join(__dirname, '../debug_report.html');
    await fsPromises.writeFile(debugHtmlPath, html);
    
    // Launch Puppeteer with explicit options for reliability
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--lang=zh-CN',
        '--font-render-hinting=medium'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set content and wait until network is idle
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Add a small delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate PDF with explicit settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      displayHeaderFooter: false
    });
    
    // Close the browser
    await browser.close();
    
    // For debugging - save the generated PDF
    const debugPdfPath = path.join(__dirname, '../debug_report.pdf');
    await fsPromises.writeFile(debugPdfPath, pdfBuffer);
    
    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
}


router.use("/:caseId/wind-turbines", windTurbinesRouter);

module.exports = router;