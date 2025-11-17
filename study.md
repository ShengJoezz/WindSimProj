# 全栈开发学习指南 

## 一、项目架构深度解析

本平台采用**前后端分离**架构，其核心设计思想是：**“Node.js做调度与通信，Python做计算”**。

-   **前端 (Frontend)**：基于 **Vue.js 3** 的单页面应用 (SPA)。它不仅仅是用户界面，还通过 **Three.js/vtk.js** 等库承担了复杂的2D和3D数据可视化渲染任务。
-   **后端 (Backend)**：一个**混合型（Polyglot）后端**。
    -   **主服务 (Node.js/Express.js)**: 作为API网关，处理所有HTTP请求、管理文件、并通过WebSocket与前端实时通信。它不执行CPU密集型计算，而是扮演一个**“指挥官”**的角色。
    -   **计算引擎 (Python/Shell)**: 由Node.js服务在需要时通过子进程（`child_process`）调用的脚本集合。这些脚本负责执行所有核心的、耗时的科学计算任务（如流体模拟、数据插值等）。
-   **部署 (Deployment)**：通过 **Docker** 和 **Docker Compose** 实现服务化，确保了开发和生产环境的高度一致性，极大简化了部署流程。

---

## 二、核心工作流：追踪一次模拟任务的生命周期

要理解这个项目，最好的方法是追踪一个核心功能的完整流程。我们以“用户创建一个新的模拟案例”为例：

### 第1步：前端 - 发起任务 (`NewCase.vue`)

1.  **用户交互**: 用户在 `frontend/src/views/NewCase.vue` 页面的表单中填写案例名称、参数，并上传所需文件。这个视图使用了 `Element Plus` 组件库来构建界面。
2.  **状态管理**: 点击“提交”后，组件会调用 `frontend/src/store/caseStore.js` (Pinia Store) 中的一个 `action`（例如 `createCase`）。
3.  **API封装**: 这个 `action` 内部会调用一个API请求函数（例如定义在 `frontend/src/api/cases.js` 中，遵循 `windTurbines.js` 的模式）。该函数使用 `axios` 将用户数据打包成一个 `FormData` 对象，并向后端发送 `POST` 请求。

### 第2步：后端 - 接收与调度 (`cases.js` & `tasks.js`)

1.  **路由接收**: 后端的 `backend/app.js` 中注册了 `cases` 路由。请求被 `backend/routes/cases.js` 中的 `POST /` 路由处理器接收。
2.  **任务准备**: 处理器首先会创建该案例专属的文件夹，并将用户上传的文件和生成的 `input.json` 参数文件存入其中。
3.  **启动任务**: 最关键的一步，处理器调用 `backend/utils/tasks.js` 中的 `taskManager.startTask(caseId)` 函数，将任务交给任务管理器。

### 第3步：后端 - 执行计算 (`tasks.js` & Python脚本)

1.  **创建子进程**: `tasks.js` 使用Node.js的 `child_process.spawn` 方法来执行一个Shell脚本（如 `run.sh`）。`spawn` 是非阻塞的，因此Node.js服务可以继续响应其他请求。
2.  **执行脚本**: `run.sh` 脚本会依次调用多个Python计算脚本（例如 `process_wind_data_parallel.py`）。这些Python脚本使用 `numpy`, `scipy`, `gdal` 等库进行繁重的数据处理和科学计算。
3.  **实时日志**: 在 `tasks.js` 中，`spawn` 创建的子进程的 `stdout` 和 `stderr` (标准输出和错误) 被监听。每当Python脚本 `print` 信息时，这些信息会被捕获并通过 `socket.io` 以 `log` 事件的形式实时广播给所有前端客户端。

### 第4步：前端 - 实时反馈与结果展示 (`CaseDetails.vue`)

1.  **接收日志**: 在 `frontend/src/views/CaseDetails.vue` 组件中，会有一个 `socket.on('log', ...)` 的监听器。它接收后端发来的实时日志，并将其显示在终端或文本区域中，让用户能看到计算进度。
2.  **任务完成**: 当计算完成，子进程退出时，`tasks.js` 会监听到 `exit` 事件，并再次通过 `socket.io` 广播一个 `caseUpdate` 事件，告知前端该案例状态已变为“完成”或“失败”。
3.  **渲染结果**: `CaseDetails.vue` 根据案例数据，加载并渲染结果。它可能会将结果文件的路径作为 `prop` 传递给专门的可视化组件，例如 `frontend/src/components/FlowVisualization.vue`。
4.  **3D可视化**: `FlowVisualization.vue` 组件负责加载由Python脚本生成的 `.vtk` 或其他格式的3D数据文件，并使用 `vtk.js` 或 `Three.js` 将其渲染成交互式的三维流线图或速度云图。

---

## 三、重点模块学习指南

| 学习目标                 | 关键技术/库                               | 建议阅读文件                                                                                                                            | 学习要点                                                                                                                                                           |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **前端状态管理**         | `Pinia`                                   | `frontend/src/store/caseStore.js`                                                                                                       | 理解 `state`, `getters`, `actions` 的用法。学习如何通过 `action` 封装API请求并更新 `state`。                                                                   |
| **前端路由**             | `Vue Router`                              | `frontend/src/router/index.js`                                                                                                          | 学习路由表的定义，特别是带参数的动态路由（如 `/cases/:caseId`）。                                                                                                  |
| **后端任务调度**         | `Node.js`, `child_process`, `socket.io`   | `backend/routes/cases.js`<br>`backend/utils/tasks.js`                                                                                   | **核心！** 重点理解 `spawn` 如何启动子进程，如何监听 `stdout`/`stderr`/`exit` 事件，以及如何结合 `socket.io` 将信息实时反馈给前端。                               |
| **3D数据可视化**         | `vtk.js` / `Three.js`                     | `frontend/src/components/FlowVisualization.vue`<br>`frontend/src/components/VTKViewer.vue`                                               | 学习如何加载外部模型/数据文件（如.vtk），设置渲染器（Renderer）、场景（Scene）、相机（Camera），并将其渲染到Vue组件的`<canvas>`中。                               |
| **地理数据处理(后端)**   | `Python`, `gdal`, `numpy`, `scipy`        | `backend/utils/process_wind_data_parallel.py`<br>`backend/utils/terrain_clipper.py`                                                      | 理解Python如何利用这些库读取和处理地理空间数据（如DEM），进行插值、裁剪等操作，并生成可视化所需的数据格式。                                                      |
| **API接口设计**          | `Express.js`                              | `backend/app.js`<br>`backend/routes/cases.js`                                                                                           | 学习 `Express` 中间件（`cors`, `morgan`）的用法，以及如何使用 `express.Router` 来组织和定义RESTful API端点。                                                       |
| **容器化部署**           | `Docker`, `Docker Compose`                | `Dockerfile` (in frontend/backend)<br>`docker-compose.yml`                                                                               | 理解 `Dockerfile` 中各指令的含义。分析 `docker-compose.yml` 如何定义前端和后端两个服务，如何设置网络（`networks`）和数据卷（`volumes`）来实现服务间的通信和数据持久化。 |