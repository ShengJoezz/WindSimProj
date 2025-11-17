# @Author: joe 847304926@qq.com
# @Date: 2025-07-06 14:27:02
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-06 17:17:25
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_2\atmospheric_run_20250627_230932\create_individual_case_comparisons.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为每个工况生成详细的高度剖面对比图
"""

import os
import json
import numpy as np
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

def calculate_errors(predicted, reference):
    """计算误差统计"""
    predicted = np.array(predicted)
    reference = np.array(reference)
    relative_error = np.abs((predicted - reference) / reference) * 100
    return {
        'mean_relative_error': np.mean(relative_error),
        'max_relative_error': np.max(relative_error),
        'relative_errors': relative_error
    }

def create_individual_case_comparison(case_dir, output_dir):
    """为单个工况创建详细对比图"""
    
    comparison_file = os.path.join(case_dir, 'boundary_layer_75m', 'comparison_analysis.json')
    if not os.path.exists(comparison_file):
        return False
    
    try:
        with open(comparison_file, 'r', encoding='utf-8') as f:
            comp_data = json.load(f)
        
        case_info = comp_data['case_info']
        our_results = comp_data['our_algorithm']['results']
        metodynwt_results = comp_data['metodynwt']
        field_results = comp_data['field_measurements']
        measurement_points = comp_data['measurement_points']
        
        case_id = case_info['case_id']
        wind_speed = case_info['wind_speed']
        wind_angle = case_info['wind_angle']
        
        # 创建大图
        fig = plt.figure(figsize=(20, 16))
        
        # 创建复杂的子图布局
        gs = fig.add_gridspec(4, 4, height_ratios=[2, 1, 1, 1], width_ratios=[2, 1, 1, 1])
        
        # 主要的高度剖面图
        ax_main = fig.add_subplot(gs[0, :2])
        
        # 误差分析图
        ax_error_terrain = fig.add_subplot(gs[0, 2])
        ax_error_height = fig.add_subplot(gs[0, 3])
        
        # 各地形的详细对比
        ax_ridge = fig.add_subplot(gs[1, 0])
        ax_valley = fig.add_subplot(gs[1, 1])
        ax_plain = fig.add_subplot(gs[1, 2])
        
        # 统计信息
        ax_stats = fig.add_subplot(gs[1, 3])
        
        # 高度层误差分布
        ax_height_error = fig.add_subplot(gs[2, :2])
        
        # 时长对比
        ax_timing = fig.add_subplot(gs[2, 2])
        
        # 性能摘要
        ax_summary = fig.add_subplot(gs[2, 3])
        
        # ABL层次分析
        ax_abl_layers = fig.add_subplot(gs[3, :])
        
        fig.suptitle(f'工况 {case_id} 详细对比分析\n风速{wind_speed:.1f}m/s, 风向{wind_angle:.0f}°', 
                     fontsize=18, fontweight='bold')
        
        # 提取数据
        terrain_types = list(measurement_points.keys())
        data_by_terrain = {terrain: {'heights': [], 'our': [], 'metodynwt': [], 'field': []} 
                           for terrain in terrain_types}
        
        for height_key, height_data in our_results.items():
            height = float(height_key)
            
            for terrain in terrain_types:
                if terrain in height_data['measurement_points']:
                    # 查找对应数据
                    metodynwt_key = None
                    field_key = None
                    
                    for key in metodynwt_results.keys():
                        if key != 'computation_time_hours':
                            try:
                                if float(key) == height:
                                    metodynwt_key = key
                                    break
                            except ValueError:
                                continue
                    
                    for key in field_results.keys():
                        try:
                            if float(key) == height:
                                field_key = key
                                break
                        except ValueError:
                            continue
                    
                    if metodynwt_key and field_key:
                        our_speed = height_data['measurement_points'][terrain]['speed']
                        metodynwt_speed = metodynwt_results[metodynwt_key][terrain]['speed']
                        field_speed = field_results[field_key][terrain]['speed']
                        
                        data_by_terrain[terrain]['heights'].append(height)
                        data_by_terrain[terrain]['our'].append(our_speed)
                        data_by_terrain[terrain]['metodynwt'].append(metodynwt_speed)
                        data_by_terrain[terrain]['field'].append(field_speed)
        
        # 1. 主要高度剖面图（带ABL层次标记）
        colors = {'山脊': 'red', '山谷': 'blue', '平地': 'green'}
        linestyles = {'field': '-', 'our': '--', 'metodynwt': ':'}
        markers = {'field': 'o', 'our': 's', 'metodynwt': '^'}
        
        for terrain in terrain_types:
            data = data_by_terrain[terrain]
            if data['heights']:
                ax_main.plot(data['field'], data['heights'], 
                           color=colors[terrain], linestyle=linestyles['field'], 
                           marker=markers['field'], markersize=8, linewidth=3,
                           label=f'{terrain}-实测', alpha=0.9)
                ax_main.plot(data['our'], data['heights'], 
                           color=colors[terrain], linestyle=linestyles['our'], 
                           marker=markers['our'], markersize=6, linewidth=2,
                           label=f'{terrain}-自研算法', alpha=0.8)
                ax_main.plot(data['metodynwt'], data['heights'], 
                           color=colors[terrain], linestyle=linestyles['metodynwt'], 
                           marker=markers['metodynwt'], markersize=6, linewidth=2,
                           label=f'{terrain}-MetodynWT', alpha=0.8)
        
        # 添加ABL层次背景
        max_height = max([max(data['heights']) for data in data_by_terrain.values() if data['heights']])
        ax_main.axhspan(0, 80, alpha=0.1, color='brown', label='近地面层')
        ax_main.axhspan(80, 140, alpha=0.1, color='yellow', label='混合层')
        ax_main.axhspan(140, 180, alpha=0.1, color='orange', label='过渡层')
        ax_main.axhspan(180, max_height+10, alpha=0.1, color='purple', label='ABL上部')
        
        ax_main.set_xlabel('风速 (m/s)', fontsize=12)
        ax_main.set_ylabel('高度 (m)', fontsize=12)
        ax_main.set_title('大气边界层风速剖面对比', fontsize=14)
        ax_main.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
        ax_main.grid(True, alpha=0.3)
        
        # 2. 按地形的误差对比
        terrain_labels = []
        our_errors = []
        metodynwt_errors = []
        
        for terrain in terrain_types:
            data = data_by_terrain[terrain]
            if data['field']:
                our_error_stats = calculate_errors(data['our'], data['field'])
                metodynwt_error_stats = calculate_errors(data['metodynwt'], data['field'])
                
                terrain_labels.append(terrain)
                our_errors.append(our_error_stats['mean_relative_error'])
                metodynwt_errors.append(metodynwt_error_stats['mean_relative_error'])
        
        if terrain_labels:
            x = np.arange(len(terrain_labels))
            width = 0.35
            
            bars1 = ax_error_terrain.bar(x - width/2, our_errors, width, 
                                       label='自研算法', color='skyblue', alpha=0.8)
            bars2 = ax_error_terrain.bar(x + width/2, metodynwt_errors, width, 
                                       label='MetodynWT', color='lightcoral', alpha=0.8)
            ax_error_terrain.axhline(y=3.0, color='red', linestyle='--', linewidth=2)
            
            # 添加数值标签
            for bars in [bars1, bars2]:
                for bar in bars:
                    height = bar.get_height()
                    ax_error_terrain.annotate(f'{height:.1f}%',
                                            xy=(bar.get_x() + bar.get_width() / 2, height),
                                            xytext=(0, 3), textcoords="offset points",
                                            ha='center', va='bottom', fontsize=9)
            
            ax_error_terrain.set_xlabel('地形类型')
            ax_error_terrain.set_ylabel('平均误差 (%)')
            ax_error_terrain.set_title('地形误差对比')
            ax_error_terrain.set_xticks(x)
            ax_error_terrain.set_xticklabels([t.replace('平地', '平地') for t in terrain_labels], rotation=15)
            ax_error_terrain.legend()
            ax_error_terrain.grid(True, alpha=0.3)
        
        # 3. 按高度的误差分布
        all_heights = []
        all_our_errors = []
        all_met_errors = []
        
        for terrain in terrain_types:
            data = data_by_terrain[terrain]
            for i, height in enumerate(data['heights']):
                if data['field'][i] > 0:
                    our_error = abs(data['our'][i] - data['field'][i]) / data['field'][i] * 100
                    met_error = abs(data['metodynwt'][i] - data['field'][i]) / data['field'][i] * 100
                    
                    all_heights.append(height)
                    all_our_errors.append(our_error)
                    all_met_errors.append(met_error)
        
        ax_error_height.scatter(all_our_errors, all_heights, alpha=0.7, color='blue', 
                              label='自研算法', s=50)
        ax_error_height.scatter(all_met_errors, all_heights, alpha=0.7, color='red', 
                              label='MetodynWT', s=50)
        ax_error_height.axvline(x=3.0, color='red', linestyle='--', linewidth=2)
        
        ax_error_height.set_xlabel('相对误差 (%)')
        ax_error_height.set_ylabel('高度 (m)')
        ax_error_height.set_title('高度-误差关系')
        ax_error_height.legend()
        ax_error_height.grid(True, alpha=0.3)
        
        # 4-6. 各地形详细对比（散点图）
        terrain_axes = [ax_ridge, ax_valley, ax_plain]
        for i, terrain in enumerate(terrain_types):
            data = data_by_terrain[terrain]
            if data['field']:
                ax = terrain_axes[i]
                
                # 自研算法 vs 实测
                ax.scatter(data['field'], data['our'], alpha=0.7, color='blue', 
                          label='自研算法', s=60)
                # MetodynWT vs 实测
                ax.scatter(data['field'], data['metodynwt'], alpha=0.7, color='red', 
                          label='MetodynWT', s=60)
                
                # 理想线
                min_val = min(min(data['field']), min(data['our']), min(data['metodynwt']))
                max_val = max(max(data['field']), max(data['our']), max(data['metodynwt']))
                ax.plot([min_val, max_val], [min_val, max_val], 'k--', alpha=0.5)
                
                ax.set_xlabel('实测风速 (m/s)')
                ax.set_ylabel('预测风速 (m/s)')
                ax.set_title(f'{terrain}对比')
                ax.legend()
                ax.grid(True, alpha=0.3)
        
        # 7. 统计信息
        ax_stats.axis('off')
        
        # 计算总体误差
        our_total_error = np.mean(our_errors) if our_errors else 0
        met_total_error = np.mean(metodynwt_errors) if metodynwt_errors else 0
        
        stats_text = f"""统计摘要:

