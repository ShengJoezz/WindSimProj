#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# gen_rou_china.py
# 批量为中国省/市/县目录生成 rou 文件（以域中心为(0,0)，单位米）
# 用法：python gen_rou_china.py --root ./China_Dem --lt 20000 --seed 270927

import os, sys, math, random, argparse, hashlib
from pathlib import Path
from typing import List, Tuple, Dict

def stable_seed_from_path(p: Path, base_seed: int) -> int:
    h = hashlib.sha256((str(p) + str(base_seed)).encode('utf-8')).hexdigest()
    return int(h[:8], 16)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def jitter():
    return (random.random() - 0.5)

def gen_points_stripes(n: int, lt: float, bands: int = 7, angle_deg: float = None) -> List[Tuple[float, float]]:
    # 模拟耕地条带：若干条与主方向近似平行的带内均匀撒点
    pts = []
    if angle_deg is None:
        angle_deg = random.uniform(-30, 30)
    ang = math.radians(angle_deg)
    L = lt * 0.9
    half = lt / 2.0
    # 在原坐标系先生成“竖直条带”，再整体旋转
    stripe_x = [(-L/2) + (i+0.5)*L/bands for i in range(bands)]
    per = max(1, n // bands)
    for sx in stripe_x:
        for _ in range(per):
            x0 = sx + random.gauss(0.0, lt*0.01)
            y0 = random.uniform(-half, half)
            # 旋转
            x = x0*math.cos(ang) - y0*math.sin(ang)
            y = x0*math.sin(ang) + y0*math.cos(ang)
            x = clamp(x, -half, half)
            y = clamp(y, -half, half)
            pts.append((x, y))
    # 补齐
    while len(pts) < n:
        pts.append((random.uniform(-half, half), random.uniform(-half, half)))
    return pts[:n]

def gen_points_ellipse(n: int, lt: float) -> List[Tuple[float, float]]:
    # 模拟林地：椭圆团块，多簇
    pts = []
    half = lt/2.0
    K = random.randint(2, 4)  # 团块数
    centers = []
    for _ in range(K):
        cx = random.uniform(-half*0.6, half*0.6)
        cy = random.uniform(-half*0.6, half*0.6)
        rx = random.uniform(lt*0.08, lt*0.2)
        ry = random.uniform(lt*0.06, lt*0.18)
        centers.append((cx, cy, rx, ry))
    per = max(1, n // K)
    for (cx, cy, rx, ry) in centers:
        for _ in range(per):
            t = random.uniform(0, 2*math.pi)
            r = abs(random.gauss(0, 0.5))
            x = cx + r*rx*math.cos(t)
            y = cy + r*ry*math.sin(t)
            x = clamp(x, -half, half)
            y = clamp(y, -half, half)
            pts.append((x, y))
    while len(pts) < n:
        pts.append((random.uniform(-half, half), random.uniform(-half, half)))
    return pts[:n]

def gen_points_ring(n: int, lt: float) -> List[Tuple[float, float]]:
    # 模拟灌丛：环带或外围碎斑
    pts = []
    half = lt/2.0
    R = lt * random.uniform(0.25, 0.45)
    for _ in range(n):
        a = random.uniform(0, 2*math.pi)
        rr = random.gauss(R, lt*0.03)
        x = clamp(rr*math.cos(a), -half, half)
        y = clamp(rr*math.sin(a), -half, half)
        pts.append((x, y))
    return pts

def gen_points_grid_jitter(n: int, lt: float) -> List[Tuple[float, float]]:
    # 模拟园地：规则网格+抖动
    pts = []
    half = lt/2.0
    side = math.sqrt(n)
    side = max(6, int(side))
    step = lt / (side + 1)
    for i in range(side):
        for j in range(side):
            if len(pts) >= n: break
            x = (-half + (i+1)*step) + jitter()*step*0.25
            y = (-half + (j+1)*step) + jitter()*step*0.25
            pts.append((x, y))
    while len(pts) < n:
        pts.append((random.uniform(-half, half), random.uniform(-half, half)))
    return pts

def gen_points_center_cluster(n: int, lt: float) -> List[Tuple[float, float]]:
    # 模拟城郊绿化：靠近域中心的集聚
    pts = []
    half = lt/2.0
    sigma = lt*0.12
    for _ in range(n):
        x = clamp(random.gauss(0.0, sigma), -half, half)
        y = clamp(random.gauss(0.0, sigma), -half, half)
        pts.append((x, y))
    return pts

# 省级简单偏置（权重与高度范围，越“常理”越好，但不追求真值）
PROV_PROFILE = {
    # 东北-华北：耕地多，林地次之
    "辽宁省": {"weights": {"farmland":0.45,"forest":0.35,"shrub":0.12,"orchard":0.04,"urban":0.04}},
    "吉林省": {"weights": {"farmland":0.42,"forest":0.38,"shrub":0.12,"orchard":0.03,"urban":0.05}},
    "黑龙江省": {"weights": {"farmland":0.40,"forest":0.40,"shrub":0.12,"orchard":0.03,"urban":0.05}},
    "河北省": {"weights": {"farmland":0.50,"forest":0.25,"shrub":0.15,"orchard":0.05,"urban":0.05}},
    "河南省": {"weights": {"farmland":0.52,"forest":0.22,"shrub":0.16,"orchard":0.05,"urban":0.05}},
    "山东省": {"weights": {"farmland":0.55,"forest":0.20,"shrub":0.15,"orchard":0.05,"urban":0.05}},
    "山西省": {"weights": {"farmland":0.45,"forest":0.30,"shrub":0.18,"orchard":0.02,"urban":0.05}},
    # 华东：耕地+园地/林地，城市绿化较多
    "江苏省": {"weights": {"farmland":0.46,"forest":0.26,"shrub":0.12,"orchard":0.08,"urban":0.08}},
    "上海市": {"weights": {"farmland":0.35,"forest":0.20,"shrub":0.15,"orchard":0.10,"urban":0.20}},
    "浙江省": {"weights": {"farmland":0.32,"forest":0.45,"shrub":0.12,"orchard":0.06,"urban":0.05}},
    "安徽省": {"weights": {"farmland":0.48,"forest":0.28,"shrub":0.14,"orchard":0.05,"urban":0.05}},
    "江西省": {"weights": {"farmland":0.36,"forest":0.44,"shrub":0.14,"orchard":0.03,"urban":0.03}},
    "福建省": {"weights": {"farmland":0.28,"forest":0.52,"shrub":0.14,"orchard":0.03,"urban":0.03}},
    "台湾省": {"weights": {"farmland":0.30,"forest":0.50,"shrub":0.15,"orchard":0.03,"urban":0.02}},
    # 华中/华南：林地更高
    "湖北省": {"weights": {"farmland":0.38,"forest":0.42,"shrub":0.12,"orchard":0.04,"urban":0.04}},
    "湖南省": {"weights": {"farmland":0.34,"forest":0.46,"shrub":0.14,"orchard":0.03,"urban":0.03}},
    "广东省": {"weights": {"farmland":0.28,"forest":0.50,"shrub":0.14,"orchard":0.04,"urban":0.04}},
    "广西壮族自治区": {"weights": {"farmland":0.30,"forest":0.48,"shrub":0.16,"orchard":0.03,"urban":0.03}},
    "海南省": {"weights": {"farmland":0.20,"forest":0.58,"shrub":0.16,"orchard":0.03,"urban":0.03}},
    "香港特别行政区": {"weights": {"farmland":0.10,"forest":0.60,"shrub":0.15,"orchard":0.05,"urban":0.10}},
    "澳门特别行政区": {"weights": {"farmland":0.10,"forest":0.55,"shrub":0.15,"orchard":0.05,"urban":0.15}},
    # 西南：山地林地多
    "四川省": {"weights": {"farmland":0.32,"forest":0.48,"shrub":0.15,"orchard":0.03,"urban":0.02}},
    "重庆市": {"weights": {"farmland":0.30,"forest":0.50,"shrub":0.15,"orchard":0.03,"urban":0.02}},
    "云南省": {"weights": {"farmland":0.26,"forest":0.54,"shrub":0.16,"orchard":0.02,"urban":0.02}},
    "贵州省": {"weights": {"farmland":0.28,"forest":0.52,"shrub":0.16,"orchard":0.02,"urban":0.02}},
    # 西北/青藏：灌丛草地多，林地相对低
    "陕西省": {"weights": {"farmland":0.40,"forest":0.32,"shrub":0.20,"orchard":0.03,"urban":0.05}},
    "甘肃省": {"weights": {"farmland":0.28,"forest":0.26,"shrub":0.40,"orchard":0.02,"urban":0.04}},
    "青海省": {"weights": {"farmland":0.20,"forest":0.24,"shrub":0.50,"orchard":0.02,"urban":0.04}},
    "宁夏回族自治区": {"weights": {"farmland":0.34,"forest":0.22,"shrub":0.40,"orchard":0.02,"urban":0.02}},
    "新疆维吾尔自治区": {"weights": {"farmland":0.24,"forest":0.20,"shrub":0.50,"orchard":0.04,"urban":0.02}},
    "内蒙古自治区": {"weights": {"farmland":0.28,"forest":0.22,"shrub":0.46,"orchard":0.02,"urban":0.02}},
    "西藏自治区": {"weights": {"farmland":0.12,"forest":0.18,"shrub":0.64,"orchard":0.02,"urban":0.04}},
}

HEIGHT_RANGES = {
    # 冠层特征高度 Hc（米），仅用于 rou2
    "farmland": (0.6, 1.6),
    "shrub":    (0.8, 3.0),
    "forest":   (8.0, 18.0),
    "orchard":  (3.0, 6.5),
    "urban":    (6.0, 12.0),  # 城郊绿化/行道树等
}

def draw_heights(key: str) -> float:
    lo, hi = HEIGHT_RANGES[key]
    return round(random.uniform(lo, hi), 2)

def generate_groups_for_dir(dir_path: Path, province: str, lt: float, total_pts: int) -> List[Tuple[int, float, List[Tuple[float,float]]]]:
    prof = PROV_PROFILE.get(province, {"weights":{"farmland":0.40,"forest":0.35,"shrub":0.15,"orchard":0.05,"urban":0.05}})
    weights = prof["weights"]
    keys = [k for k,w in weights.items() if w>0]
    # 分配点数
    alloc = {k: max(60, int(total_pts * weights.get(k, 0.0))) for k in keys}
    # 保证总数
    diff = total_pts - sum(alloc.values())
    # 微调到和为 total_pts
    if diff != 0:
        # 把差额加到权重最大的地类
        main_k = max(keys, key=lambda k: weights.get(k,0))
        alloc[main_k] += diff
    # 生成各组点
    groups = []
    # 组代号固定：1..5
    TYPE_CODE = {"farmland":1,"shrub":2,"forest":3,"orchard":4,"urban":5}
    for k in keys:
        n = alloc[k]
        if n <= 0: continue
        if k=="farmland":
            pts = gen_points_stripes(n, lt, bands=random.randint(5,9))
        elif k=="forest":
            pts = gen_points_ellipse(n, lt)
        elif k=="shrub":
            pts = gen_points_ring(n, lt)
        elif k=="orchard":
            pts = gen_points_grid_jitter(n, lt)
        else: # urban
            pts = gen_points_center_cluster(n, lt)
        Hc = draw_heights(k)
        groups.append((TYPE_CODE[k], Hc, pts))
    # 打乱组顺序，让文件“更像野外数据”
    random.shuffle(groups)
    return groups

def write_rou(file_path: Path, groups: List[Tuple[int,float,List[Tuple[float,float]]]], meta: Dict):
    fp = file_path.open("w", encoding="utf-8")
    # 头四行（仅展示，解析器会跳过）
    fp.write(f"# ROUGHNESS FIELD SPEC v1.2 | CRS: Local ENU (origin=domain center)\n")
    fp.write(f"# generator=China_RouSynth | province={meta.get('province','')} | city={meta.get('city','')} | county={meta.get('county','')}\n")
    fp.write(f"# units=meters | lt={meta.get('lt')} | total_groups={len(groups)} | total_points={sum(len(g[2]) for g in groups)}\n")
    fp.write(f"# lad_profile=Gaussian(z/Hc) | nh = rou2 * vege_times / scale | note=first 4 lines are ignored by solver\n")
    # 正文（纯数字）
    for (code, Hc, pts) in groups:
        fp.write(f"{code} {Hc} {len(pts)}\n")
        for (x,y) in pts:
            # 保留三位小数即可
            fp.write(f"{x:.3f} {y:.3f}\n")
    fp.close()

def is_leaf_dir(p: Path) -> bool:
    return any(p.iterdir()) and all(not child.is_dir() for child in p.iterdir() if child.name not in (".git",))

def walk_leaf_dirs(root: Path) -> List[Path]:
    leaves = []
    for dirpath, dirnames, filenames in os.walk(root):
        # 排除隐藏目录
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        p = Path(dirpath)
        # “叶子目录”：不含子目录（或仅含隐藏目录）
        if not any((p / d).is_dir() for d in dirnames):
            leaves.append(p)
    return leaves

def parse_admin_names(p: Path, root: Path) -> Tuple[str,str,str]:
    rel = p.relative_to(root)
    parts = rel.parts
    province, city, county = "", "", ""
    if len(parts) >= 1: province = parts[0]
    if len(parts) >= 2: city = parts[1]
    if len(parts) >= 3: county = parts[2]
    return province, city, county

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="中国行政区目录根，如 ./China_Dem")
    ap.add_argument("--lt", type=float, default=20000.0, help="点生成的参考域尺度（米），坐标范围约 [-lt/2, lt/2]")
    ap.add_argument("--seed", type=int, default=270927, help="随机种子（可复现实验）")
    ap.add_argument("--min-total", type=int, default=1800, help="每个 rou 文件的最小点数（总计）")
    ap.add_argument("--max-total", type=int, default=2600, help="每个 rou 文件的最大点数（总计）")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    leaves = walk_leaf_dirs(root)
    if not leaves:
        print("未发现叶子目录。请检查 --root 路径。")
        sys.exit(1)

    created = 0
    for leaf in leaves:
        province, city, county = parse_admin_names(leaf, root)
        # 目录级别种子，保证同一目录重复生成一致
        seed = stable_seed_from_path(leaf, args.seed)
        random.seed(seed)

        total_pts = random.randint(args.min_total, args.max_total)
        groups = generate_groups_for_dir(leaf, province, args.lt, total_pts)
        meta = {"province":province, "city":city, "county":county, "lt":args.lt}

        out_path = leaf / "rou"
        write_rou(out_path, groups, meta)
        created += 1

    print(f"已生成 rou 文件：{created} 个；根目录：{root}")

if __name__ == "__main__":
    main()
