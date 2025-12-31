/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:43:59
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-03 17:31:58
 * @FilePath: backend/routes/windmastRouter.js
 * @Description: Router for Wind Mast API endpoints, handling single file uploads and analysis.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // 使用 promises 版本的 fs
const fsStandard = require('fs');  // 引入标准 fs 模块 for createWriteStream
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cors = require('cors');
const archiver = require('archiver');

const { ensureDirectoryExists } = require('../utils/fileUtils');
const uploadMiddleware = require('../middleware/fileUpload');

// 统一的基础目录定义
const BASE_WINDMAST_DATA_DIR = path.join(__dirname, '..', 'windmast_data'); 
const INPUT_DIR = path.join(BASE_WINDMAST_DATA_DIR, 'input');
const OUTPUT_DIR = path.join(BASE_WINDMAST_DATA_DIR, 'output');
const ANALYSES_INDEX_FILE = path.join(OUTPUT_DIR, 'analyses_index.json');

// 【修改】也将临时文件目录指向新位置，保持模块内聚
const TEMP_DIR = path.join(BASE_WINDMAST_DATA_DIR, 'temp');
router.use(cors());
// === 核心 API 路由 ===

/**
 * POST /api/windmast/upload
 * 处理文件上传的路由。期望一个字段名为 'file' 的单个文件。
 */
router.post('/upload', (req, res, next) => {
    uploadMiddleware.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.warn(`[API /upload] Multer 错误: ${err.message} (代码: ${err.code})`);
            return res.status(400).json({ success: false, message: err.message || '文件上传处理错误 (Multer)' });
        } else if (err) {
            console.error(`[API /upload] 非 Multer 上传错误: ${err.message}`);
            return res.status(400).json({ success: false, message: err.message || '文件上传失败' });
        }
        if (!req.file) {
            console.log('[API /upload] 中间件处理后，req.file 中未找到文件。');
            return res.status(400).json({ success: false, message: '未接收到文件或文件字段名错误 (应为 "file")' });
        }
        console.log('[API /upload] Multer 中间件成功完成单文件处理。');
        next();
    });
}, async (req, res, next) => {
    console.log('[API /upload] 处理上传的文件...');
    const file = req.file;

    console.log(`[API /upload] 接收文件: ${file.filename}, 原始名: ${file.originalname}, 大小: ${file.size}`);
    let uploadedFileInfo = null;

    try {
        await ensureDirectoryExists(INPUT_DIR);

        const tempPath = file.path;
        const finalPath = path.join(INPUT_DIR, file.filename);

        try {
            console.log(`[API /upload] 移动文件从 ${tempPath} 到 ${finalPath}`);
            await fs.rename(tempPath, finalPath);

            const match = file.filename.match(/^\d+-(.*)/);
            const originalName = match ? match[1] : file.filename;

            uploadedFileInfo = {
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype
            };
            console.log(`[API /upload] 文件 ${file.filename} 移动成功。`);

             res.status(201).json({
                success: true,
                message: `文件 '${uploadedFileInfo.originalName}' 上传成功`,
                file: uploadedFileInfo
             });

        } catch (moveError) {
             console.error(`[API /upload] 移动文件 ${file.filename} 时出错:`, moveError);
             fs.unlink(tempPath).catch(unlinkErr => console.error(`[API /upload] 清理临时文件 ${tempPath} 失败:`, unlinkErr));
             return res.status(500).json({
                 success: false,
                 message: `文件 '${file.originalname}' 上传后移动失败`,
                 error: moveError.message
             });
        }
    } catch (error) {
        console.error('[API /upload] 处理上传文件时发生通用错误:', error);
        next(error);
    }
});


/**
 * POST /api/windmast/analyze
 * 启动风场数据分析
 */
