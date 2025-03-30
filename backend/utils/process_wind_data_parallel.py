# @Author: joe 847304926@qq.com
# @Date: 2025-03-30 16:08:46
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-03-30 18:15:42
# @FilePath: backend/utils/process_wind_data_parallel.py
# @Description:
#
# Copyright (c) 2025 by joe, All Rights Reserved.

import os
import glob
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.font_manager import FontProperties, findfont
import platform
import math
from windrose import WindroseAxes
import seaborn as sns
from datetime import datetime
import warnings
import subprocess
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import time
import cProfile
import pstats
from pstats import SortKey
import gc
import re
import argparse  # Import argparse

warnings.filterwarnings('ignore')

# --- 辅助函数 ---
def debug_font_availability():
    """调试系统可用字体"""
    from matplotlib.font_manager import findSystemFonts

    print("================ 字体调试信息 ================")
    print(f"Matplotlib 缓存目录: {mpl.get_cachedir()}")

    # 尝试强制刷新字体缓存
    print("强制刷新字体缓存...")
    try:
        # Try the new method first
        try:
            mpl.font_manager.fontManager.rebuild()
            print("使用 fontManager.rebuild() 刷新字体缓存")
        except:
            # Fall back to older versions
            try:
                mpl.font_manager._rebuild()
                print("使用 font_manager._rebuild() 刷新字体缓存")
            except:
                # Last resort for very new versions
                mpl.font_manager.FontManager.rebuild()
                print("使用 FontManager.rebuild() 刷新字体缓存")
    except Exception as e:
        print(f"警告: 无法刷新字体缓存: {e}")
        print("继续进行字体检测...")

    # 列出系统中所有可用的字体文件
    fonts = findSystemFonts(fontpaths=None, fontext='ttf')
    print(f"系统中检测到 {len(fonts)} 个TTF/TTC字体文件")

    # 查找关键中文字体
    chinese_keywords = ["microsoft", "simhei", "simsun", "msyh", "yahei", "黑体", "宋体", "微软"]
    chinese_fonts = [f for f in fonts if any(kw in f.lower() for kw in chinese_keywords)]
    print("检测到的中文字体:")
    for font in chinese_fonts[:10]:  # 仅显示前10个
        print(f"  - {os.path.basename(font)}")
    if len(chinese_fonts) > 10:
        print(f"  - ... 还有 {len(chinese_fonts) - 10} 个中文字体")

    # 检查当前matplotlib使用的字体
    print("\n当前Matplotlib默认字体配置:")
    print(f"font.family: {plt.rcParams['font.family']}")
    print(f"font.sans-serif: {plt.rcParams['font.sans-serif']}")

    # 尝试查找常用中文字体
    test_fonts = ["Microsoft YaHei", "SimHei", "SimSun", "KaiTi", "FangSong"]
    print("\n测试中文字体可用性:")
    for font in test_fonts:
        try:
            found_font = findfont(FontProperties(family=font))
            is_fallback = "BitstreamVeraSans" in found_font or "DejaVuSans" in found_font
            status = "不可用 (回退到默认字体)" if is_fallback else "可用"
            print(f"  - {font}: {status}")
            if not is_fallback:
                print(f"    路径: {found_font}")
        except Exception as e:
            print(f"  - {font}: 错误 - {e}")

    print("=======================================")
    return chinese_fonts

def set_font_for_plot():
    """根据操作系统设置绘图字体 (Linux 优化)"""
    plt.rcParams['pdf.fonttype'] = 42
    plt.rcParams['ps.fonttype'] = 42
    plt.rcParams['axes.unicode_minus'] = False # 解决负号显示问题
    font_prop = None
    system = platform.system()

    if system == 'Linux':
        # 尝试常见的 Linux 中文字体
        # 你可以根据你的 Linux 环境调整这个列表的优先级或添加更多字体
        linux_fonts = ['WenQuanYi Micro Hei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Droid Sans Fallback', 'SimHei', 'Microsoft YaHei']
        found = False
        for font_name in linux_fonts:
            try:
                # 尝试查找字体
                findfont(FontProperties(family=font_name))
                # 设置为默认无衬线字体列表的首选
                plt.rcParams['font.sans-serif'] = [font_name] + plt.rcParams['font.sans-serif']
                print(f"使用 Linux 字体: {font_name}")
                try:
                    # 尝试创建 FontProperties 实例，供需要显式传递的地方使用
                       font_prop = FontProperties(family=font_name)
                except:
                    font_prop = None
                found = True
                break # 找到一个就停止
            except Exception:
                continue # 尝试下一个字体

            if not found:
                print("\n警告: 未在系统中找到推荐的 Linux 中文字体 (如 文泉驿微米黑, Noto Sans CJK SC 等)。")
                print("请确保您的 Linux 系统已安装并配置了至少一种 Matplotlib 可识别的中文字体。")
                print("绘图中的中文可能无法正确显示。\n")
                # 作为最后的手段，保留默认字体设置，避免程序崩溃
                plt.rcParams['font.family'] = 'sans-serif'


        else:
             # 如果意外在非 Linux 环境运行，打印警告
             print(f"警告: 此脚本的字体设置已为 Linux 优化，当前系统为 '{system}'。字体可能设置不正确。")
             # 可以保留一个非常通用的 sans-serif 作为绝对备选
             plt.rcParams['font.family'] = 'sans-serif'

        return font_prop # 返回找到的 FontProperties 或 None

