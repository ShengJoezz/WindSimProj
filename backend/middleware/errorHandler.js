// backend/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: '请求的资源不存在',
        error: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  };
  
  module.exports = errorHandler;