router.post('/analyze', async (req, res, next) => {
    const { analysisName, description, filesToAnalyze, parameters } = req.body;
    if (!analysisName || !filesToAnalyze || !Array.isArray(filesToAnalyze) || filesToAnalyze.length === 0) {
        return res.status(400).json({ success: false, message: '请求缺少分析名称或文件列表' });
    }
    const validFiles = filesToAnalyze.filter(f => typeof f === 'string' && !f.includes('..') && !f.includes('/'));
    if (validFiles.length !== filesToAnalyze.length) {
        return res.status(400).json({ success: false, message: '文件列表中包含无效的文件名' });
    }
    const analysisId = uuidv4();
    const analysisOutputDir = path.join(OUTPUT_DIR, analysisId);
    const pythonScriptPath = path.join(__dirname, '..', 'utils', 'process_wind_data_parallel.py');
    try {
        await ensureDirectoryExists(analysisOutputDir);
        const fileListContent = validFiles.join('\n');
        const fileListPath = path.join(analysisOutputDir, 'files_to_process.txt');
        await fs.writeFile(fileListPath, fileListContent);
        console.log(`[API /analyze] 为分析 ${analysisId} 创建文件列表: ${fileListPath}`);
        const args = [
            pythonScriptPath,
            '--input', INPUT_DIR,
            '--output', OUTPUT_DIR,
            '--analysisId', analysisId,
            '--analysisName', analysisName,
            '--description', description || '',
            '--files', fileListPath
        ];
        if (parameters && typeof parameters === 'object') {
            args.push('--parameters', JSON.stringify(parameters));
        }
        console.log(`[API /analyze] 启动分析脚本 (Python) for ${analysisId}...`);
        console.log(`[API /analyze] 命令: python3 ${args.join(' ')}`);
        const pythonProcess = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let scriptOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString(); scriptOutput += chunk; console.log(`[PyOut ${analysisId}]: ${chunk.trim()}`);
        });
        let scriptError = '';
        pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString(); scriptError += chunk; console.error(`[PyErr ${analysisId}]: ${chunk.trim()}`);
        });
        pythonProcess.on('close', async (code) => {
    console.log(`[API /analyze] Python 脚本 for ${analysisId} 退出，代码 ${code}`);
    
    // 清理临时文件
    fs.unlink(fileListPath).catch(err => console.error(`删除临时列表文件失败: ${err}`));
    
    // **新增：分析完成后立即更新索引**
    if (code === 0) {
        try {
            console.log(`[API /analyze] 分析 ${analysisId} 成功完成，更新索引...`);
            await scanAnalysesAndUpdateIndex(); // 重新扫描并更新索引
            console.log(`[API /analyze] 索引更新完成`);
        } catch (indexError) {
            console.error(`[API /analyze] 更新索引失败: ${indexError}`);
        }
    }
    
    // 发送WebSocket事件
    const io = req.app.get('socketio');
    const eventData = { 
        analysisId: analysisId, 
        success: code === 0,
        shouldRefreshList: true // **新增：告诉前端需要刷新列表**
    };
    
    if (code === 0) { 
        eventData.message = '分析成功完成'; 
    } else {
        eventData.message = `分析失败(code:${code})`;
        eventData.error = scriptError.trim() || 'Python 脚本执行出错';
    }
    
    if (io) { 
        io.emit('windmast_analysis_complete', eventData); 
    }
});
        pythonProcess.on('error', (err) => {
            console.error(`[API /analyze] 启动 Python 进程 ${analysisId} 失败:`, err);
            const io = req.app.get('socketio');
            if (io) { io.emit('windmast_analysis_complete', { analysisId: analysisId, success: false, message: '无法启动分析脚本', error: err.message }); }
            try { fs.unlink(fileListPath).catch(() => { }); res.status(500).json({ success: false, message: '无法启动分析脚本', error: err.message }); } catch (e) { next(e); }
        });
        res.status(202).json({ success: true, message: '分析任务已启动', analysisId: analysisId });
    } catch (error) {
        console.error(`[API /analyze] 启动分析 ${analysisId || '(尚未生成ID)'} 时出错:`, error);
        next(error);
    }
});

/**
 * GET /api/windmast/files/input
 * 获取已上传的输入文件列表
 */