def save_figure_with_chinese(fig, filepath):
    """保存图表，确保中文字符正确嵌入"""
    # 确保输出目录存在
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)

    try:
        # 尝试使用不同的后端保存
        backends = ['Agg', 'Cairo', 'PDF', 'SVG']
        saved = False

        for backend in backends:
            try:
                with plt.style.context('default'):
                    if backend != 'Agg':
                        plt.switch_backend(backend)
                    fig.savefig(filepath, bbox_inches='tight', dpi=150)
                    plt.switch_backend('Agg')  # 切回默认后端
                    saved = True
                    break
            except Exception:
                continue

        if not saved:
            # 如果所有后端都失败，尝试最基本的保存方式
            fig.savefig(filepath, bbox_inches='tight', dpi=150)

        print(f"图表已保存: {filepath}")
        return True
    except Exception as e:
        print(f"保存图表失败: {e}")
        # 尝试最后的保存方法
        try:
            plt.savefig(filepath + ".png", bbox_inches='tight', dpi=150)
            print(f"使用备用方法保存图表: {filepath}.png")
            return True
        except:
            print("所有保存方法均失败")
            return False

def optimized_csv_reader(file_path, chunksize=None):
    """Optimized CSV file reader with column filtering and type specification"""
    # Define which columns we need
    usecols = [
        'farm_id', 'date_time', 'radiation', 'surface_pressure', 'humidity2',
        'temperature2', 'temperature10', 'temperature30', 'temperature50', 'temperature70',
        'temperature80', 'temperature90', 'temperature110', 'direction10', 'direction30',
        'direction50', 'direction70', 'direction80', 'direction90', 'direction110',
        'speed10', 'speed30', 'speed50', 'speed70', 'speed80', 'speed90', 'speed110'
    ]

    # Define dtypes for faster reading and memory efficiency
    dtype_dict = {
        'farm_id': 'str',
        'radiation': 'float32',
        'surface_pressure': 'float32',
        'humidity2': 'float32',
        'temperature2': 'float32',
        'temperature10': 'float32',
        'temperature30': 'float32',
        'temperature50': 'float32',
        'temperature70': 'float32',
        'temperature80': 'float32',
        'temperature90': 'float32',
        'temperature110': 'float32',
        'direction10': 'float32',
        'direction30': 'float32',
        'direction50': 'float32',
        'direction70': 'float32',
        'direction80': 'float32',
        'direction90': 'float32',
        'direction110': 'float32',
        'speed10': 'float32',
        'speed30': 'float32',
        'speed50': 'float32',
        'speed70': 'float32',
        'speed80': 'float32',
        'speed90': 'float32',
        'speed110': 'float32'
    }

    # Parse dates automatically
    parse_dates = ['date_time']

    try:
        # Try reading with specific configuration first
        return pd.read_csv(
            file_path,
            usecols=usecols,
            dtype=dtype_dict,
            parse_dates=parse_dates,
            chunksize=chunksize,
            # Try multiple common encodings and delimiters
            encoding='utf-8',
            sep=','
        )
    except Exception as e:
        print(f"使用默认配置读取失败，尝试自动检测格式: {e}")

        # Try to detect encoding
        try:
            import chardet
            with open(file_path, 'rb') as f:
                result = chardet.detect(f.read(10000))
            detected_encoding = result['encoding']
            print(f"检测到的文件编码: {detected_encoding}")
        except:
            detected_encoding = 'utf-8'  # Default fallback
            print("无法检测文件编码，使用 utf-8")

        # Try to detect delimiter
        try:
            with open(file_path, 'r', encoding=detected_encoding, errors='ignore') as f:
                first_line = f.readline().strip()

            # Check common delimiters
            delimiters = [',', ';', '\t', '|']
            counts = [first_line.count(d) for d in delimiters]
            most_likely_delimiter = delimiters[counts.index(max(counts))]
            print(f"检测到的最可能分隔符: '{most_likely_delimiter}'")
        except:
            most_likely_delimiter = ','  # Default fallback
            print("无法检测分隔符，使用 ','")

        # Try reading with detected format
        try:
            return pd.read_csv(
                file_path,
                dtype=dtype_dict,
                parse_dates=parse_dates,
                chunksize=chunksize,
                encoding=detected_encoding,
                sep=most_likely_delimiter
            )
        except Exception as e:
            print(f"使用检测到的格式读取失败，尝试最基本配置: {e}")

            # Last resort - try with minimal options
            try:
                return pd.read_csv(file_path, chunksize=chunksize)
            except Exception as e:
                print(f"所有读取方法均失败: {e}")
                raise

