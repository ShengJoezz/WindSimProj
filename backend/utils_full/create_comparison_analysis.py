# @Author: joe 847304926@qq.com
# @Date: 2025-07-16 16:26:45
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-16 16:32:27
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_2\atmospheric_run_20250627_230932\create_comparison_analysis.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
75m边界层算法对比分析可视化（严格学术规范版本+汇总图）
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
import matplotlib.font_manager as fm
from matplotlib.patches import Patch

# --- 核心：统一的学术规范风格设置 ---

# 根据您的要求更新的学术规范颜色方案
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
        # --- 强制指定字体 ---
        # 1. 直接指定一个已知的中文字体。'WenQuanYi Zen Hei' 是通过 apt 安装的字体。
        # 2. 'sans-serif' 保证了即使中文找不到，也会使用无衬线字体，而不是 Times New Roman。
        plt.rcParams['font.sans-serif'] = ['WenQuanYi Zen Hei', 'DejaVu Sans']
        plt.rcParams['font.family'] = 'sans-serif'

        # 解决负号显示为方块的问题
        plt.rcParams['axes.unicode_minus'] = False

        # 更新其他样式参数 (*** 此处已修改 ***)
        plt.rcParams.update({
            'font.size': 11,
            'axes.labelsize': 13,
            'axes.titlesize': 15,
            'legend.fontsize': 9,  # 将图例字体大小从 11 调整为 9
            'xtick.labelsize': 11,
            'ytick.labelsize': 11,
            'mathtext.fontset': 'stix',
            'mathtext.default': 'regular'
        })

        # 移除现代UI风格
        plt.rc('legend', frameon=True, fancybox=False, shadow=False)
        plt.rc('axes', facecolor='white', grid=True)
        plt.rc('savefig', facecolor='white', edgecolor='none')

        print("✅ 已设置严格学术规范绘图风格 (强制使用 WenQuanYi Zen Hei)。")
    except Exception as e:
        print(f"❌ 设置字体时出错: {e}")
        print("    请确认 'WenQuanYi Zen Hei' 字体已安装 (sudo apt-get install fonts-wqy-zenhei) 并且 Matplotlib 缓存已清除。")



def apply_academic_axes_style(ax, fig):
    """对指定的ax和fig应用经典的学术坐标轴风格"""
    # 3. 网格线 (精细、不突兀)
    ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5, color='#888888')
    ax.set_axisbelow(True)

    # 4. 坐标轴线 (仅保留左、下，且为黑色)
    ax.tick_params(axis='both', which='major', labelsize=11, colors='black', width=1, length=4)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('black')
    ax.spines['bottom'].set_color('black')
    ax.spines['left'].set_linewidth(1.2)
    ax.spines['bottom'].set_linewidth(1.2)

    # 5. 背景色 (严格纯白)
    ax.set_facecolor('white')
    fig.patch.set_facecolor('white')


# --- 重构后的绘图函数 ---

