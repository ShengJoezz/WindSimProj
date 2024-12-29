// backend/middleware/errorHandler.js
const logger = require('../utils/logger'); // 假设您有一个 logger 实用程序

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack); // 记录完整的错误堆栈，以便进行内部调试

  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: '找不到资源',
      error: err.message, // 包含原始错误消息以获取上下文
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '验证错误',
      error: err.message,
    });
  }

  // 在此处根据错误类型添加更具体的错误处理

  // 意外错误的默认错误响应
  res.status(500).json({
    success: false,
    message: '内部服务器错误',
    error: err.message, // 包含用于调试的信息，但在生产环境中要小心
  });
};

module.exports = errorHandler;