def reduce_memory_usage(df):
    """Reduce memory usage of a DataFrame by downcasting numeric types"""
    start_mem = df.memory_usage().sum() / 1024**2
    print(f"Memory usage before optimization: {start_mem:.2f} MB")

    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            # Integers
            if pd.api.types.is_integer_dtype(df[col]):
                df[col] = pd.to_numeric(df[col], downcast='integer')
            # Floats
            else:
                df[col] = pd.to_numeric(df[col], downcast='float')

    end_mem = df.memory_usage().sum() / 1024**2
    print(f"Memory usage after optimization: {end_mem:.2f} MB")
    print(f"Reduced by {100 * (start_mem - end_mem) / start_mem:.2f}%")
    return df

def calculate_atmospheric_stability_vectorized(df):
    """Vectorized version of atmospheric stability calculation"""
    # Copy dataframe
    df_stability = df.copy()

    # Vectorized temperature gradient calculation
    df_stability['temp_gradient'] = (df['temperature110'] - df['temperature10']) / 100

    # Vectorized Richardson number calculation
    g = 9.81
    T_avg = (df['temperature10'] + df['temperature110']) / 2 + 273.15
    df_stability['speed_gradient'] = (df['speed110'] - df['speed10']) / 100

    # Replace zeros with small value to avoid division by zero
    mask = df_stability['speed_gradient'] == 0
    df_stability.loc[mask, 'speed_gradient'] = 1e-10

    # Vectorized calculation
    df_stability['richardson_number'] = (g / T_avg) * df_stability['temp_gradient'] / (df_stability['speed_gradient']**2)

    # Vectorized stability classification
    conditions = [
        (df_stability['richardson_number'] < -0.5),
        (df_stability['richardson_number'] >= -0.5) & (df_stability['richardson_number'] < -0.1),
        (df_stability['richardson_number'] >= -0.1) & (df_stability['richardson_number'] <= 0.1),
        (df_stability['richardson_number'] > 0.1) & (df_stability['richardson_number'] <= 0.5),
        (df_stability['richardson_number'] > 0.5)
    ]
    choices = ['强不稳定', '不稳定', '中性', '稳定', '强稳定']
    df_stability['stability_class'] = np.select(conditions, choices, default='未知')

    return df_stability

def plot_wind_rose(df, height=10, output_dir='./output', farm_id='unknown', date_str='unknown_date'):
    """生成风玫瑰图"""
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Filter data for specified height
        wind_direction = df[f'direction{height}']
        wind_speed = df[f'speed{height}']

        # Remove rows with NaN values
        mask = ~(np.isnan(wind_direction) | np.isnan(wind_speed))
        wind_direction = wind_direction[mask]
        wind_speed = wind_speed[mask]

        if len(wind_direction) == 0:
            print(f"警告: {height}m 高度没有有效的风向风速数据，跳过风玫瑰图")
            return False

        # Get font properties
        font_prop = set_font_for_plot()

        # Create figure
        fig = plt.figure(figsize=(10, 10), dpi=150)
        ax = WindroseAxes.from_ax(fig=fig)

        # Plot wind rose
        ax.bar(wind_direction, wind_speed, normed=True, opening=0.8, edgecolor='white')

        # Set legend with explicit font properties
        legend = ax.set_legend(title=f'风速 (m/s) - {height}m高度')

        # Apply font to legend title and text
        if font_prop:
            legend.get_title().set_fontproperties(font_prop)
            for text in legend.get_texts():
                text.set_fontproperties(font_prop)

        # Set title with explicit font properties
        title_text = f'风玫瑰图 - {height}m高度'
        if font_prop:
            ax.set_title(title_text, fontproperties=font_prop, fontsize=16)
        else:
            ax.set_title(title_text, fontsize=16)

        # Apply font to all axis labels
        if font_prop:
            for label in ax.get_xticklabels() + ax.get_yticklabels():
                label.set_fontproperties(font_prop)

        # Save figure
        output_path = os.path.join(output_dir, f'{farm_id}_{date_str}_windrose_{height}m.png')
        save_figure_with_chinese(fig, output_path)
        plt.close()
        return True
    except Exception as e:
        print(f"生成 {height}m 风玫瑰图时出错: {e}")
        plt.close('all')
        return False

