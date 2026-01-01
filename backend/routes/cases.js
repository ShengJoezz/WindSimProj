/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 19:55:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-21 20:54:27
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
 * @Description: 
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
const { knownTasks } = require('../utils/tasks');
const windTurbinesRouter = require('./windTurbinesRouter');
const archiver = require('archiver');
const pdfDataService = require('../services/pdfDataService'); // 引入 PDF 数据服务

// --- In-memory running calculation registry (per backend instance) ---
// caseId -> { child, startedAt, cancelReason, killTimer, timeoutTimer }
const runningCalculations = new Map();

const getCalculationTimeoutMs = () => {
    const raw = process.env.CALCULATION_TIMEOUT_MS;
    if (!raw) return 0;
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
};

const killProcessGroup = (child, signal) => {
    if (!child || typeof child.pid !== 'number') return false;
    try {
        // Negative PID kills the process group on POSIX systems when the child is detached.
        process.kill(-child.pid, signal);
        return true;
    } catch (e) {
        try {
            process.kill(child.pid, signal);
            return true;
        } catch (_) {
            return false;
        }
    }
};

// --- 辅助函数 ---
const calculateXY = (lon, lat, centerLon, centerLat) => {
    // console.log('calculateXY - Input:', { lon, lat, centerLon, centerLat }); // Debug log
    const EARTH_RADIUS = 6371000;
    const RAD_PER_DEG = Math.PI / 180;
    const METER_PER_DEG_LAT = EARTH_RADIUS * RAD_PER_DEG;
    const LONG_LAT_RATIO = Math.cos(centerLat * RAD_PER_DEG);
    const tempAngle = 0 * RAD_PER_DEG; // Assuming no rotation for now
    const tempX = (lon - centerLon) * METER_PER_DEG_LAT * LONG_LAT_RATIO;
    const tempY = (lat - centerLat) * METER_PER_DEG_LAT;
    const projx = tempX * Math.cos(tempAngle) - tempY * Math.sin(tempAngle);
    const projy = tempY * Math.cos(tempAngle) + tempX * Math.sin(tempAngle);
    // console.log('calculateXY - Output:', { x: projx, y: projy }); // Debug log
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
            // console.log(`Created directory: ${dir}`); // Optional log
        }
    });
};

// --- 中间件和配置 ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: '请求过于频繁，请稍后再试',
    skip: (req) => process.env.NODE_ENV !== 'production'
});
router.use(limiter);

// 验证 caseId 的 schema
const caseIdSchema = Joi.string()
    .alphanum()
    .min(1)
    .max(50) // Reasonable max length
    .required()
    .messages({
        "string.alphanum": "工况 ID 只能包含字母和数字",
        "string.min": "工况 ID 至少需要 1 个字符",
        "string.max": "工况 ID 不能超过 50 个字符",
        "any.required": "工况 ID 是必需的",
    });

// Case ID 验证中间件
router.use("/:caseId", (req, res, next) => {
    const { error, value } = caseIdSchema.validate(req.params.caseId);
    if (error) {
        console.warn(`无效的工况 ID: ${req.params.caseId}, 错误: ${error.details[0].message}`);
        return res.status(400).json({
            success: false,
            message: error.details[0].message,
        });
    }
    req.params.caseId = value; // Use validated value
    next();
});

// Multer 配置 (地形文件)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use caseId from route params if caseName is not in body (e.g., for later uploads)
        const caseId = req.params.caseId || req.body.caseName;
        if (!caseId) {
            return cb(new Error('无法确定工况 ID'));
        }
        const uploadPath = path.join(__dirname, '../uploads', caseId);
        fs.mkdir(uploadPath, { recursive: true }, (err) => { // Use async mkdir
            if (err) {
                console.error("创建上传目录失败:", err);
                return cb(err);
            }
            cb(null, uploadPath);
        });
    },
    filename: (req, file, cb) => {
        if (file.fieldname === 'terrainFile') {
            cb(null, 'terrain.tif'); // Always name terrain file terrain.tif
        } else {
            // Sanitize original filename (optional but recommended)
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, safeName);
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
        // Add filters for other file types if needed
        cb(null, true);
    },
    limits: { fileSize: 500 * 1024 * 1024 } // Example: 500MB limit
}).fields([{ name: 'terrainFile', maxCount: 1 }]); 

// ===== 新增: Multer 配置 (风机性能曲线) =====
const curveStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // 目的地是持久化目录，不在 run 文件夹内
      const dst = path.join(__dirname, '..', 'uploads', req.params.caseId, 'customCurves');
      fs.mkdirSync(dst, { recursive: true });
      cb(null, dst);
    },
    filename: (req, file, cb) => {
        // 直接使用原始文件名 (例如 1-U-P-Ct.txt)，并去除任何路径部分
        cb(null, path.basename(file.originalname));
    }
});
const uploadCurves = multer({
    storage: curveStorage,
    fileFilter: (req, file, cb) => {
        // 验证文件扩展名与命名格式（与 run.sh 要求保持一致）
        const allowedExt = ['.txt'];
        const original = path.basename(file.originalname);
        const ext = path.extname(original).toLowerCase();
        if (!allowedExt.includes(ext)) return cb(new Error(`仅支持 ${allowedExt.join(', ')} 文件`), false);
        if (!/^\d+-U-P-Ct\.txt$/i.test(original)) {
            return cb(new Error('性能曲线文件名必须为 "<模型ID>-U-P-Ct.txt"（例如 1-U-P-Ct.txt）'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 1 * 1024 * 1024 } // 1MB limit per file
}).array('curveFiles', 10); // 'curveFiles' 对应前端 FormData的key, 最多10个文件
// ============================================

// ===== [新增] 用于上传单个粗糙度文件的 Multer 配置 =====
const roughnessStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const caseId = req.params.caseId; // caseId 此时一定存在
      const uploadPath = path.join(__dirname, '../uploads', caseId);
      // 确保目录存在，Multer 不会自动创建
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // 关键：无论用户上传的文件叫什么名字，都强制保存为 'rou'
        cb(null, 'rou');
    }
});

const uploadRoughness = multer({
    storage: roughnessStorage,
    fileFilter: (req, file, cb) => {
        const allowedExt = ['.txt', '.dat', '.rou', '']; // 允许的扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExt.includes(ext)) {
            return cb(new Error(`仅支持 .txt, .dat, .rou 或无后缀名文件`), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 限制文件大小为 10MB
}).single('roughnessFile'); // .single() 表示只处理一个文件，字段名 'roughnessFile' 必须与前端 FormData 中的 key 匹配

// --- 工况管理路由 ---

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
        // Joi schema for caseName validation
        const caseNameSchema = Joi.string()
            .alphanum() // Allow letters and numbers
            .min(1)
            .max(50) // Adjust max length as needed
            .required()
            .messages({
                "string.alphanum": "工况名称只能包含字母和数字",
                "string.min": "工况名称至少需要 1 个字符",
                "string.max": "工况名称不能超过 50 个字符",
                "any.required": "工况名称不能为空",
            });

        const { error: nameError, value: validatedCaseName } = caseNameSchema.validate(caseName);
        if (nameError) {
             console.warn(`无效的工况名称: ${caseName}, 错误: ${nameError.details[0].message}`);
            // Clean up potentially created directory if name is invalid
            const potentialPath = path.join(__dirname, '../uploads', caseName); // Use original name for cleanup path
            if (fs.existsSync(potentialPath)) {
                fs.rm(potentialPath, { recursive: true, force: true }, (rmErr) => {
                    if (rmErr) console.error(`清理无效工况目录 ${potentialPath} 失败:`, rmErr);
                });
            }
            return res.status(400).json({ success: false, message: nameError.details[0].message });
        }

        // Use validatedCaseName from now on
        const caseId = validatedCaseName;
        const casePath = path.join(__dirname, '../uploads', caseId);


        if (!req.files || !req.files['terrainFile'] || !req.files['terrainFile'][0]) {
            console.error('terrainFile is missing for case:', caseId);
            // Clean up created directory if terrain file is missing
             if (fs.existsSync(casePath)) {
                 fs.rm(casePath, { recursive: true, force: true }, (rmErr) => {
                     if (rmErr) console.error(`清理无地形文件工况目录 ${casePath} 失败:`, rmErr);
                 });
             }
            return res.status(400).json({ success: false, message: '请上传 GeoTIFF 地形文件' });
        }

        console.log(`工况 ${caseId} 创建成功，地形文件已上传。`);
        res.json({ success: true, message: '工况创建成功', caseName: caseId }); // Return the validated case name

    } catch (err) {
        // Handle Multer errors or other exceptions
        console.error('创建工况时出错:', err);
        let userMessage = '文件处理失败';
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                userMessage = '上传的文件过大，请确保文件大小在 500MB 以内。';
            } else {
                userMessage = `文件上传错误: ${err.message}`;
            }
             return res.status(400).json({ success: false, message: userMessage });
        } else if (err.message.includes('仅支持 GeoTIFF')) {
             userMessage = err.message;
             return res.status(400).json({ success: false, message: userMessage });
        }
        res.status(500).json({ success: false, message: err.message || userMessage });
    }
});


// 2. 获取所有工况
router.get("/", async (req, res) => {
    try {
        const uploadsPath = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsPath)) {
            console.log("Uploads 目录不存在，返回空列表。");
            return res.json({ cases: [] });
        }
        const caseNames = await fsPromises.readdir(uploadsPath, { withFileTypes: true });
        const cases = caseNames
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .sort(); // Sort alphabetically
        res.json({ cases });
    } catch (error) {
        console.error("获取工况列表失败:", error);
        res.status(500).json({ success: false, message: "获取工况列表失败" });
    }
});

// 3. 获取特定工况的地形文件
router.get("/:caseId/terrain", (req, res) => {
    const { caseId } = req.params; // Already validated by middleware
    const terrainFilePath = path.join(__dirname, "../uploads", caseId, "terrain.tif");

    if (!fs.existsSync(terrainFilePath)) {
        console.warn(`工况 ${caseId} 未找到地形文件: ${terrainFilePath}`);
        return res.status(404).json({ success: false, message: "未找到地形数据" });
    }

    res.setHeader('Content-Type', 'image/tiff');
    const stream = fs.createReadStream(terrainFilePath);

    stream.on('error', (err) => {
        console.error(`读取地形文件流时出错 (${terrainFilePath}):`, err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "读取地形文件失败" });
        } else {
            res.end(); // End response if headers were already sent
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        // console.log(`客户端断开了地形文件请求 (${terrainFilePath})`);
        stream.destroy(); // Close the stream
    });

    stream.pipe(res);
});

// 4. 删除工况
router.delete("/:caseId", async (req, res) => {
    const { caseId } = req.params; // Validated
    console.log(`尝试删除工况: ${caseId}`);
    const casePath = path.join(__dirname, "../uploads", caseId);

    try {
        if (!fs.existsSync(casePath)) {
            return res.status(404).json({ success: false, message: "工况不存在" });
        }
        await fsPromises.rm(casePath, { recursive: true, force: true });
        console.log(`成功删除工况目录: ${casePath}`);
        // Optionally clear any associated cache (e.g., speedDataCache)
        // delete speedDataCache.data[caseId];
        res.json({ success: true, message: "工况删除成功" });
    } catch (error) {
        console.error(`删除工况 ${caseId} 失败:`, error);
        res.status(500).json({ success: false, message: "删除工况失败", error: error.message });
    }
});