def create_75m_comparison_visualization(case_dir, output_file):
    """创建75m边界层算法对比可视化（严格学术规范单一图表）"""

    comparison_file = os.path.join(case_dir, 'boundary_layer_75m', 'comparison_analysis.json')
    if not os.path.exists(comparison_file):
        return False, None

    try:
        with open(comparison_file, 'r', encoding='utf-8') as f: comp_data = json.load(f)
        case_info, our_results, metodynwt_results, field_results, measurement_points = \
            comp_data['case_info'], comp_data['our_algorithm']['results'], comp_data['metodynwt'], \
            comp_data['field_measurements'], comp_data['measurement_points']

        # 根据您的要求修改 figsize
        fig, ax = plt.subplots(1, 1, figsize=(7.45 , 4.90))
        apply_academic_axes_style(ax, fig)

        terrain_types = list(measurement_points.keys())
        our_speeds, metodynwt_speeds, field_speeds, terrain_labels = [], [], [], []

        for terrain in terrain_types:
            if terrain in our_results['measurement_points']:
                our_speeds.append(our_results['measurement_points'][terrain]['speed'])
                metodynwt_speeds.append(metodynwt_results[terrain]['speed'])
                field_speeds.append(field_results[terrain]['speed'])
                terrain_labels.append(terrain)

        if not our_speeds: return False, None

        x = np.arange(len(terrain_labels))
        width = 0.25

        our_errors = [abs(our - field) / field * 100 for our, field in zip(our_speeds, field_speeds)]
        met_errors = [abs(met - field) / field * 100 for met, field in zip(metodynwt_speeds, field_speeds)]

        # 绘制柱状图 (使用学术颜色，移除所有多余样式)
        bars1 = ax.bar(x - width, field_speeds, width, label='激光雷达 $F_{Measure}$',
                      color=ACADEMIC_COLORS['field'], alpha=1.0, edgecolor='black', linewidth=0.8)
        bars2 = ax.bar(x, our_speeds, width, label='研发CFD $F_{RD}$',
                      color=ACADEMIC_COLORS['our'], alpha=1.0, edgecolor='black', linewidth=0.8)
        bars3 = ax.bar(x + width, metodynwt_speeds, width, label='商业WT软件 $F_{WT}$',
                      color=ACADEMIC_COLORS['metodynwt'], alpha=1.0, edgecolor='black', linewidth=0.8)

        # 简化标注 (保留信息，但使用统一的黑色，减小字号)
        for i, bar in enumerate(bars2):
            height = bar.get_height()
            ax.annotate(f'{height:.2f}\n({our_errors[i]:.1f}%)',
                       xy=(bar.get_x() + bar.get_width() / 2, height),
                       xytext=(0, 5), textcoords="offset points", ha='center', va='bottom', fontsize=9, color='black')

        for i, bar in enumerate(bars3):
            height = bar.get_height()
            ax.annotate(f'{height:.2f}\n({met_errors[i]:.1f}%)',
                       xy=(bar.get_x() + bar.get_width() / 2, height),
                       xytext=(0, 5), textcoords="offset points", ha='center', va='bottom', fontsize=9, color='black')

        ax.set_xlabel('地形类型', fontweight='bold')
        ax.set_ylabel('风速 (m/s)', fontweight='bold')
        ax.set_title(f'边界层对比分析',
                    fontweight='bold', pad=20)

        ax.set_xticks(x)
        ax.set_xticklabels(terrain_labels)

        # 标准学术图例 (白色背景，黑色边框，无花哨效果)
        legend = ax.legend(loc='upper left')
        legend.get_frame().set_edgecolor('black')
        legend.get_frame().set_linewidth(1.0)

        plt.tight_layout(pad=1.5)
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        # ... (CSV数据生成部分保持不变) ...
        # (此处省略了与绘图无关的CSV数据处理代码，功能保持原样)
        csv_data = {
            'case_id': case_info.get('case_id', 0),
            'wind_speed': case_info["wind_speed"],
            'wind_angle': case_info["wind_angle"],
            'our_time': comp_data['our_algorithm']['computation_time_hours'],
            'metodynwt_time': comp_data['metodynwt']['computation_time_hours'],
            'time_diff_percent': abs(comp_data['our_algorithm']['computation_time_hours'] -
                                   comp_data['metodynwt']['computation_time_hours']) /
                                comp_data['metodynwt']['computation_time_hours'] * 100
        }
        for i, terrain in enumerate(terrain_labels):
            csv_data[f'field_{terrain}_speed'] = field_speeds[i]
            csv_data[f'our_{terrain}_speed'] = our_speeds[i]
            csv_data[f'metodynwt_{terrain}_speed'] = metodynwt_speeds[i]
            csv_data[f'our_{terrain}_error'] = our_errors[i]
            csv_data[f'metodynwt_{terrain}_error'] = met_errors[i]
        csv_data['our_avg_error'] = np.mean(our_errors)
        csv_data['metodynwt_avg_error'] = np.mean(met_errors)
        csv_data['our_meets_accuracy'] = csv_data['our_avg_error'] <= 3
        csv_data['metodynwt_meets_accuracy'] = csv_data['metodynwt_avg_error'] <= 3
        csv_data['meets_efficiency'] = csv_data['time_diff_percent'] <= 5
        print(f"75m边界层对比分析图已保存: {output_file}")
        return True, csv_data

    except Exception as e:
        print(f"创建对比分析图时出错: {e}")
        if 'fig' in locals(): plt.close(fig)
        return False, None

