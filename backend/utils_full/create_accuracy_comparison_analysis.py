# @Author: joe 847304926@qq.com
# @Date: 2025-07-06 19:02:48
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-06 19:03:02
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_2\atmospheric_run_20250627_230932\create_accuracy_comparison_analysis.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
75m边界层综合精度分析（学术规范版本）
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

def set_font():
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    chinese_pref = [
        'Noto Sans CJK SC',    # Ubuntu 推荐
        'WenQuanYi Micro Hei',
        'SimHei',              # Windows
        'Microsoft YaHei',
        'PingFang SC'          # macOS
    ]
    # 在已安装字体中就地取一个
    installed = {f.name for f in fm.fontManager.ttflist}
    for font in chinese_pref:
        if font in installed:
            plt.rcParams['font.sans-serif'] = [font]
            break
    else:
        # 兜底
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
    plt.rcParams['axes.unicode_minus'] = False

def create_75m_comprehensive_analysis(input_dir):
    """创建75m边界层综合分析"""
    
    base_input_dir = os.path.abspath(input_dir)
    output_dir = os.path.join(base_input_dir, "boundary_layer_75m_analysis")
    os.makedirs(output_dir, exist_ok=True)
    
    # 学术规范颜色方案
    colors = {
        'field': '#2c3e50',      # 深灰蓝（实测值）
        'our': '#3498db',        # 清澈蓝（自研算法）
        'metodynwt': '#95a5a6',  # 中性灰（MetodynWT）
        'meets': '#27ae60',      # 深绿色（满足要求）
        'not_meets': '#e74c3c',  # 深红色（不满足要求）
        'ideal_line': '#2c3e50', # 深灰蓝（理想线）
        'diff_line': '#95a5a6'   # 中性灰（差异线）
    }
    
    # 收集所有工况的数据
    analysis_data = []
    
    case_items = [item for item in os.listdir(base_input_dir) 
                  if os.path.isdir(os.path.join(base_input_dir, item)) and item.isdigit()]
    
    print(f"正在分析 {len(case_items)} 个工况的75m边界层数据...")
    
    for item_name in sorted(case_items, key=int):
        item_path = os.path.join(base_input_dir, item_name)
        comparison_file = os.path.join(item_path, 'boundary_layer_75m', 'comparison_analysis.json')
        info_path = os.path.join(item_path, "info.json")
        
        if os.path.exists(comparison_file) and os.path.exists(info_path):
            try:
                with open(comparison_file, 'r', encoding='utf-8') as f:
                    comp_data = json.load(f)
                
                with open(info_path, 'r') as f:
                    info_data = json.load(f)
                
                wind_speed = info_data.get("wind", {}).get("speed", 10)
                wind_angle = info_data.get("wind", {}).get("angle", 0)
                
                our_results = comp_data['our_algorithm']['results']
                metodynwt_results = comp_data['metodynwt']
                field_results = comp_data['field_measurements']
                
                # 提取各地形的误差
                terrain_errors = {'our': {}, 'metodynwt': {}}
                
                for terrain in ['山脊', '山谷', '平地']:
                    if terrain in our_results['measurement_points']:
                        our_speed = our_results['measurement_points'][terrain]['speed']
                        metodynwt_speed = metodynwt_results[terrain]['speed']
                        field_speed = field_results[terrain]['speed']
                        
                        our_error = abs(our_speed - field_speed) / field_speed * 100
                        met_error = abs(metodynwt_speed - field_speed) / field_speed * 100
                        
                        terrain_errors['our'][terrain] = our_error
                        terrain_errors['metodynwt'][terrain] = met_error
                
                # 计算平均误差
                our_avg_error = np.mean(list(terrain_errors['our'].values())) if terrain_errors['our'] else 0
                met_avg_error = np.mean(list(terrain_errors['metodynwt'].values())) if terrain_errors['metodynwt'] else 0
                
                # 计算时长差异
                our_time = comp_data['our_algorithm']['computation_time_hours']
                met_time = comp_data['metodynwt']['computation_time_hours']
                time_diff_percent = abs(our_time - met_time) / met_time * 100
                
                case_data = {
                    'case_id': int(item_name),
                    'wind_speed': wind_speed,
                    'wind_angle': wind_angle,
                    'our_avg_error': our_avg_error,
                    'metodynwt_avg_error': met_avg_error,
                    'our_ridge_error': terrain_errors['our'].get('山脊', 0),
                    'our_valley_error': terrain_errors['our'].get('山谷', 0),
                    'our_plain_error': terrain_errors['our'].get('平地', 0),
                    'metodynwt_ridge_error': terrain_errors['metodynwt'].get('山脊', 0),
                    'metodynwt_valley_error': terrain_errors['metodynwt'].get('山谷', 0),
                    'metodynwt_plain_error': terrain_errors['metodynwt'].get('平地', 0),
                    'our_time': our_time,
                    'metodynwt_time': met_time,
                    'time_diff_percent': time_diff_percent,
                    'our_meets_accuracy': our_avg_error <= 3,
                    'metodynwt_meets_accuracy': met_avg_error <= 3,
                    'meets_efficiency': time_diff_percent <= 5
                }
                
                analysis_data.append(case_data)
                
            except Exception as e:
                print(f"处理工况 {item_name} 时出错: {e}")
    
    if not analysis_data:
        print("没有找到有效的75m边界层数据")
        return False
    
    df = pd.DataFrame(analysis_data)
    
    # 创建综合分析图表
    create_comprehensive_plots(df, output_dir, colors)
    
    # 保存数据表和统计摘要
    save_analysis_results(df, output_dir)
    
    return True