// 5. 获取特定工况的参数 (合并 parameters.json 和 info.json)
router.get("/:caseId/parameters", async (req, res) => {
    const { caseId } = req.params; // Validated
    const casePath = path.join(__dirname, "../uploads", caseId);
    const parametersPath = path.join(casePath, "parameters.json");
    const infoJsonPath = path.join(casePath, "info.json");

    try {
        let parameters = {};
        let info = {};

        // Read parameters.json if exists
        if (fs.existsSync(parametersPath)) {
            try {
                const parametersData = await fsPromises.readFile(parametersPath, "utf-8");
                parameters = JSON.parse(parametersData);
            } catch (err) {
                console.warn(`读取或解析 parameters.json (${caseId}) 出错:`, err);
                // Decide if this is a fatal error or just continue without these params
            }
        }

        // Read info.json if exists
        if (fs.existsSync(infoJsonPath)) {
            try {
                const infoData = await fsPromises.readFile(infoJsonPath, "utf-8");
                info = JSON.parse(infoData);
            } catch (err) {
                console.warn(`读取或解析 info.json (${caseId}) 出错:`, err);
            }
        }

        // Combine data, potentially overwriting parameters from info if necessary
        // Use parameters from parameters.json as the base, then overlay relevant info from info.json
        const combinedParameters = {
            ...parameters, // Start with parameters.json content
            caseName: info.key || caseId, // Use key from info.json or caseId as fallback
            center: info.center || parameters.center || { lon: null, lat: null }, // Prioritize info.center, then parameters.center
            // Overwrite specific parameters ONLY if they exist in info.json AND differ significantly
            // or if parameters.json was empty.
            calculationDomain: {
                width: info.domain?.lt ?? parameters.calculationDomain?.width ?? 6500,
                height: info.domain?.h ?? parameters.calculationDomain?.height ?? 800,
            },
            conditions: {
                 windDirection: info.wind?.angle ?? parameters.conditions?.windDirection ?? 0,
                 inletWindSpeed: info.wind?.speed ?? parameters.conditions?.inletWindSpeed ?? 10,
            },
             grid: {
                 encryptionHeight: info.mesh?.h1 ?? parameters.grid?.encryptionHeight ?? 210,
                 encryptionLayers: info.mesh?.ceng ?? parameters.grid?.encryptionLayers ?? 21,
                 gridGrowthRate: info.mesh?.q1 ?? parameters.grid?.gridGrowthRate ?? 1.2,
                 maxExtensionLength: info.mesh?.lc1 ?? parameters.grid?.maxExtensionLength ?? 360,
                 encryptionRadialLength: info.mesh?.lc2 ?? parameters.grid?.encryptionRadialLength ?? 10,
                 downstreamRadialLength: info.mesh?.lc3 ?? parameters.grid?.downstreamRadialLength ?? 60,
                 encryptionRadius: info.mesh?.r1 ?? parameters.grid?.encryptionRadius ?? 200,
                 encryptionTransitionRadius: info.mesh?.r2 ?? parameters.grid?.encryptionTransitionRadius ?? 400,
                 terrainRadius: info.mesh?.tr1 ?? parameters.grid?.terrainRadius ?? 5000,
                 terrainTransitionRadius: info.mesh?.tr2 ?? parameters.grid?.terrainTransitionRadius ?? 6500,
                 downstreamLength: info.mesh?.wakeL ?? parameters.grid?.downstreamLength ?? 2000,
                 downstreamWidth: info.mesh?.wakeB ?? parameters.grid?.downstreamWidth ?? 600,
                 scale: info.mesh?.scale ?? parameters.grid?.scale ?? 0.001,
             },
             simulation: {
                 cores: info.simulation?.core ?? parameters.simulation?.cores ?? 8,
                 steps: info.simulation?.step_count ?? parameters.simulation?.steps ?? 1000,
                 deltaT: info.simulation?.deltaT ?? parameters.simulation?.deltaT ?? 1,
             },
             postProcessing: {
                 resultLayers: info.post?.numh ?? parameters.postProcessing?.resultLayers ?? 10,
                 layerSpacing: info.post?.dh ?? parameters.postProcessing?.layerSpacing ?? 20,
                 // Keep width/height from parameters.json if defined, otherwise use info.json or defaults
                 layerDataWidth: parameters.postProcessing?.layerDataWidth ?? info.post?.width ?? 1000,
                 layerDataHeight: parameters.postProcessing?.layerDataHeight ?? info.post?.height ?? 1000,
             },
        };


        // Define default parameters structure (only if parameters.json was empty/missing AND info.json was missing/empty)
        const defaultParams = {
            caseName: caseId,
            calculationDomain: { width: 6500, height: 800 },
            conditions: { windDirection: 0, inletWindSpeed: 10 }, // Default North wind
            grid: {
                encryptionHeight: 210, encryptionLayers: 21, gridGrowthRate: 1.2,
                maxExtensionLength: 360, encryptionRadialLength: 10, downstreamRadialLength: 60,
                encryptionRadius: 200, encryptionTransitionRadius: 400, terrainRadius: 5000,
                terrainTransitionRadius: 6500, downstreamLength: 2000, downstreamWidth: 600,
                scale: 0.001,
            },
            simulation: { cores: 8, steps: 200, deltaT: 1 }, // Increased defaults
            postProcessing: {
                resultLayers: 10, layerSpacing: 20, layerDataWidth: 1000,
                layerDataHeight: 1000,
            },
            center: { lon: null, lat: null },
        };

        // If no parameters were loaded from parameters.json and no info loaded from info.json, use defaults
        const finalParameters = (Object.keys(parameters).length > 0 || Object.keys(info).length > 0)
            ? combinedParameters
            : defaultParams;

        res.json({ success: true, parameters: finalParameters, geographicBounds: info.geographicBounds || null });

    } catch (error) {
        console.error(`获取工况 ${caseId} 参数失败:`, error);
        res.status(500).json({ success: false, message: "获取参数失败" });
    }
});


// 6. 保存特定工况的参数 (只保存到 parameters.json)
router.post("/:caseId/parameters", async (req, res) => {
    const { caseId } = req.params; // Validated
    const parameters = req.body;
    const casePath = path.join(__dirname, "../uploads", caseId);
    const parametersPath = path.join(casePath, "parameters.json");

    const paramSchema = Joi.object({
        caseName: Joi.string().optional(),
        calculationDomain: Joi.object({
            width: Joi.number().positive().required(),
            height: Joi.number().positive().required()
        }).required(),
        conditions: Joi.object({
            windDirection: Joi.number().min(0).max(360).required(),
            inletWindSpeed: Joi.number().positive().required()
        }).required(),
        grid: Joi.object({ // 明确定义 grid 对象内部所有期望的参数
            encryptionHeight: Joi.number().required(), // 例如：encryptionHeight 是数字且必须
            encryptionLayers: Joi.number().integer().required(),
            gridGrowthRate: Joi.number().positive().required(),
            maxExtensionLength: Joi.number().required(),
            encryptionRadialLength: Joi.number().required(),
            downstreamRadialLength: Joi.number().required(),
            encryptionRadius: Joi.number().required(),
            encryptionTransitionRadius: Joi.number().required(),
            terrainRadius: Joi.number().required(),
            terrainTransitionRadius: Joi.number().required(),
            downstreamLength: Joi.number().required(),
            downstreamWidth: Joi.number().required(),
            scale: Joi.number().min(0).max(1).required() // scale 在 0-1 之间
        }).required(), // grid 对象本身是必须的
        simulation: Joi.object({
            cores: Joi.number().integer().positive().required(),
            steps: Joi.number().integer().positive().required(),
            deltaT: Joi.number().positive().required()
        }).required(),
        
        postProcessing: Joi.object({ // 明确定义 postProcessing 对象内部所有期望的参数
            resultLayers: Joi.number().integer().positive().required(),
            layerSpacing: Joi.number().positive().required(),
            layerDataWidth: Joi.number().positive().required(),
            layerDataHeight: Joi.number().positive().required()
        }).required(), // postProcessing 对象本身是必须的
        center: Joi.object({
            lon: Joi.number().allow(null),
            lat: Joi.number().allow(null)
        }).optional(),
    }).unknown(true); // 允许顶层对象包含其他未定义的字段 (如果需要的话)

     const { error: validationError, value: validatedParams } = paramSchema.validate(parameters);

     if (validationError) {
        console.warn(`参数保存验证失败 (${caseId}):`, validationError.details.map(d => d.message).join(', '));
        return res.status(400).json({ success: false, message: "参数格式无效", errors: validationError.details.map(d => d.message) });
     }

    try {
        if (!fs.existsSync(casePath)) {
            // Should not happen if caseId is valid, but good practice
            await fsPromises.mkdir(casePath, { recursive: true });
            console.warn(`工况目录 ${caseId} 不存在，已创建。`);
            // return res.status(404).json({ success: false, message: "工况不存在" });
        }

        // Only save the relevant parameters, exclude derived ones like caseName or center if they come from info.json
        const paramsToSave = { ...validatedParams }; // Use validated params
        // Remove fields that should ideally be managed by info.json generation
        // Only remove caseName if it matches the caseId to avoid confusion
        if (paramsToSave.caseName === caseId) {
            delete paramsToSave.caseName;
        }
        // Consider if 'center' should always be saved here or derived later for info.json
        // delete paramsToSave.center;

        await fsPromises.writeFile(parametersPath, JSON.stringify(paramsToSave, null, 2), 'utf-8');
        console.log(`工况 ${caseId} 参数已保存到 ${parametersPath}`);
        res.json({ success: true, message: "参数保存成功" });
    } catch (error) {
        console.error(`保存工况 ${caseId} 参数失败:`, error);
        res.status(500).json({ success: false, message: "保存参数失败", error: error.message });
    }
});


// ===== 新增: 上传风机性能曲线文件 =====
router.post('/:caseId/curve-files', async (req, res) => {
    uploadCurves(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer specific errors
            console.error(`Multer error on curve upload (${req.params.caseId}):`, err.message);
            return res.status(400).json({ success: false, message: `文件上传错误: ${err.message}` });
        } else if (err) {
            // Other errors (e.g., file filter)
            console.error(`Non-multer error on curve upload (${req.params.caseId}):`, err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
        
        // Success
        const uploadedFiles = req.files.map(f => f.filename);
        console.log(`工况 ${req.params.caseId} 成功上传了性能曲线:`, uploadedFiles);
        return res.json({ success: true, files: uploadedFiles });
    });
});
// ======================================

// ==========================================================
// ===== [新增] 粗糙度文件 (.rou) 管理的专属路由 ============
// ==========================================================

/**
 * 路由: GET /api/cases/:caseId/roughness-file-exists
 * 功能: 检查指定工况下是否已存在粗糙度文件 'rou'。
 * 成功响应: { exists: true, file: { name: 'rou', size: <bytes> } }
 * 失败响应: 404 Not Found (如果文件不存在)
 */
router.get('/:caseId/roughness-file-exists', async (req, res) => {
    const { caseId } = req.params;
    const filePath = path.join(__dirname, '../uploads', caseId, 'rou');

    try {
        // 使用 fs.promises.stat，如果文件不存在会直接抛出错误
        const stats = await fsPromises.stat(filePath);
        console.log(`找到已存在的粗糙度文件: ${filePath}`);
        res.json({
            exists: true,
            file: {
                name: 'rou',
                size: stats.size
            }
        });
    } catch (error) {
        // 当 stat 找不到文件时，error.code 会是 'ENOENT'
        if (error.code === 'ENOENT') {
            console.log(`粗糙度文件未找到: ${filePath}`);
            // 返回 404 更符合 RESTful 规范，前端的 axios catch 会处理它
            return res.status(404).json({ exists: false, message: '粗糙度文件不存在' });
        }
        // 处理其他可能的错误，如权限问题
        console.error(`检查粗糙度文件时出错 (${caseId}):`, error);
        res.status(500).json({ success: false, message: '检查文件时服务器出错' });
    }
});


/**
 * 路由: POST /api/cases/:caseId/roughness-file
 * 功能: 上传或更新粗糙度文件 'rou'。
 * 中间件: 使用上面定义的 'uploadRoughness' multer 中间件。
 * 成功响应: { success: true, message: '...', file: <file_details> }
 */
router.post('/:caseId/roughness-file', (req, res) => {
    // 调用 multer 中间件来处理文件上传
    uploadRoughness(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // 发生 Multer 相关的错误 (如文件过大)
            console.error(`上传粗糙度文件时 Multer 错误 (${req.params.caseId}):`, err.message);
            return res.status(400).json({ success: false, message: `文件上传错误: ${err.message}` });
        } else if (err) {
            // 发生其他错误 (如文件类型不匹配)
            console.error(`上传粗糙度文件时非 Multer 错误 (${req.params.caseId}):`, err.message);
            return res.status(400).json({ success: false, message: err.message });
        }

        // 如果没有文件被上传，req.file 会是 undefined
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未检测到上传的文件' });
        }

        // 文件上传成功
        console.log(`粗糙度文件已成功上传/更新: ${req.file.path}`);
        res.status(201).json({ // 201 Created 更适合资源创建/更新
            success: true,
            message: '粗糙度文件上传成功',
            file: req.file // 返回 multer 处理后的文件信息
        });
    });
});


/**
 * 路由: DELETE /api/cases/:caseId/roughness-file
 * 功能: 删除指定工况下的粗糙度文件 'rou'。
 * 成功响应: { success: true, message: '...' }
 */
router.delete('/:caseId/roughness-file', async (req, res) => {
    const { caseId } = req.params;
    const filePath = path.join(__dirname, '../uploads', caseId, 'rou');

    try {
        // 检查文件是否存在
        if (fs.existsSync(filePath)) {
            // 文件存在，执行删除
            await fsPromises.unlink(filePath);
            console.log(`粗糙度文件已删除: ${filePath}`);
            res.json({ success: true, message: '文件删除成功' });
        } else {
            // 如果文件本就不存在，也视为成功，因为客户端的目标（文件不存在）已经达成
            console.log(`请求删除粗糙度文件，但文件已不存在: ${filePath}`);
            res.json({ success: true, message: '文件本就不存在，无需删除' });
        }
    } catch (error) {
        console.error(`删除粗糙度文件时出错 (${caseId}):`, error);
        res.status(500).json({ success: false, message: '服务器在删除文件时出错' });
    }
});

// --- 计算与结果路由 ---

// 7. 获取特定工况的仿真结果 (results.json - 保持不变)
router.get("/:caseId/results", async (req, res) => {
    const { caseId } = req.params;
    const casePath = path.join(__dirname, "../uploads", caseId);
    const resultsPath = path.join(casePath, "results.json"); // Assuming results are stored here
    try {
        if (!fs.existsSync(resultsPath)) {
            // Check if Output files exist as an alternative indicator of results
             const outputPath = path.join(casePath, 'run', 'Output');
             const initFile = path.join(outputPath, 'Output04-U-P-Ct-fn(INIT)');
             const adjustFile = path.join(outputPath, 'Output06-U-P-Ct-fn(ADJUST)');
             if (fs.existsSync(initFile) || fs.existsSync(adjustFile)) {
                 // Calculation might be done, but results.json not generated yet
                 return res.json({ success: true, results: null, message: "计算可能已完成，但汇总结果文件 (results.json) 未生成。" });
             } else {
                 return res.json({ success: true, results: null, message: "暂无计算结果" });
             }
        }
        const resultsData = await fsPromises.readFile(resultsPath, "utf-8");
        const results = JSON.parse(resultsData);
        res.json({ success: true, results: results });
    } catch (error) {
        console.error(`获取工况 ${caseId} 结果失败:`, error);
        res.status(500).json({ success: false, message: "获取结果文件失败" });
    }
});
// backend/routes/cases.js

// ... (文件顶部的其他 require 和配置，例如 express, path, fs, etc.)

