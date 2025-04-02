/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 11:28:56
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 19:19:23
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

/**
  • @Author: joe 847304926@qq.com
  • @Date: 2024-12-30 10:58:27
  • @LastEditors: joe 您的名字
  • @LastEditTime: 2025-04-01 14:57:56
  • @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
  • @Description: 后端路由，包含工况创建、参数管理、计算启动及状态持久化机制。
  *
  • Copyright (c) 2025 by joe, All Rights Reserved.
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
  const { knownTasks } = require('../utils/tasks');
  const windTurbinesRouter = require('./windTurbines');
  const archiver = require('archiver');
  const pdfDataService = require('../services/pdfDataService'); // 引入 PDF 数据服务
  
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
  // cases.js - GET /:caseId/terrain - 确保使用这个版本
  router.get("/:caseId/terrain", (req, res) => {
      const { caseId } = req.params;
      if (!caseId || caseId === "undefined" || caseId === "null") {
          return res.status(400).json({ success: false, message: "请先选择工况" });
      }
      const casePath = path.join(__dirname, "../uploads", caseId);
      if (!fs.existsSync(casePath)) {
          return res.status(404).json({ success: false, message: "工况目录不存在" });
      }
      const terrainFilePath = path.join(casePath, "terrain.tif");
      if (!fs.existsSync(terrainFilePath)) {
          return res.status(404).json({ success: false, message: "未找到地形数据" });
      }
  
      res.setHeader('Content-Type', 'image/tiff');
      const stream = fs.createReadStream(terrainFilePath);
  
      stream.on('error', (err) => {
          console.error(`读取地形文件流时出错 (${terrainFilePath}):`, err);
          if (!res.headersSent) {
              res.status(500).json({ success: false, message: "读取地形文件失败" });
          } else {
              res.end();
          }
      });
  
      stream.pipe(res);
  
      req.on('close', () => {
          console.log(`客户端断开了地形文件请求 (${terrainFilePath})`);
          stream.destroy();
      });
  }); // <--- 确保这个结尾括号和花括号都在
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
      const cacheDir = path.join(__dirname, '../uploads', caseId, 'visualization_cache'); // 定义缓存目录路径
  
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
  
      // --- (清理旧的可视化缓存 - 在开始计算前) ---
      try {
          if (fs.existsSync(cacheDir)) {
              console.log(`Clearing existing visualization cache before calculation for case: ${caseId}`);
              await fsPromises.rm(cacheDir, { recursive: true, force: true });
          }
      } catch(err) {
          console.warn(`Warning: Failed to clear visualization cache for ${caseId} before calculation:`, err);
          // 不阻断计算，仅记录警告
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
                                          outputs: [],
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
                              io.to(caseId).emit("calculationOutput", msg.message);
                          }
                      } catch (e) {
                          io.to(caseId).emit("calculationOutput", line);
                      }
                  } else {
                      // Treat lines that don't start with '{' as plain text output
                      io.to(caseId).emit("calculationOutput", line);
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
                  console.log("Main calculation (run.sh) completed successfully for case:", caseId);
                  // --- (保存最终计算进度) ---
                  // ...
                  // --- (更新 info.json 状态为 completed) ---
                  // ...
  
                  // *** 计算成功后，触发可视化预计算 ***
                  console.log(`Main calculation finished, triggering visualization precomputation for ${caseId}...`);
                  io.to(caseId).emit("visualization_status", { status: 'starting' }); // 通知前端预计算开始
  
                  const precomputeScriptPath = path.join(__dirname, '../utils/precompute_visualization.py');
                  if (fs.existsSync(precomputeScriptPath)) {
                      const precomputeProcess = spawn('python3', [precomputeScriptPath, '--caseId', caseId], { stdio: ['ignore', 'pipe', 'pipe'] });
  
                      let precomputeStdout = '';
                      precomputeProcess.stdout.on('data', (data) => {
                          const output = data.toString().trim();
                          precomputeStdout += output + '\n';
                          console.log(`Precompute (${caseId}) stdout: ${output}`);
                          io.to(caseId).emit('visualization_progress', { message: output });
                      });
  
                      let precomputeStderr = '';
                      precomputeProcess.stderr.on('data', (data) => {
                          const errorOutput = data.toString().trim();
                          precomputeStderr += errorOutput + '\n';
                          console.error(`Precompute (${caseId}) stderr: ${errorOutput}`);
                          io.to(caseId).emit('visualization_error', { message: errorOutput });
                      });
  
                      precomputeProcess.on('close', (precomputeCode) => {
                          const precomputeStatus = precomputeCode === 0 ? 'completed' : 'failed';
                          console.log(`Visualization precomputation for ${caseId} finished with code ${precomputeCode} (${precomputeStatus}).`);
                          io.to(caseId).emit('visualization_status', { status: precomputeStatus, code: precomputeCode });
                          if (precomputeCode !== 0) {
                              console.error(`Visualization precomputation failed for ${caseId}. Full stderr:\n${precomputeStderr}`);
                          } else {
                              console.log(`Visualization precomputation succeeded for ${caseId}. Full stdout:\n${precomputeStdout}`);
                          }
                      });
  
                      precomputeProcess.on('error', (err) => {
                          console.error(`Failed to start visualization precomputation process for ${caseId}:`, err);
                          io.to(caseId).emit('visualization_status', { status: 'failed', error: err.message });
                      });
  
                  } else {
                      console.error(`Visualization precomputation script not found at ${precomputeScriptPath}`);
                      io.to(caseId).emit('visualization_status', { status: 'failed', error: 'Precomputation script not found on server.' });
                  }
  
                  // 主计算已完成，无论预计算是否开始/成功，都先返回成功响应
                  res.json({ success: true, message: "Main calculation completed. Visualization precomputation started." });
  
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
  
  // --- 预计算相关 API ---
  
  // 获取元数据
  router.get('/:caseId/visualization-metadata', async (req, res) => {
      const { caseId } = req.params;
      const metadataPath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'metadata.json');
      try {
          if (!fs.existsSync(metadataPath)) {
              return res.status(404).json({ success: false, message: 'Metadata cache not found. Please run pre-computation or wait for it to complete.' });
          }
          const data = await fsPromises.readFile(metadataPath, 'utf-8');
          res.json({ success: true, metadata: JSON.parse(data) }); // 直接返回解析后的JSON
      } catch (error) {
          console.error(`Error reading metadata cache for ${caseId}:`, error);
          res.status(500).json({ success: false, message: 'Failed to read metadata cache.' });
      }
  });
  
// Find the existing GET /:caseId/visualization-slice route and REPLACE it with this:
router.get('/:caseId/visualization-slice', async (req, res) => {
  const { caseId } = req.params;
  const requestedHeight = parseFloat(req.query.height);

  if (isNaN(requestedHeight)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing height parameter.' });
  }

  // --- Define paths ---
  const baseUploadPath = path.join(__dirname, '../uploads', caseId);
  const cachePath = path.join(baseUploadPath, 'visualization_cache');
  const metadataPath = path.join(cachePath, 'metadata.json');
  // *** IMPORTANT: Point to the directory where PNG images are saved ***
  const slicesImgDir = path.join(cachePath, 'slices_img'); // Or 'slices' if you saved images there

  try {
      // 1. Read metadata to find available heights, turbines, extent, etc.
      if (!fs.existsSync(metadataPath)) {
          console.error(`Metadata file not found for case ${caseId} at ${metadataPath}`);
          return res.status(404).json({ success: false, message: 'Metadata cache not found. Please run pre-computation.' });
      }
      const metadata = JSON.parse(await fsPromises.readFile(metadataPath, 'utf-8'));
      const availableHeights = metadata.heightLevels || [];
      const turbines = metadata.turbines || [];
      // Ensure extentKm exists, fall back to extent if necessary
      const extentKm = metadata.extentKm || metadata.extent;
      if (!extentKm) {
           console.error(`extentKm or extent missing in metadata for case ${caseId}`);
           return res.status(500).json({ success: false, message: 'Domain extent information missing in metadata.' });
      }

      if (availableHeights.length === 0) {
          return res.status(404).json({ success: false, message: 'No height levels found in metadata.' });
      }

      // 2. Find the closest available height in the pre-computed levels
      const actualHeight = availableHeights.reduce((prev, curr) =>
          Math.abs(curr - requestedHeight) < Math.abs(prev - requestedHeight) ? curr : prev
      );

      // 3. Construct the expected image filename and its full path on the server
      const imageFilename = `slice_height_${actualHeight.toFixed(1)}.png`;
      const imagePathOnServer = path.join(slicesImgDir, imageFilename);

      // 4. Construct the public URL path for the client (browser)
      // This URL depends on how you set up static file serving in your main server file (app.js/server.js)
      // If you used: app.use('/uploads', express.static(...)) then the URL structure is:
      const imageUrl = `/uploads/${caseId}/visualization_cache/slices_img/${imageFilename}`; // Adjust 'slices_img' if needed

      // 5. Check if the image file actually exists on the server
      if (!fs.existsSync(imagePathOnServer)) {
           console.warn(`Image file not found at expected path: ${imagePathOnServer}`);
          return res.status(404).json({
              success: false,
              message: `Image for height ${actualHeight.toFixed(1)}m not found. Pre-computation may be needed or failed.`,
              debug_expectedPath: imagePathOnServer // For server-side debugging
          });
      }

      // 6. Return the required information to the frontend
      res.json({
          success: true,
          sliceImageUrl: imageUrl,      // The public URL for the <img> tag's src
          actualHeight: actualHeight,   // The height this image represents
          turbines: turbines,           // Data for the canvas overlay
          extentKm: extentKm,           // Domain boundaries for coordinate mapping on canvas
          vmin: metadata.vmin,          // Min value for potential color bar display
          vmax: metadata.vmax           // Max value for potential color bar display
      });

  } catch (error) {
      console.error(`Error processing /visualization-slice for ${caseId}, height ${requestedHeight}:`, error);
      res.status(500).json({ success: false, message: 'Internal server error while retrieving slice information.' });
  }
});
  
  // 获取风廓线
  router.get('/:caseId/visualization-profile/:turbineId', async (req, res) => {
    // ... (Your existing implementation seems correct, returning { success: true, profile: ... })
    const { caseId, turbineId } = req.params;
    // Make sure the path points to the JSON files, not images
    const profilePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'profiles', `turbine_${turbineId}.json`);
    try {
        if (!fs.existsSync(profilePath)) {
            return res.status(404).json({ success: false, message: `Profile data for turbine ${turbineId} not found.` });
        }
        const data = await fsPromises.readFile(profilePath, 'utf-8');
        // Ensure the response structure matches what getProfileData expects
        res.json({ success: true, profile: JSON.parse(data) });
    } catch (error) {
        console.error(`Error reading profile cache for ${caseId}, turbine ${turbineId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to read profile data cache.' });
    }
});

router.get('/:caseId/visualization-wake/:turbineId', async (req, res) => {
    // ... (Your existing implementation seems correct, returning { success: true, wake: ... })
     const { caseId, turbineId } = req.params;
     // Make sure the path points to the JSON files, not images
     const wakePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'wakes', `turbine_${turbineId}.json`);
     try {
         if (!fs.existsSync(wakePath)) {
             return res.status(404).json({ success: false, message: `Wake data for turbine ${turbineId} not found.` });
         }
         const data = await fsPromises.readFile(wakePath, 'utf-8');
         // Ensure the response structure matches what getWakeData expects
         res.json({ success: true, wake: JSON.parse(data) });
     } catch (error) {
         console.error(`Error reading wake cache for ${caseId}, turbine ${turbineId}:`, error);
         res.status(500).json({ success: false, message: 'Failed to read wake data cache.' });
     }
});

  
  // 触发预计算
  router.post('/:caseId/precompute-visualization', async (req, res) => {
      const { caseId } = req.params;
      const scriptPath = path.join(__dirname, '../utils/precompute_visualization.py');
      const cacheDir = path.join(__dirname, '../uploads', caseId, 'visualization_cache');
  
      // 1. (重要) 清理旧缓存，确保数据最新
      try {
          if (fs.existsSync(cacheDir)) {
              console.log(`Clearing existing visualization cache for case: ${caseId}`);
              await fsPromises.rm(cacheDir, { recursive: true, force: true });
              console.log(`Cache cleared for ${caseId}`);
          }
      } catch(err) {
          console.error(`Error clearing cache for ${caseId}:`, err);
          // 可以选择是否因为清理失败而中止，或者继续尝试预计算
          // return res.status(500).json({ success: false, message: 'Failed to clear old cache before precomputation.' });
      }
  
  
      if (!fs.existsSync(scriptPath)) {
          return res.status(500).json({ success: false, message: 'Precomputation script not found on server.' });
      }
  
      console.log(`Triggering precomputation for case: ${caseId}`);
      // 立即响应，告知客户端任务已开始
      res.status(202).json({ success: true, message: 'Precomputation started. Check WebSocket for progress.' });
  
      // 异步执行 Python 脚本
      const pythonProcess = spawn('python3', [scriptPath, '--caseId', caseId], {
          stdio: ['ignore', 'pipe', 'pipe'] // 忽略 stdin, 捕获 stdout 和 stderr
      });
  
      const io = req.app.get('socketio'); // 获取 Socket.IO 实例
  
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log(`Precompute (${caseId}) stdout: ${output.trim()}`);
          // 通过 WebSocket 发送进度信息
          if (io) {
              io.to(caseId).emit('visualization_progress', { message: output.trim() });
          }
      });
  
      let stderr = '';
      pythonProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          console.error(`Precompute (${caseId}) stderr: ${errorOutput.trim()}`);
          // 通过 WebSocket 发送错误信息
          if (io) {
              io.to(caseId).emit('visualization_error', { message: errorOutput.trim() });
          }
      });
  
      pythonProcess.on('close', (code) => {
          const status = code === 0 ? 'completed' : 'failed';
          console.log(`Precomputation for ${caseId} finished with code ${code} (${status}).`);
          // 通过 WebSocket 发送最终状态
          if (io) {
              io.to(caseId).emit('visualization_status', { status: status, code: code });
          }
          if (code !== 0) {
              console.error(`Precomputation failed for ${caseId}. Full stderr:\n${stderr}`);
          } else {
              console.log(`Precomputation succeeded for ${caseId}. Full stdout:\n${stdout}`);
          }
      });
  
      pythonProcess.on('error', (err) => {
          console.error(`Failed to start precomputation process for ${caseId}:`, err);
          if (io) {
              io.to(caseId).emit('visualization_status', { status: 'failed', error: err.message });
          }
      });
  });
  
  // --- 将预计算集成到主计算流程 ---
  router.post("/:caseId/calculate", checkCalculationStatus, async (req, res) => {
      const { caseId } = req.params;
      const scriptPath = path.join(__dirname, "../base/run.sh");
      const casePath = path.join(__dirname, "../uploads", caseId);
      const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
      const io = req.app.get("socketio");
      const cacheDir = path.join(__dirname, '../uploads', caseId, 'visualization_cache'); // 定义缓存目录路径
  
      // --- (检查脚本和工况存在性，检查计算状态) ---
      // ...
  
      // --- (更新 info.json 状态为 running) ---
      // ...
  
      // --- (清理旧的可视化缓存 - 在开始计算前) ---
      try {
          if (fs.existsSync(cacheDir)) {
              console.log(`Clearing existing visualization cache before calculation for case: ${caseId}`);
              await fsPromises.rm(cacheDir, { recursive: true, force: true });
          }
      } catch(err) {
          console.warn(`Warning: Failed to clear visualization cache for ${caseId} before calculation:`, err);
          // 不阻断计算，仅记录警告
      }
  
      // --- (执行 run.sh 计算) ---
      try {
          const child = spawn("bash", [scriptPath], { cwd: casePath, shell: false });
          // ... (stdout, stderr, error 事件处理 - 保持不变) ...
  
          child.on("close", async (code) => {
              // ... (处理计算日志流结束) ...
  
              if (code === 0) {
                  console.log("Main calculation (run.sh) completed successfully for case:", caseId);
                  // --- (保存最终计算进度) ---
                  // ...
                  // --- (更新 info.json 状态为 completed) ---
                  // ...
  
                  // *** 计算成功后，触发可视化预计算 ***
                  console.log(`Main calculation finished, triggering visualization precomputation for ${caseId}...`);
                  io.to(caseId).emit("visualization_status", { status: 'starting' }); // 通知前端预计算开始
  
                  const precomputeScriptPath = path.join(__dirname, '../utils/precompute_visualization.py');
                  if (fs.existsSync(precomputeScriptPath)) {
                      const precomputeProcess = spawn('python3', [precomputeScriptPath, '--caseId', caseId], { stdio: ['ignore', 'pipe', 'pipe'] });
  
                      let precomputeStdout = '';
                      precomputeProcess.stdout.on('data', (data) => {
                          const output = data.toString().trim();
                          precomputeStdout += output + '\n';
                          console.log(`Precompute (${caseId}) stdout: ${output}`);
                          io.to(caseId).emit('visualization_progress', { message: output });
                      });
  
                      let precomputeStderr = '';
                      precomputeProcess.stderr.on('data', (data) => {
                          const errorOutput = data.toString().trim();
                          precomputeStderr += errorOutput + '\n';
                          console.error(`Precompute (${caseId}) stderr: ${errorOutput}`);
                          io.to(caseId).emit('visualization_error', { message: errorOutput });
                      });
  
                      precomputeProcess.on('close', (precomputeCode) => {
                          const precomputeStatus = precomputeCode === 0 ? 'completed' : 'failed';
                          console.log(`Visualization precomputation for ${caseId} finished with code ${precomputeCode} (${precomputeStatus}).`);
                          io.to(caseId).emit('visualization_status', { status: precomputeStatus, code: precomputeCode });
                          if (precomputeCode !== 0) {
                              console.error(`Visualization precomputation failed for ${caseId}. Full stderr:\n${precomputeStderr}`);
                          } else {
                              console.log(`Visualization precomputation succeeded for ${caseId}. Full stdout:\n${precomputeStdout}`);
                          }
                      });
  
                      precomputeProcess.on('error', (err) => {
                          console.error(`Failed to start visualization precomputation process for ${caseId}:`, err);
                          io.to(caseId).emit('visualization_status', { status: 'failed', error: err.message });
                      });
  
                  } else {
                      console.error(`Visualization precomputation script not found at ${precomputeScriptPath}`);
                      io.to(caseId).emit('visualization_status', { status: 'failed', error: 'Precomputation script not found on server.' });
                  }
  
                  // 主计算已完成，无论预计算是否开始/成功，都先返回成功响应
                  res.json({ success: true, message: "Main calculation completed. Visualization precomputation started." });
  
              } else {
                  console.error(`Main calculation (run.sh) failed with code ${code} for case: ${caseId}`);
                  io.to(caseId).emit("calculationFailed", { message: `Calculation failed with code ${code}` });
                  // 确保在计算失败时也更新 info.json 状态（如果需要）
                  if (fs.existsSync(infoJsonPath)) {
                      try {
                          const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                          info.calculationStatus = "error"; // 或者 'failed'
                          await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
                      } catch (err) { console.warn("Failed to update info.json on calculation failure:", err); }
                  }
                  res.status(500).json({ success: false, message: `Main calculation failed with code ${code}` });
              }
          });
          // ... (处理 child.on('error')) ...
      } catch (error) {
          // ... (处理计算设置错误) ...
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
              model: Joi.string().allow(null).optional(), // 允许 model 为 null 或字符串，或不存在
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
          if (fs.existsSync(outputPath)) {
              const output = await fs.promises.readFile(outputPath, 'utf-8');
              res.json({ output });
          } else {
              res.json({ output: '' });
          }
      } catch (error) {
          console.error("获取 OpenFOAM 输出失败:", error);
          res.status(500).json({ success: false, error: error.message });
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
  
  
  // 服务器端PDF报告生成路由 (更新)
  router.post('/:caseId/generate-pdf-report', async (req, res) => {
      const { caseId } = req.params;
      console.log(`PDF generation request for case ${caseId}`);
  
      try {
          // Log received chart data
          console.log('Received chart data from frontend:');
          if (req.body.charts) {
              Object.keys(req.body.charts).forEach(chartKey => {
                  const chart = req.body.charts[chartKey];
                  console.log(`- ${chartKey}: ${chart ? 'Present' : 'Missing'}`);
                  if (chart) {
                      console.log(`  Data starts with: ${chart.substring(0, 30)}...`);
                  }
              });
          } else {
              console.log('No chart data provided from frontend');
          }
  
          // Get frontend chart data if available
          const frontendCharts = req.body.charts || {};
  
          // Prepare data for PDF
          const pdfData = await pdfDataService.prepareDataForPDF(caseId);
  
          // Merge server-generated charts with frontend charts
          const charts = {
              ...pdfData.charts,  // Server-generated charts
              // Use frontend charts as fallbacks
              speedComparison: pdfData.charts.speedComparison || frontendCharts.speedComparison,
              powerComparison: pdfData.charts.powerComparison || frontendCharts.powerComparison,
              performanceChange: frontendCharts.performanceChange // Currently only from frontend
          };
  
          // Update the data with merged charts
          pdfData.charts = charts;
  
          // Debug and ensure data URIs are correctly formatted before template
          console.log("Final charts data passed to template:");
          Object.keys(pdfData.charts).forEach(key => {
              const value = pdfData.charts[key];
              if (value) {
                  if (!value.startsWith('data:image')) {
                      console.warn(`Chart ${key} does not have a valid data URI format, wrapping it`);
                      pdfData.charts[key] = `data:image/png;base64,${value}`;
                  } else if (value.length > 100) {
                      console.log(`- ${key}: Data URI present, starts with: ${value.substring(0, 50)}...`);
                  } else {
                      console.log(`- ${key}: Data URI present, but very short.`); // Could indicate issue
                  }
              } else {
                  console.log(`- ${key}: Chart data is null/undefined.`);
              }
          });
  
  
          // Generate PDF with combined data
          const pdfBuffer = await pdfDataService.generatePDF(caseId, pdfData);
  
          // Send response
          res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Length': pdfBuffer.length,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(pdfData.caseName || caseId)}_report.pdf"`
          });
          res.end(pdfBuffer);
  
      } catch (error) {
          console.error('Error generating PDF report:', error);
          res.status(500).json({
              success: false,
              message: 'Failed to generate PDF report',
              error: error.message
          });
      }
  });
  
  // 解析 Output02-realHigh 内容（保持与您现有的函数一致）
  function parseRealHigh(content) {
      const lines = content.trim().split('\n').filter(line => line.trim());
      const data = [];
  
      lines.forEach(line => {
          const tokens = line.trim().split(/\s+/);
          let id, node, dxy, x, y, z, height;
  
          if (tokens.length >= 7) {
              // 尝试匹配格式: "WT-1 on Node-0 0.5 10.0 100.0 0.2 100.2"
              const idNodeMatch = line.match(/^([\w-]+)\s+on\s+([\w-]+)/);
  
              if (idNodeMatch) {
                  // 格式匹配成功，提取ID和Node
                  id = idNodeMatch[1];
                  node = idNodeMatch[2];
  
                  // 提取后面的数值
                  const values = line.replace(idNodeMatch[0], '').trim().split(/\s+/);
                  if (values.length >= 5) {
                      dxy = parseFloat(values[0]).toFixed(2);
                      x = parseFloat(values[1]).toFixed(1);
                      y = parseFloat(values[2]).toFixed(1);
                      z = parseFloat(values[3]).toFixed(2);
                      height = parseFloat(values[4]).toFixed(1);
                  }
              } else {
                  // 如果不匹配上面的格式，尝试直接按顺序解析
                  id = tokens[0];
                  node = tokens[1];
                  dxy = parseFloat(tokens[2]).toFixed(2);
                  x = parseFloat(tokens[3]).toFixed(1);
                  y = parseFloat(tokens[4]).toFixed(1);
                  z = parseFloat(tokens[5]).toFixed(2);
                  height = parseFloat(tokens[6]).toFixed(1);
              }
  
              // 确保所有数值都是有效的
              if (!isNaN(parseFloat(dxy)) && !isNaN(parseFloat(x)) && !isNaN(parseFloat(y))
                  && !isNaN(parseFloat(z)) && !isNaN(parseFloat(height))) {
                  data.push({ id, node, dxy, x, y, z, height });
              }
          }
      });
  
      return data;
  }
  
  // 解析性能数据（保持与您现有的函数一致）
  function parsePerformance(content) {
      const lines = content.trim().split('\n').filter(line => line.trim());
      return lines.map(line => {
          const tokens = line.trim().split(/\s+/);
          return {
              speed: parseFloat(tokens[0]),
              power: parseFloat(tokens[1]),
              ct: parseFloat(tokens[2]),
              fn: parseFloat(tokens[3])
          };
      });
  }
  
  // Add a data cache for speed visualization
  const speedDataCache = {
      // caseId -> { metadata, heightData }
      data: {},
      // Track loading status to avoid duplicate concurrent requests
      loading: new Set()
  };
  
  // Helper to clear old cache entries (call this periodically or when cases are deleted)
  const cleanupCache = () => {
      const now = Date.now();
      const MAX_AGE = 30 * 60 * 1000; // 30 minutes
  
      Object.keys(speedDataCache.data).forEach(caseId => {
          const cacheEntry = speedDataCache.data[caseId];
          if (cacheEntry.lastAccessed && (now - cacheEntry.lastAccessed > MAX_AGE)) {
              console.log(`Clearing cached speed data for case ${caseId} due to inactivity`);
              delete speedDataCache.data[caseId];
          }
      });
  };
  
  // Schedule periodic cleanup
  setInterval(cleanupCache, 15 * 60 * 1000); // every 15 minutes
  
  
  // --- 预计算缓存 API ---
  
  // 获取预计算元数据
  router.get('/:caseId/visualization-metadata', async (req, res) => {
      const { caseId } = req.params;
      const metadataPath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'metadata.json');
      try {
          if (!fs.existsSync(metadataPath)) {
              return res.status(404).json({ success: false, message: 'Metadata cache not found. Please run pre-computation or wait for it to complete.' });
          }
          const data = await fsPromises.readFile(metadataPath, 'utf-8');
          res.json({ success: true, metadata: JSON.parse(data) });
      } catch (error) {
          console.error(`Error reading metadata cache for ${caseId}:`, error);
          res.status(500).json({ success: false, message: 'Failed to read metadata cache.' });
      }
  });
  
  // 获取速度切片
  router.get('/:caseId/visualization-slice', async (req, res) => {
      const { caseId } = req.params;
      const requestedHeight = parseFloat(req.query.height);
  
      if (isNaN(requestedHeight)) {
          return res.status(400).json({ success: false, message: 'Invalid height parameter.' });
      }
  
      const metadataPath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'metadata.json');
      const slicesDir = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'slices');
  
      try {
          if (!fs.existsSync(metadataPath)) {
              return res.status(404).json({ success: false, message: 'Metadata cache not found.' });
          }
          const metadata = JSON.parse(await fsPromises.readFile(metadataPath, 'utf-8'));
          const availableHeights = metadata.heightLevels || [];
  
          if (availableHeights.length === 0) {
              return res.status(404).json({ success: false, message: 'No height levels found in metadata.' });
          }
  
          // 找到最接近的可用高度
          const actualHeight = availableHeights.reduce((prev, curr) =>
              Math.abs(curr - requestedHeight) < Math.abs(prev - requestedHeight) ? curr : prev
          );
  
          const sliceFilename = `height_${actualHeight.toFixed(1)}.json`;
          const slicePath = path.join(slicesDir, sliceFilename);
  
          if (!fs.existsSync(slicePath)) {
              return res.status(404).json({ success: false, message: `Slice data for height ${actualHeight.toFixed(1)}m not found.` });
          }
  
          const sliceData = JSON.parse(await fsPromises.readFile(slicePath, 'utf-8'));
  
          // 将坐标数据也附加上，方便前端绘图
          res.json({
              success: true,
              sliceData: {
                  ...sliceData,
                  xCoords: metadata.xCoordsKm, // 从元数据获取
                  yCoords: metadata.yCoordsKm  // 从元数据获取
              }
          });
  
      } catch (error) {
          console.error(`Error reading slice cache for ${caseId}, height ${requestedHeight}:`, error);
          res.status(500).json({ success: false, message: 'Failed to read slice data cache.' });
      }
  });
  
  // 获取指定风机的风廓线
  router.get('/:caseId/visualization-profile/:turbineId', async (req, res) => {
      const { caseId, turbineId } = req.params;
      const profilePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'profiles', `turbine_${turbineId}.json`);
      try {
          if (!fs.existsSync(profilePath)) {
              return res.status(404).json({ success: false, message: `Profile data for turbine ${turbineId} not found.` });
          }
          const data = await fsPromises.readFile(profilePath, 'utf-8');
          res.json({ success: true, profile: JSON.parse(data) });
      } catch (error) {
          console.error(`Error reading profile cache for ${caseId}, turbine ${turbineId}:`, error);
          res.status(500).json({ success: false, message: 'Failed to read profile data cache.' });
      }
  });
  
  // 获取指定风机的尾流数据
  router.get('/:caseId/visualization-wake/:turbineId', async (req, res) => {
      const { caseId, turbineId } = req.params;
      const wakePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'wakes', `turbine_${turbineId}.json`);
      try {
          if (!fs.existsSync(wakePath)) {
              return res.status(404).json({ success: false, message: `Wake data for turbine ${turbineId} not found.` });
          }
          const data = await fsPromises.readFile(wakePath, 'utf-8');
          res.json({ success: true, wake: JSON.parse(data) });
      } catch (error) {
          console.error(`Error reading wake cache for ${caseId}, turbine ${turbineId}:`, error);
          res.status(500).json({ success: false, message: 'Failed to read wake data cache.' });
      }
  });
  
  
  router.use("/:caseId/wind-turbines", windTurbinesRouter);
  
  module.exports = router;