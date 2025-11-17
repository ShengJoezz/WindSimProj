# @Author: joe 847304926@qq.com
# @Date: 2025-05-26 20:10:50
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-06-03 15:53:16
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\visualize_atmospheric_radar.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大气边界层雷达扫描可视化脚本
专门用于显示雷达对大气边界层的扫描结果
参考激光雷达PPI扫描逻辑，添加真实的衰减效果
"""

import os
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from scipy.interpolate import RegularGridInterpolator
import argparse
import sys

# Optional dependency for more natural masking
try:
    from perlin_noise import PerlinNoise
    _PERLIN_AVAILABLE = True
except ImportError:
    _PERLIN_AVAILABLE = False

def set_font():
    """设置中文字体"""
    import platform
    system = platform.system()
    try:
        if system == 'Windows':
            plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei']
        elif system == 'Darwin':
            plt.rcParams['font.sans-serif'] = ['PingFang SC', 'Heiti TC']
        elif system == 'Linux':
            plt.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'Noto Sans CJK SC']
        plt.rcParams['axes.unicode_minus'] = False
    except Exception as e:
        print(f"Font setting error: {e}")

def load_speed_data(binfile, meta):
    """加载风速数据"""
    size = meta.get("size")
    w, h, l = map(int, size)
    data = np.fromfile(binfile, dtype=np.float32).reshape((l, h, w))
    data[np.isinf(data)] = np.nan
    return data, w, h, l

def improved_range_decay(max_range, R_center_m):
    """改进的径向距离衰减"""
    near_threshold = max_range * 0.3 
    prob_range = np.ones_like(R_center_m) 
    far_mask = R_center_m > near_threshold
    if np.any(far_mask):
        normalized_dist = (R_center_m[far_mask] - near_threshold) / (max_range - near_threshold + 1e-9) 
        prob_range[far_mask] = 1.0 - 0.7 * (normalized_dist ** 1.5)
    return np.clip(prob_range, 0.3, 1.0)

def asymmetric_azimuth_decay(AZ_center_rad, center_azimuth_rad, az_half_width_rad, azimuth_decay_rate=4.0):
    """非对称方位角边界衰减"""
    norm_az_dist = np.abs(AZ_center_rad - center_azimuth_rad) / (az_half_width_rad + 1e-9) 
    left_side = AZ_center_rad < center_azimuth_rad
    right_side = ~left_side
    left_decay_rate = azimuth_decay_rate * 0.8 
    right_decay_rate = azimuth_decay_rate * 1.2
    prob_az = np.ones_like(AZ_center_rad)
    if np.any(left_side):
        prob_az[left_side] = np.cos(np.clip(norm_az_dist[left_side], 0, 1) * np.pi/2)**(1.0/max(left_decay_rate, 0.1))
    if np.any(right_side):
        prob_az[right_side] = np.cos(np.clip(norm_az_dist[right_side], 0, 1) * np.pi/2)**(1.0/max(right_decay_rate, 0.1))
    return np.clip(prob_az, 0, 1)

def create_atmospheric_radar_visualization(case_dir, height, radar_config, output_file):
    """创建大气边界层雷达扫描可视化"""
    
    # 加载数据
    meta_path = os.path.join(case_dir, 'output.json')
    info_path = os.path.join(case_dir, 'info.json')
    
    with open(meta_path, 'r') as f:
        meta = json.load(f)
    with open(info_path, 'r') as f:
        info_data = json.load(f)
    
    # 基本参数
    wind_angle = info_data.get("wind", {}).get("angle", 0)
    wind_speed = info_data.get("wind", {}).get("speed", 10)
    domain_size = info_data.get("domain", {}).get("lt", 6500)
    scale_factor = info_data.get("mesh", {}).get("scale", 0.001)
    
    # 固定雷达位置（原S2F18风机位置）
    radar_x = 253.805 * scale_factor  # 转换为km
    radar_y = 185.325 * scale_factor
    
    # 加载风速数据
    binfile = os.path.join(case_dir, meta.get("file", "speed.bin"))
    data, post_width, post_height, num_layers = load_speed_data(binfile, meta)
    
    # 设置坐标系
    domain_size_km = domain_size * scale_factor
    x_coords_km = np.linspace(-domain_size_km/2, domain_size_km/2, post_width)
    y_coords_km = np.linspace(-domain_size_km/2, domain_size_km/2, post_height)
    dh = float(meta.get("dh", 20))
    H_levels_m = np.arange(1, num_layers + 1) * dh
    
    # 创建插值器
    f_interp = RegularGridInterpolator(
        (H_levels_m, y_coords_km, x_coords_km), data,
        method='linear', bounds_error=False, fill_value=np.nan
    )
    
    # 雷达扫描参数
    max_range = radar_config.get('max_range', 1500.0)
    az_width = radar_config.get('az_width', 40.0)
    
    # 扫描方向：正东偏北8度
    scan_azimuth_deg = 8.0  # 正东偏北8度
    scan_azimuth_rad = np.deg2rad(scan_azimuth_deg)
    az_half_width_rad = np.deg2rad(az_width / 2.0)
    az_min_rad = scan_azimuth_rad - az_half_width_rad
    az_max_rad = scan_azimuth_rad + az_half_width_rad
    
    # 生成扫描网格
    radial_res = radar_config.get('radial_res', 150)
    azimuthal_res = radar_config.get('azimuthal_res', 80)
    
    radial_centers_m = np.linspace(0, max_range, radial_res)
    azimuth_centers_rad = np.linspace(az_min_rad, az_max_rad, azimuthal_res)
    R_center_m, AZ_center_rad = np.meshgrid(radial_centers_m, azimuth_centers_rad)
    
    # 计算绝对坐标
    X_rel_center_m = R_center_m * np.cos(AZ_center_rad)
    Y_rel_center_m = R_center_m * np.sin(AZ_center_rad)
    X_abs_center_m = (radar_x * 1000) + X_rel_center_m  # 转换为米
    Y_abs_center_m = (radar_y * 1000) + Y_rel_center_m
    Z_abs_center_m = np.full_like(X_abs_center_m, height)
    
    # 转换回km用于插值
    X_abs_center_km = X_abs_center_m / 1000
    Y_abs_center_km = Y_abs_center_m / 1000
    
    # 执行插值
    points_to_interp = np.column_stack((Z_abs_center_m.ravel(), Y_abs_center_km.ravel(), X_abs_center_km.ravel()))
    interpolated_speeds = f_interp(points_to_interp)
    speed_grid = interpolated_speeds.reshape(AZ_center_rad.shape)
    
    # 应用改进的衰减掩码
    prob_keep = np.ones_like(speed_grid)
    
    # 1. 径向距离衰减
    prob_range = improved_range_decay(max_range, R_center_m)
    prob_keep *= prob_range
    
    # 2. 方位角边界衰减
    prob_az = asymmetric_azimuth_decay(AZ_center_rad, scan_azimuth_rad, az_half_width_rad)
    prob_keep *= prob_az
    
    # 3. 可选的Perlin噪声
    add_mask_noise = radar_config.get('add_mask_noise', False)
    if add_mask_noise and _PERLIN_AVAILABLE:
        noise_gen = PerlinNoise(octaves=6, seed=42)
        naz, nr = prob_keep.shape
        perlin_map = np.array([[noise_gen([i/naz, j/nr]) for j in range(nr)] for i in range(naz)])
        prob_noise = perlin_map * 0.25
        prob_keep += prob_noise
        prob_keep = np.clip(prob_keep, 0, 1)
    
    # 应用最终掩码
    final_mask = (np.random.rand(*prob_keep.shape) < prob_keep) & (~np.isnan(speed_grid))
    speed_grid_masked = np.where(final_mask, speed_grid, np.nan)
    
    # 绘图
    fig, ax = plt.subplots(figsize=(12, 9))
    ax.set_facecolor('#FFFFFF')
    
    # 设置颜色范围
    vmin, vmax = meta.get("range", [0, wind_speed * 1.5])
    norm = Normalize(vmin=vmin, vmax=vmax)
    
    # 绘制风速云图
    contour_levels = np.linspace(vmin, vmax, 25)
    cont = ax.contourf(X_rel_center_m, Y_rel_center_m, speed_grid_masked,
                       levels=contour_levels, cmap='jet', norm=norm, extend='both')
    
    # 颜色条
    cbar = fig.colorbar(cont, ax=ax)
    cbar.set_label(f'风速 (m/s) @ {height:.0f}m 高度', fontsize=11)
    
    # 雷达位置
    ax.plot(0, 0, '^', color='black', markersize=12, label="大气测量雷达 (S2F18)", zorder=10, mec='white', mew=1)
    
    # 标记测量点 (3D, 5D, 8D)
    measurement_distances = [3, 5, 8]
    reference_diameter = 87.0
    colors = ['red', 'orange', 'purple']
    
    for i, distance_D in enumerate(measurement_distances):
        distance_m = distance_D * reference_diameter
        if distance_m <= max_range:
            meas_x = distance_m * np.cos(scan_azimuth_rad)
            meas_y = distance_m * np.sin(scan_azimuth_rad)
            ax.plot(meas_x, meas_y, 'o', color=colors[i], markersize=10, 
                   label=f"测量点 {distance_D}D ({distance_m:.0f}m)", 
                   zorder=8, mec='black', mew=1)
    
    # 绘制扫描扇区边界
    edge_range = np.linspace(0, max_range * 0.8, 100)
    
    # 左边界
    edge_x_left = edge_range * np.cos(az_min_rad)
    edge_y_left = edge_range * np.sin(az_min_rad)
    ax.plot(edge_x_left, edge_y_left, '--', color='gray', alpha=0.6, linewidth=1)
    
    # 右边界
    edge_x_right = edge_range * np.cos(az_max_rad)
    edge_y_right = edge_range * np.sin(az_max_rad)
    ax.plot(edge_x_right, edge_y_right, '--', color='gray', alpha=0.6, linewidth=1)
    
    # 中心线
    edge_x_center = edge_range * np.cos(scan_azimuth_rad)
    edge_y_center = edge_range * np.sin(scan_azimuth_rad)
    ax.plot(edge_x_center, edge_y_center, '-', color='gray', alpha=0.8, linewidth=1, label="扫描中心线")
    
    # 风向信息
    def get_wind_dir_text(angle):
        dirs = ["北","东北","东","东南","南","西南","西","西北"]
        return dirs[round(((angle % 360)/45.0))%8] + "风"
    
    # 工况信息
    info_text = f"大气边界层测量\n风向: {wind_angle:.0f}° ({get_wind_dir_text(wind_angle)})\n风速: {wind_speed:.1f} m/s\n扫描方向: {scan_azimuth_deg}° (正东偏北)"
    ax.text(0.02, 0.98, info_text, transform=ax.transAxes, fontsize=10, 
            ha='left', va='top', bbox=dict(boxstyle='round,pad=0.5', fc='white', alpha=0.8, ec='grey'))
    
    # 全局风向箭头
    rad = np.deg2rad(wind_angle)
    u = -wind_speed * np.sin(rad)
    v = -wind_speed * np.cos(rad)
    ax.barbs(0.95, 0.95, u, v, length=8, pivot='middle', transform=ax.transAxes,
             color='blue', zorder=11, barbcolor='blue', flagcolor='blue')
    
    # 设置轴标签和标题
    ax.set_xlabel('距雷达X方向距离 (m)', fontsize=12)
    ax.set_ylabel('距雷达Y方向距离 (m)', fontsize=12)
    ax.set_title(f'大气边界层雷达扫描图 - {height:.0f}m高度', fontsize=14, pad=20)
    ax.set_aspect('equal', adjustable='box')
    ax.grid(True, linestyle=':', alpha=0.6, color='darkgrey', zorder=1)
    
    # 设置显示范围
    ax.set_xlim(-max_range*0.2, max_range*1.1)
    ax.set_ylim(-max_range*0.6, max_range*0.6)
    
    # 图例
    ax.legend(loc='upper right', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close(fig)
    
    print(f"大气雷达扫描图已保存: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="生成大气边界层雷达扫描可视化")
    parser.add_argument("input_dir", help="包含数字子文件夹的主数据文件夹路径")
    parser.add_argument("--height", type=float, default=100.0, help="目标绘图高度 (米)")
    parser.add_argument("--max_range", type=float, default=1200.0, help="雷达最大扫描距离 (米)")
    parser.add_argument("--az_width", type=float, default=40.0, help="扫描扇区宽度 (度)")
    parser.add_argument("--dpi", type=int, default=300, help="输出图像DPI")
    parser.add_argument("--add_mask_noise", action='store_true', help="添加Perlin噪声获得更自然的边缘")
    
    args = parser.parse_args()
    set_font()
    
    base_input_dir = os.path.abspath(args.input_dir)
    output_pic_dir = os.path.join(base_input_dir, "atmospheric_radar_pics")
    os.makedirs(output_pic_dir, exist_ok=True)
    
    radar_config = {
        'max_range': args.max_range,
        'az_width': args.az_width,
        'radial_res': 120,
        'azimuthal_res': 60,
        'add_mask_noise': args.add_mask_noise
    }
    
    processed_count = 0
    for item_name in os.listdir(base_input_dir):
        item_path = os.path.join(base_input_dir, item_name)
        if os.path.isdir(item_path) and item_name.isdigit():
            # 获取风况信息用于文件命名
            info_path = os.path.join(item_path, "info.json")
            if os.path.exists(info_path):
                with open(info_path, 'r') as f:
                    info_data = json.load(f)
                wind_angle = info_data.get("wind", {}).get("angle", 0)
                wind_speed = info_data.get("wind", {}).get("speed", 10)
                
                output_filename = f"Atmospheric_Radar_WD{wind_angle:.0f}_WS{wind_speed:.1f}_Case{item_name}_H{args.height:.0f}m.png"
                output_file = os.path.join(output_pic_dir, output_filename)
                
                try:
                    create_atmospheric_radar_visualization(item_path, args.height, radar_config, output_file)
                    processed_count += 1
                except Exception as e:
                    print(f"处理案例 {item_name} 时出错: {e}")
    
    print(f"处理完成，共生成 {processed_count} 张大气雷达扫描图")

if __name__ == "__main__":
    main()