// 8. 启动特定工况的计算 (已应用方案3进行修改)
router.post("/:caseId/calculate", checkCalculationStatus, async (req, res) => {
    const { caseId } = req.params;
    const scriptPath = path.join(__dirname, "../base/run.sh"); // 主计算脚本
    const precomputeScriptPath = path.join(__dirname, '../utils/precompute_visualization.py'); // 可视化预处理脚本
    const casePath = path.join(__dirname, "../uploads", caseId);
    const progressPath = path.join(casePath, 'calculation_progress.json');
    const infoJsonPath = path.join(casePath, "info.json");
    const runDir = path.join(casePath, 'run');
    const io = req.app.get("socketio"); // 获取 Socket.IO 实例
    const startTimeMs = Date.now();

    // --- 前置检查 ---
    if (!fs.existsSync(scriptPath)) {
        console.error("主计算脚本 run.sh 未找到!");
        return res.status(500).json({ success: false, message: "服务器错误：计算脚本丢失" });
    }
    if (!fs.existsSync(casePath)) {
        return res.status(404).json({ success: false, message: "工况目录不存在" });
    }
    if (!fs.existsSync(infoJsonPath)) {
        console.error(`工况 ${caseId} 的 info.json 未找到，无法开始计算。`);
        return res.status(400).json({ success: false, message: "缺少配置文件 (info.json)，请先生成或上传" });
    }

    // Prevent starting twice for the same case within this backend instance
    const existingRun = runningCalculations.get(caseId);
    if (existingRun && existingRun.child && !existingRun.child.killed) {
        return res.status(409).json({ success: false, message: "该工况已有计算在进行中（请等待完成或先取消）" });
    }

    // --- 准备计算环境 ---
    console.log(`准备启动工况 ${caseId} 的计算...`);
    try {
        if (!fs.existsSync(runDir)) await fsPromises.mkdir(runDir, { recursive: true });
        // 清理旧的可视化缓存
        const cacheDir = path.join(casePath, 'visualization_cache');
        if (fs.existsSync(cacheDir)) await fsPromises.rm(cacheDir, { recursive: true, force: true });
    } catch (err) {
        console.error(`准备运行环境 (${caseId}) 失败:`, err);
        return res.status(500).json({ success: false, message: '无法准备运行环境' });
    }

    // 更新 info.json 状态为 'running'
    try {
        const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
        info.calculationStatus = "running";
        info.lastCalculationStart = new Date().toISOString();
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
    } catch (err) {
        console.warn(`警告: 更新 info.json (${caseId}) 状态为 'running' 失败:`, err);
    }

    // 初始化任务状态并通过 WebSocket 发送
    const taskStatuses = {};
    knownTasks.forEach(task => { taskStatuses[task.id] = "pending"; });
    if (io) io.to(caseId).emit("taskUpdate", taskStatuses);
    const knownTaskIds = new Set(knownTasks.map(t => t.id));
    // 初始化进度文件（由后端作为唯一可信来源写入）
    try {
        const initProgress = {
            status: "running",
            isCalculating: true,
            progress: 0,
            tasks: taskStatuses,
            timestamp: Date.now(),
            completed: false,
            startTime: startTimeMs,
            endTime: null,
            exitCode: null,
            canceled: false,
            timeout: false,
            currentTaskId: null,
            lastTaskId: null,
        };
        await fsPromises.writeFile(progressPath, JSON.stringify(initProgress, null, 2));
    } catch (err) {
        console.warn(`警告: 写入初始 calculation_progress.json (${caseId}) 失败:`, err);
    }
    if (io) io.to(caseId).emit("calculationStarted", { startTime: startTimeMs });

    // --- 执行主计算脚本 (run.sh) ---
    try {
        console.log(`执行 run.sh，工况: ${caseId}, CWD: ${casePath}`);
        const child = spawn("bash", [scriptPath], {
            cwd: casePath,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
        });
        runningCalculations.set(caseId, {
            child,
            startedAt: Date.now(),
            cancelReason: null, // 'user' | 'timeout'
            killTimer: null,
            timeoutTimer: null,
        });

        const timeoutMs = getCalculationTimeoutMs();
        if (timeoutMs > 0) {
            const entry = runningCalculations.get(caseId);
            entry.timeoutTimer = setTimeout(() => {
                const rec = runningCalculations.get(caseId);
                if (!rec || !rec.child || rec.cancelReason) return;
                rec.cancelReason = 'timeout';
                if (io) io.to(caseId).emit("calculationOutput", `[TIMEOUT] 计算超时（${timeoutMs}ms），正在终止进程...\n`);
                killProcessGroup(rec.child, 'SIGTERM');
                rec.killTimer = setTimeout(() => {
                    const rec2 = runningCalculations.get(caseId);
                    if (!rec2 || !rec2.child) return;
                    killProcessGroup(rec2.child, 'SIGKILL');
                }, 10_000);
            }, timeoutMs);
        }
        // Keep a monotonic overall progress value for this run (avoid jumping backwards due to per-task progress resets)
        let overallProgressValue = 0;
        let lastPersistedOverall = 0;
        let lastPersistedAt = 0;
        let currentTaskId = null;
        let lastTaskId = null;
        let progressWriteChain = Promise.resolve();

        const queueProgressWrite = (payload) => {
            progressWriteChain = progressWriteChain
                .catch(() => {})
                .then(() => fsPromises.writeFile(progressPath, JSON.stringify(payload, null, 2)));
            return progressWriteChain;
        };

        const persistProgress = ({ status, isCalculating, progress, completed, extra = {}, force = false }) => {
            const now = Date.now();
            // Throttle non-forced writes to reduce I/O while keeping refreshable progress.
            if (!force) {
                if (progress <= lastPersistedOverall) return;
                if (now - lastPersistedAt < 1000 && progress !== 100) return;
            }
            lastPersistedOverall = Math.max(lastPersistedOverall, progress);
            lastPersistedAt = now;
            const payload = {
                status,
                isCalculating,
                progress,
                tasks: { ...taskStatuses },
                timestamp: now,
                completed: Boolean(completed),
                startTime: startTimeMs,
                endTime: extra.endTime ?? null,
                exitCode: extra.exitCode ?? null,
                canceled: Boolean(extra.canceled),
                timeout: Boolean(extra.timeout),
                currentTaskId,
                lastTaskId,
                ...extra,
            };
            queueProgressWrite(payload);
        };
        
        const logFilePath = path.join(runDir, `calculation_log_${Date.now()}.txt`);
        const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
        
        // <<< 修改点 1: 引入 stderr 缓冲区 >>>
        let stderrOutput = '';

        // 处理 stdout (进度、信息、任务)
        child.stdout.on("data", async (data) => {
            const outputString = data.toString();
            logStream.write(outputString);
            if (io) io.to(caseId).emit("calculationOutput", outputString); // 实时发送原始输出

            const computeOverallProgress = (currentTaskId, rawProgress) => {
                const total = knownTasks.length || 1;
                const completed = Object.values(taskStatuses).filter(s => s === 'completed').length;
                let fraction = 0;
                // Only apply a partial fraction for the currently running task (if any).
                if (currentTaskId && taskStatuses[currentTaskId] === 'running') {
                    const n = parseInt(rawProgress, 10);
                    if (!Number.isNaN(n)) {
                        // Clamp to [0, 99] while task is still running to avoid early 100 jumps.
                        fraction = Math.max(0, Math.min(99, n)) / 100;
                    } else {
                        fraction = 0.5;
                    }
                }
                const candidate = Math.round(((completed + fraction) / total) * 100);
                overallProgressValue = Math.max(overallProgressValue, candidate);
                return overallProgressValue;
            };

            // 解析 JSON 格式的进度信息
            const lines = outputString.split("\n").filter(line => line.trim().startsWith('{'));
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line);
                    let progressChanged = false;

                    // 处理任务状态更新（仅接受已知 taskId，避免脚本内部动态 task 污染任务面板与进度计算）
                    if (msg.action === "taskStart" && knownTaskIds.has(msg.taskId) && taskStatuses[msg.taskId] !== 'running') {
                        taskStatuses[msg.taskId] = "running";
                        currentTaskId = msg.taskId;
                        lastTaskId = msg.taskId;
                        if (io) io.to(caseId).emit("taskStarted", msg.taskId);
                        progressChanged = true;
                        // Emit an updated overall progress on task start (monotonic).
                        const overall = computeOverallProgress(msg.taskId);
                        if (io) io.to(caseId).emit("calculationProgress", { progress: overall, taskId: msg.taskId });
                    } else if (msg.action === "progress" || msg.action === "taskEnd") {
                        const {taskId, progress} = msg;
                        if (knownTaskIds.has(taskId)) {
                            currentTaskId = taskId;
                            lastTaskId = taskId;
                            if (progress === "ERROR" && taskStatuses[taskId] !== 'error') {
                                taskStatuses[taskId] = "error";
                                progressChanged = true;
                            } else if (progress === "COMPLETE" || parseInt(progress, 10) === 100) {
                                if (taskStatuses[taskId] !== 'error') taskStatuses[taskId] = "completed";
                                progressChanged = true;
                            }
                            const overall = computeOverallProgress(taskId, progress);
                            if (io) io.to(caseId).emit("calculationProgress", { progress: overall, taskId });
                        }
                    }
                    
                    const overallNow = computeOverallProgress(msg.taskId, msg.progress);
                    // 如果任务状态有变，则更新并持久化（强制写入）
                    if (progressChanged) {
                        persistProgress({
                            status: "running",
                            isCalculating: true,
                            progress: overallNow,
                            completed: false,
                            extra: { currentTaskId, lastTaskId },
                            force: true,
                        });
                        if (io) io.to(caseId).emit("taskUpdate", taskStatuses);
                    } else {
                        // 进度数值变化时也做节流持久化，保证刷新后仍能看到接近实时的进度
                        persistProgress({
                            status: "running",
                            isCalculating: true,
                            progress: overallNow,
                            completed: false,
                            extra: { currentTaskId, lastTaskId },
                            force: false,
                        });
                    }
                } catch (e) { /* 不是合法的 JSON，忽略 */ }
            }
        });

        // <<< 修改点 2: stderr 处理器只收集信息到缓冲区 >>>
        child.stderr.on("data", (data) => {
            const errorChunk = data.toString();
            stderrOutput += errorChunk; // 累加到缓冲区
            logStream.write(`STDERR: ${errorChunk}`);
            console.warn(`run.sh stderr (buffering) (${caseId}): ${errorChunk.trim()}`);
        });

        // <<< 修改点 3: 在进程结束时根据退出码做最终判断 >>>
        child.on("close", async (code) => {
            logStream.end();
            console.log(`run.sh 进程 (${caseId}) 退出，退出码: ${code}`);

            const runEntry = runningCalculations.get(caseId);
            if (runEntry?.killTimer) clearTimeout(runEntry.killTimer);
            if (runEntry?.timeoutTimer) clearTimeout(runEntry.timeoutTimer);
            const cancelReason = runEntry?.cancelReason;
            runningCalculations.delete(caseId);

            // 检查是否有任何任务报告了错误
            const hasReportedErrors = Object.values(taskStatuses).includes('error');
            const isSuccess = (code === 0 && !hasReportedErrors && !cancelReason);
            const endTimeMs = Date.now();
            const finalStatus = cancelReason === 'user'
                ? "canceled"
                : (isSuccess ? "completed" : "error");
            
            if (isSuccess && stderrOutput.trim()) {
                // 成功退出，但 stderr 有输出（通常是警告或 INFO/DEBUG 日志）
                console.warn(`脚本 (${caseId}) 成功退出，但 stderr 包含输出 (可能为日志/警告)`);
                // 将这些“警告”作为普通输出发送给前端
                if (io) io.to(caseId).emit("calculationOutput", `[SCRIPT-WARN] 脚本成功退出，但 stderr 包含以下内容:\n---\n${stderrOutput.trim()}\n---`);
            }

            // 更新所有未完成的任务状态（注意：用户取消不应把剩余任务标成 error）
            Object.keys(taskStatuses).forEach(taskId => {
                const s = taskStatuses[taskId];
                if (s !== 'pending' && s !== 'running') return;
                if (cancelReason === 'user') {
                    taskStatuses[taskId] = 'pending';
                } else if (cancelReason === 'timeout') {
                    taskStatuses[taskId] = s === 'running' ? 'error' : 'pending';
                } else {
                    taskStatuses[taskId] = isSuccess ? 'completed' : 'error';
                }
            });
            if(io) io.to(caseId).emit("taskUpdate", taskStatuses);

            // 更新最终进度文件
            const completedTaskCount = Object.values(taskStatuses).filter(s => s === 'completed').length;
            const finalProgressValue = isSuccess
                ? 100
                : Math.max(overallProgressValue, Math.round((completedTaskCount / knownTasks.length) * 100));
            const finalProgress = {
                status: finalStatus,
                isCalculating: false,
                progress: finalProgressValue,
                tasks: taskStatuses,
                timestamp: Date.now(),
                completed: isSuccess,
                startTime: startTimeMs,
                endTime: endTimeMs,
                exitCode: code,
                canceled: cancelReason === 'user',
                timeout: cancelReason === 'timeout',
                currentTaskId: null,
                lastTaskId,
            };
            try {
                // 等待可能存在的节流写入完成，避免覆盖最终状态
                await progressWriteChain;
            } catch {}
            await fsPromises.writeFile(progressPath, JSON.stringify(finalProgress, null, 2));
            
            // 更新 info.json
            try {
                const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                if (cancelReason === 'user') {
                    // Allow immediate restart after user cancel
                    info.calculationStatus = 'not_started';
                    info.lastCalculationCanceled = true;
                    info.lastCalculationCancelReason = 'user';
                    info.lastCalculationCancelTime = new Date(endTimeMs).toISOString();
                } else if (cancelReason === 'timeout') {
                    info.calculationStatus = 'error';
                    info.lastCalculationError = `计算超时并被终止（exitCode: ${code}）`;
                } else {
                    info.calculationStatus = finalStatus;
                    if (!isSuccess) {
                        info.lastCalculationError = `脚本退出码: ${code}. 详情: ${stderrOutput.substring(0, 1000).trim()}`;
                    }
                }
                info.lastCalculationEnd = new Date().toISOString();
                await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
            } catch (err) {
                console.warn(`警告: 更新最终 info.json (${caseId}) 状态失败:`, err);
            }
            
            // 发送最终的 WebSocket 消息
            if (cancelReason === 'user') {
                if (io) io.to(caseId).emit("calculationCanceled", { message: "计算已取消" });
            } else if (cancelReason === 'timeout') {
                if (io) io.to(caseId).emit("calculationFailed", {
                    message: `计算超时并终止，退出码: ${code}`,
                    details: stderrOutput.trim()
                });
            } else if (isSuccess) {
                if (io) io.to(caseId).emit("calculationCompleted", { message: "主计算成功完成" });
                
                // 触发后续的可视化预计算...
                // (此处省略了可视化预计算的spawn逻辑，您可以根据需要保留或添加)
                console.log(`主计算成功 (${caseId})，可触发可视化预计算。`);

            } else { // 失败
                console.error(`主计算 (${caseId}) 失败，退出码 ${code}。错误详情:\n${stderrOutput.trim()}`);
                if (io) io.to(caseId).emit("calculationFailed", {
                    message: `主计算失败，退出码: ${code}`,
                    details: stderrOutput.trim() // 将收集到的 stderr 内容作为错误详情发送
                });
            }
        });

        // 处理进程启动错误
        child.on("error", async (error) => {
            logStream.end();
            console.error(`执行 run.sh (${caseId}) 出错: ${error.message}`);
            const runEntry = runningCalculations.get(caseId);
            if (runEntry?.killTimer) clearTimeout(runEntry.killTimer);
            if (runEntry?.timeoutTimer) clearTimeout(runEntry.timeoutTimer);
            runningCalculations.delete(caseId);
            if (io) io.to(caseId).emit("calculationError", { message: "无法执行计算脚本", details: error.message });
            // ... (更新 info.json 和 progress.json 为失败状态的逻辑)
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: "执行计算脚本失败" });
            }
        });

        // 立即响应，表示已接受请求
        if (!res.headersSent) {
            res.status(202).json({ success: true, message: "计算已启动，请通过 WebSocket 接收进度更新。" });
        }

    } catch (error) {
        console.error(`设置计算 (${caseId}) 时出错:`, error);
        if (io) io.to(caseId).emit("calculationError", { message: "计算启动失败", details: error.message });
         if (!res.headersSent) {
             res.status(500).json({ success: false, message: "计算启动失败" });
         }
    }
});

