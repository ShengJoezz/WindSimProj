# WindSimProj 平台技术审计与能力白皮书 v1.0

本文面向研发、运维与管理同学，汇总平台现状、问题清单（按优先级）、整改建议，并系统性介绍平台的专业能力与技术亮点，便于对外展示与内部对齐。

## 一、平台概览

- 架构形态：前后端分离（Vue3 + Vite / Node.js + Express），Nginx 提供静态与 API 反向代理，Docker Compose 统一编排；CFD 计算链路集成 OpenFOAM、自研 roughFoam 工具链与 Python 后处理。
- 关键路径：
  - 工况管理与计算：上传地形/曲线/粗糙度 → 生成运行目录 → 执行 `base/run.sh` → Socket.IO 推送阶段进度 → 结果可视化（VTK/图表）。
  - DEM 裁切：`/api/dem/clip`（GDAL 裁切 → 临时输出 → 下载）。
  - 测风塔分析：上传 CSV → Python 并行处理 → 生成图片/索引/结果 → 前端浏览与打包下载。
- 技术栈：Express、Socket.IO、GDAL、OpenFOAM、Gmsh、Python 科学计算（numpy/pandas/matplotlib 等）。

代码位置参考（非穷尽）：
- 后端入口：`backend/app.js`
- 主要路由：`backend/routes/*`
- DEM 裁切：`backend/routes/demClipper.js`、`backend/routes/terrain.js`
- 测风塔分析：`backend/routes/windmastRouter.js`、`backend/windmast_data/*`
- CFD 计算脚本：`backend/base/run.sh`、`backend/base/solver/*`
- 前端入口与路由：`frontend/src/main.js`、`frontend/src/router/*.js`
- Nginx 配置：`frontend/nginx.conf`
- 本地开发代理：`frontend/vite.config.js`

## 二、关键问题清单（按优先级）

1) 生产环境 CORS / WebSocket 兼容性风险（高）
- 现象：后端将允许来源硬编码为开发端口（`http://localhost:5173`）；生产经 Nginx 暴露为 8080，可能触发跨域或 Socket.IO 握手失败。
- 位置：`backend/app.js:34-38`（CORS）、`backend/app.js:89-93`（Socket.IO CORS）
- 影响：生产实时进度推送失败，部分 API 被拒。
- 建议：使用环境变量统一配置允许源（如 `ALLOWED_ORIGINS`），并区分开发/生产。

2) Dockerfile 中 Gmsh 路径配置错误（高）
- 现象：镜像内 Gmsh 实际位于 `/usr/local/gmsh/gmsh-2.9.1-Linux/bin/gmsh`，但 PATH 设置为 `/usr/local/gmsh/bin`。
- 位置：`backend/Dockerfile:31-33`
- 影响：容器内无法调用 `gmsh`，导致建模/网格流程失败。
- 建议：修正 PATH 或在 COPY 后重命名到固定目录。

3) DEM 裁切使用同步子进程（高）
- 现象：`execSync` 调用 `gdalinfo`/`gdal_translate` 阻塞事件循环。
- 位置：`backend/routes/terrain.js:162-166, 188-193`
- 影响：大文件或并发请求时，整体 API 响应变慢甚至超时。
- 建议：改为异步 `spawn`/`exec`，并加入并发/队列控制。

4) PDF 报告功能缺失/易崩溃（高）
- 现象：前端调用 `/api/cases/:caseId/generate-pdf-report`；后端未实现；且 `pdfDataService.js` 依赖未引入的 `chartService`。
- 位置：`frontend/src/components/PDFReportGenerator.vue:28`、`backend/services/pdfDataService.js:32`
- 影响：功能 404 或 500。
- 建议：补齐后端路由与 `chartService`，或在前端隐藏该入口直至后端落地。

