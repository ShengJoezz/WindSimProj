/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 18:05:02
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 18:05:18
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\middleware\fireUpload.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // 引入 fs 模块

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/temp');
    fs.mkdirSync(uploadPath, { recursive: true }); // 使用 fs.mkdirSync 创建目录
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.txt', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'));
  }
};

const upload = multer({
  storage,
  fileFilter,
});

module.exports = upload;