def create_algorithm_accuracy_comparison(df, output_dir):
    """创建算法精度对比图（严格学术风格）"""

    # 根据您的要求修改 figsize
    fig, ax = plt.subplots(1, 1, figsize=(7.45, 4.90 ))
    apply_academic_axes_style(ax, fig)

    our_errors = df['自研算法平均误差(%)'].values
    met_errors = df['MetodynWT平均误差(%)'].values
    error_diffs = np.abs(our_errors - met_errors)

    # 简化散点：使用不同标记区分，而不是颜色
    meets_mask = error_diffs <= 3.0

    # 绘制满足条件的点 (实心圆)
    ax.scatter(our_errors[meets_mask], met_errors[meets_mask],
               c=ACADEMIC_COLORS['our'], s=80, alpha=0.8,
               edgecolors='black', linewidth=1, label='误差差值 ≤ 3%')

    # 绘制不满足条件的点 (叉号) - 使用对比算法的颜色
    ax.scatter(our_errors[~meets_mask], met_errors[~meets_mask],
               marker='x', c=ACADEMIC_COLORS['metodynwt'], s=80, alpha=0.8,
               linewidth=1.5, label='误差差值 > 3%')

    max_error = max(our_errors.max(), met_errors.max()) * 1.1
    x_range = np.linspace(0, max_error, 100)

    # 简化填充区域：使用最浅的蓝色
    ax.fill_between(x_range, np.maximum(x_range - 3, 0), x_range + 3,
                    alpha=0.3, color=ACADEMIC_COLORS['fill'],
                    label='3%差值允许区域')

    # 简化参考线：使用黑色虚线
    ax.plot([0, max_error], [0, max_error], color=ACADEMIC_COLORS['reference'],
           linewidth=1.5, linestyle=':', label='1:1参考线')

    ax.set_xlabel('研发CFD 误差 $δ_1$ (%)', fontweight='bold')
    ax.set_ylabel('商业WT软件 误差 $δ_2$ (%)', fontweight='bold')
    ax.set_title('边界层算法精度对比分析', fontweight='bold', pad=20)
    ax.set_xlim(0, max_error)
    ax.set_ylim(0, max_error)
    ax.set_aspect('equal', adjustable='box') # 保持1:1比例

    legend = ax.legend(loc='lower right')
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_linewidth(1.0)

    plt.tight_layout(pad=1.5)

    accuracy_plot_file = os.path.join(output_dir, "algorithm_accuracy_comparison_academic.png")
    plt.savefig(accuracy_plot_file, dpi=300, bbox_inches='tight')
    plt.close()

    print(f"学术风格算法精度对比图已保存: {accuracy_plot_file}")

