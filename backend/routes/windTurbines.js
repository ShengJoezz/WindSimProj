/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-11-04 11:32:52
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 15:24:12
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\backend\routes\windTurbines.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const router = express.Router()

const upload = multer({
  dest: path.join(__dirname, '../uploads/temp'),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    if (ext !== '.csv' && ext !== '.txt') {
      return cb(new Error('仅支持 .csv 和 .txt 文件'))
    }
    cb(null, true)
  }
})

// 上传风机数据
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传文件' })
  }
    const newPath = path.join(__dirname, '../uploads/', req.file.originalname)
  try {
        await fs.promises.rename(req.file.path, newPath);
        // 解析文件内容并存储风机信息
        const data = await fs.promises.readFile(newPath, 'utf-8');
    const lines = data.split('\n')
    const windTurbines = lines.map(line => {
      // 修改解析代码，使用 name, longitude, latitude, hubHeight, rotorDiameter, model 字段顺序
      const [name, longitude, latitude, hubHeight, rotorDiameter, model] = line.split(',');
      return {
        name: name.trim(), // 添加 name 字段
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude),
        hubHeight: parseFloat(hubHeight), // 使用 hubHeight 替代 towerHeight
        rotorDiameter: parseFloat(rotorDiameter),
        model: model ? model.trim() : '' // 添加 model 字段并处理可选情况
      }
    }).filter(turbine => !isNaN(turbine.longitude)) // 过滤无效数据

    // 这里简单存储到一个 JSON 文件中，实际可根据需求存储到数据库或其他存储
        const listPath = path.join(__dirname, '../uploads/windTurbines.json')
       let existing = []
       if (fs.existsSync(listPath)) {
          existing = JSON.parse(await fs.promises.readFile(listPath, 'utf-8'));
       }
         existing.push(...windTurbines)
     await fs.promises.writeFile(listPath, JSON.stringify(existing, null, 2));
     res.json({ success: true, message: '上传并解析成功' })
  } catch (err) {
      console.error("文件处理失败", err);
      return res.status(500).json({ success: false, message: '文件处理失败' })
  }

})

// 获取风机数据列表
router.get('/list', async (req, res) => {
    const listPath = path.join(__dirname, '../uploads/windTurbines.json');
    try {
          if (!fs.existsSync(listPath)) {
             return res.json({ windTurbines: [] })
          }
          const data = JSON.parse(await fs.promises.readFile(listPath, 'utf-8'));
        res.json({ windTurbines: data })
     } catch (error) {
       console.error("获取风机列表失败:", error);
       res.status(500).json({
           success: false,
           message: '获取风机列表失败'
       });
     }
})

module.exports = router