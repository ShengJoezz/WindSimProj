# @Author: joe 847304926@qq.com
# @Date: 2025-10-11 18:21:31
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-10-11 18:21:36
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils_full\batch_plot_wind_profiles.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

# @Author: joe 847304926@qq.com
# @Date: 2025-07-16 19:52:45
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-10-11 18:21:36
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\plot_profiles.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import numpy as np
from scipy.interpolate import RegularGridInterpolator, make_interp_spline
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import traceback

# ------------------------------------------------------------------
# ======================== 用户配置区域 ===========================
# ------------------------------------------------------------------

# 1. 设置包含所有案例的父文件夹的相对路径
BASE_CASES_PATH = "../batch_2/atmospheric_run_20250627_230932/cases"

# 2. 设置输出图表要存放的文件夹名称
OUTPUT_PLOTS_DIR_NAME = "generated_plots"

# 3. 设置通用的绘图参数
PLOT_CONFIG = {
    "locations_x_d": [3.0, 5.0, 7.0],
    "D": 87.0,  # 桨叶直径 (米)
    "H": 75.0,   # 轮毂高度 (米)
    "profile_scale_factor": 5.0,
    "reference_wind_speed": None, 
    "y_location_m": 0.0,
    "discrete_point_spacing": 0.25,
    "discrete_points_vertical_start_offset": 0.2,
    "second_curve_deviation_factor": 0.7,
}

# ------------------------------------------------------------------
# ======================= 以下为脚本代码 ==========================
# ------------------------------------------------------------------

def load_speed_data(binfile, meta):
    """读取 speed.bin 并 reshape 成 (layers, Ny, Nx)"""
    size = meta.get("size")
    if not size or len(size) != 3: raise ValueError("'size' must be [width,height,layers]")
    post_width, post_height, num_layers = map(int, size)
    expected = post_width * post_height * num_layers
    data = np.fromfile(binfile, dtype=np.float32)
    if data.size != expected: raise ValueError(f"binary size mismatch: expect {expected}, got {data.size}")
    data = data.reshape((num_layers, post_height, post_width)).astype(np.float32)
    data[np.isinf(data)] = np.nan
    return data, post_width, post_height, num_layers


