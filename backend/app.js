const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); // 新增
const { Server } = require('socket.io'); // 新增

const casesRouter = require('./routes/cases');
const errorHandler = require('./middleware/errorHandler'); // 引入错误处理中间件

const app = express();

// 中间件
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
  res.status(404).json({ success: false, message: 'Route not found' }); // 修改为发送 JSON 响应
});

// 全局错误处理
app.use(errorHandler);


// 创建 HTTP 服务器并集成 Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // 前端地址，根据您的实际情况调整
    methods: ['GET', 'POST'],
  },
});

// 处理 Socket.io 连接
io.on('connection', (socket) => {
  console.log('新客户端已连接:', socket.id);

  // 处理加入案例房间
  socket.on('joinCase', (caseId) => {
    socket.join(caseId);
    console.log(`客户端 ${socket.id} 加入案例房间: ${caseId}`);
  });

  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
  });
});

// 将 Socket.io 实例挂载到 app 上，便于路由中使用
app.set('socketio', io);

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`后端服务器运行在端口 ${PORT}`);
});