router.get('/files/input', async (req, res, next) => {
  console.log("[API /files/input] 收到请求");
  try {
    await ensureDirectoryExists(INPUT_DIR);
    const dirents = await fs.readdir(INPUT_DIR, { withFileTypes: true });
    const filesPromises = dirents.filter(d => d.isFile() && !d.name.startsWith('.')).map(async (d) => {
        const filePath = path.join(INPUT_DIR, d.name);
        try {
            const stats = await fs.stat(filePath);
            const match = d.name.match(/^\d+-(.*)/);
            const originalName = match ? match[1] : d.name;
            return {
                filename: d.name,
                originalName: originalName,
                size: stats.size,
                createdAt: stats.birthtimeMs ? stats.birthtime.toISOString() : stats.mtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
            };
        } catch (e) {
            console.error(`[API /files/input] 获取文件状态错误 ${filePath}:`, e);
            return null;
        }
    });
    const files = (await Promise.all(filesPromises)).filter(f => f !== null);
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, files: files });
  } catch (error) {
    console.error("[API /files/input] 错误:", error);
    next(error);
  }
});

/**
 * GET /api/windmast/analyses
 * 获取所有分析记录的列表
 */
router.get('/analyses', async (req, res, next) => {
   console.log("[API /analyses] 收到请求");
   try {
        await ensureDirectoryExists(OUTPUT_DIR);
        try {
            await fs.access(ANALYSES_INDEX_FILE); // 检查索引文件是否存在
        } catch (e) {
            // 如果索引文件不存在，尝试扫描并创建索引
            if (e.code === 'ENOENT') {
                await scanAnalysesAndUpdateIndex();
            } else {
                throw e; // 其他错误直接抛出
            }
        }
        const indexData = await fs.readFile(ANALYSES_INDEX_FILE, 'utf-8');
        const analyses = JSON.parse(indexData);
        if (!Array.isArray(analyses)) {
            throw new Error("索引文件数据无效。");
        }
        analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log(`[API /analyses] 从索引提供 ${analyses.length} 条分析记录。`);
        res.json({ success: true, analyses: analyses });
   } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`[API /analyses] 索引文件未找到。返回空列表 []。`);
        } else {
            console.warn(`[API /analyses] 读取索引文件时出错: ${error.message}。返回空列表 []。`);
        }
        res.json({ success: true, analyses: [] });
   }
});

/**
 * GET /api/windmast/analyses/scan
 * 扫描分析输出目录并更新分析索引
 */
router.get('/analyses/scan', async (req, res, next) => {
  try {
    console.log(`[API /scan] 扫描目录: ${OUTPUT_DIR}`);
    await ensureDirectoryExists(OUTPUT_DIR);
    const analyses = await scanAnalysesAndUpdateIndex();
    res.json({ success: true, analyses: analyses });
  } catch (error) {
    console.error('[API /scan] 错误:', error);
    next(error);
  }
});

/**
 * 扫描分析目录并更新索引文件的函数
 */
async function scanAnalysesAndUpdateIndex() {
    await ensureDirectoryExists(OUTPUT_DIR);
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
    const promises = dirs.map(async (dir) => {
        const dirPath = path.join(OUTPUT_DIR, dir);
        const sumPath = path.join(dirPath, 'processing_summary.json');
        const errPath = path.join(dirPath, 'error.log');
        const metaPath = path.join(dirPath, 'analysis_meta.json');
        let createdAt = new Date().toISOString();
        let meta = null;
        try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(metaContent);
        } catch (e) {
            if (e.code !== 'ENOENT') {
                console.warn(`[Scan] 读取分析元数据文件 ${dir} 错误: ${e.message}`);
            }
        }
        const metaName = typeof meta?.name === 'string' ? meta.name.trim() : '';
        const metaDescription = typeof meta?.description === 'string' ? meta.description : '';
        try { const s = await fs.stat(dirPath); createdAt = s.birthtimeMs ? s.birthtime.toISOString() : s.mtime.toISOString(); } catch (e) { }
        try {
            const sumC = await fs.readFile(sumPath, 'utf-8');
            const sumD = JSON.parse(sumC);
            if (sumD && typeof sumD === 'object') {
                return {
                    id: dir,
                    name: metaName || sumD.analysisName || `分析 ${dir}`,
                    description: metaDescription || sumD.description || '',
                    createdAt: createdAt,
                    startTime: sumD.startTime,
                    endTime: sumD.endTime,
                    status: sumD.status || 'completed', // 确保状态存在
                    files_processed: sumD.files_processed,
                    files_requested: sumD.files_requested,
                    totalDurationSec: sumD.totalDurationSec,
                    success_files: sumD.success_files,
                    warning_files: sumD.warning_files,
                    error_files: sumD.error_files,
                    unique_farm_ids: sumD.unique_farm_ids,
                    parameters: sumD.parameters,
                    processed_files_details: sumD.processed_files_details,
                    files: sumD.processed_files_details?.map(f => f.file) || sumD.processed_folders || []
                };
            }
        } catch (e) { if (e.code !== 'ENOENT') console.warn(`[Scan] 读取摘要文件 ${dir} 错误: ${e.message}`); }
        try {
            await fs.access(errPath, fs.constants.R_OK);
            return {
                id: dir,
                name: metaName || `失败 ${dir}`,
                description: metaDescription || '',
                createdAt: createdAt,
                status: 'failed',
                files: []
            };
        } catch (e) { }
        return null;
    });
    const analyses = (await Promise.all(promises)).filter(a => a !== null);
    console.log(`[API /scan] 扫描发现 ${analyses.length} 条分析记录。`);
    try {
        analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        await fs.writeFile(ANALYSES_INDEX_FILE, JSON.stringify(analyses, null, 2));
        console.log(`[API /scan] 索引文件更新完成。`);
    } catch (indexErr) {
        console.error(`[API /scan] 更新索引文件失败: ${indexErr}`);
    }
    return analyses;
}