// 取消正在进行的计算
router.post("/:caseId/cancel", async (req, res) => {
    const { caseId } = req.params;
    const io = req.app.get("socketio");
    const entry = runningCalculations.get(caseId);
    if (!entry || !entry.child || entry.child.killed) {
        return res.status(409).json({ success: false, message: "当前没有正在运行的计算可取消" });
    }
    if (!entry.cancelReason) {
        entry.cancelReason = 'user';
        if (io) io.to(caseId).emit("calculationOutput", "[USER] 已请求取消计算，正在终止进程...\n");
        killProcessGroup(entry.child, 'SIGTERM');
        entry.killTimer = setTimeout(() => {
            const rec = runningCalculations.get(caseId);
            if (!rec || !rec.child) return;
            killProcessGroup(rec.child, 'SIGKILL');
        }, 10_000);
    }
    return res.json({ success: true, message: "已请求取消，正在终止计算进程..." });
});


// --- ======================================== ---
// ---       REVISED VISUALIZATION API          ---
// --- ======================================== ---

// 1. Get Main Visualization Metadata (Excluding per-slice info)
router.get('/:caseId/visualization-metadata', async (req, res) => {
    const { caseId } = req.params;
    const metadataPath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'metadata.json');
    try {
        if (!fs.existsSync(metadataPath)) {
             console.warn(`Main metadata cache not found for ${caseId} at ${metadataPath}`);
            // Check if precomputation failed or hasn't run
            const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
            let vizStatus = 'not_run';
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                    vizStatus = info.visualizationStatus || vizStatus; // e.g., 'failed', 'completed'
                } catch { /* ignore read error */ }
            }
             let message = '未找到主元数据缓存。';
             if (vizStatus === 'failed') {
                 message += ' 可视化预计算可能已失败。';
             } else if (vizStatus === 'starting' || vizStatus === 'running') {
                 message += ' 可视化预计算正在进行中。';
             } else {
                  message += ' 请运行预计算。';
             }
            return res.status(404).json({ success: false, message: message, visualizationStatus: vizStatus });
        }
        const data = await fsPromises.readFile(metadataPath, 'utf-8');
        res.json({ success: true, metadata: JSON.parse(data) }); // Return parsed JSON
    } catch (error) {
        console.error(`读取主元数据缓存 (${caseId}) 出错:`, error);
        res.status(500).json({ success: false, message: '读取主元数据缓存失败。' });
    }
});

// 2. Get Specific Height Slice Info (Image URL, Pixel Coords, Dimensions)
router.get('/:caseId/visualization-slice', async (req, res) => {
    const { caseId } = req.params;
    const requestedHeight = parseFloat(req.query.height);

    if (isNaN(requestedHeight)) {
        return res.status(400).json({ success: false, message: '无效或缺少高度参数。' });
    }

    // Define paths
    const baseUploadPath = path.join(__dirname, '../uploads', caseId);
    const cachePath = path.join(baseUploadPath, 'visualization_cache');
    const mainMetadataPath = path.join(cachePath, 'metadata.json'); // Need this for height levels and vmin/vmax
    const slicesInfoDir = path.join(cachePath, 'slices_info');    // Directory for slice JSONs
    const slicesImgDir = path.join(cachePath, 'slices_img');      // Directory for slice PNGs

    try {
        // 1. Read main metadata to find closest height and get common info
        if (!fs.existsSync(mainMetadataPath)) {
            console.error(`主元数据文件未找到 (${caseId}) at ${mainMetadataPath}`);
            // Check viz status from info.json
            const infoJsonPath = path.join(baseUploadPath, 'info.json');
            let vizStatus = 'not_run';
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                    vizStatus = info.visualizationStatus || vizStatus;
                } catch { /* ignore */ }
            }
             let message = '未找到主元数据缓存。';
             if (vizStatus === 'failed') message += ' 可视化预计算可能已失败。';
             else if (vizStatus === 'starting' || vizStatus === 'running') message += ' 可视化预计算正在进行中。';
             else message += ' 请运行预计算。';
            return res.status(404).json({ success: false, message: message, visualizationStatus: vizStatus });
        }
        const mainMetadata = JSON.parse(await fsPromises.readFile(mainMetadataPath, 'utf-8'));
        const availableHeights = mainMetadata.heightLevels || [];
        const extentKm = mainMetadata.extentKm || mainMetadata.extent || mainMetadata.extent_m;
        const vmin = mainMetadata.vmin;
        const vmax = mainMetadata.vmax;
        const plotAreaPixels = mainMetadata.plotAreaPixels; // Get plot area bounds

        if (availableHeights.length === 0) {
            return res.status(404).json({ success: false, message: '主元数据中未找到高度层级。' });
        }
        if (!extentKm) {
             console.error(`主元数据中缺少 extentKm 或 extent (${caseId})`);
             return res.status(500).json({ success: false, message: '主元数据中缺少域范围信息。' });
        }
        // PlotAreaPixels is useful but maybe not strictly required for basic display
        // if (!plotAreaPixels) {
        //      console.error(`Main metadata is missing plotAreaPixels (${caseId})`);
        //      return res.status(500).json({ success: false, message: 'Main metadata is missing plot area pixel information.' });
        // }

        // 2. Find the closest available height
        const actualHeight = availableHeights.reduce((prev, curr) =>
            Math.abs(curr - requestedHeight) < Math.abs(prev - requestedHeight) ? curr : prev
        );

        // 3. Construct paths for slice image and slice info JSON
        // Use fixed precision formatting consistent with precompute script (e.g., 1 decimal place)
        const heightString = actualHeight.toFixed(1);
        const imageFilename = `slice_height_${heightString}.png`;
        const imagePathOnServer = path.join(slicesImgDir, imageFilename);
        const infoFilename = `slice_info_${heightString}.json`;
        const infoPathOnServer = path.join(slicesInfoDir, infoFilename);

        // 4. Check if both image and info file exist
        const imageExists = fs.existsSync(imagePathOnServer);
        const infoExists = fs.existsSync(infoPathOnServer);

        if (!imageExists || !infoExists) {
            let missingFiles = [];
            if (!imageExists) missingFiles.push(`图像 (${imageFilename})`);
            if (!infoExists) missingFiles.push(`信息文件 (${infoFilename})`);
            const message = `未找到高度 ${heightString}m 的 ${missingFiles.join(' 和 ')}。可能预计算未完成或失败。`;
            console.warn(message + ` Expected paths: Img=${imagePathOnServer}, Info=${infoPathOnServer}`);
            return res.status(404).json({
                success: false,
                message: message,
                debug_expectedImagePath: imagePathOnServer,
                debug_expectedInfoPath: infoPathOnServer
            });
        }

        // 5. Read slice info JSON
        const sliceInfoData = JSON.parse(await fsPromises.readFile(infoPathOnServer, 'utf-8'));
        const turbinesPixels = sliceInfoData.turbinesPixels || [];
        const imageDimensions = sliceInfoData.imageDimensions || null;

        if (!imageDimensions) {
            console.error(`切片信息 JSON (${infoFilename}) 缺少 imageDimensions。`);
            return res.status(500).json({ success: false, message: '切片信息文件损坏 (缺少图像尺寸)。' });
        }

        // 6. Construct the public URL path for the image
        // Ensure correct base path for serving static files is used
        const imageUrl = `/uploads/${caseId}/visualization_cache/slices_img/${imageFilename}`;

        // 7. Return combined information
        res.json({
            success: true,
            sliceImageUrl: imageUrl,
            actualHeight: actualHeight,
            imageDimensions: imageDimensions,   // Original dimensions of this slice image
            turbinesPixels: turbinesPixels,     // Precalculated pixel coordinates for this slice
            vmin: vmin,                         // Color range min
            vmax: vmax,                         // Color range max
            extentKm: extentKm,                 // Domain extent (might be useful for context)
            plotAreaPixels: plotAreaPixels      // Include plot area pixel bounds from main metadata
        });

    } catch (error) {
        console.error(`处理 /visualization-slice (${caseId}, H=${requestedHeight}) 出错:`, error);
        res.status(500).json({ success: false, message: '检索切片信息时发生内部服务器错误。' });
    }
});

// backend/routes/cases.js

// 3. Get Wind Profile Data
router.get('/:caseId/visualization-profile/:turbineId', async (req, res) => {
    const { caseId, turbineId } = req.params;
    // Validate turbineId format if necessary
    const turbineIdSchema = Joi.string().pattern(/^[\w-]+$/).max(50).required();
    const { error: idError } = turbineIdSchema.validate(turbineId);
    if (idError) {
         return res.status(400).json({ success: false, message: `无效的风机 ID 格式: ${turbineId}` });
    }

    const profilePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'profiles', `turbine_${turbineId}.json`);

    try {
        if (!fs.existsSync(profilePath)) {
            console.warn(`Profile file not found: ${profilePath}`);
            return res.status(404).json({ success: false, message: `未找到风机 ${turbineId} 的风廓线数据。` });
        }

        const data = await fsPromises.readFile(profilePath, 'utf-8');
        const profileData = JSON.parse(data); // Parse the root object

        // --- VALIDATION for {heights, speeds} structure ---
        // Check if it's an object and has the required arrays of the same length
        if (!profileData || typeof profileData !== 'object' || !Array.isArray(profileData.heights) || !Array.isArray(profileData.speeds) || profileData.heights.length !== profileData.speeds.length) {
            console.error(`风廓线数据结构无效 (缺少 heights/speeds 或长度不匹配) (${caseId}, Turbine ${turbineId})`);
            return res.status(500).json({ success: false, message: '风廓线数据文件结构无效。' });
        }

        // Optional: Further check types within arrays, allowing null for speeds
        if (profileData.heights.some(h => typeof h !== 'number') || profileData.speeds.some(s => typeof s !== 'number' && s !== null)) {
             console.error(`风廓线数据类型无效 (heights/speeds 包含非数字/null) (${caseId}, Turbine ${turbineId})`);
             // Consider if non-numeric heights are also an error
             return res.status(500).json({ success: false, message: '风廓线数据类型无效 (heights 或 speeds 数组包含非数字或不允许的 null 值)。' });
        }
        // --- END VALIDATION ---

        // Send the entire profileData object, as expected by the frontend service
        // frontend's visualizationService.js expects response.data.profile to be this object
        console.log(`成功读取并验证风廓线数据 (${caseId}, Turbine ${turbineId})`); // Add success log
        res.json({ success: true, profile: profileData });

    } catch (error) {
        // Handle JSON parsing errors separately
        if (error instanceof SyntaxError) {
             console.error(`解析风廓线 JSON 失败 (${caseId}, Turbine ${turbineId}):`, error);
             res.status(500).json({ success: false, message: '风廓线数据文件损坏 (无效 JSON)。' });
        } else {
            // Handle other errors (e.g., file read errors)
            console.error(`读取风廓线缓存 (${caseId}, Turbine ${turbineId}) 出错:`, error);
            res.status(500).json({ success: false, message: '读取风廓线数据缓存失败。' });
        }
    }
});