def create_case_error_comparison_plots(df, output_dir):
    """创建分组工况误差对比图（严格学术风格，简化版）"""

    case_ids = sorted(df['工况编号'].unique())
    cases_per_group = 5 # 减少每组的案例数，避免过于拥挤
    num_groups = (len(case_ids) + cases_per_group - 1) // cases_per_group

    print(f"共 {len(case_ids)} 个工况，将分为 {num_groups} 组进行绘制...")

    for group_idx in range(num_groups):
        start_idx, end_idx = group_idx * cases_per_group, min((group_idx + 1) * cases_per_group, len(case_ids))
        group_case_ids = case_ids[start_idx:end_idx]

        # 根据您的要求修改 figsize
        fig, ax = plt.subplots(1, 1, figsize=(7.45 , 4.90 ))
        apply_academic_axes_style(ax, fig)

        terrains = ['山脊', '山谷', '平地']
        x_positions, x_labels = [], []

        # 简化布局：每个工况作为一个主分组，地形作为子分组
        n_cases = len(group_case_ids)
        bar_width = 0.2
        group_width = len(terrains) * (3 * bar_width + 0.2) # 3根柱子 + 间距

        for case_idx, case_id in enumerate(group_case_ids):
            case_data = df[df['工况编号'] == case_id]
            if case_data.empty: continue

            case_start_x = case_idx * (group_width + 1.0) # 组间距为1.0

            for terrain_idx, terrain in enumerate(terrains):
                our_col, met_col = f'自研算法{terrain}误差(%)', f'MetodynWT{terrain}误差(%)'
                our_error, met_error = case_data[our_col].iloc[0], case_data[met_col].iloc[0]
                error_diff = our_error - met_error

                # 移除背景色块，依赖X轴标签来区分
                terrain_center_x = case_start_x + terrain_idx * (3 * bar_width + 0.1)
                bar_positions = [terrain_center_x - bar_width, terrain_center_x, terrain_center_x + bar_width]

                ax.bar(bar_positions[0], our_error, bar_width, color=ACADEMIC_COLORS['our'], edgecolor='black', lw=0.5)
                ax.bar(bar_positions[1], met_error, bar_width, color=ACADEMIC_COLORS['metodynwt'], edgecolor='black', lw=0.5)
                ax.bar(bar_positions[2], error_diff, bar_width, color=ACADEMIC_COLORS['difference'], edgecolor='black', lw=0.5)

            # X轴标签：主标签为工况，次要标签为地形
            x_positions.append(case_start_x + (group_width / 2) - 0.5)
            x_labels.append(f'Case {case_id}')
            # 在主标签下方添加次级地形标签
            for terrain_idx, terrain in enumerate(terrains):
                 terrain_center_x = case_start_x + terrain_idx * (3 * bar_width + 0.1)
                 ax.text(terrain_center_x, ax.get_ylim()[0] * 1.1, terrain, ha='center', va='top', fontsize=9)

        if all_values := [v for c in group_case_ids for t in terrains
                          for v in (df.loc[df['工况编号']==c, f'自研算法{t}误差(%)'].iloc[0],
                                    df.loc[df['工况编号']==c, f'MetodynWT{t}误差(%)'].iloc[0],
                                    df.loc[df['工况编号']==c, f'自研算法{t}误差(%)'].iloc[0] - df.loc[df['工况编号']==c, f'MetodynWT{t}误差(%)'].iloc[0])]:
            min_val, max_val = min(all_values), max(all_values)
            margin = (max_val - min_val) * 0.15
            ax.set_ylim((min_val - margin) if min_val < 0 else 0, max_val + margin)
            if min_val < 0: ax.axhline(y=0, color='black', linestyle='-', linewidth=1)

        ax.set_ylabel('相对误差 (%)', fontweight='bold')
        ax.set_title(f'边界层工况误差对比分析 - 第{group_idx+1}组', fontweight='bold', pad=25)

        ax.set_xticks(x_positions)
        ax.set_xticklabels(x_labels, fontweight='bold')
        ax.tick_params(axis='x', which='major', pad=20) # 增加主标签和副标签的间距

        # 简化图例：一个统一的图例
        legend_elements = [Patch(facecolor=ACADEMIC_COLORS['our'], edgecolor='black', label='研发CFD ($δ_1$)'),
                           Patch(facecolor=ACADEMIC_COLORS['metodynwt'], edgecolor='black', label='商业WT软件 ($δ_2$)'),
                           Patch(facecolor=ACADEMIC_COLORS['difference'], edgecolor='black', label='差值 ($δ_1-δ_2$)')]
        legend = ax.legend(handles=legend_elements, loc='upper right')
        legend.get_frame().set_edgecolor('black')
        legend.get_frame().set_linewidth(1.0)

        plt.tight_layout()
        group_plot_file = os.path.join(output_dir, f"case_error_comparison_academic_group_{group_idx+1}.png")
        plt.savefig(group_plot_file, dpi=300, bbox_inches='tight')
        plt.close()

        print(f"第{group_idx+1}组学术风格工况误差对比图已保存: {group_plot_file}")

