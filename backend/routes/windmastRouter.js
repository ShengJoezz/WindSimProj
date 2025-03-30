/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 17:50:17
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 17:59:29
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\windmastRouter.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// windmastRouter.js 修改
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const router = express.Router();  // 移除 { mergeParams: true } 不再需要

// --- 帮助函数：确保目录存在 ---
const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
};

// --- 修改文件存储路径：不再使用caseId ---
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // 使用全局统一的测风塔数据目录
        const uploadPath = path.join(__dirname, '..', 'uploads', 'windmast', 'input');
        try {
            await ensureDirectoryExists(uploadPath);
            cb(null, uploadPath);
        } catch (err) {
            console.error("创建测风塔上传目录失败:", err);
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniquePrefix = Date.now();
        const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${uniquePrefix}-${safeOriginalName}`);
    }
});

const csvFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
        return cb(new Error('仅支持上传 CSV 文件'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: csvFileFilter });

// --- API端点修改：移除caseId参数 ---

// 1. 上传测风塔数据 (POST /api/windmast/upload)
router.post('/upload', upload.array('windMastFiles'), (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: '未选择任何 CSV 文件' });
        }
        const uploadedFiles = req.files.map(f => ({
            originalName: f.originalname,
            filename: f.filename,
            path: f.path,
            size: f.size
        }));
        res.status(201).json({
            success: true,
            message: `${req.files.length} 个测风塔数据文件上传成功`,
            files: uploadedFiles
        });
    } catch (error) {
        next(error);
    }
});

// 2. 触发 Python 分析 (POST /api/windmast/analyze)
router.post('/analyze', async (req, res, next) => {
  // 获取要分析的文件列表
  const { filesToAnalyze } = req.body;

  if (!filesToAnalyze || !Array.isArray(filesToAnalyze) || filesToAnalyze.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供要分析的文件列表'
    });
  }

    const baseUploadsDir = path.join(__dirname, '..', 'uploads');
    const inputDir = path.join(baseUploadsDir, 'windmast', 'input');
    const outputDir = path.join(baseUploadsDir, 'windmast', 'output');
    const pythonScriptPath = path.join(__dirname, '..', 'utils', 'process_wind_data_parallel.py');
    const pythonExecutable = 'python3';

    const io = req.app.get('socketio');
    const analysisId = Date.now().toString(); // 生成唯一的分析ID

    try {
        await fs.access(pythonScriptPath);
        await ensureDirectoryExists(outputDir);

        // 创建特定文件的临时列表，用于传递给 Python 脚本
        const fileListPath = path.join(inputDir, `analysis_files_${analysisId}.txt`);
        await fs.writeFile(fileListPath, filesToAnalyze.join('\n'));

        console.log(`[${analysisId}] 开始分析测风塔数据，分析文件数: ${filesToAnalyze.length}`);
        // 修改 Python 脚本调用，添加 --files 参数指向刚创建的文件列表
        const pythonProcess = spawn(pythonExecutable, [
            pythonScriptPath,
            '--input', inputDir,
            '--output', outputDir,
            '--files', fileListPath // 添加这一行来指定需要处理的文件列表
        ]);

        // --- 实时日志和错误：广播到全局windmast频道 ---
        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[${analysisId}] Python stdout: ${message}`);
            io.emit('windmast_analysis_progress', message); // 全局广播
        });

        pythonProcess.stderr.on('data', (data) => {
            const errorMessage = data.toString().trim();
            console.error(`[${analysisId}] Python stderr: ${errorMessage}`);
            io.emit('windmast_analysis_error', errorMessage); // 全局广播
        });

        pythonProcess.on('close', (code) => {
            console.log(`[${analysisId}] Python脚本执行完毕，退出码: ${code}`);
            const result = {
                success: code === 0,
                message: code === 0 ? '分析完成' : `分析失败 (退出码: ${code})`
            };
            io.emit('windmast_analysis_complete', result); // 全局广播
        });

        pythonProcess.on('error', (spawnError) => {
            console.error(`[${analysisId}] 启动 Python 脚本失败:`, spawnError);
            io.emit('windmast_analysis_complete', {
                success: false,
                message: '启动分析脚本失败',
                error: spawnError.message
            });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: '启动分析脚本失败', error: spawnError.message });
            }
        });

        res.status(202).json({
            success: true,
            message: '测风塔数据分析任务已启动',
            analysisId // 返回唯一ID以便前端跟踪
        });

    } catch (error) {
        console.error(`[${analysisId}] 准备分析时出错:`, error);
        if (!res.headersSent) {
            io.emit('windmast_analysis_complete', {
                success: false,
                message: '分析前准备失败',
                error: error.message
            });
            next(error);
        }
    }
});

// 3. 获取分析结果 (GET /api/windmast/results)
router.get('/results', async (req, res, next) => {
    const outputDir = path.join(__dirname, '..', 'uploads', 'windmast', 'output');
    const summaryFilePath = path.join(outputDir, 'processing_summary.json');

    try {
        await fs.access(summaryFilePath);
        const summaryData = JSON.parse(await fs.readFile(summaryFilePath, 'utf-8'));

        const results = {
            summary: summaryData,
            files: []
        };

        if (summaryData.processed_folders && Array.isArray(summaryData.processed_folders)) {
            for (const folderPath of summaryData.processed_folders) {
                try {
                    await fs.access(folderPath);
                    const folderName = path.basename(folderPath);
                    const fileResult = {
                        source_csv_folder: folderName,
                        plots: []
                    };

                    const filesInFolder = await fs.readdir(folderPath);
                    const plotFiles = filesInFolder.filter(f => f.toLowerCase().endsWith('.png'));

                    plotFiles.forEach(plotFile => {
                        // 修改URL路径，不再包含caseId
                        const imageUrl = `/uploads/windmast/output/${folderName}/${plotFile}`;
                        fileResult.plots.push({
                            name: plotFile,
                            url: imageUrl
                        });
                    });
                    results.files.push(fileResult);
                } catch (readErr) {
                    console.warn(`读取结果子目录失败: ${folderPath}`, readErr.message);
                }
            }
        }

        res.json({ success: true, data: results });

    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, message: '分析结果尚不存在或未找到摘要文件' });
        } else {
            next(error);
        }
    }
});

module.exports = router;