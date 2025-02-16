/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 18:08:34
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 15:33:49
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\middleware\errorHandler.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// backend/middleware/errorHandler.js
const multer = require('multer'); // <--- 添加这行导入 multer

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传错误'
    });
  }

  if (err.message === '不支持的文件类型') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
};

module.exports = errorHandler;