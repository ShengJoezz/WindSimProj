/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-29 19:37:26
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-01 12:02:36
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\main.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// frontend/src/main.js
// 这个文件是Vue.js前端项目的入口文件。
// 它负责初始化Vue应用，并挂载到DOM元素上。
// 依赖的主要库有：Vue、Vue Router、Pinia（状态管理库）和Element Plus（UI组件库）。

// 导入Vue的createApp函数，用于创建Vue应用实例。
import { createApp } from 'vue';

// 导入App组件，这是应用的根组件。
import App from './App.vue';

// 导入Vue Router实例，用于处理应用的路由。
import router from './router';

// 导入Pinia，这是一个用于Vue的状态管理库。
import { createPinia } from 'pinia';

// 导入Element Plus库，这是一个用于构建用户界面的组件库。
import ElementPlus from 'element-plus';

// 导入Element Plus的样式文件。
import 'element-plus/dist/index.css';

// 导入全局样式文件，用于应用的全局样式。
import './assets/styles.css';

import * as ElementPlusIconsVue from '@element-plus/icons-vue'; // 添加这行

// 使用createApp函数创建一个新的Vue应用实例。
const app = createApp(App);
// 使用Element Plus库，将其添加到Vue应用中。
// 这使得应用能够使用Element Plus提供的各种UI组件。
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }
  
  app.use(ElementPlus)

// 使用createPinia创建Pinia实例，并将其添加到Vue应用中。
// Pinia实例用于管理应用的状态。
app.use(createPinia());

// 使用之前导入的router实例，将其添加到Vue应用中。
// 这使得应用能够响应路由的变化。

app.use(router);

// 将Vue应用实例挂载到id为'app'的DOM元素上。
// 这是应用渲染的起点。
app.mount('#app');