def plot_single_case_profile(case_dir, config, output_dir):
    """(工作函数) 为单个案例绘制图表并保存到指定目录"""
    case_name = os.path.basename(case_dir)
    
    # --- 1. 设置全局绘图风格 ---
    plt.rcParams.update({
        'font.family': 'serif', 'mathtext.fontset': 'cm', 'font.size': 14,
        'axes.linewidth': 1.0, 'xtick.direction': 'in', 'ytick.direction': 'in',
        'xtick.major.width': 1.0, 'ytick.major.width': 1.0,
    })

    # --- 2. 加载数据和插值器 ---
    meta_path = os.path.join(case_dir, "output.json")
    info_path = os.path.join(case_dir, "info.json")
    binfile_path = os.path.join(case_dir, "speed.bin")
    with open(meta_path, "r", encoding="utf-8") as f: meta = json.load(f)
    with open(info_path, "r", encoding="utf-8") as f: info = json.load(f)
    data, Nx, Ny, Nz = load_speed_data(binfile_path, meta)
    lt = info.get("domain", {}).get("lt", 10000); dh = float(meta.get("dh", 10))
    x_coords = np.linspace(-lt/2, lt/2, Nx); y_coords = np.linspace(-lt/2, lt/2, Ny)
    H_levels = np.arange(1, Nz + 1) * dh
    f_interp = RegularGridInterpolator((H_levels, y_coords, x_coords), data, method="linear", bounds_error=False, fill_value=np.nan)
    
    # --- 3. 准备绘图和计算 ---
    fig, ax = plt.subplots(figsize=(10, 7))
    D, H, y_loc = config["D"], config["H"], config["y_location_m"]
    ref_speed = config.get("reference_wind_speed") or info.get("wind", {}).get("speed", 10.0)
    z_eval_m = np.linspace(H_levels.min(), H_levels.max(), 200)
    z_plot = (z_eval_m - H) / H
    vertical_offsets = { 7.0: 0.1, 5.0: 0.0, 3.0: 0.2 }

    profiles_data, terrain_anchor_points, discrete_points_data = [], {}, []
    
    # --- 阶段一: 计算所有数据 ---
    for x_d in sorted(config["locations_x_d"]):
        v_offset = vertical_offsets.get(x_d, 0.0)
        z_plot_shifted = z_plot + v_offset
        
        # 使用 np.full_like 来创建与 z_eval_m 等长的 x 坐标数组
        x_m = x_d * D
        interp_points = np.column_stack([z_eval_m, np.full_like(z_eval_m, y_loc), np.full_like(z_eval_m, x_m)])
        
        speeds = f_interp(interp_points); speeds[np.isnan(speeds)] = 0
        normalized_speeds = speeds / ref_speed
        red_speed_deviation = normalized_speeds - 1.0
        x_plot_red = x_d + red_speed_deviation * config["profile_scale_factor"]
        green_speed_deviation = red_speed_deviation * config["second_curve_deviation_factor"]
        x_plot_green = x_d + green_speed_deviation * config["profile_scale_factor"]
        profiles_data.append({'x_red': x_plot_red, 'x_green': x_plot_green, 'z_shifted': z_plot_shifted})
        min_y_index = np.argmin(z_plot_shifted)
        terrain_anchor_points[x_d] = (x_plot_red[min_y_index], z_plot_shifted[min_y_index])
        start_y_for_dots = z_plot_shifted.min() + config["discrete_points_vertical_start_offset"]
        if start_y_for_dots < z_plot_shifted.max():
            target_y_levels = np.arange(start_y_for_dots, z_plot_shifted.max(), config["discrete_point_spacing"])
            perfect_x_points = np.interp(target_y_levels, z_plot_shifted, x_plot_red)
            perfect_deviation = (perfect_x_points - x_d) / config["profile_scale_factor"]
            noise_factor = 1.0 + np.random.uniform(-0.15, 0.15, size=len(perfect_deviation))
            noisy_x_points = x_d + (perfect_deviation * noise_factor) * config["profile_scale_factor"]
            discrete_points_data.append({'x': noisy_x_points, 'y': target_y_levels})

    # --- 阶段二: 绘制 ---
    anchor_3d, anchor_5d, anchor_7d = terrain_anchor_points[3.0], terrain_anchor_points[5.0], terrain_anchor_points[7.0]

    # 1. 首先，将核心锚点放入一个列表中
    control_points = [anchor_3d, anchor_5d, anchor_7d]
    
    # 2. 定义曲线的延伸范围
    start_x = min(config['locations_x_d']) - 2.0
    end_x = max(config['locations_x_d']) + 2.0
    
    # 3. 在列表的开头和末尾插入点，以控制曲线的边界行为
    control_points.insert(0, (start_x, anchor_3d[1]))
    control_points.append((end_x, anchor_7d[1]))

    # ==================== 关键修复 ====================
    # 根据每个点的 x 坐标 (p[0]) 对列表进行排序，确保 x 序列是严格递增的
    control_points.sort(key=lambda p: p[0])
    # ====================================================

    # 4. 提取 x 和 y 坐标
    control_x, control_y = np.array([p[0] for p in control_points]), np.array([p[1] for p in control_points])
    
    # 5. 增加一个检查，防止因点太少而无法插值
    if len(control_x) < 4: # 三次样条至少需要4个点
        print(f"⚠️  警告: 案例 {case_name} 的有效控制点不足，无法生成地形样条曲线。")
    else:
        # 使用三次样条 (k=3) 进行平滑插值
        spline = make_interp_spline(control_x, control_y, k=3)
        # 生成更密集的点用于绘图，确保范围覆盖所有控制点
        terrain_x_smooth = np.linspace(control_x.min(), control_x.max(), 400)
        terrain_y_smooth = spline(terrain_x_smooth)
        ax.plot(terrain_x_smooth, terrain_y_smooth, color='k', linewidth=1.0, zorder=5)
        ax.fill_between(terrain_x_smooth, terrain_y_smooth, -10, color='lightgreen', alpha=0.8, zorder=4)

    # 绘制其他图形元素
    for i, profile in enumerate(profiles_data):
        ax.plot(profile['x_green'], profile['z_shifted'], color='g', linewidth=1.2, zorder=9)
        ax.plot(profile['x_red'], profile['z_shifted'], color='r', linewidth=1.2, zorder=10)
        x_d = sorted(config["locations_x_d"])[i]
        ax.axvline(x=x_d, color='k', linestyle='-.', linewidth=1.0, zorder=6)
    for points in discrete_points_data:
        ax.scatter(points['x'], points['y'], color='blue', s=20, zorder=12, edgecolor='white', linewidth=0.5)

    # --- 5. 美化和最终调整 ---
    ax.set_xlabel('$x/D$'); ax.set_ylabel('$z/H$')
    x_locs = config['locations_x_d']
    ax.set_xlim(left=min(x_locs) - 2.0, right=max(x_locs) + 2.0)
    max_y_values = [p['z_shifted'].max() for p in profiles_data]
    min_y_values = [p['z_shifted'].min() for p in profiles_data]
    
    # 修正 ylim 的 bottom 值，以确保地形完全可见
    # 如果地形曲线成功生成，则考虑其最低点
    bottom_y_limit = min(min_y_values)
    if 'terrain_y_smooth' in locals():
        bottom_y_limit = min(bottom_y_limit, terrain_y_smooth.min())
    ax.set_ylim(bottom=bottom_y_limit, top=max(max_y_values))
    
    ax.axhline(y=0.0, color='k', linestyle=':', linewidth=1.0)

    legend_elements = [
        Line2D([0], [0], color='r', lw=1.5, label='$F_{RD}$'),
        Line2D([0], [0], color='g', lw=1.5, label='$F_{WT}$'),
        Line2D([0], [0], marker='o', color='blue', label='$F_{measure}$', ls='None', ms=5, mec='w', mew=0.5)
    ]
    ax.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, 1.08), ncol=3, frameon=False, fontsize=12)
    
    output_filename = f"Profile_Plot_{case_name}.png"
    output_path = os.path.join(output_dir, output_filename)
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close(fig)