def plot_wind_frequency(df, height=10, output_dir='./output', farm_id='unknown', date_str='unknown_date'):
    """生成风频分布图"""
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Explicitly ensure height is an integer
        height = int(height)

        # Check if the column exists first
        speed_column = f'speed{height}'
        if speed_column not in df.columns:
            print(f"警告: 数据中不存在 {speed_column} 列，跳过风频分布图")
            return False

        # Get wind speeds for specified height
        wind_speed = df[speed_column].copy()
        orig_count = len(wind_speed)
        wind_speed = wind_speed.dropna()
        if orig_count - len(wind_speed) > 0:
            print(f"注意: 从 {speed_column} 中移除了 {orig_count - len(wind_speed)} 个NaN值")

        if len(wind_speed) == 0:
            print(f"警告: {height}m 高度没有有效的风速数据，跳过风频分布图")
            return False

        # Create bins for wind speed categories
        bins = [0, 2, 4, 6, 8, 10, 12, 14, 16, np.inf]
        labels = ['0-2', '2-4', '4-6', '6-8', '8-10', '10-12', '12-14', '14-16', '>16']

        # Categorize wind speeds
        wind_categories = pd.cut(wind_speed, bins=bins, labels=labels, right=False)

        # Calculate frequency for each category
        frequency = wind_categories.value_counts(normalize=True).reindex(labels) * 100

        # Get font properties
        font_prop = set_font_for_plot()

        # Create figure
        fig = plt.figure(figsize=(12, 8), dpi=150)

        # Plot bar chart
        bars = plt.bar(frequency.index, frequency.values, color='skyblue', edgecolor='navy')

        # Add data labels on top of bars
        for bar in bars:
            height_val = bar.get_height()
            if font_prop:
                plt.text(bar.get_x() + bar.get_width()/2., height_val + 1,
                       f'{height_val:.1f}%', ha='center', va='bottom',
                       fontproperties=font_prop)
            else:
                plt.text(bar.get_x() + bar.get_width()/2., height_val + 1,
                       f'{height_val:.1f}%', ha='center', va='bottom')

        # Set labels and title
        if font_prop:
            plt.xlabel('风速范围 (m/s)', fontsize=14, fontproperties=font_prop)
            plt.ylabel('频率 (%)', fontsize=14, fontproperties=font_prop)
            plt.title(f'风速频率分布 - {height}m高度', fontsize=16, fontproperties=font_prop)
            for label in plt.gca().get_xticklabels() + plt.gca().get_yticklabels():
                label.set_fontproperties(font_prop)
        else:
            plt.xlabel('风速范围 (m/s)', fontsize=14)
            plt.ylabel('频率 (%)', fontsize=14)
            plt.title(f'风速频率分布 - {height}m高度', fontsize=16)

        plt.grid(axis='y', linestyle='--', alpha=0.7)

        # Ensure all bars are visible even if frequency is 0
        plt.ylim(0, max(frequency.values) * 1.2 if not frequency.empty else 10)

        # Save figure
        fig = plt.gcf() # get current figure
        output_path = os.path.join(output_dir, f'{farm_id}_{date_str}_wind_frequency_{height}m.png')
        save_figure_with_chinese(fig, output_path)
        plt.close()
        return True
    except Exception as e:
        print(f"生成 {height}m 风频分布图时出错: {e}")
        plt.close('all')  # Make sure to close all open figures
        return False

def plot_wind_energy(df, height=10, output_dir='./output', farm_id='unknown', date_str='unknown_date'):
    """生成风能分布图"""
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Explicitly ensure height is an integer
        height = int(height)

        # Check if the column exists first
        speed_column = f'speed{height}'
        if speed_column not in df.columns:
            print(f"警告: 数据中不存在 {speed_column} 列，跳过风能分布图")
            return False

        # Get wind speeds for specified height and handle NaN values properly
        wind_speed = df[speed_column].copy()
        orig_count = len(wind_speed)
        wind_speed = wind_speed.dropna()
        if orig_count - len(wind_speed) > 0:
            print(f"注意: 从 {speed_column} 中移除了 {orig_count - len(wind_speed)} 个NaN值")

        if len(wind_speed) == 0:
            print(f"警告: {height}m 高度没有有效的风速数据，跳过风能分布图")
            return False

        # Create bins for wind speed categories
        bins = [0, 2, 4, 6, 8, 10, 12, 14, 16, np.inf]
        labels = ['0-2', '2-4', '4-6', '6-8', '8-10', '10-12', '12-14', '14-16', '>16']

        # Categorize wind speeds
        wind_categories = pd.cut(wind_speed, bins=bins, labels=labels, right=False)

        # Create a dataframe with wind speeds and their categories
        wind_df = pd.DataFrame({
            'speed': wind_speed,
            'category': wind_categories
        })

        # Calculate wind energy for each speed (proportional to speed^3)
        air_density = 1.225  # kg/m³
        wind_df['energy'] = 0.5 * air_density * wind_df['speed']**3

        # Calculate average energy for each category and normalize
        energy_by_category = wind_df.groupby('category')['energy'].mean()
        total_energy = energy_by_category.sum()

        if total_energy == 0:
            print(f"警告: {height}m 高度的风能总和为零，跳过风能分布图")
            return False

        energy_percentage = (energy_by_category / total_energy * 100).reindex(labels)

        # Get font properties
        font_prop = set_font_for_plot()

        # Create figure
        fig = plt.figure(figsize=(12, 8), dpi=150)

        # Plot bar chart
        bars = plt.bar(energy_percentage.index, energy_percentage.values, color='salmon', edgecolor='darkred')

        # Add data labels on top of bars
        for bar in bars:
            height_val = bar.get_height()
            if not np.isnan(height_val) and height_val > 0:
                if font_prop:
                    plt.text(bar.get_x() + bar.get_width()/2., height_val + 1,
                            f'{height_val:.1f}%', ha='center', va='bottom',
                            fontproperties=font_prop)
                else:
                    plt.text(bar.get_x() + bar.get_width()/2., height_val + 1,
                            f'{height_val:.1f}%', ha='center', va='bottom')

        # Set labels and title
        if font_prop:
            plt.xlabel('风速范围 (m/s)', fontsize=14, fontproperties=font_prop)
            plt.ylabel('能量贡献 (%)', fontsize=14, fontproperties=font_prop)
            plt.title(f'风能分布 - {height}m高度', fontsize=16, fontproperties=font_prop)
            for label in plt.gca().get_xticklabels() + plt.gca().get_yticklabels():
                label.set_fontproperties(font_prop)
        else:
            plt.xlabel('风速范围 (m/s)', fontsize=14)
            plt.ylabel('能量贡献 (%)', fontsize=14)
            plt.title(f'风能分布 - {height}m高度', fontsize=16)

        plt.grid(axis='y', linestyle='--', alpha=0.7)

        # Ensure all bars are visible even if percentage is 0
        if not np.isnan(energy_percentage.values).all():
            plt.ylim(0, np.nanmax(energy_percentage.values) * 1.2)
        else:
            plt.ylim(0, 10)

        # Save figure
        fig = plt.gcf() # get current figure
        output_path = os.path.join(output_dir, f'{farm_id}_{date_str}_wind_energy_{height}m.png')
        save_figure_with_chinese(fig, output_path)
        plt.close()
        return True
    except Exception as e:
        print(f"生成 {height}m 风能分布图时出错: {e}")
        plt.close('all')  # Make sure to close all open figures
        return False

