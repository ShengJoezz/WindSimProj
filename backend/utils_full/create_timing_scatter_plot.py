# @Author: joe 847304926@qq.com
# @Date: 2025-07-06 18:51:42
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-16 20:59:28
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_2\atmospheric_run_20250627_230932\create_timing_scatter_plot.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
计算时长对比可视化（严格学术规范版本）
"""

import os
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import argparse
import sys
from matplotlib.patches import Patch

# --- 核心：统一的学术规范风格设置 (与 create_comparison_analysis.py 完全一致) ---

ACADEMIC_COLORS = {
    'field': '#b3cede',      # 实测 (较浅的蓝色)
    'our': '#225b91',        # 我方算法 (最深的蓝色)
    'metodynwt': '#4884af',  # 对比算法 (次深的蓝色)
    'difference': '#78aac8',# 差值 (中等蓝色)
    'reference': '#000000',  # 参考线 (黑色)
    'fill': '#dae6f1'        # 填充区域 (最浅的蓝色)
}

def set_academic_style():
    """
    设置全局的、严格的学术图表风格（强制指定中文字体版本）。
    """
    try:
        plt.rcParams['font.sans-serif'] = ['WenQuanYi Zen Hei', 'DejaVu Sans']
        plt.rcParams['font.family'] = 'sans-serif'
        plt.rcParams['axes.unicode_minus'] = False
        plt.rcParams.update({
            'font.size': 11,
            'axes.labelsize': 13,
            'axes.titlesize': 15,
            'legend.fontsize': 9,
            'xtick.labelsize': 11,
            'ytick.labelsize': 11,
            'mathtext.fontset': 'stix',
            'mathtext.default': 'regular'
        })
        plt.rc('legend', frameon=True, fancybox=False, shadow=False)
        plt.rc('axes', facecolor='white', grid=True)
        plt.rc('savefig', facecolor='white', edgecolor='none')
        print("✅ 已设置严格学术规范绘图风格 (强制使用 WenQuanYi Zen Hei)。")
    except Exception as e:
        print(f"❌ 设置字体时出错: {e}")
        print("    请确认 'WenQuanYi Zen Hei' 字体已安装 (sudo apt-get install fonts-wqy-zenhei) 并且 Matplotlib 缓存已清除。")

def apply_academic_axes_style(ax, fig):
    """对指定的ax和fig应用经典的学术坐标轴风格"""
    ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5, color='#888888')
    ax.set_axisbelow(True)
    ax.tick_params(axis='both', which='major', labelsize=11, colors='black', width=1, length=4)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('black')
    ax.spines['bottom'].set_color('black')
    ax.spines['left'].set_linewidth(1.2)
    ax.spines['bottom'].set_linewidth(1.2)
    ax.set_facecolor('white')
    fig.patch.set_facecolor('white')

# --- 重构后的绘图函数 ---

# --- 已为您修改的绘图函数 ---

def create_timing_scatter_plot(input_dir):
    """创建严格学术规范的时长对比散点图（坐标轴优化以放大细节）"""
    
    base_input_dir = os.path.abspath(input_dir)
    output_dir = os.path.join(base_input_dir, "timing_comparison_academic")
    os.makedirs(output_dir, exist_ok=True)
    
    # --- 数据加载部分 (保持不变) ---
    timing_data = []
    case_items = [item for item in os.listdir(base_input_dir) 
                  if os.path.isdir(os.path.join(base_input_dir, item)) and item.isdigit()]
    
    for item_name in sorted(case_items, key=int):
        item_path = os.path.join(base_input_dir, item_name)
        comparison_file = os.path.join(item_path, 'boundary_layer_75m', 'comparison_analysis.json')
        info_path = os.path.join(item_path, "info.json")
        
        if os.path.exists(comparison_file) and os.path.exists(info_path):
            try:
                with open(comparison_file, 'r', encoding='utf-8') as f: comp_data = json.load(f)
                with open(info_path, 'r') as f: info_data = json.load(f)
                
                our_time = comp_data['our_algorithm']['computation_time_hours']
                metodynwt_time = comp_data['metodynwt']['computation_time_hours']
                time_diff_percent = abs(our_time - metodynwt_time) / metodynwt_time * 100
                
                timing_data.append({
                    'case_id': int(item_name),
                    'wind_speed': info_data.get("wind", {}).get("speed", 10),
                    'wind_angle': info_data.get("wind", {}).get("angle", 0),
                    'our_time': our_time,
                    'metodynwt_time': metodynwt_time,
                    'time_diff_percent': time_diff_percent,
                    'meets_requirement': time_diff_percent <= 5
                })
            except Exception as e:
                print(f"处理工况 {item_name} 时出错: {e}")
    
    if not timing_data:
        print("没有找到有效的时长数据")
        return False
    
    df = pd.DataFrame(timing_data)
    our_times = df['our_time'].values
    met_times = df['metodynwt_time'].values
    meets_mask = df['meets_requirement'].values
    
    # --- 绘图部分 (坐标轴范围已修改) ---
    
    fig, ax = plt.subplots(1, 1, figsize=(7.45, 4.90))
    apply_academic_axes_style(ax, fig)

    # 绘制散点图 (保持不变)
    ax.scatter(our_times[meets_mask], met_times[meets_mask],
               c=ACADEMIC_COLORS['our'], s=80, alpha=0.8,
               edgecolors='black', linewidth=1, label='时长差异 ≤ 5%')
    ax.scatter(our_times[~meets_mask], met_times[~meets_mask],
               marker='x', c=ACADEMIC_COLORS['metodynwt'], s=80, alpha=0.8,
               linewidth=1.5, label='时长差异 > 5%')

    # ==================== 核心修改：调整坐标轴范围 ====================
    # 1. 找到数据的实际最小和最大值
    min_val = min(our_times.min(), met_times.min())
    max_val = max(our_times.max(), met_times.max())
    
    # 2. 根据数据范围计算新的、紧凑的绘图边界，并增加一点边距
    range_span = max_val - min_val if max_val > min_val else 0.1
    plot_min = min_val - range_span * 0.15 # 在最小值基础上再减去15%的范围作为下限
    plot_max = max_val + range_span * 0.15 # 在最大值基础上再增加15%的范围作为上限

    # 3. 基于新的边界重新定义参考线和填充区域的范围
    x_range = np.linspace(plot_min, plot_max, 200)

    # 4. 在新的范围内绘制填充区域
    ax.fill_between(x_range, x_range * 0.95, x_range * 1.05,
                    alpha=0.3, color=ACADEMIC_COLORS['fill'],
                    label='5%差异允许区域')

    # 5. 在新的范围内绘制1:1参考线
    ax.plot([plot_min, plot_max], [plot_min, plot_max], color=ACADEMIC_COLORS['reference'],
           linewidth=1.5, linestyle=':', label='1:1参考线')
    # =================================================================

    # 6. 设置轴标签和标题 (保持不变)
    ax.set_xlabel('研发CFD 计算时长 $T_{RD}$ (h)', fontweight='bold')
    ax.set_ylabel('商业WT软件 计算时长 $T_{WT}$ (h)', fontweight='bold')
    ax.set_title('边界层算法计算效率对比分析', fontweight='bold', pad=20)
    
    # 7. 应用新的坐标轴限制
    ax.set_xlim(plot_min, plot_max)
    ax.set_ylim(plot_min, plot_max)
    ax.set_aspect('equal', adjustable='box') 

    # 8. 创建图例 (保持不变)
    legend = ax.legend(loc='lower right')
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_linewidth(1.0)
    
    plt.tight_layout(pad=1.5)
    
    # 9. 保存图表和数据 (保持不变)
    plot_file = os.path.join(output_dir, "timing_comparison_scatter_academic.png")
    plt.savefig(plot_file, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"严格学术规范的时长对比散点图（坐标轴已优化）已保存: {plot_file}")
    
    df_export = df[['case_id', 'wind_speed', 'wind_angle', 'our_time', 'metodynwt_time', 'time_diff_percent', 'meets_requirement']]
    df_export.columns = ['工况编号', '风速(m/s)', '风向(°)', '自研算法时长(h)', 'MetodynWT时长(h)', '时长差异(%)', '满足要求']
    csv_file = os.path.join(output_dir, "timing_comparison_data_academic.csv")
    df_export.to_csv(csv_file, index=False, encoding='utf-8-sig')
    print(f"严格学术规范的时长对比数据表已保存: {csv_file}")
    
    return True

def main():
    parser = argparse.ArgumentParser(description="生成严格学术规范的时长对比散点图")
    parser.add_argument("input_dir", help="包含数字子文件夹的主数据文件夹路径")
    
    args = parser.parse_args()
    # 调用统一的学术风格设置函数
    set_academic_style()
    
    success = create_timing_scatter_plot(args.input_dir)
    
    if success:
        print("\n✅ 严格学术规范的时长对比散点图生成完成！")
    else:
        print("\n❌ 严格学术规范的时长对比散点图生成失败")
        sys.exit(1)

if __name__ == "__main__":
    main()