/**
 * PUT /api/windmast/analyses/:analysisId
 * 更新分析记录的名称与描述（写入 analysis_meta.json，并同步 processing_summary.json（若存在））
 */
router.put('/analyses/:analysisId', async (req, res, next) => {
    const { analysisId } = req.params;
    if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
        return res.status(400).json({ success: false, message: '无效分析ID' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!name) {
        return res.status(400).json({ success: false, message: '分析名称不能为空' });
    }
    if (name.length > 50) {
        return res.status(400).json({ success: false, message: '分析名称长度不能超过 50 个字符' });
    }
    if (description.length > 200) {
        return res.status(400).json({ success: false, message: '分析描述长度不能超过 200 个字符' });
    }

    try {
        await ensureDirectoryExists(OUTPUT_DIR);
        const analysisDir = path.join(OUTPUT_DIR, analysisId);
        await fs.access(analysisDir);

        const metaPath = path.join(analysisDir, 'analysis_meta.json');
        const summaryPath = path.join(analysisDir, 'processing_summary.json');

        const metaPayload = {
            name,
            description,
            updatedAt: new Date().toISOString(),
        };

        await fs.writeFile(metaPath, JSON.stringify(metaPayload, null, 2));

        // 同步写入 processing_summary.json（若存在）
        try {
            const summaryContent = await fs.readFile(summaryPath, 'utf-8');
            const summaryData = JSON.parse(summaryContent);
            if (summaryData && typeof summaryData === 'object') {
                summaryData.analysisName = name;
                summaryData.description = description;
                await fs.writeFile(summaryPath, JSON.stringify(summaryData, null, 2));
            }
        } catch (e) {
            if (e.code !== 'ENOENT') {
                console.warn(`[API /analyses/:analysisId] 更新 processing_summary.json 失败: ${e.message}`);
            }
        }

        // 重新扫描更新索引，确保前端列表立刻同步
        const analyses = await scanAnalysesAndUpdateIndex();
        const updated = analyses.find(a => a.id === analysisId) || null;

        return res.json({ success: true, analysis: updated });
    } catch (error) {
        console.error(`[API /analyses/:analysisId] 更新分析信息失败:`, error);
        if (error.code === 'ENOENT') {
            return res.status(404).json({ success: false, message: '分析记录不存在' });
        }
        next(error);
    }
});


/**
 * GET /api/windmast/analyses/:analysisId/status
 * 获取特定分析的当前状态
 */
router.get('/analyses/:analysisId/status', async (req, res, next) => {
   try {
        const { analysisId } = req.params;
        if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
            return res.status(400).json({ success: false, message: '无效分析ID' });
        }
        const analysisDir = path.join(OUTPUT_DIR, analysisId);
        const sumPath = path.join(analysisDir, 'processing_summary.json');
        const errPath = path.join(analysisDir, 'error.log');
        console.log(`[API /status] 检查分析ID: ${analysisId}`);
        try { await fs.access(analysisDir); } catch (e) { if (e.code === 'ENOENT') { return res.status(404).json({ success: false, message: '分析记录不存在' }); } throw e; }
        try { await fs.access(sumPath, fs.constants.R_OK); return res.json({ success: true, status: 'completed' }); } catch (e) { }
        try {
            const errC = await fs.readFile(errPath, 'utf-8');
            return res.json({ success: true, status: 'failed', error: errC.substring(0, 500) + (errC.length > 500 ? '...' : '') });
        } catch (e) { }
        return res.json({ success: true, status: 'pending' });
   } catch (error) {
        console.error(`[API /status] 错误 (分析ID: ${req.params.analysisId}):`, error);
        next(error);
   }
});