def plot_stability_distribution(df_stability, output_dir='./output', farm_id='unknown', date_str='unknown_date'):
    """生成大气稳定度分布图"""
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Count stability classes
        stability_counts = df_stability['stability_class'].value_counts()

        if len(stability_counts) == 0:
            print("警告: 没有有效的大气稳定度数据，跳过大气稳定度分布图")
            return False

        # Calculate percentages
        stability_percentages = stability_counts / stability_counts.sum() * 100

        # Define the order of stability classes
        stability_order = ['强不稳定', '不稳定', '中性', '稳定', '强稳定', '未知']

        # Reindex the percentages to ensure all classes are included in the correct order
        stability_percentages = stability_percentages.reindex(stability_order, fill_value=0)

        # Define colors for each stability class
        colors = {'强不稳定': '#d73027', '不稳定': '#fc8d59', '中性': '#fee090',
                '稳定': '#91bfdb', '强稳定': '#4575b4', '未知': '#999999'}

        # Get font property
        font_prop = set_font_for_plot()

        # Create figure
        fig = plt.figure(figsize=(12, 8), dpi=150)

        # Plot bar chart with specific colors
        bars = plt.bar(stability_percentages.index, stability_percentages.values,
                    color=[colors[c] for c in stability_percentages.index])

        # Add data labels on top of bars
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                plt.text(bar.get_x() + bar.get_width()/2., height + 1,
                        f'{height:.1f}%', ha='center', va='bottom', fontproperties=font_prop if font_prop else None)

        # Set labels and title
        plt.xlabel('大气稳定度类别', fontsize=14, fontproperties=font_prop if font_prop else None)
        plt.ylabel('频率 (%)', fontsize=14, fontproperties=font_prop if font_prop else None)
        plt.title('大气稳定度分布', fontsize=16, fontproperties=font_prop if font_prop else None)
        plt.xticks(fontproperties=font_prop if font_prop else None)
        plt.yticks(fontproperties=font_prop if font_prop else None)
        plt.grid(axis='y', linestyle='--', alpha=0.7)

        # Set ylim
        plt.ylim(0, max(stability_percentages.values) * 1.2 if not stability_percentages.empty else 10)

        # Save figure
        fig = plt.gcf() # get current figure
        output_path = os.path.join(output_dir, f'{farm_id}_{date_str}_stability_distribution.png')
        save_figure_with_chinese(fig, output_path)
        plt.close()
        return True
    except Exception as e:
        print(f"生成大气稳定度分布图时出错: {e}")
        plt.close('all')  # Make sure to close all open figures
        return False

