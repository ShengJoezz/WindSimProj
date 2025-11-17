/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-17 00:24:59
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-07 09:37:50
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\app.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan'); // Correctly require morgan
const http = require('http');
const { Server } = require('socket.io');

// --- Routers ---
const casesRouter = require('./routes/cases'); // Existing Cases Router
const windTurbinesRouter = require('./routes/windTurbinesRouter'); // Existing Wind Turbines Router
const terrainRouter = require('./routes/terrain'); // Existing Terrain Router
const windMastRouter = require('./routes/windmastRouter');
const errorHandler = require('./middleware/errorHandler'); // Existing Error Handler
const demClipperRouter = require('./routes/demClipper');
const rouDownloaderRouter = require('./routes/rouDownloader');

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(morgan('combined')); // Correctly use morgan
app.use(cors({
  origin: ['http://localhost:5173', 'http://172.23.77.108:5173'], // Your frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Set request body size limits - adjust as needed for CFD data
// Placed here, before routes, to apply to all incoming JSON/URL-encoded requests.
// Increased to 100mb as a starting point for CFD data.
// If you expect even larger data, increase this value (e.g., '200mb', '500mb').
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// --- Static Files ---
// Serve files from the 'uploads' directory
// This will allow access like http://localhost:5000/uploads/<caseId>/windmast/output/...
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 为 /api/static 路径提供静态文件服务
app.use('/api/static', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/windmast', express.static(path.join(__dirname, 'windmast_data')));

// --- Logging Middleware (Keep if desired) ---
app.use((req, res, next) => {
  console.log('\n=== 新请求 ===');
  console.log(`${req.method} ${req.url}`);
  // Be cautious logging full headers in production as they might contain sensitive info
  // console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    // console.log('Body:', req.body); // Be cautious logging full body in production for large/sensitive data
    console.log('Body received (keys):', Object.keys(req.body));
  }
  next();
});

// --- API Routes ---
// Mount routers - Order might matter depending on specificity, but this looks okay
app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/wind-turbines', windTurbinesRouter);
app.use('/api/cases', terrainRouter); // Check path if it includes :caseId implicitly or explicitly
app.use('/api/windmast', windMastRouter);
app.use('/api/dem', demClipperRouter);
app.use('/api/rou', rouDownloaderRouter);

// --- 404 Handler ---
// This should be placed after all your API routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Central Error Handler ---
// This should be the last piece of middleware
app.use(errorHandler);

// --- HTTP Server and Socket.IO Setup ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://172.23.77.108:5173'], // Match frontend origin
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('新客户端已连接:', socket.id);

  socket.on('joinCase', (caseId) => {
    socket.join(caseId); // Client joins a room specific to the case
    console.log(`客户端 ${socket.id} 加入案例房间: ${caseId}`);
  });

  socket.on('leaveCase', (caseId) => {
     socket.leave(caseId);
     console.log(`客户端 ${socket.id} 离开案例房间: ${caseId}`);
  });

  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
    // Optional: Clean up any rooms the socket was in if needed
  });
});

// Make io instance available to routes
app.set('socketio', io);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`后端服务器运行在端口 ${PORT}`);
});