// 4. Get Wake Data
router.get('/:caseId/visualization-wake/:turbineId', async (req, res) => {
     const { caseId, turbineId } = req.params;
     // Validate turbineId format
    const turbineIdSchema = Joi.string().pattern(/^[\w-]+$/).max(50).required();
    const { error: idError } = turbineIdSchema.validate(turbineId);
    if (idError) {
         return res.status(400).json({ success: false, message: `无效的风机 ID 格式: ${turbineId}` });
    }

     const wakePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'wakes', `turbine_${turbineId}.json`);
     try {
         if (!fs.existsSync(wakePath)) {
             return res.status(404).json({ success: false, message: `未找到风机 ${turbineId} 的尾流数据。` });
         }
         const data = await fsPromises.readFile(wakePath, 'utf-8');
         // Optional: Validate JSON structure
         const wake = JSON.parse(data);
         // Example validation: Check for expected keys like 'centerline', 'deficit', etc.
         // if (!wake || typeof wake.centerline === 'undefined' || typeof wake.deficit === 'undefined') {
         //     console.error(`Wake data format invalid (${caseId}, Turbine ${turbineId})`);
         //     return res.status(500).json({ success: false, message: 'Wake data file has invalid format.' });
         // }
         res.json({ success: true, wake: wake });
     } catch (error) {
         if (error instanceof SyntaxError) {
             console.error(`Parsing wake JSON failed (${caseId}, Turbine ${turbineId}):`, error);
             res.status(500).json({ success: false, message: 'Wake data file is corrupted (invalid JSON).' });
         } else {
             console.error(`Reading wake cache (${caseId}, Turbine ${turbineId}) failed:`, error);
             res.status(500).json({ success: false, message: 'Failed to read wake data cache.' });
         }
     }
});

// 新增：查询特定坐标点的风速
router.get('/:caseId/query-wind-speed', async (req, res) => {
    const { caseId } = req.params;
    const { x, y, z } = req.query;

    // 1. 输入验证
    const pointSchema = Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required(),
        z: Joi.number().required()
    });

    const { error } = pointSchema.validate({ x, y, z });
    if (error) {
        return res.status(400).json({ success: false, message: '无效的坐标输入', errors: error.details.map(d => d.message) });
    }

    const scriptPath = path.join(__dirname, '../utils/run_query.sh');
    if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({ success: false, message: '查询脚本不存在' });
    }

	    // 2. 执行包装器脚本
	    try {
	        const pythonProcess = spawn('bash', [
	            scriptPath,
	            '--caseId',
            caseId,
            '--x',
            x,
            '--y',
            y,
            '--z',
            z
        ]);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

	        pythonProcess.stderr.on('data', (data) => {
	            stderrData += data.toString();
	        });

	        pythonProcess.on('close', (code) => {
	            const truncate = (text, max = 2000) => {
	                const value = String(text || '').trim();
	                if (!value) return '';
	                if (value.length <= max) return value;
	                return `${value.slice(0, max)}\n... (truncated)`;
	            };

	            const tryParseJson = (text) => {
	                const value = String(text || '').trim();
	                if (!value) return null;
	                try {
	                    return JSON.parse(value);
	                } catch {
	                    return null;
	                }
	            };

	            const getFriendlyQuerySpeedErrorMessage = (rawError) => {
	                const errText = String(rawError || '').trim();
	                const lower = errText.toLowerCase();
	                if (!errText) return '单点风速查询失败：后端未返回错误信息。';

	                if (errText.includes('Missing required Python package')) {
	                    return '单点风速查询依赖 Python 包 numpy/scipy；请确认后端环境已安装依赖并重启服务。';
	                }

	                if (errText.includes('Data files (output.json/speed.bin) not found')) {
	                    return '未找到速度场数据文件（output.json/speed.bin）。请先完成计算，并确认结果文件未被清理。';
	                }

	                if (errText.includes('Binary data size mismatch')) {
	                    return '速度场数据文件损坏或与元数据不匹配（output.json/speed.bin）。请重新计算或重新生成结果文件。';
	                }

	                if (lower.includes('python3') && (lower.includes('not found') || lower.includes('no such file'))) {
	                    return '后端未找到 python3，无法执行单点风速查询。';
	                }

	                return '单点风速查询失败：后端脚本运行异常，请查看后端日志。';
	            };

	            const stdoutTrimmed = String(stdoutData || '').trim();
	            const stderrTrimmed = String(stderrData || '').trim();
	            const parsedStdout = tryParseJson(stdoutTrimmed);
	            const includeDebug = process.env.DEBUG_QUERY_SPEED === '1';

	            const sendError = (message, debug) => {
	                const payload = { success: false, message };
	                if (includeDebug) {
	                    payload.debug = debug;
	                }
	                return res.status(500).json(payload);
	            };

	            if (code !== 0) {
	                const rawError = parsedStdout?.error || stderrTrimmed || stdoutTrimmed || `exit code ${code}`;
	                console.error(`查询脚本执行失败 (case: ${caseId}, point: ${x},${y},${z}, code: ${code})`, {
	                    stderr: truncate(stderrTrimmed, 800),
	                    stdout: truncate(stdoutTrimmed, 800),
	                });
	                return sendError(getFriendlyQuerySpeedErrorMessage(rawError), {
	                    code,
	                    stderr: truncate(stderrTrimmed),
	                    stdout: truncate(stdoutTrimmed),
	                });
	            }

	            if (!parsedStdout) {
	                console.error(`解析查询脚本输出失败 (case: ${caseId}), stdout: ${truncate(stdoutTrimmed, 800)}`);
	                return sendError('无法解析查询结果，请查看后端日志。', {
	                    code,
	                    stdout: truncate(stdoutTrimmed),
	                });
	            }

	            if (parsedStdout.success) {
	                return res.json({ success: true, speed: parsedStdout.speed, message: parsedStdout.message });
	            }

	            const rawError = parsedStdout.error || parsedStdout.message;
	            return sendError(getFriendlyQuerySpeedErrorMessage(rawError), {
	                code,
	                stdout: truncate(stdoutTrimmed),
	            });
	        });

	    } catch (spawnError) {
	        console.error(`启动查询脚本失败 (case: ${caseId}):`, spawnError);
        res.status(500).json({ success: false, message: '无法启动查询脚本' });
    }
});

// --- 5. 手动触发预计算 API ---
router.post('/:caseId/precompute-visualization', async (req, res) => {
    const { caseId } = req.params;
    const scriptPath = path.join(__dirname, '../utils/precompute_visualization.py');
    const casePath = path.join(__dirname, '../uploads', caseId);
    const cacheDir = path.join(casePath, 'visualization_cache');
    const infoJsonPath = path.join(casePath, 'info.json');
    const io = req.app.get('socketio');

    // 1. Check if case exists
    if (!fs.existsSync(casePath)) {
        return res.status(404).json({ success: false, message: '工况目录不存在' });
    }
    // 2. Check if calculation is completed (precomputation needs results)
     let calcStatus = 'unknown';
     if (fs.existsSync(infoJsonPath)) {
         try {
             const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
             calcStatus = info.calculationStatus || 'unknown';
         } catch { /* ignore read error */ }
     }
     if (calcStatus !== 'completed') {
          let message = '无法开始可视化预计算。';
          if (calcStatus === 'running') message += ' 主计算仍在运行中。';
          else if (calcStatus === 'error') message += ' 主计算失败。';
          else if (calcStatus === 'not_started' || calcStatus === 'not_configured') message += ' 主计算尚未运行或完成。';
          else message += ` 当前计算状态: ${calcStatus}。`;
          return res.status(400).json({ success: false, message: message, calculationStatus: calcStatus });
     }

    // 3. Clear old cache
    try {
        if (fs.existsSync(cacheDir)) {
            console.log(`手动触发：清理工况 ${caseId} 的可视化缓存...`);
            await fsPromises.rm(cacheDir, { recursive: true, force: true });
        }
    } catch(err) {
        console.error(`手动触发：清理缓存 (${caseId}) 失败:`, err);
        // Decide if this is fatal. Probably should continue.
        // return res.status(500).json({ success: false, message: '清理旧缓存失败' });
    }

    // 4. Check script existence
    if (!fs.existsSync(scriptPath)) {
         console.error(`预计算脚本未找到: ${scriptPath}`);
        return res.status(500).json({ success: false, message: '服务器上未找到预计算脚本。' });
    }

    console.log(`手动为工况 ${caseId} 触发预计算...`);

    // 5. Update info.json status
    try {
        const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
        info.visualizationStatus = "starting"; // Set status before starting
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
    } catch (err) {
        console.warn(`警告: 更新 info.json (${caseId}) 预计算状态 (starting) 失败:`, err);
    }

    // 6. Respond immediately (202 Accepted)
    // Send this *before* spawning the potentially long process
    res.status(202).json({ success: true, message: '预计算已开始。请通过 WebSocket 查看进度。' });

    // 7. Spawn Python script asynchronously
    // We don't wait for this to finish before responding to the HTTP request.
    // Use an async function wrapper to handle the spawn and updates without blocking.
    (async () => {
        try {
            const pythonProcess = spawn('python3', [scriptPath, '--caseId', caseId], {
                stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, capture stdout/stderr
            });

            let stdout = '';
            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                stdout += output + '\n';
                console.log(`Precompute (Manual) (${caseId}) stdout: ${output}`);
                if (io) io.to(caseId).emit('visualization_progress', { message: output });
            });

            let stderr = '';
            pythonProcess.stderr.on('data', (data) => {
                const errorOutput = data.toString().trim();
                stderr += errorOutput + '\n';
                console.error(`Precompute (Manual) (${caseId}) stderr: ${errorOutput}`);
                if (io) io.to(caseId).emit('visualization_error', { message: errorOutput });
            });

            pythonProcess.on('close', async (code) => { // Make handler async for file writes
                const finalStatus = code === 0 ? 'completed' : 'failed';
                console.log(`手动预计算 (${caseId}) 完成，退出码 ${code} (${finalStatus}).`);
                if (io) io.to(caseId).emit('visualization_status', { status: finalStatus, code: code });

                // Update info.json with final status
                 try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                    info.visualizationStatus = finalStatus;
                    if (finalStatus === 'failed') info.lastVisualizationError = stderr.substring(0, 500);
                    await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
                 } catch (err) {
                     console.warn(`警告: 更新最终 info.json (${caseId}) 预计算状态 (${finalStatus}) 失败:`, err);
                 }

                if (code !== 0) console.error(`手动预计算失败 (${caseId}). Stderr:\n${stderr}`);
            });

            pythonProcess.on('error', async (err) => { // Make handler async
                console.error(`启动手动预计算 (${caseId}) 失败:`, err);
                if (io) io.to(caseId).emit('visualization_status', { status: 'failed', error: err.message });
                 // Update info.json with failure status
                  try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                    info.visualizationStatus = 'failed';
                    info.lastVisualizationError = `启动预计算进程失败: ${err.message}`;
                    await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
                  } catch (errFS) {
                      console.warn(`警告: 更新 info.json (${caseId}) 预计算失败状态 (spawn error) 失败:`, errFS);
                  }
            });
        } catch (spawnError) {
             // This catches errors if spawn itself fails immediately
             console.error(`手动预计算 (${caseId}) spawn 错误:`, spawnError);
             if (io) io.to(caseId).emit('visualization_status', { status: 'failed', error: `Spawn failed: ${spawnError.message}` });
              try {
                const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                info.visualizationStatus = 'failed';
                info.lastVisualizationError = `Spawn failed: ${spawnError.message}`;
                await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
              } catch (errFS) {
                  console.warn(`警告: 更新 info.json (${caseId}) 预计算失败状态 (spawn catch) 失败:`, errFS);
              }
        }
    })(); // Immediately invoke the async function

});


// --- 其他路由 (info.json, 状态, VTK, PDF 等 - 保持不变) ---

// 11. 检查 info.json 是否存在
router.get('/:caseId/info-exists', (req, res) => {
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
    try {
        const exists = fs.existsSync(infoJsonPath);
        res.json({ exists });
    } catch (error) {
        console.error(`检查 info.json (${caseId}) 出错: ${error}`);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 12. 下载 info.json
router.get('/:caseId/info-download', (req, res) => {
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
    if (!fs.existsSync(infoJsonPath)) {
        return res.status(404).json({ success: false, message: 'info.json 不存在' });
    }
    // Send file with correct Content-Type
    res.download(infoJsonPath, 'info.json', (err) => {
        if (err) {
            console.error(`发送 info.json (${caseId}) 失败:`, err);
            // Avoid sending error response if headers already sent
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: '下载文件时服务器错误' });
            }
        }
    });
});