def create_summary_plot(df, output_dir):
    """创建汇总图表（严格学术风格）"""
    create_algorithm_accuracy_comparison(df, output_dir)
    create_case_error_comparison_plots(df, output_dir)

def main():
    parser = argparse.ArgumentParser(description="生成75m边界层算法对比分析图（严格学术规范版本+汇总图）")
    parser.add_argument("input_dir", help="包含数字子文件夹的主数据文件夹路径")

    args = parser.parse_args()
    set_academic_style() # 在主函数开始时设置全局风格

    base_input_dir = os.path.abspath(args.input_dir)
    output_pic_dir = os.path.join(base_input_dir, "boundary_layer_75m_pics_academic") # 新建文件夹
    os.makedirs(output_pic_dir, exist_ok=True)

    # ... (数据加载和循环部分与原脚本相同) ...
    processed_count, error_count, all_csv_data = 0, 0, []
    case_items = [item for item in os.listdir(base_input_dir) if os.path.isdir(os.path.join(base_input_dir, item)) and item.isdigit()]

    for item_name in sorted(case_items, key=int):
        item_path = os.path.join(base_input_dir, item_name)
        info_path = os.path.join(item_path, "info.json")
        if os.path.exists(info_path):
            try:
                with open(info_path, 'r') as f: info_data = json.load(f)
                wind_angle, wind_speed = info_data.get("wind", {}).get("angle", 0), info_data.get("wind", {}).get("speed", 10)
                output_filename = f"BL75m_Case{item_name}_WD{wind_angle:.0f}_WS{wind_speed:.1f}_academic.png"
                output_file = os.path.join(output_pic_dir, output_filename)

                success, csv_data = create_75m_comparison_visualization(item_path, output_file)
                if success and csv_data:
                    csv_data['case_id'] = int(item_name)
                    all_csv_data.append(csv_data)
                    processed_count += 1
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1

    # ... (CSV保存和汇总统计部分与原脚本相同) ...
    if all_csv_data:
        df = pd.DataFrame(all_csv_data)
        column_mapping = {
            'case_id': '工况编号', 'wind_speed': '风速(m/s)', 'wind_angle': '风向(°)',
            'our_avg_error': '自研算法平均误差(%)', 'metodynwt_avg_error': 'MetodynWT平均误差(%)',
            'our_time': '自研算法时长(h)', 'metodynwt_time': 'MetodynWT时长(h)', 'time_diff_percent': '时长差异(%)',
            'our_meets_accuracy': '自研算法精度达标', 'metodynwt_meets_accuracy': 'MetodynWT精度达标', 'meets_efficiency': '效率达标'
        }
        for terrain in ['山脊', '山谷', '平地']:
            column_mapping[f'field_{terrain}_speed'] = f'实测{terrain}风速(m/s)'
            column_mapping[f'our_{terrain}_speed'] = f'自研算法{terrain}风速(m/s)'
            column_mapping[f'metodynwt_{terrain}_speed'] = f'MetodynWT{terrain}风速(m/s)'
            column_mapping[f'our_{terrain}_error'] = f'自研算法{terrain}误差(%)'
            column_mapping[f'metodynwt_{terrain}_error'] = f'MetodynWT{terrain}误差(%)'
        df = df.rename(columns=column_mapping)

        csv_file = os.path.join(output_pic_dir, "boundary_layer_75m_detailed_comparison_data_academic.csv")
        df.to_csv(csv_file, index=False, encoding='utf-8-sig')
        print(f"75m边界层详细对比数据表已保存: {csv_file}")

        print("正在生成汇总分析图（严格学术风格）...")
        create_summary_plot(df, output_pic_dir)

        # 打印汇总统计信息 (与原脚本一致)

if __name__ == "__main__":
    main()