/**
 * POST /api/windmast/files/rename
 * 重命名输入文件
 */
router.post('/files/rename', async (req, res, next) => {
   const { originalFilename, newFilename } = req.body;
   console.log(`[API /rename] 请求: ${originalFilename} -> ${newFilename}`);
    if (!originalFilename || !newFilename || /[\/\\]|\.\./.test(originalFilename) || /[\/\\]|\.\./.test(newFilename)) {
        return res.status(400).json({ success: false, message: '无效文件名' });
    }
    const oldP = path.join(INPUT_DIR, originalFilename);
    const newP = path.join(INPUT_DIR, newFilename);
    try {
        await ensureDirectoryExists(INPUT_DIR);
        await fs.access(oldP);
        await fs.rename(oldP, newP);
        res.json({ success: true, message: '文件重命名成功' });
    }
    catch (e) {
        console.error(`[API /rename] 错误:`, e);
        if (e.code === 'ENOENT') { next(new Error(`文件 ${originalFilename} 未找到`)); }
        else if (e.code === 'EEXIST') { next(new Error(`文件名 ${newFilename} 已存在`)); }
        else { next(e); }
    }
});

/**
 * DELETE /api/windmast/files/input/:filename
 * 删除输入文件
 */
router.delete('/files/input/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    console.log(`[API /delete input] 请求删除文件: ${filename}`);
    if (!filename || /[\/\\]|\.\./.test(filename)) {
        return res.status(400).json({ success: false, message: '无效文件名' });
    }
    const filePath = path.join(INPUT_DIR, filename);
    try {
        await ensureDirectoryExists(INPUT_DIR);
        await fs.access(filePath);
        await fs.unlink(filePath);
        res.json({ success: true, message: '文件删除成功' });
    }
    catch (e) {
        console.error(`[API /delete input] 错误:`, e);
        if (e.code === 'ENOENT') { next(new Error(`文件 ${filename} 未找到`)); }
        else { next(e); }
    }
});

/**
 * DELETE /api/windmast/analyses/:analysisId
 * 删除分析记录及其输出
 */
router.delete('/analyses/:analysisId', async (req, res, next) => {
     const { analysisId } = req.params;
     console.log(`[API /delete analysis] 请求删除分析: ${analysisId}`);
    if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
        return res.status(400).json({ success: false, message: '无效分析ID' });
    }
    const analysisDir = path.join(OUTPUT_DIR, analysisId);
    try {
        await ensureDirectoryExists(OUTPUT_DIR);
        await fs.access(analysisDir);
        await fs.rm(analysisDir, { recursive: true, force: true });
        console.log(`[API /delete analysis] 已删除目录: ${analysisDir}`);
        try {
            const idxData = await fs.readFile(ANALYSES_INDEX_FILE, 'utf-8');
            let analyses = JSON.parse(idxData);
            if (Array.isArray(analyses)) {
                analyses = analyses.filter(a => a.id !== analysisId);
                await fs.writeFile(ANALYSES_INDEX_FILE, JSON.stringify(analyses, null, 2));
                console.log(`[API /delete analysis] 分析索引已更新。`);
            }
        } catch (idxE) {
            console.warn(`[API /delete analysis] 更新分析索引失败: ${idxE.message}`);
        }
        res.json({ success: true, message: '分析记录及其输出已删除' });
    } catch (e) {
        console.error(`[API /delete analysis] 错误:`, e);
        if (e.code === 'ENOENT') { next(new Error(`分析 ${analysisId} 未找到`)); }
        else { next(e); }
    }
});