整体平均误差:
• 自研算法: {our_total_error:.2f}%
• MetodynWT: {met_total_error:.2f}%

地形误差:
"""
        for i, terrain in enumerate(terrain_labels):
            if i < len(our_errors):
                stats_text += f"• {terrain}:\n  自研 {our_errors[i]:.1f}% | WT {metodynwt_errors[i]:.1f}%\n"
        
        stats_text += f"""
高度覆盖: {len(all_heights)} 个测点
ABL层次: 4 层
精度要求: ≤3%
"""
        
        ax_stats.text(0.05, 0.95, stats_text, transform=ax_stats.transAxes, 
                     fontsize=11, verticalalignment='top', fontfamily='monospace',
                     bbox=dict(boxstyle='round,pad=0.5', facecolor='lightgray', alpha=0.8))
        
        # 8. 高度层误差分布
        height_bins = [40, 80, 120, 160, 200]
        height_labels = ['40-80m', '80-120m', '120-160m', '160-200m']
        
        our_height_errors = []
        met_height_errors = []
        
        for i in range(len(height_bins)-1):
            mask = [(h >= height_bins[i] and h < height_bins[i+1]) for h in all_heights]
            our_errors_in_range = [e for j, e in enumerate(all_our_errors) if mask[j]]
            met_errors_in_range = [e for j, e in enumerate(all_met_errors) if mask[j]]
            
            our_height_errors.append(np.mean(our_errors_in_range) if our_errors_in_range else 0)
            met_height_errors.append(np.mean(met_errors_in_range) if met_errors_in_range else 0)
        
        x = np.arange(len(height_labels))
        ax_height_error.bar(x - 0.2, our_height_errors, 0.4, label='自研算法', 
                           color='skyblue', alpha=0.8)
        ax_height_error.bar(x + 0.2, met_height_errors, 0.4, label='MetodynWT', 
                           color='lightcoral', alpha=0.8)
        ax_height_error.axhline(y=3.0, color='red', linestyle='--', linewidth=2)
        
        ax_height_error.set_xlabel('高度范围')
        ax_height_error.set_ylabel('平均误差 (%)')
        ax_height_error.set_title('不同高度层的精度对比')
        ax_height_error.set_xticks(x)
        ax_height_error.set_xticklabels(height_labels)
        ax_height_error.legend()
        ax_height_error.grid(True, alpha=0.3)
        
        # 9. 计算时长对比
        our_time = comp_data['our_algorithm']['computation_time_hours']
        metodynwt_time = comp_data['metodynwt']['computation_time_hours']
        
        algorithms = ['自研算法', 'MetodynWT']
        times = [our_time, metodynwt_time]
        colors_time = ['lightgreen', 'orange']
        
        bars = ax_timing.bar(algorithms, times, color=colors_time, alpha=0.8)
        time_diff_percent = abs(our_time - metodynwt_time) / metodynwt_time * 100
        
        ax_timing.set_ylabel('计算时长 (小时)')
        ax_timing.set_title(f'计算效率对比\n差异: {time_diff_percent:.1f}%')
        ax_timing.grid(True, alpha=0.3)
        
        for bar in bars:
            height = bar.get_height()
            ax_timing.annotate(f'{height:.2f}h',
                             xy=(bar.get_x() + bar.get_width() / 2, height),
                             xytext=(0, 3), textcoords="offset points",
                             ha='center', va='bottom', fontsize=10)
        
        # 10. 性能摘要
        ax_summary.axis('off')
        
        summary_text = f"""性能评估:

