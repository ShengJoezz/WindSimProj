// windTurbines.js
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const router = express.Router()

const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    if (ext !== '.csv' && ext !== '.txt') {
      return cb(new Error('仅支持 .csv 和 .txt 文件'))
    }
    cb(null, true)
  }
})

// 上传风机数据
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传文件' })
  }
  const newPath = path.join(__dirname, '../uploads/', req.file.originalname)
  fs.rename(req.file.path, newPath, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: '文件处理失败' })
    }
    // 解析文件内容并存储风机信息
    const data = fs.readFileSync(newPath, 'utf-8')
    const lines = data.split('\n')
    const windTurbines = lines.map(line => {
      const [longitude, latitude, towerHeight, rotorDiameter, model] = line.split(',')
      return {
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude),
        towerHeight: parseFloat(towerHeight),
        rotorDiameter: parseFloat(rotorDiameter),
        model: model.trim()
      }
    }).filter(turbine => !isNaN(turbine.longitude)) // 过滤无效数据

    // 这里简单存储到一个 JSON 文件中，实际可根据需求存储到数据库或其他存储
    const listPath = path.join(__dirname, '../uploads/windTurbines.json')
    let existing = []
    if (fs.existsSync(listPath)) {
      existing = JSON.parse(fs.readFileSync(listPath, 'utf-8'))
    }
    existing.push(...windTurbines)
    fs.writeFileSync(listPath, JSON.stringify(existing, null, 2))
    res.json({ success: true, message: '上传并解析成功' })
  })
})

// 获取风机数据列表
router.get('/list', (req, res) => {
  const listPath = path.join(__dirname, '../uploads/windTurbines.json')
  if (!fs.existsSync(listPath)) {
    return res.json({ windTurbines: [] })
  }
  const data = JSON.parse(fs.readFileSync(listPath, 'utf-8'))
  res.json({ windTurbines: data })
})

module.exports = router