/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 21:45:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-12 22:27:29
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\vite.config.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import path from 'path';
import fs from 'node:fs';

export default defineConfig({
  plugins: [
    vue(),
    // 自定义插件，用于将 vtk.js 中的 .glsl 文件转换为字符串模块
    {
      name: 'handle-vtk-js-glsl',
      enforce: 'pre', // 确保插件在其他插件之前执行
      transform(code, id) {
        // 使用正则表达式匹配 vtk.js 内部的 .glsl 文件
        if (/node_modules\/vtk\.js\/Sources\/Rendering\/OpenGL\/glsl\/.*\.(glsl|vs|fs)$/.test(id)) {
          console.log(`[handle-vtk-js-glsl] Transforming GLSL file: ${id}`);
          return {
            code: `export default ${JSON.stringify(code)}`,
            map: null, // 不生成 source map
          };
        }
        return null; // 其他文件不处理
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      '@kitware/vtk.js',
      '@kitware/vtk.js/IO/XML/XMLMultiBlockDataReader' // 显式包含，尝试解决导入问题
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('正在发送代理请求:', proxyReq.method, proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('收到代理响应:', proxyRes.statusCode);
          });
        },
      },
    },
  },
});