def validate_data_format(df):
    """检查数据格式是否符合预期"""
    expected_columns = [
        'farm_id', 'date_time', 'radiation', 'surface_pressure', 'humidity2',
        'temperature2', 'temperature10', 'temperature30', 'temperature50', 'temperature70',
        'temperature80', 'temperature90', 'temperature110', 'direction10', 'direction30',
        'direction50', 'direction70', 'direction80', 'direction90', 'direction110',
        'speed10', 'speed30', 'speed50', 'speed70', 'speed80', 'speed90', 'speed110'
    ]

    # Check if all expected columns exist
    missing_columns = [col for col in expected_columns if col not in df.columns]
    if missing_columns:
        print(f"警告: 数据缺少以下列: {missing_columns}")
        # If critical columns are missing, return False
        critical_columns = ['farm_id', 'date_time', 'temperature10', 'temperature110', 'direction10', 'speed10']
        critical_missing = [col for col in critical_columns if col in missing_columns]
        if critical_missing:
            print(f"错误: 关键列缺失: {critical_missing}")
            return False
        print("非关键列缺失，继续处理...")

    # Check if farm_id is not empty
    if 'farm_id' in df.columns and df['farm_id'].isnull().all():
        print("警告: farm_id 列全部为空值")
        # Assign a default farm_id if none exists
        df['farm_id'] = 'unknown_farm'
        print("已设置默认 farm_id: unknown_farm")

    # Check if date_time is in the correct format
    if 'date_time' in df.columns:
        try:
            # Convert date_time to datetime if it's not already
            if not pd.api.types.is_datetime64_any_dtype(df['date_time']):
                # Try multiple formats
                try:
                    # Try standard format
                    df['date_time'] = pd.to_datetime(df['date_time'], format='%Y-%m-%d_%H:%M:%S')
                except:
                    try:
                        # Try alternative format
                        df['date_time'] = pd.to_datetime(df['date_time'])
                    except Exception as e:
                        print(f"警告: date_time 列格式无法识别: {e}")
                        return False
        except Exception as e:
            print(f"警告: date_time 列处理出错: {e}")
            return False

    # Check for negative wind speeds (which would be invalid)
    speed_columns = [col for col in df.columns if col.startswith('speed') and col in df.columns]
    for col in speed_columns:
        neg_count = (df[col] < 0).sum()
        if neg_count > 0:
            print(f"警告: {col} 列存在 {neg_count} 个负值，将其替换为NaN")
            df.loc[df[col] < 0, col] = np.nan

    # Check if wind direction is within valid range (0-360 degrees)
    direction_columns = [col for col in df.columns if col.startswith('direction') and col in df.columns]
    for col in direction_columns:
        invalid_count = ((df[col] < 0) | (df[col] > 360)).sum()
        if invalid_count > 0:
            print(f"警告: {col} 列有 {invalid_count} 个值不在有效范围内 (0-360)，将其替换为NaN")
            df.loc[(df[col] < 0) | (df[col] > 360), col] = np.nan

    return True

def process_csv_file(file_path, output_folder, sample_for_plots=10000):
    """Process a single CSV file, creating a unique output folder for each file."""
    try:
        file_name = os.path.basename(file_path)
        print(f"处理文件: {file_name}")

        # 根据 CSV 文件名（去掉扩展名）创建独立的文件夹
        csv_folder_name = os.path.splitext(file_name)[0]
        csv_output_folder = os.path.join(output_folder, csv_folder_name)
        os.makedirs(csv_output_folder, exist_ok=True)

        # Extract date from filename if possible (e.g. meteoforce_FARMID_2021010106_weather.csv)
        date_str = "unknown_date"
        date_match = re.search(r'_(\d{8,10})_', file_name)  # 支持8或10位日期
        if date_match:
            date_str = date_match.group(1)

        # 接下来判断是否使用分块处理（针对大文件）
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        use_chunking = file_size_mb > 100  # 大于100MB采用分块处理

        if use_chunking:
            print(f"文件大小: {file_size_mb:.2f} MB, 使用分块处理")
            chunk_size = 100000
            reader = optimized_csv_reader(file_path, chunksize=chunk_size)

            # Process first chunk for metadata
            first_chunk = next(reader)
            if not validate_data_format(first_chunk):
                print(f"警告: 文件 {file_name} 数据格式验证失败，跳过处理")
                return {"file": file_name, "status": "warning", "warning": "Data format validation failed",
                        "output_folder": csv_output_folder}

            # 获取 farm_id 信息
            farm_id = first_chunk['farm_id'].iloc[0] if 'farm_id' in first_chunk.columns else 'unknown'

            # 保存统计信息到当前 CSV 文件的文件夹中
            stats_df = pd.concat([
                first_chunk.describe(),
                pd.DataFrame({'data_rows': [first_chunk.shape[0]]}),
                pd.DataFrame({'data_columns': [first_chunk.shape[1]]}),
                pd.DataFrame({'file_size_mb': [file_size_mb]})
            ])
            stats_df.to_csv(os.path.join(csv_output_folder, f"{farm_id}_{date_str}_statistics.csv"))

            print(f"生成 {farm_id} 分析图表...")
            # 用采样数据绘制图表
            df_sample = first_chunk.sample(min(sample_for_plots, len(first_chunk)), random_state=42)
            for chunk in reader:
                if len(df_sample) < sample_for_plots:
                    sample_needed = sample_for_plots - len(df_sample)
                    if len(chunk) > sample_needed:
                        df_sample = pd.concat([df_sample, chunk.sample(sample_needed, random_state=42)])
                    else:
                        df_sample = pd.concat([df_sample, chunk])
            # 计算大气稳定性（用采样数据计算即可）
            df_stability = calculate_atmospheric_stability_vectorized(df_sample)
        else:
            print(f"文件大小: {file_size_mb:.2f} MB, 一次性处理")
            df = optimized_csv_reader(file_path)
            df = reduce_memory_usage(df)
            if not validate_data_format(df):
                print(f"警告: 文件 {file_name} 数据格式验证失败，跳过处理")
                return {"file": file_name, "status": "warning", "warning": "Data format validation failed",
                        "output_folder": csv_output_folder}
            print(f"文件 {file_name} 数据格式验证成功")
            farm_id = df['farm_id'].iloc[0] if 'farm_id' in df.columns else 'unknown'
            df_stability = calculate_atmospheric_stability_vectorized(df)
            # 如有需要，将处理过的数据保存
            df.to_csv(os.path.join(csv_output_folder, f"{farm_id}_{date_str}_processed_data.csv"), index=False)
            # 对绘图采用采样数据减少绘图负担
            df_sample = df.sample(min(sample_for_plots, len(df)), random_state=42)

        # 生成各类图表（采样数据用于绘图）
        plots_created = []
        heights = [10, 30, 50, 70, 80, 90, 110]
        for height in heights:
            speed_col = f'speed{height}'
            direction_col = f'direction{height}'
            if speed_col in df_sample.columns and direction_col in df_sample.columns:
                print(f"  生成 {height}m 高度的风玫瑰图...")
                if plot_wind_rose(df_sample, height=height, output_dir=csv_output_folder, farm_id=farm_id, date_str=date_str):
                    plots_created.append(f"windrose_{height}m")
                print(f"  生成 {height}m 高度的风频分布图...")
                if plot_wind_frequency(df_sample, height=height, output_dir=csv_output_folder, farm_id=farm_id, date_str=date_str):
                    plots_created.append(f"wind_frequency_{height}m")
                print(f"  生成 {height}m 高度的风能分布图...")
                if plot_wind_energy(df_sample, height=height, output_dir=csv_output_folder, farm_id=farm_id, date_str=date_str):
                    plots_created.append(f"wind_energy_{height}m")

        print("  生成大气稳定度分布图...")
        if plot_stability_distribution(df_stability, output_dir=csv_output_folder, farm_id=farm_id, date_str=date_str):
            plots_created.append("stability_distribution")

        # 保存大气稳定度数据
        df_stability.to_csv(os.path.join(csv_output_folder, f"{farm_id}_{date_str}_stability_data.csv"), index=False)

        print(f"文件 {file_name} 处理完成，生成了 {len(plots_created)} 个图表")
        gc.collect()
        return {
            "file": file_name,
            "farm_id": farm_id,
            "status": "success",
            "plots_created": plots_created,
            "output_folder": csv_output_folder
        }

    except Exception as e:
        print(f"处理文件 {file_name} 时出错: {e}")
        import traceback
        traceback.print_exc()
        return {"file": file_name, "status": "error", "error": str(e), "output_folder": csv_output_folder if 'csv_output_folder' in locals() else None}