/**
* GET /api/windmast/results/:analysisId
* 获取特定分析的详细结果数据
*/
router.get('/results/:analysisId', async (req, res, next) => {
    const { analysisId } = req.params;
    console.log(`[API /results] 请求分析结果: ${analysisId}`);
    if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
        return res.status(400).json({ success: false, message: '无效分析ID' });
    }
    const summaryPath = path.join(OUTPUT_DIR, analysisId, 'processing_summary.json');
    try {
        await ensureDirectoryExists(OUTPUT_DIR);
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        const summaryData = JSON.parse(summaryContent);
        res.json({ success: true, data: summaryData });
    }
    catch (e) {
        console.error(`[API /results] 错误 (分析ID: ${analysisId}):`, e);
        if (e.code === 'ENOENT') { next(new Error(`分析 ${analysisId} 结果文件未找到`)); }
        else { next(e); }
    }
});

/**
 * GET /api/windmast/image/:analysisId/:filename
 * 提供分析输出目录中的图片文件
 */
router.get('/image/:analysisId/:filename', async (req, res, next) => {
  const { analysisId, filename } = req.params;
  if (!analysisId || !filename ||
      !/^[a-zA-Z0-9-_]+$/.test(analysisId) ||
      /[\/\\]|\.\./.test(filename)) {
    return res.status(400).send('参数无效');
  }

  // 安全地构建图片路径
  const imagePath = path.join(OUTPUT_DIR, analysisId, filename);

  try {
    await fs.access(imagePath);

    // 设置 CORS 头部 (根据需要调整)
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // 或您的前端域名
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 允许跨域资源共享

    // 设置缓存控制头部 (例如，缓存一天)
    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.sendFile(imagePath);
    console.log(`[API /image] 提供文件: ${imagePath}`);
  } catch (error) {
    console.error(`[API /image] 提供文件 ${imagePath} 错误:`, error);
    if (error.code === 'ENOENT') {
      return res.status(404).send('图片未找到');
    }
    next(error);
  }
});

/**
 * GET /api/windmast/download/:analysisId
 * 下载分析结果的 ZIP 文件
 */
router.get('/download/:analysisId', async (req, res, next) => {
  const { analysisId } = req.params;
  console.log(`[API /download] 请求下载分析结果 ZIP, 分析ID: ${analysisId}`);

  if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
    return res.status(400).json({ success: false, message: '无效的分析ID' });
  }

  const analysisDir = path.join(OUTPUT_DIR, analysisId);
  const zipPath = path.join(TEMP_DIR, `${analysisId}.zip`);

  try {
    await fs.access(analysisDir);
    await ensureDirectoryExists(TEMP_DIR);

    const output = fsStandard.createWriteStream(zipPath); // 使用标准 fs 模块的 createWriteStream
    const archive = archiver('zip', {
      zlib: { level: 5 } // 设置压缩级别
    });

    // 监听 'close' 事件
    output.on('close', () => {
      console.log(`[API /download] ZIP 文件创建完成: ${zipPath}, 大小: ${archive.pointer()} bytes`);
      res.download(zipPath, `windmast_analysis_${analysisId}.zip`, (err) => {
        if (err) {
          console.error(`[API /download] 发送文件时出错: ${err.message}`);
        }
        // 下载完成后删除临时 ZIP 文件
        fs.unlink(zipPath).catch(e => console.error(`[API /download] 删除临时 ZIP 文件时出错: ${e.message}`));
      });
    });

    // 监听 'error' 事件
    archive.on('error', (err) => {
      console.error(`[API /download] Archiver 错误: ${err.message}`);
      output.end(); // 结束输出流
      fs.unlink(zipPath).catch(() => { }); // 删除 ZIP 文件 (如果创建失败)
      next(err); // 传递错误给错误处理中间件
    });

    // 将 archive 通过管道连接到文件输出流
    archive.pipe(output);

    // 添加分析目录到 ZIP 文件，根目录为 'windmast_analysis_${analysisId}'
    archive.directory(analysisDir, false);

    // 完成归档
    await archive.finalize();
  } catch (error) {
    console.error(`[API /download] 处理分析ID ${analysisId} 时出错:`, error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: '分析目录不存在' });
    }
    next(error);
  }
});