def batch_process_all_cases(base_cases_dir, output_dir_name, config):
    """(主控函数) 批量处理指定目录下的所有案例文件夹"""
    output_plots_dir = os.path.join(base_cases_dir, output_dir_name)
    print(f"所有生成的图表将被保存在: {output_plots_dir}")
    os.makedirs(output_plots_dir, exist_ok=True)
    try:
        sub_dirs = [d.path for d in os.scandir(base_cases_dir) if d.is_dir() and d.name != output_dir_name]
    except FileNotFoundError:
        print(f"❌ 错误: 找不到案例目录: {base_cases_dir}")
        return
    if not sub_dirs:
        print("⚠️ 警告: 在指定目录下没有找到任何案例文件夹。")
        return
    print(f"找到 {len(sub_dirs)} 个案例文件夹进行处理。")
    
    for i, case_path in enumerate(sub_dirs):
        case_name = os.path.basename(case_path)
        print("-" * 70)
        print(f"[{i+1}/{len(sub_dirs)}] 正在处理案例: {case_name}")
        try:
            plot_single_case_profile(case_path, config, output_plots_dir)
            print(f"✅ 成功处理案例: {case_name}")
        except Exception as e:
            print(f"❌❌❌ 处理案例 {case_name} 时发生严重错误: {e}")
            traceback.print_exc()
            print(f">>>>>> 跳过此案例，继续处理下一个... <<<<<<")
    
    print("-" * 70)
    print("🎉 所有案例处理完毕！")


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    absolute_cases_path = os.path.abspath(os.path.join(script_dir, BASE_CASES_PATH))
    batch_process_all_cases(absolute_cases_path, OUTPUT_PLOTS_DIR_NAME, PLOT_CONFIG)