def create_comprehensive_plots(df, output_dir, colors):
    """创建学术规范的综合分析图表"""
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('75m边界层算法综合性能分析', fontsize=16, fontweight='bold', color='#2c3e50')
    
    # 统一的学术风格设置函数
    def set_academic_style(ax):
        ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5, color='#bdc3c7')
        ax.set_axisbelow(True)
        ax.tick_params(axis='both', which='major', labelsize=11, colors='#2c3e50')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#7f8c8d')
        ax.spines['bottom'].set_color('#7f8c8d')
        ax.spines['left'].set_linewidth(1.5)
        ax.spines['bottom'].set_linewidth(1.5)
        ax.set_facecolor('#fafbfc')
    
    # 1. 精度散点图
    point_colors = [colors['meets'] if meets else colors['not_meets'] 
                   for meets in df['our_meets_accuracy']]
    
    scatter = ax1.scatter(df['our_avg_error'], df['metodynwt_avg_error'], 
                         c=point_colors, s=100, alpha=0.7, 
                         edgecolors='white', linewidth=1.5)
    
    max_error = max(df['our_avg_error'].max(), df['metodynwt_avg_error'].max()) * 1.1
    ax1.plot([0, max_error], [0, max_error], color=colors['ideal_line'], 
            alpha=0.8, linewidth=2.5, label='理想线 (1:1)')
    ax1.axhline(y=3.0, color=colors['not_meets'], linestyle='--', 
               linewidth=2, alpha=0.8, label='3%精度要求')
    ax1.axvline(x=3.0, color=colors['not_meets'], linestyle='--', 
               linewidth=2, alpha=0.8)
    
    ax1.set_xlabel('自研算法平均误差 (%)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax1.set_ylabel('MetodynWT平均误差 (%)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax1.set_title('75m高度精度对比', fontsize=13, fontweight='bold', color='#2c3e50')
    
    legend1 = ax1.legend(fontsize=10, frameon=True, fancybox=True, shadow=True)
    legend1.get_frame().set_facecolor('#f8f9fa')
    legend1.get_frame().set_edgecolor('#dee2e6')
    
    set_academic_style(ax1)
    
    # 2. 时长散点图
    time_colors = [colors['meets'] if meets else colors['not_meets'] 
                  for meets in df['meets_efficiency']]
    
    ax2.scatter(df['our_time'], df['metodynwt_time'], 
               c=time_colors, s=100, alpha=0.7, 
               edgecolors='white', linewidth=1.5)
    
    min_time = min(df['our_time'].min(), df['metodynwt_time'].min()) * 0.9
    max_time = max(df['our_time'].max(), df['metodynwt_time'].max()) * 1.1
    ax2.plot([min_time, max_time], [min_time, max_time], 
            color=colors['ideal_line'], alpha=0.8, linewidth=2.5, label='理想线 (1:1)')
    ax2.plot([min_time, max_time], [min_time*0.95, max_time*0.95], 
            color=colors['diff_line'], alpha=0.7, linewidth=2, 
            linestyle='--', label='±5%差异线')
    ax2.plot([min_time, max_time], [min_time*1.05, max_time*1.05], 
            color=colors['diff_line'], alpha=0.7, linewidth=2, linestyle='--')
    
    ax2.set_xlabel('自研算法时长 (小时)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax2.set_ylabel('MetodynWT时长 (小时)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax2.set_title('计算效率对比', fontsize=13, fontweight='bold', color='#2c3e50')
    
    legend2 = ax2.legend(fontsize=10, frameon=True, fancybox=True, shadow=True)
    legend2.get_frame().set_facecolor('#f8f9fa')
    legend2.get_frame().set_edgecolor('#dee2e6')
    
    set_academic_style(ax2)
    
    # 3. 地形误差对比
    terrain_names = ['山脊', '山谷', '平地']
    our_terrain_errors = [
        df['our_ridge_error'].mean(),
        df['our_valley_error'].mean(),
        df['our_plain_error'].mean()
    ]
    met_terrain_errors = [
        df['metodynwt_ridge_error'].mean(),
        df['metodynwt_valley_error'].mean(),
        df['metodynwt_plain_error'].mean()
    ]
    
    x = np.arange(len(terrain_names))
    width = 0.35
    
    bars1 = ax3.bar(x - width/2, our_terrain_errors, width, label='自研算法', 
                   color=colors['our'], alpha=0.85, edgecolor='white', linewidth=1.5)
    bars2 = ax3.bar(x + width/2, met_terrain_errors, width, label='MetodynWT', 
                   color=colors['metodynwt'], alpha=0.85, edgecolor='white', linewidth=1.5)
    ax3.axhline(y=3.0, color=colors['not_meets'], linestyle='--', 
               linewidth=2, label='3%精度要求')
    
    # 添加数值标签
    for bars, color_key in [(bars1, 'our'), (bars2, 'metodynwt')]:
        for bar in bars:
            height = bar.get_height()
            ax3.annotate(f'{height:.1f}%',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 5), textcoords="offset points",
                        ha='center', va='bottom', fontsize=10, fontweight='bold',
                        color=colors[color_key])
    
    ax3.set_xlabel('地形类型', fontsize=12, fontweight='bold', color='#2c3e50')
    ax3.set_ylabel('平均相对误差 (%)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax3.set_title('不同地形精度对比', fontsize=13, fontweight='bold', color='#2c3e50')
    ax3.set_xticks(x)
    ax3.set_xticklabels(terrain_names)
    
    legend3 = ax3.legend(fontsize=10, frameon=True, fancybox=True, shadow=True)
    legend3.get_frame().set_facecolor('#f8f9fa')
    legend3.get_frame().set_edgecolor('#dee2e6')
    
    set_academic_style(ax3)
    
    # 4. 达标率统计
    our_accuracy_rate = sum(df['our_meets_accuracy']) / len(df) * 100
    met_accuracy_rate = sum(df['metodynwt_meets_accuracy']) / len(df) * 100
    efficiency_rate = sum(df['meets_efficiency']) / len(df) * 100
    
    categories = ['自研算法\n精度达标', 'MetodynWT\n精度达标', '效率\n达标']
    rates = [our_accuracy_rate, met_accuracy_rate, efficiency_rate]
    bar_colors = [colors['our'], colors['metodynwt'], colors['field']]
    
    bars = ax4.bar(categories, rates, color=bar_colors, alpha=0.85, 
                  edgecolor='white', linewidth=1.5)
    ax4.axhline(y=80, color=colors['not_meets'], linestyle='--', 
               linewidth=2, label='80%目标')
    
    for bar, color in zip(bars, bar_colors):
        height = bar.get_height()
        ax4.annotate(f'{height:.1f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 5), textcoords="offset points",
                    ha='center', va='bottom', fontsize=11, fontweight='bold',
                    color=color)
    
    ax4.set_ylabel('达标率 (%)', fontsize=12, fontweight='bold', color='#2c3e50')
    ax4.set_title('性能要求达标情况', fontsize=13, fontweight='bold', color='#2c3e50')
    ax4.set_ylim(0, 100)
    
    legend4 = ax4.legend(fontsize=10, frameon=True, fancybox=True, shadow=True)
    legend4.get_frame().set_facecolor('#f8f9fa')
    legend4.get_frame().set_edgecolor('#dee2e6')
    
    set_academic_style(ax4)
    
    # 设置整体背景
    fig.patch.set_facecolor('white')
    
    plt.tight_layout()
    
    # 保存图表
    plot_file = os.path.join(output_dir, "75m_boundary_layer_comprehensive_analysis.png")
    plt.savefig(plot_file, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close()
    
    print(f"75m边界层综合分析图已保存: {plot_file}")

def save_analysis_results(df, output_dir):
    """保存分析结果（统一格式）"""
    
    # 保存详细数据表（与其他文件一致）
    df_export = df.copy()
    df_export = df_export.rename(columns={
        'case_id': '工况编号',
        'wind_speed': '风速(m/s)',
        'wind_angle': '风向(°)',
        'our_avg_error': '自研算法平均误差(%)',
        'metodynwt_avg_error': 'MetodynWT平均误差(%)',
        'our_ridge_error': '自研算法山脊误差(%)',
        'our_valley_error': '自研算法山谷误差(%)',
        'our_plain_error': '自研算法平地误差(%)',
        'metodynwt_ridge_error': 'MetodynWT山脊误差(%)',
        'metodynwt_valley_error': 'MetodynWT山谷误差(%)',
        'metodynwt_plain_error': 'MetodynWT平地误差(%)',
        'our_time': '自研算法时长(h)',
        'metodynwt_time': 'MetodynWT时长(h)',
        'time_diff_percent': '时长差异(%)',
        'our_meets_accuracy': '自研算法精度达标',
        'metodynwt_meets_accuracy': 'MetodynWT精度达标',
        'meets_efficiency': '效率达标'
    })
    
    # 基本列
    export_columns = ['工况编号', '风速(m/s)', '风向(°)', 
                     '自研算法平均误差(%)', 'MetodynWT平均误差(%)',
                     '自研算法山脊误差(%)', '自研算法山谷误差(%)', '自研算法平地误差(%)',
                     'MetodynWT山脊误差(%)', 'MetodynWT山谷误差(%)', 'MetodynWT平地误差(%)',
                     '自研算法时长(h)', 'MetodynWT时长(h)', '时长差异(%)',
                     '自研算法精度达标', 'MetodynWT精度达标', '效率达标']
    
    df_export = df_export[export_columns]
    
    csv_file = os.path.join(output_dir, "75m_boundary_layer_comprehensive_data.csv")
    df_export.to_csv(csv_file, index=False, encoding='utf-8-sig')
    print(f"75m边界层综合分析数据表已保存: {csv_file}")
    
    # 计算并保存统计摘要
    summary_stats = {
        '总工况数': len(df),
        '测量高度': '75m',
        '自研算法平均误差(%)': round(df['our_avg_error'].mean(), 2),
        'MetodynWT平均误差(%)': round(df['metodynwt_avg_error'].mean(), 2),
        '自研算法平均时长(h)': round(df['our_time'].mean(), 2),
        'MetodynWT平均时长(h)': round(df['metodynwt_time'].mean(), 2),
        '平均时长差异(%)': round(df['time_diff_percent'].mean(), 2),
        '自研算法精度达标工况数': sum(df['our_meets_accuracy']),
        'MetodynWT精度达标工况数': sum(df['metodynwt_meets_accuracy']),
        '效率达标工况数': sum(df['meets_efficiency']),
        '自研算法精度达标率(%)': round(sum(df['our_meets_accuracy']) / len(df) * 100, 1),
        'MetodynWT精度达标率(%)': round(sum(df['metodynwt_meets_accuracy']) / len(df) * 100, 1),
        '效率达标率(%)': round(sum(df['meets_efficiency']) / len(df) * 100, 1)
    }
    
    summary_file = os.path.join(output_dir, "75m_boundary_layer_summary.json")
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary_stats, f, indent=2, ensure_ascii=False)
    
    print(f"75m边界层统计摘要已保存: {summary_file}")
    
    # 打印摘要报告
    print("\n" + "="*60)
    print("              75m边界层验证报告")
    print("="*60)
    for key, value in summary_stats.items():
        print(f"{key:25}: {value}")
    print("="*60)

def main():
    parser = argparse.ArgumentParser(description="生成75m边界层综合分析（学术规范版本）")
    parser.add_argument("input_dir", help="包含数字子文件夹的主数据文件夹路径")
    
    args = parser.parse_args()
    set_font()
    
    success = create_75m_comprehensive_analysis(args.input_dir)
    
    if success:
        print("\n✅ 75m边界层综合分析生成完成！")
    else:
        print("\n❌ 75m边界层综合分析生成失败")
        sys.exit(1)

if __name__ == "__main__":
    main()