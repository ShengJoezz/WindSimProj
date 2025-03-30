/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 21:45:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 20:07:01
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\vite.config.js
 * @Description: Vite config with corrected WebSocket proxy
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
// Removed unused path and fs imports for clarity, Vite handles paths well
// import path from 'path';
// import fs from 'node:fs';

export default defineConfig({
  plugins: [
    vue(),
    // Keep your custom VTK GLSL plugin
    {
      name: 'handle-vtk-js-glsl',
      enforce: 'pre',
      transform(code, id) {
        if (/node_modules\/vtk\.js\/Sources\/Rendering\/OpenGL\/glsl\/.*\.(glsl|vs|fs)$/.test(id)) {
          // console.log(`[handle-vtk-js-glsl] Transforming GLSL file: ${id}`); // Keep if debugging needed
          return {
            code: `export default ${JSON.stringify(code)}`,
            map: null,
          };
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Add alias for vtk.js if you face issues with its internal imports, otherwise optional
      // 'vtk.js': fileURLToPath(new URL('./node_modules/@kitware/vtk.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      // Keep optimizeDeps if needed, especially for large CJS dependencies like vtk.js
      '@kitware/vtk.js',
      // Including specific subpaths might sometimes help, but often isn't necessary
      // '@kitware/vtk.js/IO/XML/XMLMultiBlockDataReader'
    ],
     // Might need to exclude VTK if deep CJS dependencies cause issues with Vite's pre-bundling
     // exclude: ['@kitware/vtk.js']
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      // You might need to explicitly ignore VTK from CJS conversion if it causes issues
      // exclude: ['node_modules/@kitware/vtk.js/**'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: '0.0.0.0', // Make accessible on network if needed (e.g., from VM)
    port: 5173,     // Explicitly define port
    proxy: {
      // Proxy for static uploads (like result images/files)
      '/uploads': {
        target: 'http://localhost:5000', // Target your backend server
        changeOrigin: true,
        secure: false, // Often needed for localhost targets
      },
      // Proxy for standard API HTTP requests
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          // Keep your logging if helpful
          proxy.on('error', (err, req, res) => {
            console.error('API Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // console.log('正在发送 API 代理请求:', proxyReq.method, proxyReq.path); // Less verbose logging maybe?
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // console.log('收到 API 代理响应:', proxyRes.statusCode, req.url);
          });
        },
      },
      // *** ADDED: Proxy for WebSocket connections ***
      // Assumes the default '/socket.io' path.
      // If your client uses io({ path: '/custom-path' }), change this key accordingly.
      '/socket.io': {
        target: 'ws://localhost:5000', // Use ws:// protocol for WebSocket target
        ws: true,                     // <<< IMPORTANT: Enable WebSocket proxying
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
           // Optional: Add logging specific to WebSocket proxy if needed
           proxy.on('error', (err, req, socket) => { // Note: 'socket' instead of 'res' for WS errors
                console.error('WebSocket Proxy error:', err);
                socket.end(); // Close the connection on error
            });
            proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
                // console.log('正在发送 WebSocket 代理请求:', proxyReq.path);
            });
            proxy.on('open', (proxySocket) => {
                // console.log('WebSocket 代理连接已打开');
            });
            proxy.on('close', (res, socket, head) => {
                 // console.log('WebSocket 代理连接已关闭');
            });
        },
      }
    },
  },
});