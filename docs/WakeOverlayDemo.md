# Wake Overlay Demo (Terrain CFD + Analytic/FLORIS Wake)

> 目的：在**不做“含风机的复杂地形 CFD”**的前提下，用现有的“无风机地形流场”结果做底图，再叠加一个解析/FLORIS 的尾流缺速（含简单偏转），从而得到可用于展示的“山区尾流偏转”效果图。

本方案**只改可视化缓存 PNG**，不改 CFD 计算结果文件；适合演示，不代表严格物理正确性。

---

## 1) 前置条件

你的 base case（例如 `jieqing`）需要已经有：

- `backend/uploads/<caseId>/speed.bin`
- `backend/uploads/<caseId>/output.json`
- `backend/uploads/<caseId>/visualization_cache/metadata.json`
- `backend/uploads/<caseId>/visualization_cache/slices_img/slice_height_*.png`

如果缺少 `visualization_cache`，先运行：

```bash
python backend/utils/precompute_visualization.py --caseId <caseId>
```

---

## 2) 准备风机布置（CSV/JSON/XLSX）

推荐 CSV：至少包含 `x,y`（单位：米），可选 `id,yaw`。

```csv
id,x,y,yaw
T1,-1000,0,0
T2,0,0,0
T3,1000,0,0
```

坐标系要求：和 `visualization_cache/metadata.json` 的 `xCoords_m/yCoords_m` 一致（通常以场区中心为 0,0，范围约 `[-lt/2, +lt/2]`）。

如果你的布局是 `0..5000` 这类正坐标，可用 `--layout-auto-center` 自动把布局质心移到域中心。

---

## 3) 运行叠加脚本（默认：简化解析模型）

将尾流“写进”每一层切片 PNG（会自动备份原图到 `slices_img_backup_YYYYmmdd_HHMMSS/`）：

```bash
python backend/utils/overlay_wake_on_slices.py \
  --caseId jieqing \
  --layout-file path/to/layout.csv \
  --layout-auto-center \
  --deflection-deg 8
```

常用参数：

- `--wind-from-deg`：风向（气象定义：**风从**某方向吹来，0=北风，90=东风…），默认取 `metadata.json`/`info.json`。
- `--hub-height` / `--rotor-diameter` / `--ct`：决定尾流宽度/强度。
- `--wake-expansion-k`：尾流扩散速度（越大越“胖”）。
- `--cmap`：颜色映射（默认 `viridis`）。常用：`viridis`/`cividis`（更均匀、观感更好）、`turbo`（更鲜艳）。
- `--heights 120,140`：只处理部分高度（默认 `all`）。
- `--no-backup`：不备份（不建议）。
- `--dry-run`：只检查输入不写文件。

---

## 4) 在前端查看效果

刷新 `http://localhost:5173/cases/<caseId>/results`（或风场切片页）即可看到新的切片图。

如果浏览器有缓存，建议：

- 强制刷新（Shift+Reload），或
- 在 URL 后加一个临时参数（例如 `?t=123`）绕开缓存。

---

## 5) 可选：使用 FLORIS 计算尾流平面

如果你的 FLORIS 安装在 Conda 环境（例如 `Wind_env`），建议用 `conda run` 调用脚本：

```bash
CONDA_NO_PLUGINS=true conda run -n Wind_env python backend/utils/overlay_wake_on_slices.py \
  --caseId jieqing \
  --layout-file path/to/layout.csv \
  --layout-auto-center \
  --model floris \
  --wind-from-deg 270 \
  --wind-speed 10 \
  --ti 0.08 \
  --yaw-deg 20 \
  --floris-deflection-dm 2.5 \
  --floris-x-res 300 --floris-y-res 300
```

说明：

- `--wind-from-deg 270` 表示**西风（从西往东吹）**；如果你想“从北往南吹”，用 `--wind-from-deg 0`。
- `--yaw-deg` 可让尾流出现明显“偏转”（不设置通常偏转不明显）。
- `--yaw-opt geometric` 可让 FLORIS 自动算一组偏航角（更像“优化/工程策略”），此时会忽略 `--yaw-deg`。
- `--floris-deflection-dm` 会放大/缩小 FLORIS 的偏转量（演示用途，>1 会更“夸张”）。
- `--cmap` 可改善配色观感（默认 `viridis`）；如果你更喜欢“风速图常见的彩虹感”，可试 `--cmap turbo`。
- `--floris-x-res/--floris-y-res` 影响速度与精细程度；脚本会把 FLORIS 平面插值到 CFD 网格再渲染 PNG。
- `--floris-config` 是可选的：不传则使用脚本内置的最小默认配置（默认风机类型 `nrel_5MW`，可用 `--floris-turbine-type` 调整）。

如果你想直接复用某个工况的风机坐标（例如 `testmi`），不需要准备 CSV：

```bash
CONDA_NO_PLUGINS=true conda run -n Wind_env python backend/utils/overlay_wake_on_slices.py \
  --caseId jieqing \
  --layout-from-case testmi \
  --model floris \
  --wind-from-deg 270 \
  --yaw-deg 20 \
  --floris-deflection-dm 2.5 \
  --floris-x-res 300 --floris-y-res 300
```

---

## 6) 回滚

脚本运行后会输出备份目录，例如：

```
Backup saved to: .../visualization_cache/slices_img_backup_20260109_234451
```

回滚最简单方式：把备份目录里的 `slice_height_*.png` 拷回 `visualization_cache/slices_img/` 覆盖即可。