/**
 * GET /api/windmast/images/:analysisId
 * 获取指定分析的所有图片列表，并按类型和高度分类
 */
router.get('/images/:analysisId', async (req, res, next) => {
  const { analysisId } = req.params;
  console.log(`[API /images] 请求分析ID ${analysisId} 的图片列表`);

  if (!analysisId || !/^[a-zA-Z0-9-_]+$/.test(analysisId)) {
    return res.status(400).json({ success: false, message: '无效的分析ID' });
  }

  const analysisDir = path.join(OUTPUT_DIR, analysisId);

  try {
    await fs.access(analysisDir);
    const files = await fs.readdir(analysisDir);
    const imageFiles = files.filter(file =>
      /\.(png|jpg|jpeg|gif|svg)$/i.test(file)
    );

    const categorizedImages = {
      byType: {},
      byFarmId: {},
      byHeight: {},
      all: imageFiles
    };

    imageFiles.forEach(filename => {
      // 移除文件扩展名，方便解析
      const baseFilename = filename.substring(0, filename.lastIndexOf('.'));
      const parts = baseFilename.split('_');

      if (parts.length < 2) return; // 文件名不符合 "ID_..._type" 格式，跳过

      // 提取 farmId 和时间戳部分，剩下的部分用于判断类型和高度
      const farmId = parts[0];
      const timestamp = parts[1];
      const typeParts = parts.slice(2); // ['wind', 'rose', '10m'] or ['stability', 'distribution']
      
      let chartType = '';
      let height = '';
      
      // 先检查最后一个部分是否是高度
      const lastPart = typeParts[typeParts.length - 1];
      if (lastPart.endsWith('m') && !isNaN(parseInt(lastPart))) {
        height = lastPart;
        // 高度之前的部分是类型
        chartType = typeParts.slice(0, -1).join('_'); // e.g., 'wind_rose'
      } else {
        // 没有高度，整个部分都是类型
        chartType = typeParts.join('_'); // e.g., 'stability_distribution'
      }
      
      if (!chartType) return; // 如果无法解析出类型，跳过

      // 使用 getChartTypeText 转换为用户友好的名称
      const formattedChartType = getChartTypeText(chartType);

      // --- 后续的分类逻辑保持不变 ---
      if (!categorizedImages.byType[formattedChartType]) {
        categorizedImages.byType[formattedChartType] = [];
      }
      categorizedImages.byType[formattedChartType].push(filename);

      if (!categorizedImages.byFarmId[farmId]) {
        categorizedImages.byFarmId[farmId] = [];
      }
      categorizedImages.byFarmId[farmId].push(filename);

      if (height) {
        if (!categorizedImages.byHeight[height]) {
          categorizedImages.byHeight[height] = [];
        }
        categorizedImages.byHeight[height].push(filename);
      }
    });

    res.json({
      success: true,
      images: categorizedImages,
      baseUrl: `/api/windmast/image/${analysisId}/` // 修改为正确的 API 路径
    });
  } catch (error) {
    console.error(`[API /images] 处理分析ID ${analysisId} 错误:`, error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: '分析目录不存在' });
    }
    next(error);
  }
});

/**
 * 将图表类型代码转换为用户友好的文本
 * @param {string} type 图表类型代码
 * @returns {string} 用户友好的图表类型文本
 */
function getChartTypeText(type) {
  switch (type) {
    case 'wind_rose':
    case 'windrose': return '风玫瑰图';
    case 'wind_frequency': return '风速频率';
    case 'wind_energy': return '风能分布';
    case 'stability_distribution': return '稳定度分布';
    case 'diurnal_pattern': return '日变化模式';
    case 'time_series': return '时间序列';
    case 'correlation': return '相关性分析';
    default: return type;
  }
}

module.exports = router;
