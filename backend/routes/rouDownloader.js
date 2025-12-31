const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');

// 模拟从YAML注释中提取名称的逻辑
const typeNames = {
    1: '耕地/低矮作物',
    2: '森林',
    3: '灌丛/公园化地表',
    4: '草地/开阔地',
    5: '水体',
    6: '雪/冰',
    7: '裸地/荒地',
    8: '不透水面/城镇',
    9: '湿地'
};

// GET /api/rou/mapping-data
router.get('/mapping-data', (req, res) => {
    try {
        const mappingPath = path.join(__dirname, '../rou/mapping.yaml');
        const fileContents = fs.readFileSync(mappingPath, 'utf8');
        const data = yaml.load(fileContents);
        
        const formattedData = Object.entries(data.clcd_to_z0).map(([id, z0]) => {
            const numId = parseInt(id);
            return {
                id: numId,
                name: typeNames[numId] || 'Unknown', // 从上面的对象获取名称
                z0: z0
            };
        });

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error("读取或解析mapping.yaml失败:", error);
        res.status(500).json({ success: false, message: '无法获取映射数据' });
    }
});

// POST /api/rou/download-by-coords
router.post('/download-by-coords', (req, res) => {
    const { lat, lon, radius } = req.body;

    const requiredParams = { lat, lon, radius };
    for (const [key, value] of Object.entries(requiredParams)) {
        if (value === undefined || value === null || value === '') {
            return res.status(400).json({ success: false, message: '缺少经纬度或半径参数' });
        }
    }

    const latNum = Number(lat);
    const lonNum = Number(lon);
    const radiusNum = Number(radius);

    if (![latNum, lonNum, radiusNum].every(Number.isFinite)) {
        return res.status(400).json({ success: false, message: '参数必须是有效的数字' });
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        return res.status(400).json({ success: false, message: '经纬度超出有效范围 (lat: -90~90, lon: -180~180)' });
    }
    if (radiusNum <= 0) {
        return res.status(400).json({ success: false, message: '半径必须为正数' });
    }

    const tempId = uuidv4();
    const tempDir = path.join(__dirname, '../../temp_rou_files');
    try {
        fs.mkdirSync(tempDir, { recursive: true });
    } catch (error) {
        console.error('创建临时目录失败:', error);
        return res.status(500).json({ success: false, message: '无法创建服务器临时目录' });
    }
    
    const outputPath = path.join(tempDir, `rou_${tempId}.txt`);
    const scriptPath = path.join(__dirname, '../rou/generate_rou.py');
    const clcdPath = path.join(__dirname, '../rou/CLCD_v01_2023_albert.tif');
    const mappingPath = path.join(__dirname, '../rou/mapping.yaml');

    const scriptArgs = [
        scriptPath,
        '--clcd', clcdPath,
        '--center', `${latNum},${lonNum}`,
        '--r2', String(radiusNum),
        '--out', outputPath,
        '--mapping', mappingPath
    ];

    console.log(`[ROU API] 启动脚本: python3 ${scriptArgs.join(' ')}`);

    const pyProcess = spawn('python3', scriptArgs);

    let stderrOutput = '';
    pyProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        console.error(`[Python Script Error]: ${data}`);
    });

    pyProcess.on('close', (code) => {
        console.log(`[ROU API] Python脚本执行完毕，退出码: ${code}`);
        if (code !== 0) {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            return res.status(500).json({ 
                success: false, 
                message: '生成rou文件失败',
                error: stderrOutput || '未知脚本错误'
            });
        }

        if (!fs.existsSync(outputPath)) {
            console.error('[ROU API] 脚本成功退出，但输出文件不存在!');
            return res.status(500).json({ success: false, message: '脚本执行异常，未生成文件' });
        }

        res.download(outputPath, 'rou', (err) => {
            if (err) {
                console.error('下载文件时出错:', err);
            }
            try {
                fs.unlinkSync(outputPath);
                console.log(`[ROU API] 已清理临时文件: ${outputPath}`);
            } catch (unlinkErr) {
                console.error(`清理临时文件失败: ${unlinkErr}`);
            }
        });
    });

    pyProcess.on('error', (err) => {
        console.error('[ROU API] 启动Python进程失败:', err);
        res.status(500).json({ success: false, message: '无法启动后台处理脚本' });
    });
});

module.exports = router;