// 13. 生成并保存 info.json
router.post('/:caseId/info', async (req, res) => {
    const { caseId } = req.params;
    
    // --- Joi Schema for Validation ---
    const turbineSchema = Joi.object({
        id: Joi.string().required(),
        longitude: Joi.number().min(-180).max(180).required(),
        latitude: Joi.number().min(-90).max(90).required(),
        hubHeight: Joi.number().positive().required(),
        rotorDiameter: Joi.number().positive().required(),
        model: Joi.string().allow(null, '').optional(),
        type: Joi.number().allow(null, '').optional(),
        name: Joi.string().allow(null, '').optional(),
    }).required();

    const parametersSchema = Joi.object({
        calculationDomain: Joi.object({
            width: Joi.number().required(),
            height: Joi.number().required()
        }).required(),
        conditions: Joi.object({
            windDirection: Joi.number().required(),
            inletWindSpeed: Joi.number().required()
        }).required(),
        grid: Joi.object().unknown(true).required(),
        terrain: Joi.object({
            r1: Joi.number().required(),
            r2: Joi.number().required()
        }).required(),
        roughness: Joi.object({
            Cd: Joi.number().min(0).required(),
            lad_max: Joi.number().min(0).required(),
            vege_times: Joi.number().min(0).required()
        }).required(),

        simulation: Joi.object().unknown(true).required(),
        postProcessing: Joi.object().unknown(true).required(),
        center: Joi.object({
            lon: Joi.number().allow(null).optional(),
            lat: Joi.number().allow(null).optional()
        }).optional(),
        caseName: Joi.string().optional()
    }).unknown(true).required();

    // 添加地理范围验证schema
    const geographicBoundsSchema = Joi.object({
        minLat: Joi.number().min(-90).max(90).required(),
        maxLat: Joi.number().min(-90).max(90).required(),
        minLon: Joi.number().min(-180).max(180).required(),
        maxLon: Joi.number().min(-180).max(180).required()
    }).optional();

    const schema = Joi.object({
        parameters: parametersSchema,
        windTurbines: Joi.array().items(turbineSchema).min(1).required().messages({
            'array.min': '至少需要提供一个风机信息',
            'array.base': '风机信息必须是一个列表',
        }),
        // 添加地理范围字段
        geographicBounds: geographicBoundsSchema
    });

    // --- Validate Request Body ---
    const { error: validationError, value } = schema.validate(req.body, { abortEarly: false });
    if (validationError) {
        const errorMessages = validationError.details.map(detail => detail.message);
        console.warn(`info.json 生成验证失败 (${caseId}):`, errorMessages);
        return res.status(400).json({ success: false, message: "请求数据无效", errors: errorMessages });
    }

    const { parameters, windTurbines, geographicBounds } = value;

    try {
        // --- Calculate Wind Farm Center ---
        let windFarmCenterLon, windFarmCenterLat;
        if (windTurbines.length > 0) {
            const longitudes = windTurbines.map(turbine => turbine.longitude);
            const latitudes = windTurbines.map(turbine => turbine.latitude);
            windFarmCenterLon = (longitudes.length > 0) ? (Math.min(...longitudes) + Math.max(...longitudes)) / 2 : 0;
            windFarmCenterLat = (latitudes.length > 0) ? (Math.min(...latitudes) + Math.max(...latitudes)) / 2 : 0;
        } else {
            return res.status(400).json({ success: false, message: "风机列表不能为空" });
        }

        // --- Calculate CFD Domain Center (based on tif geographic bounds) ---
        let cfdCenterLon, cfdCenterLat;
        if (geographicBounds) {
            // 验证地理范围的有效性
            if (geographicBounds.maxLon <= geographicBounds.minLon || 
                geographicBounds.maxLat <= geographicBounds.minLat) {
                console.warn(`无效的地理范围 (${caseId}):`, geographicBounds);
                return res.status(400).json({ success: false, message: "地理范围数据无效" });
            }
            
            cfdCenterLon = (geographicBounds.minLon + geographicBounds.maxLon) / 2;
            cfdCenterLat = (geographicBounds.minLat + geographicBounds.maxLat) / 2;
            
            console.log(`CFD domain center (tif-based): (${cfdCenterLon.toFixed(6)}, ${cfdCenterLat.toFixed(6)})`);
            console.log(`Wind farm center: (${windFarmCenterLon.toFixed(6)}, ${windFarmCenterLat.toFixed(6)})`);
        } else {
            // fallback: 使用风机群中心
            cfdCenterLon = windFarmCenterLon;
            cfdCenterLat = windFarmCenterLat;
            console.log(`Warning: No geographic bounds provided for case ${caseId}, using wind farm center as CFD domain center`);
        }

        // --- Read existing info.json to preserve status ---
        let existingInfo = {};
        const casePath = path.join(__dirname, '../uploads', caseId);
        const infoJsonPath = path.join(casePath, 'info.json');
        if (fs.existsSync(infoJsonPath)) {
            try {
                existingInfo = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
            } catch (readErr) {
                console.warn(`读取现有 info.json (${caseId}) 失败，将重新创建:`, readErr);
            }
        }

        // --- Construct info.json Content ---
        const infoJson = {
            key: caseId,
            // Preserve existing status, default to 'not_started' if new or unreadable
            calculationStatus: existingInfo.calculationStatus || 'not_started',
            visualizationStatus: existingInfo.visualizationStatus,
            domain: {
                lt: parameters.calculationDomain?.width ?? 10000,
                h: parameters.calculationDomain?.height ?? 800,
                // CFD域的实际中心（基于tif数据）
                centerLon: parseFloat(cfdCenterLon.toFixed(6)),
                centerLat: parseFloat(cfdCenterLat.toFixed(6))
            },
            // 添加地理范围信息（如果提供的话）
            geographicBounds: geographicBounds ? {
                minLon: parseFloat(geographicBounds.minLon.toFixed(6)),
                maxLon: parseFloat(geographicBounds.maxLon.toFixed(6)),
                minLat: parseFloat(geographicBounds.minLat.toFixed(6)),
                maxLat: parseFloat(geographicBounds.maxLat.toFixed(6))
            } : null,
            // 风机群中心（用于坐标转换）
            windFarmCenter: {
                lon: parseFloat(windFarmCenterLon.toFixed(6)),
                lat: parseFloat(windFarmCenterLat.toFixed(6))
            },
            wind: {
                angle: parameters.conditions?.windDirection ?? 270,
                speed: parameters.conditions?.inletWindSpeed ?? 10
            },
            mesh: {
                h1: parameters.grid?.encryptionHeight ?? 210,
                ceng: parameters.grid?.encryptionLayers ?? 21,
                q1: parameters.grid?.gridGrowthRate ?? 1.2,
                lc1: parameters.grid?.maxExtensionLength ?? 360,
                lc2: parameters.grid?.encryptionRadialLength ?? 50,
                lc3: parameters.grid?.downstreamRadialLength ?? 100,
                r1: parameters.grid?.encryptionRadius ?? 200,
                r2: parameters.grid?.encryptionTransitionRadius ?? 400,
                tr1: parameters.grid?.terrainRadius ?? 4000,
                tr2: parameters.grid?.terrainTransitionRadius ?? 5000,
                wakeL: parameters.grid?.downstreamLength ?? 2000,
                wakeB: parameters.grid?.downstreamWidth ?? 600,
                scale: parameters.grid?.scale ?? 0.001,
            },
                // 新增 terrain 对象
    terrain: {
        r1: parameters.terrain?.r1 ?? 4000,
        r2: parameters.terrain?.r2 ?? 5000,
    },
    // 新增 roughness 对象
    roughness: {
        Cd: parameters.roughness?.Cd ?? 0.2,
        lad_max: parameters.roughness?.lad_max ?? 0.5,
        vege_times: parameters.roughness?.vege_times ?? 1.0,
    },
            simulation: {
                core: parameters.simulation?.cores ?? 4,
                step_count: parameters.simulation?.steps ?? 1000,
                deltaT: parameters.simulation?.deltaT ?? 1
            },
            post: {
                numh: parameters.postProcessing?.resultLayers ?? 10,
                dh: parameters.postProcessing?.layerSpacing ?? 20,
                width: parameters.postProcessing?.layerDataWidth ?? 1000,
                height: parameters.postProcessing?.layerDataHeight ?? 1000,
            },
            turbines: windTurbines.map(turbine => {
                // 注意：这里仍然使用风机群中心计算投影坐标
                // 坐标转换将在预处理阶段进行
                const { x, y } = calculateXY(turbine.longitude, turbine.latitude, windFarmCenterLon, windFarmCenterLat);
                const rawModel = (turbine.model ?? turbine.type ?? 1);
                const modelNum = Number(rawModel);
                const modelId = (Number.isFinite(modelNum) && modelNum >= 1 && modelNum <= 10)
                  ? String(Math.trunc(modelNum))
                  : '1';
                const rawType = (turbine.type ?? modelId);
                const typeNum = Number(rawType);
                const typeId = (Number.isFinite(typeNum) && typeNum >= 1 && typeNum <= 10)
                  ? Math.trunc(typeNum)
                  : Number(modelId);
                return {
                    id: turbine.id,
                    lon: turbine.longitude,
                    lat: turbine.latitude,
                    hub: turbine.hubHeight,
                    d: turbine.rotorDiameter,
                    x: parseFloat(x.toFixed(3)), // 相对于风机群中心的投影坐标（米）
                    y: parseFloat(y.toFixed(3)),
                    type: typeId,
                    name: turbine.name || `Turbine_${turbine.id}`,
                    model: modelId
                };
            }),
            center: {
                // 保持向后兼容性，这里仍然是风机群中心
                lon: parseFloat(windFarmCenterLon.toFixed(6)),
                lat: parseFloat(windFarmCenterLat.toFixed(6))
            },
            // Add timestamp
            lastInfoGenerated: new Date().toISOString(),
        };

        // --- Save info.json ---
        await fsPromises.mkdir(casePath, { recursive: true });
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');

        console.log(`info.json 已为工况 ${caseId} 生成/更新，包含CFD域中心信息。`);
        
        // 输出调试信息
        if (geographicBounds) {
            console.log(`  - 地理范围: Lon[${geographicBounds.minLon.toFixed(6)}, ${geographicBounds.maxLon.toFixed(6)}], Lat[${geographicBounds.minLat.toFixed(6)}, ${geographicBounds.maxLat.toFixed(6)}]`);
            console.log(`  - CFD域中心: (${cfdCenterLon.toFixed(6)}, ${cfdCenterLat.toFixed(6)})`);
            console.log(`  - 风机群中心: (${windFarmCenterLon.toFixed(6)}, ${windFarmCenterLat.toFixed(6)})`);
            
            // 计算中心之间的距离（粗略估算）
            const earthRadius = 6371000; // 地球半径（米）
            const lat1 = cfdCenterLat * Math.PI / 180;
            const lat2 = windFarmCenterLat * Math.PI / 180;
            const deltaLat = (windFarmCenterLat - cfdCenterLat) * Math.PI / 180;
            const deltaLon = (windFarmCenterLon - cfdCenterLon) * Math.PI / 180;
            
            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                     Math.cos(lat1) * Math.cos(lat2) *
                     Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = earthRadius * c;
            
            console.log(`  - 中心距离: ${distance.toFixed(1)} 米`);
        }

        console.log(`info.json 已为工况 ${caseId} 生成/更新，包含植被和地形参数。`);
        res.status(201).json({ success: true, message: 'info.json 生成/更新成功' });

    } catch (error) {
        console.error(`生成和保存 info.json (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, message: '生成或保存 info.json 时服务器出错' });
    }
});

// ==========================================================
// [新增] 13.5. 删除 info.json (用于在前端解锁参数)
// ==========================================================
router.delete('/:caseId/info', async (req, res) => {
    const { caseId } = req.params; // 已由中间件验证
    const casePath = path.join(__dirname, '../uploads', caseId);
    const infoJsonPath = path.join(casePath, 'info.json');

    try {
        // 检查文件是否存在
        if (!fs.existsSync(infoJsonPath)) {
            // 如果文件本就不存在，也视为一种“成功”，因为客户端的目标已经达成
            console.log(`请求解锁参数，但 info.json (${caseId}) 已不存在。`);
            return res.json({ success: true, message: '参数已处于可编辑状态。' });
        }

        // 执行删除操作
        await fsPromises.unlink(infoJsonPath);
        console.log(`成功删除 info.json (${caseId})，参数已解锁。`);

        // 可选但推荐：如果删除了 info.json，也应该清理相关的计算状态，
        // 因为旧的计算结果和进度不再与当前（即将被修改的）参数匹配。
        const progressPath = path.join(casePath, 'calculation_progress.json');
        if (fs.existsSync(progressPath)) {
            await fsPromises.unlink(progressPath);
            console.log(`已一并删除 calculation_progress.json (${caseId})。`);
        }
        
        res.json({ success: true, message: '参数解锁成功，您可以重新编辑并提交。' });

    } catch (error) {
        console.error(`删除 info.json (${caseId}) 时发生错误:`, error);
        res.status(500).json({ success: false, message: '服务器在尝试解锁参数时发生错误。' });
    }
});

// 14. 获取特定工况的计算状态 (从 info.json 读取)
router.get('/:caseId/calculation-status', async (req, res) => { // Make async
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');

    if (!fs.existsSync(infoJsonPath)) {
        // If info.json doesn't exist, the case setup is likely incomplete
        return res.json({ calculationStatus: 'not_configured', visualizationStatus: null }); // More specific status
    }

    try {
        const data = await fsPromises.readFile(infoJsonPath, 'utf-8');
        const info = JSON.parse(data);
        const calcStatus = info.calculationStatus || 'unknown'; // Default to 'unknown' if field missing
        const vizStatus = info.visualizationStatus || null; // Get viz status too
        res.json({ calculationStatus: calcStatus, visualizationStatus: vizStatus });
    } catch (error) {
        console.error(`读取 info.json (${caseId}) 状态时出错:`, error);
        // Return a specific error status if reading fails
        res.json({ calculationStatus: 'error_reading_status', visualizationStatus: null });
    }
});

// --- 进度、日志、状态文件路由 ---

// 存储计算进度 - 放宽验证
router.post('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

    try {
        // 计算运行中时，进度文件由后端统一写入，防止前端误覆写导致状态错乱
        const entry = runningCalculations.get(caseId);
        if (entry && entry.child && !entry.child.killed) {
            return res.status(409).json({
                success: false,
                message: '计算正在运行，进度由后端维护，禁止客户端覆写。'
            });
        }

        // 更宽松的验证
        if (typeof req.body !== 'object' || req.body === null) {
            return res.status(400).json({ success: false, error: '无效的进度数据格式' });
        }

        // 确保必要的字段存在，提供默认值
        const progressData = {
            status: req.body.status || req.body.calculationStatus || 'not_started',
            isCalculating: req.body.isCalculating !== undefined ? req.body.isCalculating : false,
            progress: req.body.progress || 0,
            tasks: req.body.tasks || {},
            outputs: req.body.outputs || [],
            timestamp: req.body.timestamp || Date.now(),
            completed: req.body.completed || false,
            startTime: req.body.startTime || null,
            ...req.body // 包含其他字段
        };

        await fsPromises.writeFile(progressPath, JSON.stringify(progressData, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error(`保存计算进度 (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, error: '保存进度失败', details: error.message });
    }
});


