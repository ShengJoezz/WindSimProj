# @Author: joe 847304926@qq.com
# @Date: 2025-07-17 16:43:36
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-17 16:52:59
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_1\visualize_lidar_wake_view.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@File    : visualize_lidar_ppi_smooth_natural_edge_2d_v2.py
@Time    : 2025-04-01 (Modified for Enhanced Realism and Targetting)
@Author  : Assistant based on user code
@Version : 9.0.11 (Iterate through subfolders, dynamic output naming, robust error handling)
@Description:
     使用风场模拟数据，生成特定高度的激光雷达扫描扇区风速云图 (2D)。
     脚本会遍历指定输入目录下的数字子文件夹，为每个子文件夹（工况）生成一张图。
     图片保存在输入目录下的 'wake_pic' 文件夹中，并根据风向和风速命名。
     命令行参数通过风机'name'属性指定雷达和目标风机。
     修改：图像上仅标注指定的几台风机(S3F13, S2F14, S2F15, S2F16)，
           并通过'name'属性(如S3F12)指定激光雷达。
           高亮显示目标风机(默认为S2F15)。
     修改：移除了尾流增强效果的调用。
"""

import os
import json
import math
import platform
import argparse
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from scipy.interpolate import RegularGridInterpolator
import warnings
import sys

# Optional dependency for more natural masking
try:
    from perlin_noise import PerlinNoise
    _PERLIN_AVAILABLE = True
except ImportError:
    _PERLIN_AVAILABLE = False
    print("Optional library 'perlin-noise' not found. Mask noise feature disabled.")
    print("Install using: pip install perlin-noise")


# --- 1. 复制并放置字体&风格函数 ---
def set_academic_font():
    """符合学术论文排版的中英文字体与默认参数"""
    import matplotlib.font_manager as fm
    chinese_candidates = ['SimSun', 'NSimSun', 'SimHei', 'Microsoft YaHei',
                          'Noto Sans CJK SC', 'WenQuanYi Micro Hei']
    installed = {f.name for f in fm.fontManager.ttflist}
    chinese_font = next((f for f in chinese_candidates if f in installed), 'DejaVu Sans')

    plt.rcParams.update({
        # 字体
        'font.family': ['serif', 'sans-serif'],
        'font.serif':  ['Times New Roman', 'DejaVu Serif'],
        'font.sans-serif': [chinese_font, 'Arial', 'DejaVu Sans'],
        # 字号
        'font.size': 11,
        'axes.labelsize': 12,
        'xtick.labelsize': 10,
        'ytick.labelsize': 10,
        'legend.fontsize': 10,
        # 其它
        'axes.unicode_minus': False,
        'mathtext.fontset': 'stix',
        'mathtext.default': 'regular'
    })


# --- Data Loading ---
def load_speed_data(binfile, meta):
    """Loads speed data from .bin file based on metadata."""
    size = meta.get("size")
    assert size and len(size) == 3, "output.json 'size' missing/invalid."
    w, h, l = map(int, size)
    assert os.path.exists(binfile), f"File not found: {binfile}"
    try:
        data = np.fromfile(binfile, dtype=np.float32)
        assert data.size == w * h * l, f"Data size mismatch: expected {w*h*l}, got {data.size}."
        return data.reshape((l, h, w)), w, h, l
    except Exception as e:
        raise IOError(f"Error reading or reshaping speed data from {binfile}: {e}")

# --- Argument Parsing ---
def parse_args():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="生成激光雷达视角尾流风速云图 (2D PPI), 可遍历处理子文件夹.")
    parser.add_argument("input_dir", type=str, help="包含数字子文件夹 (如 '1', '2') 的主数据文件夹路径. 每个子文件夹应包含 speed.bin, info.json, output.json.")
    parser.add_argument("--height", type=float, default=120.0, help="目标绘图高度 (米)，默认为 120.0")
    parser.add_argument("--lidar_turbine_id", type=str, default="S3F12", help="作为激光雷达位置的风机名称 (来自info.json中的'name'属性)")
    parser.add_argument("--target_turbine_id", type=str, default="S2F15", help="作为激光雷达扫描目标并高亮显示的风机名称 (来自info.json中的'name'属性, 可选)")
    parser.add_argument("--az_width", type=float, default=40.0, help="雷达扫描扇区宽度 (度), 默认为 40")
    parser.add_argument("--max_range", type=float, default=1500.0, help="雷达扫描最大有效距离 (米), 默认为 1500.0")
    parser.add_argument("--radial_res", type=int, default=150, help="径向网格点数 (用于插值)")
    parser.add_argument("--azimuthal_res", type=int, default=80, help="方位角网格点数 (用于插值)")
    parser.add_argument("--range_decay_rate", type=float, default=3.0, help="控制距离衰减速率 (越大衰减越快), default=3.0")
    parser.add_argument("--azimuth_decay_rate", type=float, default=4.0, help="控制方位角边缘衰减速率 (越大衰减越快), default=4.0")
    parser.add_argument("--near_range_pct", type=float, default=0.1, help="在此比例的最大距离内，衰减较慢, default=0.1")
    parser.add_argument("--add_mask_noise", action='store_true', help="向掩码概率添加Perlin噪声以获得更自然的边缘 (需安装 perlin-noise)")
    parser.add_argument("--mask_noise_octaves", type=int, default=6, help="Perlin噪声的倍频 (影响细节)")
    parser.add_argument("--mask_noise_scale", type=float, default=0.25, help="Perlin噪声强度 (占概率范围的比例)")
    parser.add_argument("--mask_noise_seed", type=int, default=42, help="Perlin噪声的随机种子")
    parser.add_argument("--contour_levels", type=int, default=25, help="填充等高线图的层级数，越多越平滑")
    parser.add_argument("--turbine_icon_path", type=str, default=None, help="风机图标文件路径 (e.g., 'turbine.png'). 如未提供或仅用于目标风机.")
    parser.add_argument("--icon_zoom", type=float, default=0.1, help="风机图标的缩放比例")
    parser.add_argument("--dpi", type=int, default=150, help="输出图像的 DPI")

    args = parser.parse_args()
    if args.add_mask_noise and not _PERLIN_AVAILABLE:
        warnings.warn("Perlin noise requested (--add_mask_noise) but 'perlin-noise' library not found. Disabling noise feature.")
        args.add_mask_noise = False
    return args

# 1. 径向距离衰减 - 改进版
def improved_range_decay(args, R_center_m):
    """Implements improved radial range decay for lidar signal probability."""
    near_threshold = args.max_range * 0.3
    prob_range = np.ones_like(R_center_m)
    far_mask = R_center_m > near_threshold
    if np.any(far_mask):
        normalized_dist = (R_center_m[far_mask] - near_threshold) / (args.max_range - near_threshold + 1e-9)
        prob_range[far_mask] = 1.0 - 0.7 * (normalized_dist ** 1.5)
    return np.clip(prob_range, 0.3, 1.0)

# 2. 方位角边界衰减 - 改进为非对称
def asymmetric_azimuth_decay(args, AZ_center_rad, center_azimuth_rad, az_half_width_rad):
    """Implements asymmetric azimuthal decay for lidar signal probability towards scan edges."""
    norm_az_dist = np.abs(AZ_center_rad - center_azimuth_rad) / (az_half_width_rad + 1e-9)
    left_side = AZ_center_rad < center_azimuth_rad
    right_side = ~left_side
    left_decay_rate = args.azimuth_decay_rate * 0.8
    right_decay_rate = args.azimuth_decay_rate * 1.2
    prob_az = np.ones_like(AZ_center_rad)
    if np.any(left_side):
        prob_az[left_side] = np.cos(np.clip(norm_az_dist[left_side], 0, 1) * np.pi/2)**(1.0/max(left_decay_rate, 0.1))
    if np.any(right_side):
        prob_az[right_side] = np.cos(np.clip(norm_az_dist[right_side], 0, 1) * np.pi/2)**(1.0/max(right_decay_rate, 0.1))
    return np.clip(prob_az, 0, 1)


# --- Visualization function for a single case ---
def run_visualization_for_case(current_case_dir, base_args, output_pic_dir_base):
    """
    Processes and visualizes data for a single case (subfolder).

    Args:
        current_case_dir (str): Path to the specific numbered subfolder for the current case.
        base_args (argparse.Namespace): Parsed command-line arguments.
        output_pic_dir_base (str): Path to the base 'wake_pic' directory.
    """
    print(f"  正在处理工况: {os.path.basename(current_case_dir)}")

    # --- Load info.json for this specific case ---
    info_file_path = os.path.join(current_case_dir, "info.json")
    if not os.path.exists(info_file_path):
        print(f"  警告: 在 {current_case_dir} 中未找到 info.json。跳过此工况。")
        return

    with open(info_file_path, 'r', encoding='utf-8') as f:
        case_info_data = json.load(f)

    case_global_wind_angle_deg = float(case_info_data.get("wind", {}).get("angle", np.nan))
    case_global_wind_speed_mps = float(case_info_data.get("wind", {}).get("speed", np.nan))

    # --- Generate dynamic output filename ---
    wind_angle_str = f"{case_global_wind_angle_deg:.0f}" if not np.isnan(case_global_wind_angle_deg) else "UnknownAngle"
    wind_speed_str = f"{case_global_wind_speed_mps:.1f}" if not np.isnan(case_global_wind_speed_mps) else "UnknownSpeed"
    safe_wind_angle_str = wind_angle_str.replace('.', '_')
    safe_wind_speed_str = wind_speed_str.replace('.', '_')
    case_name_part = os.path.basename(current_case_dir)

    output_filename_dynamic = f"Angle_{safe_wind_angle_str}_Speed_{safe_wind_speed_str}_Case_{case_name_part}.png"
    output_file_path_dynamic = os.path.join(output_pic_dir_base, output_filename_dynamic)

    # --- Load other data files for this case ---
    meta_file_path = os.path.join(current_case_dir, "output.json")
    if not os.path.exists(meta_file_path):
        print(f"  警告: 在 {current_case_dir} 中未找到 output.json。跳过此工况。")
        return
    with open(meta_file_path, 'r', encoding='utf-8') as f: meta = json.load(f)

    binfile_name = meta.get("file", "speed.bin")
    binfile_path = os.path.join(current_case_dir, binfile_name)
    if not os.path.exists(binfile_path):
        print(f"  警告: 在 {current_case_dir} 中未找到 {binfile_name}。跳过此工况。")
        return

    try:
        data, post_width, post_height, num_layers = load_speed_data(binfile_path, meta)
    except Exception as e:
        print(f"  错误: 加载 {binfile_name} 从 {current_case_dir} 失败: {e}。跳过此工况。")
        return
    print(f"    已加载速度数据: {num_layers} 层, {post_width}x{post_height} 网格.")

    turbines_from_info_case = case_info_data.get("turbines", [])
    if not turbines_from_info_case:
        print(f"  警告: {current_case_dir} 的 info.json 中未找到风机信息。跳过此工况。")
        return

    domain_size_meters = float(case_info_data.get("domain", {}).get("lt", 10000.0))
    print(f"    风机数量: {len(turbines_from_info_case)}, 域尺寸 Lt={domain_size_meters}m")

    # --- Lidar and Target Turbine identification using 'name' (from base_args) ---
    lidar_turbine_obj = next((t for t in turbines_from_info_case if t.get("name") == base_args.lidar_turbine_id), None)
    if lidar_turbine_obj is None:
        print(f"  警告: 在工况 {case_name_part} 中未找到激光雷达风机名称 '{base_args.lidar_turbine_id}'. 跳过此工况。")
        return

    lidar_x_m = lidar_turbine_obj.get("x", 0.0)
    lidar_y_m = lidar_turbine_obj.get("y", 0.0)
    print(f"    激光雷达位于风机 (名称: {base_args.lidar_turbine_id}): ({lidar_x_m:.1f}, {lidar_y_m:.1f}) 米.")

    # Determine scan direction
    all_other_turbines_for_scan_fallback_case = [t for t in turbines_from_info_case if t.get("name") != base_args.lidar_turbine_id]
    actual_target_turbine_for_scan_direction = None
    target_x_m_scan, target_y_m_scan = None, None

    if base_args.target_turbine_id:
        specified_target_turbine_obj_scan = next((t for t in turbines_from_info_case if t.get("name") == base_args.target_turbine_id), None)
        if specified_target_turbine_obj_scan:
            if specified_target_turbine_obj_scan.get("name") == base_args.lidar_turbine_id:
                print(f"    警告: 目标风机名称 '{base_args.target_turbine_id}' 与激光雷达风机名称相同。")
                if all_other_turbines_for_scan_fallback_case:
                    actual_target_turbine_for_scan_direction = all_other_turbines_for_scan_fallback_case[0]
            else:
                actual_target_turbine_for_scan_direction = specified_target_turbine_obj_scan
        elif all_other_turbines_for_scan_fallback_case:
             print(f"    警告: 未找到指定的目标风机名称 '{base_args.target_turbine_id}' 用于扫描/高亮。")
             actual_target_turbine_for_scan_direction = all_other_turbines_for_scan_fallback_case[0]
    elif all_other_turbines_for_scan_fallback_case:
        actual_target_turbine_for_scan_direction = all_other_turbines_for_scan_fallback_case[0]

    if actual_target_turbine_for_scan_direction:
        target_x_m_scan = actual_target_turbine_for_scan_direction.get("x")
        target_y_m_scan = actual_target_turbine_for_scan_direction.get("y")
        if target_x_m_scan is None or target_y_m_scan is None:
            print(f"    警告: 用于扫描方向的风机 {actual_target_turbine_for_scan_direction.get('name', '未知')} 缺少坐标。")
            target_x_m_scan, target_y_m_scan = None, None

    if target_x_m_scan is None or target_y_m_scan is None:
        target_x_m_scan = lidar_x_m + 1000.0
        target_y_m_scan = lidar_y_m
        print("    扫描将默认朝向东方。")
        actual_target_turbine_for_scan_direction = None

    vec_x = target_x_m_scan - lidar_x_m
    vec_y = target_y_m_scan - lidar_y_m
    if abs(vec_x) < 1e-6 and abs(vec_y) < 1e-6:
        vec_x = 1000.0; vec_y = 0.0

    center_azimuth_rad = np.arctan2(vec_y, vec_x)

    # --- Interpolation Grid & Interpolation ---
    az_half_width_rad = np.radians(base_args.az_width / 2.0)
    az_min_rad = center_azimuth_rad - az_half_width_rad
    az_max_rad = center_azimuth_rad + az_half_width_rad

    x_sim_m = np.linspace(-domain_size_meters / 2, domain_size_meters / 2, post_width)
    y_sim_m = np.linspace(-domain_size_meters / 2, domain_size_meters / 2, post_height)
    dh = float(meta.get("dh", 10.0))
    H_levels = np.arange(1, num_layers + 1) * dh

    try:
        f_interp = RegularGridInterpolator(
            (H_levels, y_sim_m, x_sim_m), data,
            method='linear', bounds_error=False, fill_value=np.nan
        )
    except ValueError as e:
        print(f"    创建插值器时出错 for case {case_name_part}: {e}. 跳过此工况。")
        return

    target_height = base_args.height
    radial_centers_m = np.linspace(0, base_args.max_range, base_args.radial_res)
    azimuth_centers_rad = np.linspace(az_min_rad, az_max_rad, base_args.azimuthal_res)
    R_center_m, AZ_center_rad = np.meshgrid(radial_centers_m, azimuth_centers_rad)

    X_rel_center_m = R_center_m * np.cos(AZ_center_rad)
    Y_rel_center_m = R_center_m * np.sin(AZ_center_rad)
    X_abs_center_m = lidar_x_m + X_rel_center_m
    Y_abs_center_m = lidar_y_m + Y_rel_center_m
    Z_abs_center_m = np.full_like(X_abs_center_m, target_height)

    points_to_interp = np.column_stack((Z_abs_center_m.ravel(), Y_abs_center_m.ravel(), X_abs_center_m.ravel()))
    interpolated_speeds = f_interp(points_to_interp)
    speed_grid = interpolated_speeds.reshape(AZ_center_rad.shape)

    # --- Masking ---
    prob_keep = np.ones_like(speed_grid)
    prob_range = improved_range_decay(base_args, R_center_m)
    prob_keep *= prob_range
    prob_az = asymmetric_azimuth_decay(base_args, AZ_center_rad, center_azimuth_rad, az_half_width_rad)
    prob_keep *= prob_az

    if base_args.add_mask_noise and _PERLIN_AVAILABLE:
        noise_gen = PerlinNoise(octaves=base_args.mask_noise_octaves, seed=base_args.mask_noise_seed)
        naz, nr = prob_keep.shape
        perlin_map = np.array([[noise_gen([i/naz, j/nr]) for j in range(nr)] for i in range(naz)])
        prob_noise = perlin_map * base_args.mask_noise_scale
        prob_keep += prob_noise
        prob_keep = np.clip(prob_keep, 0, 1)

    final_mask = (np.random.rand(*prob_keep.shape) < prob_keep)
    nan_mask = np.isnan(speed_grid)
    final_mask = final_mask & (~nan_mask)
    speed_grid_masked = np.where(final_mask, speed_grid, np.nan)
    num_valid_cells = final_mask.sum()

    if num_valid_cells == 0:
        print(f"    警告: 工况 {case_name_part} 没有有效的单元格可绘制。不生成图片。")
        return

    # --- 设置图形样式 ---
    def set_academic_style(ax):
        """去除右/上脊，细网格，白底"""
        ax.set_facecolor('white')
        ax.grid(True, linestyle=':', linewidth=0.6, alpha=0.4, color='#666666')
        ax.set_axisbelow(True)
        # 去掉 top/right
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        for k in ['left', 'bottom']:
            ax.spines[k].set_linewidth(1)
            ax.spines[k].set_color('black')
        ax.tick_params(axis='both', direction='out', width=1, length=4, colors='black')

    # --- Plotting ---
    fig, ax = plt.subplots(figsize=(10, 8.0))
    set_academic_style(ax)

    vmin_data = np.nanmin(speed_grid_masked)
    vmax_data = np.nanmax(speed_grid_masked)
    case_vmin, case_vmax = meta.get("range", [min(0, vmin_data), vmax_data])

    # 使用jet colormap以匹配参考图
    cmap = plt.get_cmap('jet')
    norm = Normalize(vmin=case_vmin, vmax=case_vmax)

    contour_levels_arr = np.linspace(case_vmin, case_vmax, base_args.contour_levels)
    cont = ax.contourf(X_rel_center_m, Y_rel_center_m, speed_grid_masked,
                       levels=contour_levels_arr, cmap=cmap, norm=norm, extend='both')

    # 创建与参考图相似的color bar
    cbar = fig.colorbar(cont, ax=ax, shrink=0.8, aspect=20, pad=0.05)
    cbar.set_label('speed(m/s)', fontsize=12, labelpad=15)
    cbar.ax.tick_params(labelsize=10)
    
    # 设置color bar的刻度样式
    cbar.ax.yaxis.set_tick_params(width=1, length=4, direction='out')
    cbar.outline.set_linewidth(1)

    # 标记激光雷达位置
    ax.plot(0, 0, '^', color='black', markersize=10, label=f"激光雷达 ({base_args.lidar_turbine_id})", 
            zorder=10, mec='white', mew=0.5)

    # 加载风机图标（如果提供）
    turbine_icon_loaded = None
    if base_args.turbine_icon_path:
        icon_path_abs = os.path.abspath(base_args.turbine_icon_path)
        icon_path_rel_base_input = os.path.join(os.path.dirname(base_args.input_dir), base_args.turbine_icon_path)

        actual_icon_path = None
        if os.path.exists(icon_path_abs): 
            actual_icon_path = icon_path_abs
        elif os.path.exists(icon_path_rel_base_input): 
            actual_icon_path = icon_path_rel_base_input

        if actual_icon_path:
            try: 
                turbine_icon_loaded = plt.imread(actual_icon_path)
            except Exception: 
                turbine_icon_loaded = None

    # 显示指定的风机
    other_turbines_to_display_custom_names = ["S3F12"]
    for turbine_data in turbines_from_info_case:
        current_turbine_name = turbine_data.get("name")
        if current_turbine_name in other_turbines_to_display_custom_names:
            if current_turbine_name == base_args.lidar_turbine_id: 
                continue

            t_x_abs = turbine_data.get("x")
            t_y_abs = turbine_data.get("y")
            if t_x_abs is not None and t_y_abs is not None:
                t_rel_x = t_x_abs - lidar_x_m
                t_rel_y = t_y_abs - lidar_y_m
                is_highlighted_target = (base_args.target_turbine_id == current_turbine_name)

                marker_char='o'
                p_color='gray'
                p_size=7
                p_zorder=3
                legend_label=None
                
                if is_highlighted_target:
                    marker_char='P'
                    p_color='red'
                    p_size=12
                    p_zorder=5
                    legend_label = f"目标风机 ({current_turbine_name})"

                if turbine_icon_loaded and is_highlighted_target:
                    ab = AnnotationBbox(OffsetImage(turbine_icon_loaded, zoom=base_args.icon_zoom), 
                                      (t_rel_x, t_rel_y), frameon=False, pad=0, zorder=p_zorder)
                    ax.add_artist(ab)
                    if legend_label: 
                        ax.plot([], [], marker='P', color=p_color, markersize=10, 
                               linestyle='None', label=legend_label)
                else:
                    ax.plot(t_rel_x, t_rel_y, marker=marker_char, color=p_color, markersize=p_size,
                           mec='black', mew=0.5, label=legend_label, linestyle='None', zorder=p_zorder)
                
                # 添加风机标签
                ax.text(t_rel_x+20, t_rel_y+20, current_turbine_name, fontsize=7, color='black', 
                       zorder=p_zorder+1, ha='left', va='bottom',
                       bbox=dict(boxstyle='round,pad=0.2', fc='white', alpha=0.5, ec='none'))

    # 设置轴标签（与参考图一致）
    ax.set_xlabel('Zonal direction (m)', fontsize=12)
    ax.set_ylabel('Meridional direction (m)', fontsize=12)
    ax.set_aspect('equal', adjustable='box')

    # 设置轴范围
    all_x = [0]
    all_y = [0]
    if num_valid_cells > 0:
        all_x.extend(X_rel_center_m[final_mask])
        all_y.extend(Y_rel_center_m[final_mask])
    
    for td in turbines_from_info_case:
        if td.get("name") in other_turbines_to_display_custom_names and td.get("name") != base_args.lidar_turbine_id:
            if td.get("x") is not None and td.get("y") is not None:
                all_x.append(td["x"] - lidar_x_m)
                all_y.append(td["y"] - lidar_y_m)

    min_x = np.min(all_x) if all_x else -base_args.max_range * 0.1
    max_x = np.max(all_x) if all_x else base_args.max_range * 1.1
    min_y = np.min(all_y) if all_y else -base_args.max_range * 0.6
    max_y = np.max(all_y) if all_y else base_args.max_range * 0.6
    
    pad_x = (max_x - min_x) * 0.1 + 100
    pad_y = (max_y - min_y) * 0.1 + 100
    
    ax.set_xlim(min_x - pad_x, max_x + pad_x)
    ax.set_ylim(min_y - pad_y, max_y + pad_y)

    plt.tight_layout()
    plt.savefig(output_file_path_dynamic, dpi=base_args.dpi, bbox_inches='tight')
    print(f"    图片已保存为: {output_file_path_dynamic}")
    plt.close(fig)


# --- Main execution block ---
if __name__ == "__main__":
    warnings.filterwarnings("ignore", category=UserWarning, module='matplotlib')
    warnings.filterwarnings("ignore", category=RuntimeWarning)

    parsed_args = parse_args()
    set_academic_font()

    base_input_dir = os.path.abspath(parsed_args.input_dir)
    if not os.path.isdir(base_input_dir):
        print(f"错误: 基准输入文件夹无效: {base_input_dir}", file=sys.stderr)
        sys.exit(1)
    print(f"使用基准输入文件夹: {base_input_dir}")

    output_pic_main_dir = os.path.join(base_input_dir, "wake_pic")
    os.makedirs(output_pic_main_dir, exist_ok=True)
    print(f"图片将保存在: {output_pic_main_dir}")

    processed_cases_count = 0
    for item_name in os.listdir(base_input_dir):
        item_path = os.path.join(base_input_dir, item_name)
        if os.path.isdir(item_path) and item_name.isdigit():
            current_case_processing_dir = item_path
            try:
                run_visualization_for_case(current_case_processing_dir, parsed_args, output_pic_main_dir)
                processed_cases_count += 1
            except Exception as e_case:
                print(f"处理文件夹 {current_case_processing_dir} 时发生严重错误: {e_case}", file=sys.stderr)
                import traceback
                traceback.print_exc()
                print(f"--- 跳过文件夹: {current_case_processing_dir} ---")
                plt.close('all')
                continue

    if processed_cases_count == 0:
        print("\n未在基准输入文件夹中找到或成功处理任何有效的数字子文件夹。")
    else:
        print(f"\n--- 所有有效工况处理完毕. 共处理 {processed_cases_count} 个工况. ---")