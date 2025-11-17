下面把你这条 rou 生成链路（CLCD → z0 → h → rou）的“可引用依据”和每个关键参数的“为什么”梳理成一份简明证据包，便于你在文档或论文里直接引用。

一、数据来源与坐标系

- 中国30米年度土地覆盖（CLCD）：权威数据描述与精度评估已在 ESSD 期刊发表，给出九大类（耕地、森林、灌丛、草地、水体、雪/冰、裸地、不透水/城镇、湿地），总体精度约 79%（多年稳定在 76–83%）。新版数据以 COG GeoTIFF 发布，并提供 “*_albert.tif” Albers 等积投影（proj4 详述）。这些都支持你直接把 CLCD 作为土地覆盖底图来派生粗糙度。([zenodo.org](https://zenodo.org/doi/10.5281/zenodo.4417809?utm_source=openai))
- 你的流程先把 Albers 投影的 CLCD 裁剪、再重投影到局地 UTM（按中心经纬度计算分区）是合理做法。WAsP/风能地形工作流也明确建议在 WGS84 的 UTM 合适分带内工作（便于以米作为单位做距离与面积计算）。([wasp.dk](https://www.wasp.dk/download/mapeditor_releasenotes?utm_source=openai))
- 使用 gdalbuildvrt/gdalwarp 做拼接、裁剪与重投影是业界通用工具链，且 gdalwarp 在分类型（分类栅格）数据上推荐 nearest-neighbor 重采样以避免类别被插值污染。([gdal.org](https://gdal.org/en/stable/programs/gdalbuildvrt.html?utm_source=openai))

二、由土地覆盖映射到粗糙度长度 z0（mapping.yaml）
 “土地覆盖 → z0”的查表法在风能/边界层界常用，典型值的权威来源包括 WMO/AMS 指南、EPA/AERSURFACE 手册、Davenport–Wieringa 分类与后续综述，以及风能领域（NEWA）把 CORINE 类别映射到常数 z0 的做法。要点与常见范围如下（你当前取值见括号）：

- 水体：z0 ≈ 0.0002 m；WAsP 为区分水面/极光滑陆面，内部通常将水体粗糙度标记为 0（软件约定）。你在 CFD 中设 0.0002 亦属教科书量级。([nepis.epa.gov](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=2000D6B8.TXT&utm_source=openai))
- 草地/开阔地：z0 ≈ 0.03–0.05 m（你取 0.05）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- 耕地/低矮作物：z0 ≈ 0.10–0.25 m（你取 0.10）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- 灌丛/公园化地表：z0 ≈ 0.05–0.5 m（你取 0.07）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- 裸地/荒地：z0 ≈ 0.01–0.03 m（你取 0.02）。([nepis.epa.gov](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=2000D6B8.TXT&utm_source=openai))
- 森林：z0 常在 0.5–1.5 m（你取 0.5）。多文献与风能工具建议森林可采用 1.0–1.5 m 的代表值，但也会因冠层结构/季节而显著变动。([journals.ametsoc.org](https://journals.ametsoc.org/view/journals/apme/39/5/1520-0450_2000_039_0708_eosrla_2.0.co_2.xml?utm_source=openai))
- 城镇/不透水：郊区/低密建成区 z0 ≈ 0.4–1.0 m，市中心可 ≥2 m（你取 0.4；偏保守）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Log_wind_profile?utm_source=openai))
- 雪/冰：z0 ≈ 0.001–0.005 m（你取 0.001）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- “映射表只有约定俗成而无唯一真值”，NEWA 明确指出 CORINE→z0 的查表并无“客观且充分验证的”唯一方案，因此你的 mapping.yaml 作为工程化配置是合理的，后续可据现场或再分析数据调优。([gmd.copernicus.org](https://gmd.copernicus.org/articles/13/5079/2020/index.html?utm_source=openai))

三、由 z0 到“植被高度” h：h = a·z0 的依据

- 边界层理论与观测普遍给出 z0 与粗糙元高度 h 同阶的线性比例，经验上 z0 ≈ (0.05–0.2)·h，常用“十分之一法则”z0 ≈ 0.1 h；反过来 h ≈ (5–20)·z0。你设置 a=20 属于该文献范围的上沿（偏保守，不会低估高度）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- 更细致的植被冠层参数化（Raupach 1994）将 z0、位移高度 d 与冠层高度 h、叶/枝面积指数联系起来，进一步说明 a 并非一成不变、与冠层密度季节性有关。你的 a 作为工程化系数可结合季节或本地校准调整。([link.springer.com](https://link.springer.com/article/10.1007/bf00709229?utm_source=openai))

四、季节性与“vege-times”系数

- 文献表明 z0 与 LAI 季节变化显著：冬季落叶时 z0 可显著变小，夏季满叶时增大。因此引入一个全局乘子（vege-times）去做“叶季/非叶季”或情景灵敏度分析是合理的工程化做法（例如冬季 0.5–0.8、夏季 1.0）。([gmd.copernicus.org](https://gmd.copernicus.org/articles/13/2451/2020/gmd-13-2451-2020.html?utm_source=openai))

五、.rou 文件/等值线表达的合理性

- 工具链上已经有“从土地覆盖生成粗糙度并导出”为 WAsP .map 或 WindSim .gws 的标准做法（Global Mapper 的“Create Roughness Grid from Landcover Layer…”功能即内置多套映射表并支持导出），这为你“从分类栅格→粗糙度→线/点表达→外部流场工具”的思路提供了直接先例。([bluemarblegeo.com](https://www.bluemarblegeo.com/knowledgebase/global-mapper/roughness.htm?utm_source=openai))
- WAsP/Global Mapper 的讨论里也提到包含“Z0_left Z0_right Height #Points + 坐标列”的线要素格式变体，因此你在 rou 中同时写入 z0 与 h 的分组等值线是有先例可循的（不同软件对拓扑/列含义的解释略有差异，需按目标软件验收）。([globalmapperforum.com](https://www.globalmapperforum.com/discussion/10828/wasp-map-combined-elevation-roughness-lines?utm_source=openai))
- 若你的目标是 WAsP 生态，官方接受并鼓励用 .map（线）或网格类（WindSim .gws）表示粗糙度；因此 rou 作为“你方工具链的文本等值线格式”是可行的，只要与下游读取脚本对齐即可。([gdal.org](https://gdal.org/en/stable/drivers/vector/wasp.html?utm_source=openai))

六、你脚本里关键参数与实现细节的依据

- 最近邻重采样（-r near）：分类栅格标准做法，避免类别插值。([gdal.org](https://gdal.org/en/stable/programs/gdalwarp.html?utm_source=openai))
- 设置 -dstNodata 0 并在采样时滤除 nodata=0：与多数土地覆盖产品（类别码从 1 开始，0/None 为 nodata）的习惯一致，避免把空洞当真实类别。
- 采样间距 sample ≈ 100 m：CLCD 原始分辨率 30 m；风能粗糙度建模在欧洲 NEWA 中也采用 100 m 级别的 z0 底图，100 m 的子采样可显著降容且保持粗糙度空间结构。([gmd.copernicus.org](https://gmd.copernicus.org/articles/13/5079/2020/index.html?utm_source=openai))
- 定量分组 quant_step_m=0.5 m：既能显著压缩等值线集合规模，也远小于当前卫星反演冠高的常见 RMSE（多研究显示 4–9 m 量级），不会引入实质性误差。([mdpi.com](https://www.mdpi.com/1999-4907/15/9/1536?utm_source=openai))
- 5% 的裁剪缓冲：重投影裁剪时留出小缓冲可避免边界像元因重采样核外推而丢失，属常见栅格处理经验（GDAL 对重采样窗口/无效像元处理的说明）。([gdal.org](https://gdal.org/en/release-3.9/programs/gdalwarp.html?utm_source=openai))
- UTM 投影选择：WAsP Map Editor 亦建议将工程地图转换到合适 UTM WGS84 分带后再使用；你的 “按中心经纬度推断 UTM 分带 + Transformer 重投影”做法契合这一建议。([wasp.dk](https://www.wasp.dk/download/mapeditor_releasenotes?utm_source=openai))

七、城镇与水面的两个小提醒

- 水面在 WAsP 里常用 z0=0 作为特殊标识；若你的下游不是 WAsP，而是 LES/CFD，自然可采用海面常见的 0.0002 m 静态近似。请按目标模型习惯选用。([wasp.dtu.dk](https://wasp.dtu.dk/support/frequently-asked-questions/maps-faq/roughnessandorography?utm_source=openai))
- 城镇 z0 的不确定性很大，低密郊区到高密市中心差别可达量级。AERSURFACE/文献给出 0.5–≥2 m 的广泛范围；你目前 0.4 m 属偏低的保守设定，必要时可按城区密度与建筑高度调高（或用形态学参数化，如 Macdonald/1998 系列）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Log_wind_profile?utm_source=openai))

八、阻力项与 Cᵈ 的取值

- 采用 f_u,i = ½ ρ Cᵈ a_t |ũ| ũᵢ 的体积阻力形式，在植被/城市冠层 LES 与浅水植被阻力文献中普遍使用；Cᵈ 在 0.2–>1 的范围内随雷诺数、密度与要素形态变化显著。你采用 Cᵈ≈0.4 属工程中常用的中等量级，后续可以通过实测或风洞/数值对比标定。([agupubs.onlinelibrary.wiley.com](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023WR036521?utm_source=openai))

九、与你 mapping.yaml 逐条对照（建议写进方法附录）

- 你当前表：Cropland 0.10、Forest 0.50、Shrub 0.07、Grass 0.05、Water 0.0002、Snow/Ice 0.001、Barren 0.02、Urban 0.40、Wetland 0.07；a_factor=20；quant_step=0.5 m。该表处于上述权威范围内且有工程先例（NEWA 的“固定 z0 查表”思路）。建议在文档里声明“此为起始配置，会依据现场与再分析风气候作 sector-wise or class-wise 校正”。([gmd.copernicus.org](https://gmd.copernicus.org/articles/13/5079/2020/index.html?utm_source=openai))

十、流程与格式的可复现性说明（写给审稿人/甲方）

- 数据：CLCD（Albers 投影 COG，九大类，OA≈79%）；解释“albert.tif”为 Albers 等积。([zenodo.org](https://zenodo.org/doi/10.5281/zenodo.4417809?utm_source=openai))
- 处理：GDAL（buildvrt/warp，最近邻，nodata=0，UTM 分带）；100 m 采样；z0/H 分组写 rou。([gdal.org](https://gdal.org/en/stable/programs/gdalbuildvrt.html?utm_source=openai))
- 物理：类别→z0 查表范围与引用；h = a·z0 的经验关系；Cᵈ a_t 阻力项；季节性（vege-times）。([en.wikipedia.org](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai))
- 输出：等值线 rou 的先例（WAsP .map/WindSim .gws/Global Mapper 导出），并说明若导入 WAsP，水体请用 z0=0 的约定。([bluemarblegeo.com](https://www.bluemarblegeo.com/knowledgebase/global-mapper/roughness.htm?utm_source=openai))

如需，我可以：

- 按上述依据，给你生成一份可直接粘贴到报告/论文“方法-数据与参数设置”章节的中英双语段落；
- 根据项目地点（经纬度/代表下垫面）把 Urban/Forest 的 z0 与 a 做一次情景扫描（夏/冬、低/高中密度），给出一张推荐参数表；
- 输出一版 WAsP .map 或 WindSim .gws，方便和第三方工具交叉校验 rou 的一致性。

------

Learn more:

1. [The 30 m annual land cover datasets and its dynamics in China from 1985 to 2023](https://zenodo.org/doi/10.5281/zenodo.4417809?utm_source=openai)
2. [WAsP Map Editor 12 - Release Notes](https://www.wasp.dk/download/mapeditor_releasenotes?utm_source=openai)
3. [gdalbuildvrt — GDAL documentation](https://gdal.org/en/stable/programs/gdalbuildvrt.html?utm_source=openai)
4. [Site Specification Meteorological Monitoring Guidance For Regulatory Modeling Applications](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=2000D6B8.TXT&utm_source=openai)
5. [Roughness length](https://en.wikipedia.org/wiki/Roughness_length?utm_source=openai)
6. [Estimation of Surface Roughness Length and Displacement Height from Single-Level Sonic Anemometer Data in: Journal of Applied Meteorology and Climatology Volume 39 Issue 5 (2000)](https://journals.ametsoc.org/view/journals/apme/39/5/1520-0450_2000_039_0708_eosrla_2.0.co_2.xml?utm_source=openai)
7. [Log wind profile](https://en.wikipedia.org/wiki/Log_wind_profile?utm_source=openai)
8. [GMD - The Making of the New European Wind Atlas – Part 2: Production and evaluation](https://gmd.copernicus.org/articles/13/5079/2020/index.html?utm_source=openai)
9. [Simplified expressions for vegetation roughness length and zero-plane displacement as functions of canopy height and area index | Boundary-Layer Meteorology](https://link.springer.com/article/10.1007/bf00709229?utm_source=openai)
10. [GMD - Satellite-derived leaf area index and roughness length information for surface–atmosphere exchange modelling: a case study for reactive nitrogen deposition in north-western Europe using LOTOS-EUROS v2.0](https://gmd.copernicus.org/articles/13/2451/2020/gmd-13-2451-2020.html?utm_source=openai)
11. [Create Roughness Grid From Landcover Layer...](https://www.bluemarblegeo.com/knowledgebase/global-mapper/roughness.htm?utm_source=openai)
12. [WAsP Map - combined elevation & roughness lines — Global Mapper Forum](https://www.globalmapperforum.com/discussion/10828/wasp-map-combined-elevation-roughness-lines?utm_source=openai)
13. [WAsP - WAsP .map format — GDAL documentation](https://gdal.org/en/stable/drivers/vector/wasp.html?utm_source=openai)
14. [gdalwarp — GDAL documentation](https://gdal.org/en/stable/programs/gdalwarp.html?utm_source=openai)
15. [Error Analysis and Accuracy Improvement in Forest Canopy Height Estimation Based on GEDI L2A Product: A Case Study in the United States](https://www.mdpi.com/1999-4907/15/9/1536?utm_source=openai)
16. [gdalwarp — GDAL documentation](https://gdal.org/en/release-3.9/programs/gdalwarp.html?utm_source=openai)
17. https://wasp.dtu.dk/support/frequently-asked-questions/maps-faq/roughnessandorography?utm_source=openai
18. [Drag in Vegetation Canopy: Considering Sheltering and Blockage Effects - Liu - 2024 - Water Resources Research - Wiley Online Library](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023WR036521?utm_source=openai)