5) 数据持久化不完整（中高）
- 现象：仅对 `/app/uploads` 建命名卷；`/app/windmast_data`、`/app/clipped`、`/app/temp`、`/app/temp_rou_files` 未持久化。
- 位置：`docker-compose.yml`
- 影响：容器重启后测风输出与临时数据丢失；不利于横向扩展。
- 建议：为上述目录新增命名卷或绑定挂载，并规划清理策略。

6) 前端依赖混入服务端库（中）
- 现象：前端 `package.json` 依赖了 `express`、`multer` 等无用包。
- 位置：`frontend/package.json`
- 影响：增大构建体积，可能引入打包警告。
- 建议：移除无关依赖。

7) API 不一致与死代码（中）
- 现象：前端存在 `/api/wind-turbines/upload` 调用，但实际路由是 `/api/cases/:caseId/wind-turbines`；旧文件 `backend/routes/windTurbines.js` 疑似未挂载。
- 位置：`frontend/src/api/windTurbines.js:16`、`backend/app.js:71`
- 影响：调用 404、维护成本增加。
- 建议：统一前端调用；删除未挂载的旧路由或纳入挂载体系。

8) 配置与环境变量未集中管理（中）
- 现象：根 `.env` 未被后端加载；端口与允许来源在多处硬编码且不一致（开发 5000 / 生产 3000）。
- 位置：`.env`、`backend/app.js:118-120`、`frontend/vite.config.js`、`docker-compose.yml`
- 影响：环境切换易出错。
- 建议：引入 `dotenv`，统一端口/域名/目录配置项。

9) 访问控制与流量治理缺失（中）
- 现象：重任务接口缺少鉴权与全局限流，仅 `cases` 路由使用了限流器。
- 位置：`backend/routes` 多处
- 影响：易被滥用导致资源耗尽。
- 建议：引入认证（JWT/网关），对 `/api/dem`、`/api/rou`、`/api/windmast`、计算触发等接口增加限流与作业队列。

10) 日志与观测性待增强（中）
- 现象：大量 console 输出；生产难以检索与归档。
- 建议：统一用 `winston` 结构化日志；区分等级，输出到文件与标准输出；接入基础监控。

## 三、整改建议（执行顺序）

1) 环境化与统一配置
- 引入 `dotenv`，环境变量集中：`PORT`、`ALLOWED_ORIGINS`、`DATA_DIRS` 等。
- 调整前端 Vite 代理、Nginx 转发与后端端口一致性。

2) 修复 Dockerfile 中 Gmsh 路径
- 将 PATH 指向实际 gmsh 可执行所在路径，或在构建阶段统一拷贝到 `/usr/local/bin/gmsh`。

3) DEM 裁切异步化与并发保护
- 使用 `spawn`/`exec`，明确超时与错误处理；引入队列或并发令牌。

4) PDF 功能闭环
- 实现 `/api/cases/:caseId/generate-pdf-report`；补充/引入 `chartService`；或先隐藏前端入口。

5) 数据卷完善
- 在 `docker-compose.yml` 为 `windmast_data`、`clipped`、`temp`、`temp_rou_files` 配置命名卷或绑定挂载；补上定期清理任务。

6) 前端依赖与 API 清理
- 移除无关依赖；统一风机相关 API；移除旧未挂载路由文件或纳入路由注册。

7) 安全与治理
- 增加鉴权、全局限流（如按用户/Token）、请求体大小限制分级、下载接口鉴权；对子进程命令入参做白名单与路径校验。

## 四、平台专业能力与技术亮点

> 以下从“已实现 / 近期可落地 / 规划中”三类维度呈现，突出平台的工程化与行业化能力。

### 1) 复杂地形精细化建模（已实现＋可深化）
- 地形数据治理：支持 GeoTIFF/DEM 快速裁切与重投影；GDAL 管线结合 Python 工具，形成一键化预处理能力（`backend/routes/demClipper.js`、`backend/utils/terrain_clipper.py`）。
- 地形特征保真：融合地形坡度、起伏、切线方向等信息，保留关键地形剖面以服务流场模拟的边界约束。
- 粗糙度场注入：支持 CLCD 栅格到 z0 的映射（`/api/rou`），实现粗糙度分区与等效参数化，为近地边界层模拟提供物理一致的地表条件。

