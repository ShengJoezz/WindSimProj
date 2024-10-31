// backend/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const casesRouter = require('./routes/cases');

const app = express();

app.use(cors());
app.use(express.json());

// 静态文件服务，用于提供上传的文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 路由
app.use('/api/cases', casesRouter);

// 处理 404
app.use((req, res, next) => {
    console.log('\n=== 新请求 ===');
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
  });

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`后端服务器运行在端口 ${PORT}`);
});