精度评级:
{'✓ 优秀' if our_total_error <= 1 else '✓ 良好' if our_total_error <= 3 else '✗ 需改进'} 自研算法 ({our_total_error:.1f}%)
{'✓ 优秀' if met_total_error <= 1 else '✓ 良好' if met_total_error <= 3 else '✗ 需改进'} MetodynWT ({met_total_error:.1f}%)

效率评级:
{'✓ 满足' if time_diff_percent <= 5 else '✗ 不满足'} 时长差异 ({time_diff_percent:.1f}%)

综合评价:
算法{'胜出' if our_total_error < met_total_error else '相当' if abs(our_total_error - met_total_error) < 0.5 else '落后'}
"""
        
        ax_summary.text(0.05, 0.95, summary_text, transform=ax_summary.transAxes, 
                       fontsize=11, verticalalignment='top', fontfamily='monospace',
                       bbox=dict(boxstyle='round,pad=0.5', facecolor='lightyellow', alpha=0.8))
        
        # 11. ABL层次分析
        layer_names = ['近地面层', '混合层', '过渡层', 'ABL上部']
        layer_ranges = [(0, 80), (80, 140), (140, 180), (180, 250)]
        
        layer_our_errors = []
        layer_met_errors = []
        layer_counts = []
        
        for layer_range in layer_ranges:
            mask = [(h >= layer_range[0] and h < layer_range[1]) for h in all_heights]
            our_errors_in_layer = [e for j, e in enumerate(all_our_errors) if mask[j]]
            met_errors_in_layer = [e for j, e in enumerate(all_met_errors) if mask[j]]
            
            layer_our_errors.append(np.mean(our_errors_in_layer) if our_errors_in_layer else 0)
            layer_met_errors.append(np.mean(met_errors_in_layer) if met_errors_in_layer else 0)
            layer_counts.append(len(our_errors_in_layer))
        
        x = np.arange(len(layer_names))
        width = 0.35
        
        bars1 = ax_abl_layers.bar(x - width/2, layer_our_errors, width, 
                                 label='自研算法', color='skyblue', alpha=0.8)
        bars2 = ax_abl_layers.bar(x + width/2, layer_met_errors, width, 
                                 label='MetodynWT', color='lightcoral', alpha=0.8)
        ax_abl_layers.axhline(y=3.0, color='red', linestyle='--', linewidth=2, label='3%要求线')
        
        # 添加测点数量标签
        for i, (bar1, bar2) in enumerate(zip(bars1, bars2)):
            if layer_counts[i] > 0:
                ax_abl_layers.text(i, max(bar1.get_height(), bar2.get_height()) + 0.2, 
                                  f'{layer_counts[i]}点', ha='center', fontsize=9)
        
        ax_abl_layers.set_xlabel('大气边界层层次')
        ax_abl_layers.set_ylabel('平均相对误差 (%)')
        ax_abl_layers.set_title('大气边界层各层次精度对比')
        ax_abl_layers.set_xticks(x)
        ax_abl_layers.set_xticklabels(layer_names)
        ax_abl_layers.legend()
        ax_abl_layers.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # 保存图表
        output_filename = f"Case_{case_id:02d}_WD{wind_angle:.0f}_WS{wind_speed:.1f}_DetailedComparison.png"
        output_file = os.path.join(output_dir, output_filename)
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"工况 {case_id} 详细对比图已保存: {output_file}")
        return True
        
    except Exception as e:
        print(f"处理工况 {case_id} 时出错: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(description="为每个工况生成详细对比图")
    parser.add_argument("input_dir", help="包含数字子文件夹的主数据文件夹路径")
    
    args = parser.parse_args()
    set_font()
    
    base_input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.join(base_input_dir, "individual_case_comparisons")
    os.makedirs(output_dir, exist_ok=True)
    
    processed_count = 0
    error_count = 0
    
    case_items = [item for item in os.listdir(base_input_dir) 
                  if os.path.isdir(os.path.join(base_input_dir, item)) and item.isdigit()]
    
    print(f"为 {len(case_items)} 个工况生成详细对比图...")
    
    for item_name in sorted(case_items, key=int):
        item_path = os.path.join(base_input_dir, item_name)
        
        try:
            if create_individual_case_comparison(item_path, output_dir):
                processed_count += 1
            else:
                error_count += 1
        except Exception as e:
            print(f"处理案例 {item_name} 时出错: {e}")
            error_count += 1
    
    print(f"处理完成: 成功 {processed_count} 个, 失败 {error_count} 个")
    print(f"详细对比图保存在: {output_dir}")

if __name__ == "__main__":
    main()