def process_wind_data_parallel(data_folder, output_folder='./output', max_workers=None, files_to_process=None): # 添加 files_to_process 参数
    """Process wind data files in parallel and output a summary of all processed folders."""
    os.makedirs(output_folder, exist_ok=True)
    set_font_for_plot()

    if files_to_process: # 如果指定了要处理的文件列表
        csv_files = [os.path.join(data_folder, file) for file in files_to_process]
        csv_files = [file for file in csv_files if os.path.exists(file)] # 确保文件存在
        print(f"从文件列表中获取了 {len(csv_files)} 个CSV文件")
    else: # 否则处理目录下所有 CSV 文件
        csv_files = glob.glob(os.path.join(data_folder, "*.csv"))
        print(f"从目录中获取了 {len(csv_files)} 个CSV文件")

    if not csv_files:
        print(f"错误: 在 {data_folder} 文件夹中没有找到CSV文件")
        return []

    print(f"找到 {len(csv_files)} 个CSV文件，开始并行处理 (workers={max_workers})...")

    results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {
            executor.submit(process_csv_file, file, output_folder): file
            for file in csv_files
        }

        try:
            from tqdm import tqdm
            progress_iterator = tqdm(as_completed(future_to_file), total=len(future_to_file), desc="处理CSV文件")
        except ImportError:
            progress_iterator = as_completed(future_to_file)
            print("开始处理文件...")

        for future in progress_iterator:
            file = future_to_file[future]
            try:
                result = future.result()
                results.append(result)
                if not 'tqdm' in sys.modules:
                    print(f"完成: {os.path.basename(file)} - 状态: {result['status']}")
                if result['status'] == 'warning':
                    print(f"  警告信息: {result.get('warning', '未知')}")
                elif result['status'] == 'error':
                    print(f"  错误信息: {result.get('error', '未知')}")
            except Exception as e:
                print(f"处理文件 {os.path.basename(file)} 时出错: {e}")
                import traceback
                traceback.print_exc()

    # 汇总所有结果并生成报告
    success_count = sum(1 for r in results if r['status'] == 'success')
    warning_count = sum(1 for r in results if r['status'] == 'warning')
    error_count = sum(1 for r in results if r['status'] == 'error')

    # 汇总所有独立文件夹路径
    processed_folders = [r["output_folder"] for r in results if r.get("output_folder")]

    summary_report = {
        'total_files': len(csv_files),
        'success': success_count,
        'warning': warning_count,
        'error': error_count,
        'processed_folders': processed_folders,
        'farms': {}
    }

    # 这里继续对同一农场的结果进行分组（如果需要）
    for farm_id, farm_data in summary_report.get('farms', {}).items(): # 循环遍历 farms 字典
        if 'plots' in farm_data and isinstance(farm_data['plots'], set): # 检查 'plots' 键是否存在且为 set 类型
            farm_data['plots'] = sorted(list(farm_data['plots'])) # 将 plots 集合转换为排序后的列表

    # 将汇总报告写入文件
    import json
    summary_path = os.path.join(output_folder, 'processing_summary.json')
    try:
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary_report, f, ensure_ascii=False, indent=2)
        print(f"处理摘要已保存到 {summary_path}")
    except Exception as e:
        print(f"错误：无法将处理摘要写入 JSON 文件: {e}")
        # 可以考虑在这里也返回错误状态或记录更详细的日志

    return results

