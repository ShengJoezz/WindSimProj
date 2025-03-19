const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const casesRouter = require('./routes/cases');
const windTurbinesRouter = require('./routes/windTurbinesRouter');
const errorHandler = require('./middleware/errorHandler');
const terrainRouter = require('./routes/terrain');

const app = express();

app.use(helmet());
app.use(morgan('combined'));

app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log all incoming requests but don't terminate them
app.use((req, res, next) => {
  console.log('\n=== 新请求 ===');
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next(); // Important! Continue to the next middleware
});

// Route definitions
app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/wind-turbines', windTurbinesRouter);
app.use('/api/cases', terrainRouter);

// 404 handler - should be AFTER all your routes
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`后端服务器运行在端口 ${PORT}`);
});