// 获取计算进度
router.get('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
    try {
        if (fs.existsSync(progressPath)) {
            const progressData = await fsPromises.readFile(progressPath, 'utf-8');
            const progress = JSON.parse(progressData);
            // Ensure all required fields are present, provide defaults if not
            const defaultProgress = {
                status: 'not_started',
                isCalculating: false,
                progress: 0,
                tasks: {},
                outputs: [],
                completed: false,
                timestamp: null,
                startTime: null,
                endTime: null,
                exitCode: null,
                canceled: false,
                timeout: false,
                currentTaskId: null,
                lastTaskId: null,
            };
            res.json({ progress: { ...defaultProgress, ...progress } }); // Merge with defaults
        } else {
            // Return a default progress state if file doesn't exist
             const defaultProgress = {
                 status: 'not_started',
                 isCalculating: false,
                 progress: 0,
                 tasks: {},
                 outputs: [],
                 completed: false,
                 timestamp: null,
                 startTime: null,
                 endTime: null,
                 exitCode: null,
                 canceled: false,
                 timeout: false,
                 currentTaskId: null,
                 lastTaskId: null,
             };
             // Try getting status from info.json as a fallback
             const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
             if (fs.existsSync(infoJsonPath)) {
                 try {
                     const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                     if (info.calculationStatus === 'completed') {
                         defaultProgress.status = 'completed';
                         defaultProgress.completed = true;
                         defaultProgress.progress = 100;
                         // Populate tasks as completed? Maybe too complex here.
                     } else if (info.calculationStatus === 'running') {
                         defaultProgress.status = 'running';
                         defaultProgress.isCalculating = true;
                     } else if (info.calculationStatus) {
                         defaultProgress.status = info.calculationStatus;
                     }
                 } catch {/* ignore */}
             }
            res.json({ progress: defaultProgress });
        }
    } catch (error) {
        console.error(`获取计算进度 (${caseId}) 失败:`, error);
        if (error instanceof SyntaxError) {
             res.status(500).json({ success: false, error: '进度文件损坏 (无效 JSON)' });
        } else {
            res.status(500).json({ success: false, error: '获取进度失败', details: error.message });
        }
    }
});

// 获取已上传的性能曲线文件列表
router.get('/:caseId/curve-files', async (req, res) => {
    const { caseId } = req.params;
    const curvesDir = path.join(__dirname, '..', 'uploads', caseId, 'customCurves');
    
    try {
      if (!fs.existsSync(curvesDir)) {
        return res.json({ success: true, files: [] });
      }
      
      const files = await fsPromises.readdir(curvesDir);
      const curveFiles = files
        .filter(file => file.match(/^\d+-U-P-Ct\.(txt|csv)$/))
        .map(file => ({
          name: file,
          path: path.join(curvesDir, file),
          size: fs.statSync(path.join(curvesDir, file)).size,
          uploadTime: fs.statSync(path.join(curvesDir, file)).mtime
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      res.json({ success: true, files: curveFiles });
    } catch (error) {
      console.error(`获取性能曲线文件列表 (${caseId}) 失败:`, error);
      res.status(500).json({ success: false, message: '获取文件列表失败' });
    }
  });

  // 获取特定性能曲线文件的内容
router.get('/:caseId/curve-files/:fileName', async (req, res) => {
    const { caseId, fileName } = req.params;
    
    // 验证文件名格式
    if (!fileName.match(/^\d+-U-P-Ct\.(txt|csv)$/)) {
      return res.status(400).json({ success: false, message: '无效的文件名格式' });
    }
    
    const filePath = path.join(__dirname, '..', 'uploads', caseId, 'customCurves', fileName);
    
    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: '文件不存在' });
      }
      
      const content = await fsPromises.readFile(filePath, 'utf-8');
      res.json({ success: true, content, fileName });
    } catch (error) {
      console.error(`读取性能曲线文件 ${fileName} (${caseId}) 失败:`, error);
      res.status(500).json({ success: false, message: '读取文件失败' });
    }
  });
  
  // 删除特定性能曲线文件
router.delete('/:caseId/curve-files/:fileName', async (req, res) => {
    const { caseId, fileName } = req.params;
    
    // 验证文件名格式
    if (!fileName.match(/^\d+-U-P-Ct\.(txt|csv)$/)) {
      return res.status(400).json({ success: false, message: '无效的文件名格式' });
    }
    
    const filePath = path.join(__dirname, '..', 'uploads', caseId, 'customCurves', fileName);
    
    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: '文件不存在' });
      }
      
      await fsPromises.unlink(filePath);
      console.log(`成功删除性能曲线文件: ${fileName} (${caseId})`);
      res.json({ success: true, message: '文件删除成功' });
    } catch (error) {
      console.error(`删除性能曲线文件 ${fileName} (${caseId}) 失败:`, error);
      res.status(500).json({ success: false, message: '删除文件失败' });
    }
  });
  
// 删除计算进度 + 重置 info.json 中的 calculationStatus（用于允许重新开始计算）
router.delete('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
    const infoJsonPath = path.join(__dirname, `../uploads/${caseId}/info.json`);

    const entry = runningCalculations.get(caseId);
    if (entry && entry.child && !entry.child.killed) {
        return res.status(409).json({ success: false, message: '计算正在运行，请先取消计算后再重置。' });
    }

    try {
        let deletedProgress = false;
        if (fs.existsSync(progressPath)) {
            await fsPromises.unlink(progressPath);
            deletedProgress = true;
            console.log(`计算进度文件已删除 (${caseId}): ${progressPath}`);
        }

        let updatedInfoStatus = false;
        if (fs.existsSync(infoJsonPath)) {
            try {
                const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                info.calculationStatus = 'not_started';
                info.lastCalculationReset = new Date().toISOString();
                await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), 'utf-8');
                updatedInfoStatus = true;
            } catch (err) {
                console.warn(`警告: 重置 info.json (${caseId}) 计算状态失败:`, err);
            }
        }

        const parts = [];
        parts.push(deletedProgress ? '计算进度已清理' : '计算进度文件不存在');
        if (updatedInfoStatus) {
            parts.push('计算状态已重置为未开始');
        } else if (!fs.existsSync(infoJsonPath)) {
            parts.push('未找到 info.json，未重置计算状态');
        }

        return res.json({ success: true, message: parts.join('；') });
    } catch (error) {
        console.error(`删除计算进度/重置状态 (${caseId}) 失败:`, error);
        return res.status(500).json({ success: false, message: '删除计算进度/重置状态失败', error: error.message });
    }
});


// 获取 OpenFOAM (或其他计算核心) 的日志输出
router.get('/:caseId/calculation-log', async (req, res) => {
    const { caseId } = req.params;
    const runDir = path.join(__dirname, `../uploads/${caseId}/run`);

    // Define preferred log file names in order of preference
    const logPreferences = [
        'log.simpleFoam', // OpenFOAM solver log
        'log.snappyHexMesh', // Meshing log
        'log.blockMesh', // Initial mesh log
        'log.potentialFoam' // Initial field log
    ];

    try {
         // Check for preferred logs first
         for (const logName of logPreferences) {
             const logPath = path.join(runDir, logName);
             if (fs.existsSync(logPath)) {
                 console.log(`Serving preferred log: ${logName} for case ${caseId}`);
                 const output = await fsPromises.readFile(logPath, 'utf-8');
                 return res.type('text/plain').send(output);
             }
         }

         // If no preferred logs found, try finding the latest timestamped log
         if (fs.existsSync(runDir)) {
             const files = await fsPromises.readdir(runDir);
             const logFiles = files
                 .filter(f => f.startsWith('calculation_log_') && f.endsWith('.txt'))
                 .sort()
                 .reverse(); // Sort descending to get latest

             if (logFiles.length > 0) {
                 const latestLogPath = path.join(runDir, logFiles[0]);
                 console.log(`Serving latest timestamped log: ${logFiles[0]} for case ${caseId}`);
                 const output = await fsPromises.readFile(latestLogPath, 'utf-8');
                 return res.type('text/plain').send(output);
             }
         }

        // If no logs found at all
        res.status(404).type('text/plain').send(`未找到工况 ${caseId} 的计算日志文件。`);

    } catch (error) {
        console.error(`获取计算日志 (${caseId}) 失败:`, error);
        res.status(500).type('text/plain').send(`获取计算日志失败: ${error.message}`);
    }
});


// --- 风机状态路由 (保持不变) ---
// 保存风机状态 (通常由前端的交互触发, e.g., toggling on/off)
router.post('/:caseId/state', async (req, res) => {
    const { caseId } = req.params;
    const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);

    // Validate incoming state (e.g., must be an object with a windTurbines array)
     const stateSchema = Joi.object({
         windTurbines: Joi.array().items(Joi.object({
             id: Joi.string().required(),
             // Add other state properties to validate, e.g., 'enabled', 'yawOffset'
             enabled: Joi.boolean().optional(), // Example state property
             // ... other state fields
         }).unknown(true)) // Allow other properties within each turbine object
         .required() // The windTurbines array is required
     }).required(); // The root object is required

     const { error: validationError, value: validatedState } = stateSchema.validate(req.body);
     if (validationError) {
         console.warn(`保存风机状态验证失败 (${caseId}):`, validationError.details.map(d => d.message));
         return res.status(400).json({ success: false, message: '无效的风机状态数据格式', errors: validationError.details.map(d => d.message) });
     }

    try {
        // Ensure directory exists (might be redundant if case created properly)
         await fsPromises.mkdir(path.dirname(statePath), { recursive: true });

        await fsPromises.writeFile(statePath, JSON.stringify(validatedState, null, 2), 'utf-8');
        console.log(`风机状态已保存 (${caseId}): ${statePath}`);
        res.json({ success: true, message: '风机状态保存成功' });
    } catch (error) {
        console.error(`保存风机状态 (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, message: '保存风机状态失败', error: error.message });
    }
});


// 获取风机状态
router.get('/:caseId/state', async (req, res) => {
    const { caseId } = req.params;
    const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);
    try {
        if (fs.existsSync(statePath)) {
            const stateData = await fsPromises.readFile(statePath, 'utf-8');
            const state = JSON.parse(stateData);
            // Ensure it returns the expected structure, e.g., { windTurbines: [...] }
            // Validate structure before sending?
            if (!state || !Array.isArray(state.windTurbines)) {
                 console.warn(`风机状态文件格式无效 (${caseId}), 返回空列表。 Path: ${statePath}`);
                 return res.json({ success: true, windTurbines: [] });
            }
            res.json({ success: true, windTurbines: state.windTurbines });
        } else {
            // If state file doesn't exist, try getting turbines from info.json
            const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const infoData = await fsPromises.readFile(infoJsonPath, 'utf-8');
                    const info = JSON.parse(infoData);
                    if (info && Array.isArray(info.turbines)) {
                         // Return basic turbine info from info.json as default state (e.g., all enabled)
                         const defaultState = info.turbines.map(t => ({ id: t.id, name: t.name, enabled: true /* Default state */ }));
                         return res.json({ success: true, windTurbines: defaultState });
                    }
                } catch (err) {
                     console.warn(`读取 info.json 以获取默认状态失败 (${caseId}):`, err);
                }
            }
            // Return empty array if neither state nor info file provides data
            res.json({ success: true, windTurbines: [] });
        }
    } catch (error) {
        console.error(`获取风机状态 (${caseId}) 失败:`, error);
         if (error instanceof SyntaxError) {
             console.error(`风机状态文件损坏 (${caseId}):`, error);
             res.status(500).json({ success: false, message: '获取风机状态失败 (文件损坏)' });
         } else {
             res.status(500).json({ success: false, message: '获取风机状态失败', error: error.message });
         }
    }
});


// --- VTK 和后处理文件路由 (保持不变) ---

// 确保 VTK 目录存在 (中间件)
// Apply middleware specifically to routes that need the VTK dir
const ensureVTKMiddleware = (req, res, next) => {
    ensureVTKDirectories(req.params.caseId);
    next();
};
router.use('/:caseId/VTK', ensureVTKMiddleware);
router.use('/:caseId/list-vtk-files', ensureVTKMiddleware);


// 主要的VTK文件提供路由
router.get('/:caseId/VTK/*', async (req, res) => {
    const { caseId } = req.params;
    // req.params[0] captures everything after /VTK/
    const relativePath = req.params[0];
    if (!relativePath || relativePath.includes('..')) { // Basic traversal check
        return res.status(400).json({ success: false, error: '无效或禁止的 VTK 文件路径' });
    }
    // Construct the full path relative to the case's VTK directory
    const filePath = path.join(__dirname, '../uploads', caseId, 'run/VTK', relativePath);

    // More robust path traversal check
    const vtkBaseDir = path.resolve(path.join(__dirname, '../uploads', caseId, 'run/VTK'));
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(vtkBaseDir)) {
         console.warn(`Path traversal attempt detected: ${resolvedFilePath} vs ${vtkBaseDir}`);
         return res.status(403).json({ success: false, error: '禁止访问' });
    }


    try {
        if (!fs.existsSync(resolvedFilePath)) {
            console.warn('VTK 文件未找到:', resolvedFilePath);
            return res.status(404).json({ success: false, error: 'VTK 文件未找到', path: relativePath });
        }

        const stat = await fsPromises.stat(resolvedFilePath);
        if (stat.isDirectory()) {
             return res.status(400).json({ success: false, error: '请求路径是一个目录，不是文件', path: relativePath });
        }

        const ext = path.extname(resolvedFilePath).toLowerCase();
        // Determine content type based on extension
        let contentType = 'application/octet-stream'; // Default binary
        if (ext === '.vtk') contentType = 'text/plain'; // Legacy VTK often text
        // Modern VTK XML formats
        else if (ext === '.vtu') contentType = 'application/vnd.kitware.vtk+xml'; // Unstructured Grid
        else if (ext === '.vtp') contentType = 'application/vnd.kitware.vtk+xml'; // PolyData
        else if (ext === '.vti') contentType = 'application/vnd.kitware.vtk+xml'; // ImageData
        else if (ext === '.vts') contentType = 'application/vnd.kitware.vtk+xml'; // Structured Grid
        else if (ext === '.vtr') contentType = 'application/vnd.kitware.vtk+xml'; // Rectilinear Grid
        else if (ext === '.vtm') contentType = 'application/vnd.kitware.vtk+xml'; // MultiBlock Data
        else if (ext === '.pvsm') contentType = 'application/xml'; // ParaView State File
        else if (ext === '.json') contentType = 'application/json';

        res.setHeader('Content-Type', contentType);
        // Add cache control headers if desired (e.g., cache for a short time)
        // res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

        const fileStream = fs.createReadStream(resolvedFilePath);
        fileStream.on('error', (error) => {
            console.error(`读取 VTK 文件流 (${resolvedFilePath}) 出错:`, error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: '读取文件失败', details: error.message });
            } else {
                 res.end();
            }
        });

        req.on('close', () => {
            // console.log(`Client disconnected while streaming VTK file: ${resolvedFilePath}`);
            fileStream.destroy(); // Clean up stream if client disconnects
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error(`提供 VTK 文件 (${resolvedFilePath}) 时出错:`, error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: '服务器内部错误', details: error.message });
        }
    }
});

// 列出可用的VTK文件 (递归查找)
router.get('/:caseId/list-vtk-files', async (req, res) => {
    const { caseId } = req.params;
    const vtkBaseDir = path.join(__dirname, '../uploads', caseId, 'run', 'VTK');
    const uploadsBaseDir = path.join(__dirname, '..', 'uploads'); // Base for relative paths

    try {
        if (!fs.existsSync(vtkBaseDir)) {
            console.log(`VTK 目录未找到: ${vtkBaseDir}`);
            // Return empty list if directory doesn't exist
             // The base directory path should be relative to the server root or configured static path
            return res.json({ success: true, files: [], baseDirectory: `/uploads/${caseId}/run/VTK` });
        }

        const vtkFiles = [];
        const directories = [vtkBaseDir]; // Stack for directories to explore

        while (directories.length > 0) {
            const currentDir = directories.pop();
            let entries;
            try {
                entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
            } catch (readDirError) {
                 console.warn(`无法读取目录 ${currentDir}: ${readDirError.message}`);
                 continue; // Skip directories that cannot be read
            }


            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    // Avoid infinite loops with symlinks (though less common here)
                    // Add basic depth limit?
                    directories.push(fullPath); // Add subdirectory to stack
                } else if (entry.isFile()) { // Ensure it's a file
                    const ext = path.extname(entry.name).toLowerCase();
                     // Define recognizable VTK/ParaView extensions
                    const vtkExtensions = ['.vtk', '.vtu', '.vtp', '.vti', '.vts', '.vtr', '.vtm', '.pvsm', '.pvd'];
                    if (vtkExtensions.includes(ext)) {
                        // Store relative path from the VTK base directory for easier client-side requests
                        const relativePath = path.relative(vtkBaseDir, fullPath).replace(/\\/g, '/'); // Use forward slashes
                        vtkFiles.push(relativePath);
                    }
                }
            }
        }
        vtkFiles.sort(); // Sort for consistency
        console.log(`工况 ${caseId} 找到 VTK/PVSM 文件:`, vtkFiles.length);
        // Return relative paths from the static 'uploads' root for the base directory
        res.json({ success: true, files: vtkFiles, baseDirectory: `/uploads/${caseId}/run/VTK` });

    } catch (error) {
        console.error(`列出 VTK 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, error: '列出 VTK 文件失败', details: error.message });
    }
});