def profile_processing(data_folder, output_folder):
    """Profile the wind data processing to identify bottlenecks"""
    # Setup profiler
    profiler = cProfile.Profile()
    profiler.enable()

    # Run the processing function (with a small sample)
    # Process just a few files for profiling
    csv_files = glob.glob(os.path.join(data_folder, "*.csv"))
    if len(csv_files) > 3:
        csv_files = csv_files[:3]  # Just take the first 3 for profiling

    sample_output = os.path.join(output_folder, "profile_sample")
    os.makedirs(sample_output, exist_ok=True)

    for file in csv_files:
        process_csv_file(file, sample_output)

    # Disable profiler
    profiler.disable()

    # Print stats sorted by cumulative time
    stats = pstats.Stats(profiler).sort_stats(SortKey.CUMULATIVE)
    stats.print_stats(20)  # Print top 20 functions by time

    # Save detailed stats to a file
    stats.dump_stats("wind_processing_profile.prof")
    print("Profile saved to wind_processing_profile.prof")

    try:
        # Try to generate a more readable report if gprof2dot is available
        subprocess.run("pip install gprof2dot", shell=True)
        subprocess.run("gprof2dot -f pstats wind_processing_profile.prof | dot -Tpng -o profile_visualization.png", shell=True)
        print("Visual profile saved to profile_visualization.png")
    except:
        print("Could not generate visual profile (gprof2dot may not be installed)")

if __name__ == "__main__":
    import argparse
    import time
    import sys

    # Create the parser
    parser = argparse.ArgumentParser(description='Optimized 风数据自动处理脚本 (CSV版本)')

    # Add arguments
    parser.add_argument('--input', type=str, required=True, help='输入数据文件夹路径 (包含CSV文件)')
    parser.add_argument('--output', type=str, default='./output', help='输出结果文件夹路径 (默认: ./output)')
    parser.add_argument('--profile', action='store_true', help='是否进行性能分析')
    parser.add_argument('--workers', type=int, default=None, help='并行处理worker数量 (默认: CPU核心数)')
    parser.add_argument('--sample', type=int, default=10000, help='绘图采样点数量 (默认: 10000)')
    parser.add_argument('--files', type=str, help='包含要处理的文件列表的文本文件路径') # 添加 --files 参数

    # Parse arguments
    args = parser.parse_args()

    input_folder = args.input
    output_folder = args.output
    profile_enabled = args.profile
    workers = args.workers
    sample_size = args.sample
    files_list_path = args.files # 获取文件列表路径

    file_list = None # 初始化文件列表

    if files_list_path and os.path.exists(files_list_path): # 如果提供了文件列表路径且文件存在
        with open(files_list_path, 'r') as f:
            file_list = [line.strip() for line in f.readlines() if line.strip()] # 从文件中读取文件列表
        print(f"从文件列表中读取到 {len(file_list)} 个文件")

    if profile_enabled:
        print("开始性能分析...")
        profile_processing(input_folder, output_folder)
        print("性能分析完成，结果保存在 wind_processing_profile.prof")
    else:
        print("开始处理风数据...")
        start_time = time.time()
        results = process_wind_data_parallel(input_folder, output_folder, max_workers=workers, files_to_process=file_list) # 传递文件列表
        elapsed_time = time.time() - start_time

        if results:
            success_count = sum(1 for r in results if r['status'] == 'success')
            warning_count = sum(1 for r in results if r['status'] == 'warning')
            error_count = sum(1 for r in results if r['status'] == 'error')

            print(f"数据处理完成. 总处理时间: {elapsed_time:.2f} 秒")
            print(f"处理结果：成功: {success_count}, 警告: {warning_count}, 失败: {error_count}")
            print(f"输出结果保存在: {output_folder}")

            if len(results) > 0:
                avg_time = elapsed_time / len(results)
                print(f"平均每个文件处理时间: {avg_time:.2f} 秒")
        else:
            print("没有找到可处理的文件或处理过程中出现严重错误")