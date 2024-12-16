// frontend/vite.config.js

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 后端服务器地址和端口
        changeOrigin: true,
        secure: false,
        // 添加调试选项
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('正在发送代理请求:', proxyReq.method, proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('收到代理响应:', proxyRes.statusCode);
          });
        }
      }
    }
  }
});