// VTK 处理 (示例，按需实现)
router.post('/:caseId/process-vtk', async (req, res) => {
    const { caseId } = req.params;
    const script = path.join(__dirname, '../utils/process_vtk.py'); // Example script
    // Get input/output specifications from request body?
    const inputFileRelative = req.body.inputFile; // e.g., "some_input.vtu" or "subdir/some_input.vtu"
    const outputName = req.body.outputName || 'processed_output'; // e.g., "slice"

     if (!inputFileRelative || inputFileRelative.includes('..')) {
         return res.status(400).json({ success: false, error: '无效或缺失输入文件参数' });
     }

    const inputPath = path.join(__dirname, '../uploads', caseId, 'run/VTK', inputFileRelative);
    // Define output directory within VTK folder
    const outputDir = path.join(__dirname, '../uploads', caseId, 'run/VTK', 'processed', outputName);

    // Security checks
    const vtkBaseDir = path.resolve(path.join(__dirname, '../uploads', caseId, 'run/VTK'));
    const resolvedInputPath = path.resolve(inputPath);
     const resolvedOutputDir = path.resolve(outputDir);
    if (!resolvedInputPath.startsWith(vtkBaseDir) || !resolvedOutputDir.startsWith(vtkBaseDir)) {
        return res.status(403).json({ success: false, error: '禁止访问输入/输出路径' });
    }


    if (!fs.existsSync(script)) {
        console.error(`VTK 处理脚本未找到: ${script}`);
        return res.status(500).json({ success: false, error: 'VTK 处理脚本未找到' });
    }
     if (!fs.existsSync(resolvedInputPath)) {
        return res.status(404).json({ success: false, error: `输入 VTK 文件未找到: ${inputFileRelative}` });
    }

    try {
        await fsPromises.mkdir(resolvedOutputDir, { recursive: true });
        console.log(`执行 VTK 处理脚本: python3 ${script} ${resolvedInputPath} ${resolvedOutputDir}`);
        // Pass arguments securely
        const pythonProcess = spawn('python3', [script, resolvedInputPath, resolvedOutputDir]);

        let outputData = '';
        let errorData = '';
        pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); console.log(`VTK Proc stdout: ${data}`); });
        pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); console.error(`VTK Proc stderr: ${data}`);});

        const exitCode = await new Promise((resolve, reject) => {
            pythonProcess.on('close', resolve);
            pythonProcess.on('error', (err) => {
                console.error(`VTK 处理进程启动错误 (${caseId}):`, err);
                 reject(new Error(`VTK 处理脚本启动失败: ${err.message}`));
            });
        });

        if (exitCode !== 0) {
            console.error(`VTK 处理脚本 (${caseId}) 失败，退出码 ${exitCode}:\n${errorData}`);
            // Send specific error if possible
            return res.status(500).json({ success: false, message: 'VTK 处理脚本执行失败', exitCode: exitCode, stderr: errorData.substring(0, 1000) }); // Limit stderr length
        }

        console.log(`VTK 处理脚本 (${caseId}) 成功完成. Output:\n${outputData}`);
        // Look for expected output files or metadata
        // Example: Check if a specific output file was created
        const expectedOutputFile = path.join(resolvedOutputDir, 'result.vtp'); // Example output name
        if (fs.existsSync(expectedOutputFile)) {
             res.json({ success: true, message: 'VTK 处理成功', output: outputData, resultFile: path.relative(vtkBaseDir, expectedOutputFile).replace(/\\/g, '/') });
        } else {
            res.json({ success: true, message: 'VTK 处理脚本执行成功，但未找到预期的输出文件', output: outputData });
        }

    } catch (error) {
        console.error(`处理 VTK 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, error: '处理 VTK 文件时发生服务器错误', details: error.message });
    }
});


// 获取速度场 VTP 文件列表 (用于 ParaView Glance 等)
router.get('/:caseId/list-velocity-files', async (req, res) => {
    const { caseId } = req.params;
    // Correct path for post-processing data (often within 'run' directory)
    const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');
    console.log(`[list-velocity-files] Reading directory: ${dataPath} for case ${caseId}`);

    try {
        // Prevent browser caching of the list
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (!fs.existsSync(dataPath)) {
            console.warn(`[list-velocity-files] Directory not found: ${dataPath}`);
            return res.json({ success: true, files: [], baseDirectory: `/uploads/${caseId}/run/postProcessing/Data` });
        }

        // Read directory content
        const files = await fsPromises.readdir(dataPath);
        // Filter for files ending with .vtp (case-insensitive) and sort
        const velocityFiles = files
            .filter(file => file.toLowerCase().endsWith('.vtp'))
            .sort((a, b) => {
                 // Attempt to sort numerically if possible (e.g., slice_10.vtp, slice_100.vtp)
                 const numA = parseFloat(a.replace(/[^0-9.]/g, ''));
                 const numB = parseFloat(b.replace(/[^0-9.]/g, ''));
                 if (!isNaN(numA) && !isNaN(numB)) {
                     return numA - numB;
                 }
                 // Fallback to alphabetical sort if not numeric
                 return a.localeCompare(b);
            });


        console.log(`[list-velocity-files] Found ${velocityFiles.length} VTP files for case ${caseId}.`);
        res.json({ success: true, files: velocityFiles, baseDirectory: `/uploads/${caseId}/run/postProcessing/Data` });

    } catch (error) {
        console.error(`[list-velocity-files] Error reading directory ${dataPath}:`, error);
        res.status(500).json({ success: false, message: '读取速度场文件列表失败', details: error.message });
    }
});


// --- 报告相关路由 (保持不变) ---
// 列出 Output 目录下的特定文件 (for report generation)
router.get('/:caseId/list-output-files', async (req, res) => {
    const { caseId } = req.params;
    const outputPath = path.join(__dirname, '../uploads', caseId, 'run', 'Output');
    // Files typically needed for the report
    const requiredFiles = ['Output02-realHigh', 'Output04-U-P-Ct-fn(INIT)', 'Output06-U-P-Ct-fn(ADJUST)'];
    const outputBaseUrl = `/uploads/${caseId}/run/Output`; // Relative URL path

    try {
        let availableFiles = [];
        if (fs.existsSync(outputPath)) {
            const filesInDir = await fsPromises.readdir(outputPath);
            availableFiles = filesInDir.filter(file => requiredFiles.includes(file)).sort();
            console.log(`Found required output files for report (${caseId}):`, availableFiles);
        } else {
             console.warn(`Output 目录未找到: ${outputPath} for case ${caseId}`);
        }
        res.json({ success: true, files: availableFiles, baseDirectory: outputBaseUrl });

    } catch (error) {
        console.error(`列出 Output 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, message: '列出 Output 文件失败', details: error.message });
    }
});

// 读取指定 Output 文件内容
router.get('/:caseId/output-file/:fileName', async (req, res) => {
    const { caseId, fileName } = req.params;
    // Basic validation on fileName to prevent arbitrary file access
    // Use a regex or explicit list check
     const allowedFiles = ['Output02-realHigh', 'Output04-U-P-Ct-fn(INIT)', 'Output06-U-P-Ct-fn(ADJUST)'];
    if (!fileName || !allowedFiles.includes(fileName)) {
        return res.status(400).json({ success: false, message: '无效或不允许的文件名' });
    }

    const filePath = path.join(__dirname, '../uploads', caseId, 'run', 'Output', fileName);
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: `Output 文件 '${fileName}' 不存在`, path: filePath });
        }
        // Consider file size limit? These files are usually small text files.
        const content = await fsPromises.readFile(filePath, 'utf-8');
        // Send as plain text or JSON? Assuming JSON is easier for frontend.
        // If it's plain text, just send text.
        // res.type('text/plain').send(content);
        res.json({ success: true, content: content }); // Send as JSON object with content key

    } catch (error) {
        console.error(`读取 output 文件 (${filePath}) 时出错:`, error);
        res.status(500).json({ success: false, message: '读取 Output 文件失败', details: error.message });
    }
});

// 导出所有速度场 VTP 文件为 ZIP
router.get('/:caseId/export-velocity-layers', async (req, res) => {
    const { caseId } = req.params;
    const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');

    if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ success: false, message: '速度场数据目录不存在' });
    }

    try {
        const files = (await fsPromises.readdir(dataPath)).filter(file => file.toLowerCase().endsWith('.vtp'));

        if (files.length === 0) {
            return res.status(404).json({ success: false, message: '未找到 VTP 文件' });
        }

        const archive = archiver('zip', { zlib: { level: 6 } }); // Compression level (6 is good balance)

        // Handle archiver errors
        archive.on('warning', function(err) {
          if (err.code === 'ENOENT') {
             console.warn(`Archiver warning (${caseId}): ${err.message}`); // Log file not found warnings
          } else {
             console.error(`Archiver error (${caseId}):`, err); // Log other errors
             // Try to send an error response if headers not sent
              if (!res.headersSent) {
                 res.status(500).json({ success: false, message: '创建 ZIP 文件时出错 (archiver error)' });
              }
          }
        });
        archive.on('error', function(err) {
           console.error(`Fatal Archiver error (${caseId}):`, err);
           if (!res.headersSent) {
             res.status(500).json({ success: false, message: '创建 ZIP 文件时发生严重错误' });
           }
        });


        // Set headers for download - Use encodeURIComponent for robustness
         const safeCaseId = encodeURIComponent(caseId);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeCaseId}_velocity_layers.zip"; filename*=UTF-8''${safeCaseId}_velocity_layers.zip`);


        // Pipe archive data to the response
        archive.pipe(res);

        // Add files to the archive asynchronously? No, append is synchronous.
        console.log(`Archiving ${files.length} VTP files for ${caseId}...`);
        for (const file of files) {
            const filePath = path.join(dataPath, file);
            // Check if file still exists before adding (might be deleted during process?)
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file }); // Add file with its original name
            } else {
                 console.warn(`File disappeared before archiving: ${filePath}`);
            }
        }

        // Finalize the archive (triggers writing and sending)
        // This is asynchronous.
        await archive.finalize();
        console.log(`ZIP archive finalized and sent for ${caseId}.`);

    } catch (error) {
        console.error(`创建速度层 ZIP (${caseId}) 失败:`, error);
        // Ensure response isn't sent twice
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: '创建 ZIP 文件失败', error: error.message });
        } else {
            // If headers sent, the stream failed. Client might get partial file.
            console.error(`Error occurred after headers sent for ZIP (${caseId}).`);
        }
    }
});




// --- 嵌套风机路由 ---
router.use("/:caseId/wind-turbines", windTurbinesRouter);

// --- 导出路由 ---
module.exports = router;
