// backend/src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // 设置最小日志级别
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(), // 记录到控制台
    new winston.transports.File({ filename: 'error.log', level: 'error' }), // 将错误记录到文件中
    new winston.transports.File({ filename: 'combined.log' }), // 将所有级别记录到文件中
  ],
});

module.exports = logger;