价值：在山区与复杂地形区域显著提升流场模拟的可信度，为选址精评提供“地形级”分辨率的输入。

### 2) 自适应网格划分与边界层解析（可落地）
- 网格生成链路：Gmsh + 自研 roughFoam 接口，网格策略可参数化配置（加密高度/半径/过渡半径等，见前端参数面板与 `backend/base/solver/*`）。
- 物理驱动加密：基于地形梯度、地表粗糙度跳变与风机近场区域进行各向异性加密，兼顾精度与代价。
- 边界层友好：提供近壁面 `y+` 目标区间与分层策略（高度与层数），在不牺牲稳定性的前提下捕捉剪切与分离特征。

价值：在保证工程精度的同时，计算规模可控，适配从概念选址到精评的多阶段建模需求。

### 3) 测风数据自动化处理与风能分析（已实现）
- 数据引入：上传 CSV（`/api/windmast/upload`）→ 解析清洗 → 质量控制（缺测/越界/跳变检测）→ 统一时序栈。
- 稳定度与风玫瑰：自动计算稳定度分布、风玫瑰、多高度风速频率与风能密度图（`backend/windmast_data/output/*`）。
- 管道式运行：支持并行/批处理，生成加工摘要、图片资产与索引（`/api/windmast/analyses*` 系列接口）。

价值：将“数据 → 认知”的周转从天降到分钟级，输出面向站点评估、功率预测与验证的关键统计。

### 4) 网格自适应加密（规划中）
- 误差指标触发：以速度梯度、涡量、压力恢复等作为误差估计器，驱动局部加/解密迭代。
- 伴随与灵敏度：针对关心指标（如尾流损失、年能量）引入伴随灵敏度作为再分布依据。
- 动态网格：在稳态求解链路上引入有限轮次的自适应循环（Refine → Solve → Assess），在可控计算预算内最大化边界层与尾流解析度。

价值：同等资源投入下，显著提升对关键区域（机组近场、复杂地形边界）的解析效果。

### 5) 端到端工程化闭环（已实现＋可深化）
- 一键化：从数据上传、参数配置、求解执行、进度推送到可视化与结果下载全流程打通（Socket.IO 实时管线）。
- 可移植：Docker 化封装，依赖镜像内置（OpenFOAM、GDAL、Python/Node）可快速部署到多环境。
- 可扩展：接口与目录结构模块化，便于接入新的风机模型、粗糙度映射与后处理脚本。

## 五、运维与交付建议

- 统一环境变量与配置中心：端口、域名、允许源、数据目录、并发阈值等全部环境化；在 CI/CD 中按环境注入。
- 完善数据卷与清理策略：对 `uploads`、`windmast_data`、`clipped`、`temp*` 进行持久化与定期清理。
- 监控告警：基础三件套（存储/CPU/内存）＋作业成功率、时延分布、队列堆积阈值告警。
- 安全基线：鉴权/配额/限流/审计日志，下载接口与静态目录最小暴露，Python 子进程参数白名单与路径校验。

## 六、里程碑路线图（建议）

- M1（两周）：CORS/Socket.IO 环境化，Gmsh PATH 修复，DEM 裁切异步化，数据卷完善；PDF 前端入口隐藏或后端 MVP。
- M2（四周）：PDF 完整版、鉴权与全局限流、日志标准化、作业并发与队列化、下载接口鉴权。
- M3（八周）：物理驱动网格自适应 PoC，上线测风与计算结果联合报告模板（可 PDF 导出），观测性 Dashboard。

---

附：关键文件索引（便于快速定位）
- `backend/app.js`
- `backend/routes/{cases.js, terrain.js, demClipper.js, windmastRouter.js, rouDownloader.js}`
- `backend/Dockerfile`
- `frontend/nginx.conf`
- `frontend/vite.config.js`
- `docker-compose.yml`

