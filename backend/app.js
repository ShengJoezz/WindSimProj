/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 16:46:19
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 15:24:43
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\backend\app.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');             // 新增 helmet 中间件
const morgan = require('morgan');             // 新增 morgan 日志中间件
const http = require('http');
const { Server } = require('socket.io');

const casesRouter = require('./routes/cases');
const windTurbinesRouter = require('./routes/windTurbinesRouter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());                            // 使用 helmet 中间件
app.use(morgan('combined'));                  // 使用 morgan 中间件

app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/wind-turbines', windTurbinesRouter);

app.use((req, res, next) => {
  console.log('\n=== 新请求 ===');
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('新客户端已连接:', socket.id);
  socket.on('joinCase', (caseId) => {
    socket.join(caseId);
    console.log(`客户端 ${socket.id} 加入案例房间: ${caseId}`);
  });
  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
  });
});

app.set('socketio', io);

const PORT = process.env.PORT || 5000; // 从环境变量或默认值获取端口
server.listen(PORT, () => {
  console.log(`后端服务器运行在端口 ${PORT}`);
});