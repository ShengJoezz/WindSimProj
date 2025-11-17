# @Author: joe 847304926@qq.com
# @Date: 2025-03-30 19:44:27
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-03-30 19:54:03
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\process_wind_data_parallel.py
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
import argparse # Keep argparse
import json # Added for JSON summary
import sys # Added for sys.exit

warnings.filterwarnings('ignore', category=UserWarning, module='matplotlib') # Be more specific
warnings.filterwarnings('ignore', category=RuntimeWarning) # Ignore common numpy runtime warnings

# --- Font and Plotting Utilities (Keep as is, minor print adjustments) ---
def debug_font_availability():
    """调试系统可用字体"""
    from matplotlib.font_manager import findSystemFonts
    print("\n--- Font Debug Information ---")
    # ... (rest of the function remains the same) ...
    print("--- End Font Debug ---\n")
    return chinese_fonts

def set_font_for_plot():
    """根据操作系统设置绘图字体 (Linux 优化)"""
    plt.rcParams['pdf.fonttype'] = 42
    plt.rcParams['ps.fonttype'] = 42
    plt.rcParams['axes.unicode_minus'] = False
    font_prop = None
    system = platform.system()
    preferred_fonts = []

    if system == 'Linux':
        preferred_fonts = ['WenQuanYi Micro Hei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Droid Sans Fallback', 'SimHei', 'Microsoft YaHei']
        print("[Font Setup] Detected Linux system.")
    elif system == 'Windows':
        preferred_fonts = ['Microsoft YaHei', 'SimHei', 'SimSun', 'DengXian']
        print("[Font Setup] Detected Windows system.")
    elif system == 'Darwin': # macOS
        preferred_fonts = ['PingFang SC', 'Hiragino Sans GB', 'Arial Unicode MS', 'Microsoft YaHei']
        print("[Font Setup] Detected macOS system.")
    else:
        print(f"[Font Setup] Detected system: {system}. Using default sans-serif.")
        plt.rcParams['font.family'] = 'sans-serif'
        return None

    found = False
    for font_name in preferred_fonts:
        try:
            findfont(FontProperties(family=font_name))
            # Set as the first choice in the sans-serif list
            plt.rcParams['font.sans-serif'] = [font_name] + plt.rcParams['font.sans-serif']
            print(f"[Font Setup] Using font: '{font_name}'")
            try:
                font_prop = FontProperties(family=font_name)
            except Exception as fp_err:
                print(f"[Font Setup] Warning: Could not create FontProperties for '{font_name}': {fp_err}")
                font_prop = None # Fallback if FontProperties fails
            found = True
            break
        except Exception:
            # Font not found by findfont, try next
            continue

    if not found:
        print(f"\n[Font Setup] Warning: Could not find any preferred fonts: {preferred_fonts}.")
        print("[Font Setup] Chinese characters in plots might not display correctly.")
        print("[Font Setup] Please ensure appropriate fonts are installed and accessible by Matplotlib.")
        # Fallback to generic sans-serif
        plt.rcParams['font.family'] = 'sans-serif'
        font_prop = None # Ensure font_prop is None if no specific font found

    return font_prop


def save_figure_with_chinese(fig, filepath):
    """保存图表，确保中文字符正确嵌入"""
    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        # Save directly, relying on rcParams for font embedding
        fig.savefig(filepath, bbox_inches='tight', dpi=150)
        print(f"图表已保存: {os.path.basename(filepath)}") # Print only filename
        plt.close(fig) # Close the specific figure
        return True
    except Exception as e:
        print(f"保存图表失败 {os.path.basename(filepath)}: {e}")
        plt.close(fig) # Ensure figure is closed even on error
        return False

# --- Data Reading and Processing Utilities (Keep as is, minor print adjustments) ---
def optimized_csv_reader(file_path, chunksize=None):
    """Optimized CSV file reader with column filtering and type specification"""
    usecols = [
        'farm_id', 'date_time', 'radiation', 'surface_pressure', 'humidity2',
        'temperature2', 'temperature10', 'temperature30', 'temperature50', 'temperature70',
        'temperature80', 'temperature90', 'temperature110', 'direction10', 'direction30',
        'direction50', 'direction70', 'direction80', 'direction90', 'direction110',
        'speed10', 'speed30', 'speed50', 'speed70', 'speed80', 'speed90', 'speed110'
    ]
    dtype_dict = {col: 'float32' for col in usecols if col not in ['farm_id', 'date_time']}
    dtype_dict['farm_id'] = 'str'
    parse_dates = ['date_time']

    encodings_to_try = ['utf-8', 'gbk', 'gb2312', 'latin1']
    delimiters_to_try = [',', ';', '\t']

    for encoding in encodings_to_try:
        for delimiter in delimiters_to_try:
            try:
                # print(f"尝试读取: 编码='{encoding}', 分隔符='{delimiter}'")
                return pd.read_csv(
                    file_path,
                    usecols=lambda c: c in usecols, # Use lambda for robustness if columns missing
                    dtype=dtype_dict,
                    parse_dates=parse_dates,
                    chunksize=chunksize,
                    encoding=encoding,
                    sep=delimiter,
                    low_memory=False, # Often helps with mixed types or large files
                    on_bad_lines='warn' # Report problematic lines
                )
            except (UnicodeDecodeError, pd.errors.ParserError, ValueError) as e:
                 # print(f"读取失败 ({encoding}, {delimiter}): {e}")
                 continue # Try next combination
            except Exception as e:
                 print(f"读取时发生意外错误 ({encoding}, {delimiter}): {e}")
                 # If it's a FileNotFoundError, raise it immediately
                 if isinstance(e, FileNotFoundError):
                      raise e
                 continue

    # If all combinations fail
    print(f"错误: 无法使用任何标准配置读取文件: {os.path.basename(file_path)}")
    print("请检查文件编码、分隔符和内容格式。")
    raise ValueError(f"Failed to read CSV file: {os.path.basename(file_path)}")

def reduce_memory_usage(df):
    """Reduce memory usage of a DataFrame by downcasting numeric types"""
    start_mem = df.memory_usage(deep=True).sum() / 1024**2
    # print(f"  内存占用 (优化前): {start_mem:.2f} MB")
    for col in df.columns:
        col_type = df[col].dtype
        if pd.api.types.is_datetime64_any_dtype(col_type) or col_type == 'object':
             continue # Skip datetime and object types for now

        if pd.api.types.is_numeric_dtype(col_type):
            c_min = df[col].min()
            c_max = df[col].max()
            if pd.api.types.is_integer_dtype(col_type):
                if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                    df[col] = df[col].astype(np.int8)
                elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                    df[col] = df[col].astype(np.int16)
                elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                    df[col] = df[col].astype(np.int32)
                elif c_min > np.iinfo(np.int64).min and c_max < np.iinfo(np.int64).max:
                    df[col] = df[col].astype(np.int64)
            else: # Float
                # Use float32 always, as float16 has limited precision
                 if c_min > np.finfo(np.float32).min and c_max < np.finfo(np.float32).max:
                     df[col] = df[col].astype(np.float32)
                 else:
                     df[col] = df[col].astype(np.float64) # Keep as float64 if range exceeds float32
    end_mem = df.memory_usage(deep=True).sum() / 1024**2
    # print(f"  内存占用 (优化后): {end_mem:.2f} MB (减少 {100 * (start_mem - end_mem) / start_mem:.1f}%)")
    return df

def calculate_atmospheric_stability_vectorized(df):
    """Vectorized version of atmospheric stability calculation"""
    if not all(c in df.columns for c in ['temperature10', 'temperature110', 'speed10', 'speed110']):
        print("警告: 缺少计算大气稳定度所需的列 (temp/speed at 10/110m)，跳过计算。")
        df['stability_class'] = '未知 (缺少数据)'
        return df

    # Work on a copy to avoid modifying original df if passed by reference
    df_stability = pd.DataFrame(index=df.index)
    df_stability['temp_gradient'] = (df['temperature110'] - df['temperature10']) / 100.0
    df_stability['speed_gradient'] = (df['speed110'] - df['speed10']) / 100.0

    g = 9.81
    # Calculate average temperature in Kelvin, handle potential NaNs
    T_avg_C = (df['temperature10'] + df['temperature110']) / 2.0
    T_avg_K = T_avg_C + 273.15

    # Avoid division by zero or NaN in T_avg_K
    T_avg_K = T_avg_K.replace(0, np.nan) # Replace 0 Kelvin with NaN

    # Avoid division by zero in speed_gradient, replace with a small number
    # Be careful with inplace modifications if df is large
    speed_gradient_safe = df_stability['speed_gradient'].replace(0, 1e-6)

    # Calculate Richardson number, handle potential NaNs from inputs
    richardson_number = (g / T_avg_K) * df_stability['temp_gradient'] / (speed_gradient_safe**2)

    # Classify stability based on Richardson number
    conditions = [
        (richardson_number < -0.5),
        (richardson_number >= -0.5) & (richardson_number < -0.1),
        (richardson_number >= -0.1) & (richardson_number <= 0.1),
        (richardson_number > 0.1) & (richardson_number <= 0.5),
        (richardson_number > 0.5)
    ]
    choices = ['强不稳定', '不稳定', '中性', '稳定', '强稳定']

    # Use np.select for vectorized conditional assignment
    # Handle NaN Richardson numbers explicitly
    df_stability['stability_class'] = np.select(conditions, choices, default='中性') # Default to Neutral seems reasonable
    df_stability.loc[richardson_number.isna(), 'stability_class'] = '未知 (计算错误)' # Mark NaNs explicitly

    # Add the stability class back to the original DataFrame (or return df_stability)
    df['stability_class'] = df_stability['stability_class']
    return df # Return the modified original DataFrame


# --- Plotting Functions (Updated paths) ---
def plot_wind_rose(df, height=10, output_dir='./output', source_filename='unknown_file', farm_id='unknown', date_str='unknown_date', font_prop=None):
    """生成风玫瑰图"""
    plot_filename = f'{source_filename}_windrose_{height}m.png'
    output_path = os.path.join(output_dir, plot_filename)

    try:
        direction_col, speed_col = f'direction{height}', f'speed{height}'
        if direction_col not in df.columns or speed_col not in df.columns:
            print(f"  跳过: 缺少 {height}m 风向/风速数据")
            return False

        wind_direction = df[direction_col].dropna()
        wind_speed = df[speed_col].dropna()
        # Align indices after dropping NaNs separately
        common_index = wind_direction.index.intersection(wind_speed.index)
        wind_direction = wind_direction.loc[common_index]
        wind_speed = wind_speed.loc[common_index]


        if len(wind_direction) == 0:
            print(f"  跳过: {height}m 无有效风向/风速数据")
            return False

        fig = plt.figure(figsize=(8, 8), dpi=150) # Slightly smaller default size
        try: # Use try-finally to ensure figure is closed
            ax = WindroseAxes.from_ax(fig=fig)
            ax.bar(wind_direction, wind_speed, normed=True, opening=0.8, edgecolor='white')
            legend = ax.set_legend(title=f'风速 (m/s)', loc='upper left', bbox_to_anchor=(-0.1, 1.1))

            title_text = f'源文件: {source_filename}\n{height}m高度 风玫瑰图'
            if font_prop:
                ax.set_title(title_text, fontproperties=font_prop, fontsize=14, y=1.12)
                if legend:
                    plt.setp(legend.get_texts(), fontproperties=font_prop)
                    legend.get_title().set_fontproperties(font_prop)
                # Apply font to tick labels - might need adjustment based on WindroseAxes version
                try:
                    plt.setp(ax.get_xticklabels(), fontproperties=font_prop)
                    plt.setp(ax.get_yticklabels(), fontproperties=font_prop)
                except Exception as tick_err:
                    print(f"  注意: 设置风玫瑰图刻度标签字体时出错: {tick_err}")
            else:
                ax.set_title(title_text, fontsize=14, y=1.12)

            return save_figure_with_chinese(fig, output_path)
        finally:
            plt.close(fig) # Ensure figure is closed

    except Exception as e:
        print(f"  错误: 生成 {height}m 风玫瑰图 ({plot_filename}) 时出错: {e}")
        import traceback
        # traceback.print_exc() # Uncomment for detailed stack trace during debugging
        plt.close('all') # Close any potentially lingering figures
        return False

def plot_wind_frequency(df, height=10, output_dir='./output', source_filename='unknown_file', farm_id='unknown', date_str='unknown_date', font_prop=None):
    """生成风频分布图"""
    plot_filename = f'{source_filename}_wind_frequency_{height}m.png'
    output_path = os.path.join(output_dir, plot_filename)

    try:
        speed_column = f'speed{height}'
        if speed_column not in df.columns:
            print(f"  跳过: 数据中不存在 {speed_column} 列")
            return False

        wind_speed = df[speed_column].dropna()
        if len(wind_speed) == 0:
            print(f"  跳过: {height}m 高度没有有效的风速数据")
            return False

        bins = np.arange(0, wind_speed.max() + 2, 2) # Dynamic bins based on max speed
        labels = [f'{bins[i]}-{bins[i+1]}' for i in range(len(bins)-1)]

        wind_categories = pd.cut(wind_speed, bins=bins, labels=labels, right=False, include_lowest=True)
        frequency = wind_categories.value_counts(normalize=True).reindex(labels, fill_value=0.0) * 100

        fig, ax = plt.subplots(figsize=(10, 6), dpi=150) # Use object-oriented approach
        try:
            bars = ax.bar(frequency.index, frequency.values, color='skyblue', edgecolor='navy', width=0.8)
            ax.set_xlabel('风速范围 (m/s)', fontsize=12, fontproperties=font_prop)
            ax.set_ylabel('频率 (%)', fontsize=12, fontproperties=font_prop)
            ax.set_title(f'源文件: {source_filename}\n{height}m高度 风速频率分布', fontsize=14, fontproperties=font_prop)
            ax.grid(axis='y', linestyle='--', alpha=0.7)
            ax.set_ylim(0, max(frequency.max() * 1.15, 10)) # Ensure y-axis starts at 0 and has some headroom

            # Add data labels
            for bar in bars:
                height_val = bar.get_height()
                if height_val > 0.1: # Only label bars with significant height
                    ax.text(bar.get_x() + bar.get_width()/2., height_val + 0.5,
                           f'{height_val:.1f}%', ha='center', va='bottom', fontsize=9, fontproperties=font_prop)

            # Apply font to tick labels
            plt.setp(ax.get_xticklabels(), fontproperties=font_prop, rotation=45, ha='right') # Rotate labels
            plt.setp(ax.get_yticklabels(), fontproperties=font_prop)

            plt.tight_layout() # Adjust layout
            return save_figure_with_chinese(fig, output_path)
        finally:
            plt.close(fig)

    except Exception as e:
        print(f"  错误: 生成 {height}m 风频分布图 ({plot_filename}) 时出错: {e}")
        plt.close('all')
        return False

def plot_wind_energy(df, height=10, output_dir='./output', source_filename='unknown_file', farm_id='unknown', date_str='unknown_date', font_prop=None):
    """生成风能分布图"""
    plot_filename = f'{source_filename}_wind_energy_{height}m.png'
    output_path = os.path.join(output_dir, plot_filename)

    try:
        speed_column = f'speed{height}'
        if speed_column not in df.columns:
            print(f"  跳过: 数据中不存在 {speed_column} 列")
            return False

        wind_speed = df[speed_column].dropna()
        if len(wind_speed) == 0:
            print(f"  跳过: {height}m 高度没有有效的风速数据")
            return False

        # Use the same dynamic bins as frequency plot for consistency
        bins = np.arange(0, wind_speed.max() + 2, 2)
        labels = [f'{bins[i]}-{bins[i+1]}' for i in range(len(bins)-1)]

        wind_categories = pd.cut(wind_speed, bins=bins, labels=labels, right=False, include_lowest=True)
        wind_df = pd.DataFrame({'speed': wind_speed, 'category': wind_categories})

        air_density = 1.225
        wind_df['energy_density'] = 0.5 * air_density * (wind_df['speed']**3) # Proportional to energy

        # Sum energy density per category instead of averaging
        energy_by_category = wind_df.groupby('category')['energy_density'].sum()
        total_energy_density = energy_by_category.sum()

        if total_energy_density == 0:
            print(f"  警告: {height}m 高度的总风能密度为零，跳过风能图")
            return False

        energy_percentage = (energy_by_category / total_energy_density * 100).reindex(labels, fill_value=0.0)

        fig, ax = plt.subplots(figsize=(10, 6), dpi=150)
        try:
            bars = ax.bar(energy_percentage.index, energy_percentage.values, color='salmon', edgecolor='darkred', width=0.8)
            ax.set_xlabel('风速范围 (m/s)', fontsize=12, fontproperties=font_prop)
            ax.set_ylabel('风能密度贡献 (%)', fontsize=12, fontproperties=font_prop)
            ax.set_title(f'源文件: {source_filename}\n{height}m高度 风能密度分布', fontsize=14, fontproperties=font_prop)
            ax.grid(axis='y', linestyle='--', alpha=0.7)
            ax.set_ylim(0, max(energy_percentage.max() * 1.15, 10))

            for bar in bars:
                height_val = bar.get_height()
                if height_val > 0.1:
                    ax.text(bar.get_x() + bar.get_width()/2., height_val + 0.5,
                           f'{height_val:.1f}%', ha='center', va='bottom', fontsize=9, fontproperties=font_prop)

            plt.setp(ax.get_xticklabels(), fontproperties=font_prop, rotation=45, ha='right')
            plt.setp(ax.get_yticklabels(), fontproperties=font_prop)

            plt.tight_layout()
            return save_figure_with_chinese(fig, output_path)
        finally:
            plt.close(fig)

    except Exception as e:
        print(f"  错误: 生成 {height}m 风能分布图 ({plot_filename}) 时出错: {e}")
        plt.close('all')
        return False

def plot_stability_distribution(df_stability, output_dir='./output', source_filename='unknown_file', farm_id='unknown', date_str='unknown_date', font_prop=None):
    """生成大气稳定度分布图"""
    plot_filename = f'{source_filename}_stability_distribution.png'
    output_path = os.path.join(output_dir, plot_filename)

    try:
        if 'stability_class' not in df_stability.columns:
             print(f"  跳过: 缺少 'stability_class' 列")
             return False

        stability_counts = df_stability['stability_class'].value_counts()
        if len(stability_counts) == 0 or stability_counts.sum() == 0:
            print("  跳过: 没有有效的大气稳定度数据")
            return False

        stability_percentages = stability_counts / stability_counts.sum() * 100
        stability_order = ['强不稳定', '不稳定', '中性', '稳定', '强稳定', '未知 (计算错误)', '未知 (缺少数据)'] # Include all possible categories
        stability_percentages = stability_percentages.reindex(stability_order, fill_value=0)
        # Filter out categories with 0% that were not in the original data
        stability_percentages = stability_percentages[stability_percentages > 0]


        colors_map = {'强不稳定': '#d73027', '不稳定': '#fc8d59', '中性': '#fee090',
                    '稳定': '#91bfdb', '强稳定': '#4575b4',
                    '未知 (计算错误)': '#cccccc', '未知 (缺少数据)': '#999999'}
        # Get colors only for the categories present
        plot_colors = [colors_map.get(c, '#999999') for c in stability_percentages.index]

        fig, ax = plt.subplots(figsize=(10, 6), dpi=150)
        try:
            bars = ax.bar(stability_percentages.index, stability_percentages.values, color=plot_colors, width=0.7)
            ax.set_xlabel('大气稳定度类别', fontsize=12, fontproperties=font_prop)
            ax.set_ylabel('频率 (%)', fontsize=12, fontproperties=font_prop)
            ax.set_title(f'源文件: {source_filename}\n大气稳定度分布', fontsize=14, fontproperties=font_prop)
            ax.grid(axis='y', linestyle='--', alpha=0.7)
            ax.set_ylim(0, max(stability_percentages.max() * 1.15, 10))

            for bar in bars:
                height = bar.get_height()
                if height > 0.1:
                    ax.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                           f'{height:.1f}%', ha='center', va='bottom', fontsize=9, fontproperties=font_prop)

            plt.setp(ax.get_xticklabels(), fontproperties=font_prop, rotation=0) # No rotation needed usually
            plt.setp(ax.get_yticklabels(), fontproperties=font_prop)

            plt.tight_layout()
            return save_figure_with_chinese(fig, output_path)
        finally:
             plt.close(fig)

    except Exception as e:
        print(f"  错误: 生成大气稳定度分布图 ({plot_filename}) 时出错: {e}")
        plt.close('all')
        return False


# --- Data Validation ---
def validate_data_format(df, filename=""):
    """检查数据格式是否符合预期"""
    print(f"  验证数据格式: {filename}...")
    required_cols = ['farm_id', 'date_time', 'speed10', 'direction10'] # Minimum required
    numeric_cols = [
        'radiation', 'surface_pressure', 'humidity2',
        'temperature2', 'temperature10', 'temperature30', 'temperature50', 'temperature70',
        'temperature80', 'temperature90', 'temperature110', 'direction10', 'direction30',
        'direction50', 'direction70', 'direction80', 'direction90', 'direction110',
        'speed10', 'speed30', 'speed50', 'speed70', 'speed80', 'speed90', 'speed110'
    ]
    is_valid = True
    warnings_list = []

    # Check for required columns
    missing_required = [col for col in required_cols if col not in df.columns]
    if missing_required:
        msg = f"关键列缺失: {', '.join(missing_required)}"
        print(f"    错误: {msg}")
        warnings_list.append(msg)
        return False, warnings_list # Cannot proceed without required columns

    # Check other numeric columns, issue warnings if missing
    missing_numeric = [col for col in numeric_cols if col not in df.columns]
    if missing_numeric:
         msg = f"数值列缺失: {', '.join(missing_numeric)}"
         print(f"    警告: {msg}")
         warnings_list.append(msg)
         # Allow processing to continue, but stability/plots might fail later

    # Check farm_id
    if df['farm_id'].isnull().all():
         msg = "farm_id 列全部为空值, 使用 'unknown_farm'"
         print(f"    警告: {msg}")
         warnings_list.append(msg)
         df['farm_id'].fillna('unknown_farm', inplace=True)
    elif df['farm_id'].nunique() > 1:
         msg = f"文件中包含多个 farm_id ({df['farm_id'].nunique()}个), 使用第一个 ({df['farm_id'].iloc[0]})"
         print(f"    警告: {msg}")
         warnings_list.append(msg)
         # Optionally standardize to the first farm_id? Or handle per farm?
         # For now, use the first one for naming conventions.

    # Check date_time format and NaNs
    if not pd.api.types.is_datetime64_any_dtype(df['date_time']):
        msg = "date_time 列不是日期时间格式"
        print(f"    错误: {msg}")
        warnings_list.append(msg)
        is_valid = False
    elif df['date_time'].isnull().any():
         nan_count = df['date_time'].isnull().sum()
         msg = f"date_time 列包含 {nan_count} 个空值"
         print(f"    警告: {msg}")
         warnings_list.append(msg)
         # Allow processing, but rows with NaT will be dropped by plots/analysis

    # Check numeric ranges (example for speed and direction)
    speed_cols = [col for col in df.columns if col.startswith('speed')]
    for col in speed_cols:
        if df[col].min() < 0:
            neg_count = (df[col] < 0).sum()
            msg = f"{col} 列包含 {neg_count} 个负值 (已替换为 NaN)"
            print(f"    警告: {msg}")
            warnings_list.append(msg)
            df.loc[df[col] < 0, col] = np.nan
            is_valid = False # Treat negative speed as data error
        # Check for excessively high speeds (e.g., > 100 m/s)
        high_speed_threshold = 100
        if df[col].max() > high_speed_threshold:
            high_count = (df[col] > high_speed_threshold).sum()
            msg = f"{col} 列包含 {high_count} 个超高值 (> {high_speed_threshold} m/s) (已替换为 NaN)"
            print(f"    警告: {msg}")
            warnings_list.append(msg)
            df.loc[df[col] > high_speed_threshold, col] = np.nan
            is_valid = False # Treat very high speed as data error


    direction_cols = [col for col in df.columns if col.startswith('direction')]
    for col in direction_cols:
        invalid_dir = (df[col] < 0) | (df[col] > 360)
        if invalid_dir.any():
            inv_count = invalid_dir.sum()
            msg = f"{col} 列包含 {inv_count} 个无效值 (不在 0-360 范围内) (已替换为 NaN)"
            print(f"    警告: {msg}")
            warnings_list.append(msg)
            df.loc[invalid_dir, col] = np.nan
            is_valid = False # Treat invalid direction as data error

    print(f"  数据格式验证完成. 状态: {'有效' if is_valid else '存在问题'}")
    return is_valid, warnings_list


# --- Main Processing Function (Single File) ---
def process_csv_file(file_path, base_output_folder, sample_for_plots=10000):
    """Process a single CSV file, creating output within the base_output_folder."""
    file_name = os.path.basename(file_path)
    print(f"\n开始处理文件: {file_name}")
    start_time = time.time()

    # Determine farm_id and date_str early for naming
    farm_id = 'unknown_farm'
    date_str = "unknown_date"
    try:
        # Peek at the first few rows to get farm_id without reading the whole file yet
        peek_df = pd.read_csv(file_path, nrows=5, usecols=['farm_id'], encoding='utf-8', sep=',') # Assume common format for peek
        if 'farm_id' in peek_df.columns and not peek_df['farm_id'].isnull().all():
             farm_id = peek_df['farm_id'].iloc[0]
    except Exception:
         # Try other common formats if peek fails
        try:
             peek_df = pd.read_csv(file_path, nrows=5, usecols=['farm_id'], encoding='gbk', sep=',')
             if 'farm_id' in peek_df.columns and not peek_df['farm_id'].isnull().all():
                  farm_id = peek_df['farm_id'].iloc[0]
        except Exception:
             print(f"  警告: 无法从文件 {file_name} 的前几行提取 farm_id。将使用 '{farm_id}'。")

    # Extract date from filename
    date_match = re.search(r'(\d{8,14})', file_name) # More flexible date regex
    if date_match:
        date_str = date_match.group(1)
    else:
         print(f"  警告: 无法从文件名 {file_name} 提取日期。将使用 '{date_str}'。")

    # Define output paths using base_output_folder
    processed_data_path = os.path.join(base_output_folder, f"{farm_id}_{date_str}_processed_data.csv.gz") # Compress output
    stability_data_path = os.path.join(base_output_folder, f"{farm_id}_{date_str}_stability_data.csv.gz")
    stats_path = os.path.join(base_output_folder, f"{farm_id}_{date_str}_statistics.csv")

    # Ensure the base output directory exists (should be created by parent process)
    os.makedirs(base_output_folder, exist_ok=True)

    plots_created = []
    file_info = {
        "file": file_name,
        "farm_id": farm_id,
        "date_str": date_str,
        "status": "processing",
        "plots_created": [],
        "output_folder": base_output_folder, # Use the passed base folder
        "warnings": [],
        "error": None,
        "rows_processed": 0,
        "processing_time_sec": 0
    }

    try:
        # Read and process data (chunking logic simplified, read all at once for now)
        # Re-introduce chunking if memory becomes an issue again
        print(f"  读取数据...")
        df = optimized_csv_reader(file_path)
        print(f"  数据读取完成. 行数: {len(df)}")
        file_info["rows_processed"] = len(df)

        print(f"  优化内存使用...")
        df = reduce_memory_usage(df)

        # Validate data format
        is_valid, validation_warnings = validate_data_format(df, file_name)
        file_info["warnings"].extend(validation_warnings)
        if not is_valid:
             # Decide if processing should stop based on validation warnings
             # For now, continue but log issues
             print(f"  警告: 文件 {file_name} 数据格式存在问题，分析可能不准确。")
             file_info["status"] = "warning" # Mark as warning if format issues found
        else:
            print(f"  数据格式验证成功。")


        # Correct farm_id based on validation if needed
        if 'farm_id' in df.columns:
            file_info["farm_id"] = df['farm_id'].iloc[0] # Use the validated/assigned farm_id

        # Save basic statistics
        print(f"  计算并保存统计信息...")
        try:
             stats_df = df.describe(include='all', datetime_is_numeric=True).transpose() # Get comprehensive stats
             stats_df.to_csv(stats_path)
        except Exception as stats_err:
             msg = f"保存统计信息失败: {stats_err}"
             print(f"    错误: {msg}")
             file_info["warnings"].append(msg)

        # Calculate Atmospheric Stability
        print(f"  计算大气稳定度...")
        df = calculate_atmospheric_stability_vectorized(df)
        # Save stability data (consider saving only relevant columns)
        try:
            stability_cols = ['date_time', 'stability_class'] + [c for c in df.columns if c.startswith(('temp', 'speed'))]
            df[stability_cols].to_csv(stability_data_path, index=False, compression='gzip')
        except Exception as stab_save_err:
            msg = f"保存稳定度数据失败: {stab_save_err}"
            print(f"    错误: {msg}")
            file_info["warnings"].append(msg)


        # Save processed data (optional, can be large)
        # print(f"  保存处理后的数据...")
        # df.to_csv(processed_data_path, index=False, compression='gzip')

        # Generate Plots (using sampled data for performance)
        print(f"  准备生成图表 (采样 {min(sample_for_plots, len(df))} 点)...")
        df_sample = df.sample(min(sample_for_plots, len(df)), random_state=42) if len(df) > sample_for_plots else df
        font_prop = set_font_for_plot() # Set font before plotting loop

        # Get a clean version of the source filename (without extension)
        clean_source_name = Path(file_name).stem

        heights = [10, 30, 50, 70, 80, 90, 110]
        plot_functions = {
            "windrose": plot_wind_rose,
            "wind_frequency": plot_wind_frequency,
            "wind_energy": plot_wind_energy
        }

        for height in heights:
            print(f"  生成 {height}m 高度图表:")
            for plot_type, plot_func in plot_functions.items():
                print(f"    - {plot_type}...")
                if plot_func(df_sample, height=height, output_dir=base_output_folder, source_filename=clean_source_name, farm_id=file_info["farm_id"], date_str=date_str, font_prop=font_prop):
                    plots_created.append(f"{plot_type}_{height}m")

        print(f"  生成大气稳定度分布图:")
        if plot_stability_distribution(df, output_dir=base_output_folder, source_filename=clean_source_name, farm_id=file_info["farm_id"], date_str=date_str, font_prop=font_prop):
            plots_created.append("stability_distribution")

        file_info["plots_created"] = plots_created
        # If status was 'processing' or 'warning', and we reached here without fatal errors, mark as success/warning
        if file_info["status"] == "processing":
            file_info["status"] = "success"

        print(f"文件 {file_name} 处理完成. 状态: {file_info['status']}")

    except Exception as e:
        print(f"处理文件 {file_name} 时发生严重错误: {e}")
        import traceback
        traceback.print_exc() # Log full traceback for debugging
        file_info["status"] = "error"
        file_info["error"] = str(e)
        # Attempt to write an error file within the output directory
        try:
            error_log_path = os.path.join(base_output_folder, 'error.log')
            with open(error_log_path, 'w', encoding='utf-8') as f_err:
                 f_err.write(f"Error processing file: {file_name}\n")
                 f_err.write(f"Time: {datetime.now().isoformat()}\n")
                 f_err.write(f"Error Details: {str(e)}\n\n")
                 f_err.write("Traceback:\n")
                 traceback.print_exc(file=f_err)
            print(f"  错误日志已写入: {error_log_path}")
        except Exception as log_err:
             print(f"  写入错误日志失败: {log_err}")

    finally:
        # Cleanup memory
        del df, df_sample
        gc.collect()
        end_time = time.time()
        file_info["processing_time_sec"] = round(end_time - start_time, 2)
        print(f"文件 {file_name} 处理耗时: {file_info['processing_time_sec']:.2f} 秒")

    return file_info


# --- Main Parallel Processing Function ---
def process_wind_data_parallel(
    data_folder,
    output_folder, # This is the BASE output folder (e.g., ./output)
    analysis_id,   # Unique ID for this analysis run
    max_workers=None,
    files_to_process=None,
    analysis_name="未命名分析", # Added parameters from frontend config
    description="",
    parameters=None # Dictionary of analysis parameters
    ):
    """Process wind data files in parallel for a specific analysis run."""

    # Create the specific output directory for THIS analysis run
    analysis_output_dir = os.path.join(output_folder, analysis_id)
    print(f"创建分析输出目录: {analysis_output_dir}")
    os.makedirs(analysis_output_dir, exist_ok=True)

    # Set font once for the entire process
    set_font_for_plot()

    # Determine the list of CSV files to process
    if files_to_process:
        # Ensure paths are absolute or relative to data_folder
        csv_files = [os.path.join(data_folder, f) for f in files_to_process if isinstance(f, str)]
        # Filter out files that don't exist
        csv_files = [f for f in csv_files if os.path.exists(f)]
        print(f"从文件列表中选择了 {len(csv_files)} 个CSV文件进行处理。")
    else:
        # Process all CSVs in the input folder if no specific list provided
        print(f"警告: 未提供具体文件列表，将处理输入目录 '{data_folder}' 中的所有CSV文件。")
        csv_files = glob.glob(os.path.join(data_folder, "*.csv"))
        print(f"从目录中自动选择了 {len(csv_files)} 个CSV文件。")

    if not csv_files:
        msg = f"错误: 在 '{data_folder}' 中没有找到要处理的CSV文件。"
        print(msg)
        # Write error log for this analysis run
        error_log_path = os.path.join(analysis_output_dir, 'error.log')
        with open(error_log_path, 'w', encoding='utf-8') as f_err:
            f_err.write(f"Analysis ID: {analysis_id}\n")
            f_err.write(f"Error: {msg}\n")
        sys.exit(1) # Exit script with error code

    print(f"开始并行处理 {len(csv_files)} 个文件 (Workers: {max_workers or '默认'})...")
    start_run_time = time.time()

    results_list = [] # Store results from each file processing task
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit tasks: pass the analysis_output_dir as the base for each file
        future_to_file = {
            executor.submit(process_csv_file, file, analysis_output_dir): file
            for file in csv_files
        }

        # Progress reporting (optional using tqdm if installed)
        try:
            from tqdm import tqdm
            progress_iterator = tqdm(as_completed(future_to_file), total=len(future_to_file), desc=f"分析 {analysis_id}")
        except ImportError:
            progress_iterator = as_completed(future_to_file)
            print("开始处理文件 (无进度条)...")

        for i, future in enumerate(progress_iterator):
            file_path = future_to_file[future]
            file_name = os.path.basename(file_path)
            try:
                result = future.result() # Get result from process_csv_file
                results_list.append(result)
                # Update progress description if using tqdm
                if 'tqdm' in sys.modules:
                    progress_iterator.set_postfix({
                        "状态": result['status'],
                        "文件": file_name[-20:] # Show last part of filename
                    })
                else: # Basic console logging without tqdm
                    print(f"  ({i+1}/{len(csv_files)}) 完成: {file_name} - 状态: {result['status']} ({result['processing_time_sec']:.2f}s)")
                    if result['status'] == 'warning':
                         for warn in result.get('warnings', []): print(f"    警告: {warn}")
                    elif result['status'] == 'error':
                         print(f"    错误: {result.get('error', '未知错误')}")

            except Exception as exc:
                # Handle errors where the future itself failed (e.g., process crash)
                print(f"处理文件 {file_name} 时发生严重异常: {exc}")
                import traceback
                traceback.print_exc()
                results_list.append({
                    "file": file_name,
                    "status": "error",
                    "error": f"处理过程中发生未捕获的异常: {exc}",
                    "output_folder": analysis_output_dir,
                    "processing_time_sec": 0,
                    "warnings": [],
                    "plots_created": []
                })

    # --- Analysis Run Summary ---
    end_run_time = time.time()
    total_run_time = round(end_run_time - start_run_time, 2)

    success_count = sum(1 for r in results_list if r['status'] == 'success')
    warning_count = sum(1 for r in results_list if r['status'] == 'warning')
    error_count = sum(1 for r in results_list if r['status'] == 'error')
    total_processed = len(results_list)

    # Determine overall status based on file results
    overall_status = "error" # Default to error
    if total_processed == len(csv_files):
        if error_count == 0 and warning_count == 0:
            overall_status = "completed"
        elif error_count == 0 and warning_count > 0:
            overall_status = "completed_with_warnings"
        elif error_count > 0:
             overall_status = "failed" # Treat any error as overall failure

    print(f"\n--- 分析任务 '{analysis_name}' (ID: {analysis_id}) 完成 ---")
    print(f"总耗时: {total_run_time:.2f} 秒")
    print(f"处理文件: {total_processed} / {len(csv_files)}")
    print(f"  - 成功: {success_count}")
    print(f"  - 警告: {warning_count}")
    print(f"  - 失败: {error_count}")
    print(f"总体状态: {overall_status}")
    print(f"详细结果保存在: {analysis_output_dir}")

    # Create the final summary JSON for this analysis run
    summary_data = {
        'analysisId': analysis_id,
        'analysisName': analysis_name,
        'description': description,
        'status': overall_status,
        'startTime': datetime.fromtimestamp(start_run_time).isoformat(),
        'endTime': datetime.fromtimestamp(end_run_time).isoformat(),
        'totalDurationSec': total_run_time,
        'inputDataFolder': data_folder,
        'outputDataFolder': analysis_output_dir,
        'parameters': parameters or {}, # Include analysis parameters
        'files_requested': len(csv_files),
        'files_processed': total_processed,
        'success_files': success_count,
        'warning_files': warning_count,
        'error_files': error_count,
        'processed_files_details': results_list, # Include details of each file
         # Add aggregated info if needed, e.g., unique farm IDs processed
        'unique_farm_ids': list(set(r['farm_id'] for r in results_list if 'farm_id' in r))
    }

    summary_path = os.path.join(analysis_output_dir, 'processing_summary.json')
    error_log_path = os.path.join(analysis_output_dir, 'error.log')

    try:
        # Write summary JSON
        with open(summary_path, 'w', encoding='utf-8') as f_summary:
            json.dump(summary_data, f_summary, ensure_ascii=False, indent=2)
        print(f"分析摘要已保存: {summary_path}")

        # If the overall status is 'failed', ensure error.log exists with summary info
        if overall_status == 'failed':
            if not os.path.exists(error_log_path): # Create if not already created by a file error
                 with open(error_log_path, 'w', encoding='utf-8') as f_err:
                      f_err.write(f"Analysis ID: {analysis_id}\n")
                      f_err.write(f"Overall Status: {overall_status}\n")
                      f_err.write(f"Total Files: {len(csv_files)}, Errors: {error_count}\n\n")
                      f_err.write("File Errors:\n")
                      for result in results_list:
                          if result['status'] == 'error':
                              f_err.write(f" - {result['file']}: {result.get('error', 'Unknown error')}\n")
                 print(f"总体错误日志已写入: {error_log_path}")
            else:
                 print(f"错误日志已存在 (可能由文件处理错误创建): {error_log_path}")
        elif os.path.exists(error_log_path):
            # If overall status is NOT failed, but an error log exists (from a recoverable file error), maybe rename it?
            print(f"警告: 分析总体成功/有警告，但存在错误日志 {error_log_path} (可能来自个别文件处理失败)。")
            # os.rename(error_log_path, os.path.join(analysis_output_dir, 'file_errors.log'))


    except Exception as e:
        print(f"错误: 无法写入最终的分析摘要或错误日志: {e}")
        # Attempt to write a minimal error log if summary writing fails
        try:
            if not os.path.exists(error_log_path):
                 with open(error_log_path, 'w', encoding='utf-8') as f_err:
                      f_err.write(f"Analysis ID: {analysis_id}\n")
                      f_err.write(f"FATAL ERROR: Failed to write processing_summary.json\n")
                      f_err.write(f"Error: {str(e)}\n")
        except:
             pass # Ignore errors writing the fallback error log
        sys.exit(1) # Exit with error if summary cannot be written


    # Exit with 0 if completed (even with warnings), 1 if failed
    if overall_status == "failed":
        sys.exit(1)
    else:
        sys.exit(0)

# --- Profiling Function (Keep as is) ---
def profile_processing(data_folder, output_folder):
    # ... (profiling function remains the same) ...
    pass

# --- Command Line Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='并行处理测风塔CSV数据脚本')
    parser.add_argument('--input', type=str, required=True, help='包含CSV文件的输入数据文件夹路径')
    parser.add_argument('--output', type=str, required=True, help='总输出文件夹的基础路径')
    parser.add_argument('--analysisId', type=str, required=True, help='本次分析任务的唯一ID')
    parser.add_argument('--analysisName', type=str, default='未命名分析', help='分析任务的可读名称')
    parser.add_argument('--description', type=str, default='', help='分析任务的描述')
    parser.add_argument('--files', type=str, help='可选：包含要处理的文件名列表的文本文件路径 (每行一个文件名)')
    parser.add_argument('--parameters', type=str, help='可选：JSON字符串格式的分析参数 (例如: \'{"threshold": 60, "method": "standard"}\')')
    parser.add_argument('--workers', type=int, default=None, help='并行处理的worker数量 (默认: CPU核心数)')
    parser.add_argument('--profile', action='store_true', help='是否执行性能分析 (会覆盖正常执行)')

    args = parser.parse_args()

    # --- Input Validation ---
    if not os.path.isdir(args.input):
        print(f"错误: 输入文件夹不存在或不是一个目录: {args.input}")
        sys.exit(1)
    if not args.analysisId:
        print(f"错误: 必须提供 --analysisId 参数")
        sys.exit(1)
    # Basic validation for analysisId format (alphanumeric, hyphen, underscore)
    if not re.match(r'^[a-zA-Z0-9-_]+$', args.analysisId):
         print(f"错误: analysisId 包含无效字符。请只使用字母、数字、下划线和连字符。")
         sys.exit(1)


    # Ensure base output directory exists
    os.makedirs(args.output, exist_ok=True)

    # --- Performance Profiling Mode ---
    if args.profile:
        print("开始性能分析模式...")
        # Create a dedicated output folder for profiling results
        profile_output_dir = os.path.join(args.output, f"{args.analysisId}_profile")
        profile_processing(args.input, profile_output_dir)
        print(f"性能分析完成。结果可能保存在 {profile_output_dir} 和 .prof 文件中。")
        sys.exit(0) # Exit after profiling

    # --- Normal Execution Mode ---
    print(f"\n=== 开始风数据分析任务 ===")
    print(f"分析 ID:     {args.analysisId}")
    print(f"分析名称:    {args.analysisName}")
    print(f"输入目录:    {args.input}")
    print(f"输出基目录: {args.output}")

    # Load file list if provided
    files_to_process_list = None
    if args.files:
        if os.path.isfile(args.files):
            try:
                with open(args.files, 'r', encoding='utf-8') as f:
                    files_to_process_list = [line.strip() for line in f if line.strip()]
                if files_to_process_list:
                    print(f"处理文件列表: 从 {args.files} 加载了 {len(files_to_process_list)} 个文件")
                else:
                    print(f"警告: 文件列表 {args.files} 为空。")
                    files_to_process_list = None # Treat as if no list provided
            except Exception as e:
                print(f"警告: 无法读取文件列表 {args.files}: {e}。将处理输入目录中的所有CSV。")
                files_to_process_list = None
        else:
            print(f"警告: 指定的文件列表不存在: {args.files}。将处理输入目录中的所有CSV。")
            files_to_process_list = None

    # Parse JSON parameters if provided
    analysis_parameters = None
    if args.parameters:
        try:
            analysis_parameters = json.loads(args.parameters)
            if isinstance(analysis_parameters, dict):
                 print(f"分析参数:    {json.dumps(analysis_parameters)}")
            else:
                 print("警告: --parameters 参数不是有效的JSON对象，将被忽略。")
                 analysis_parameters = None
        except json.JSONDecodeError as e:
            print(f"警告: 解析 --parameters 参数失败: {e}。参数将被忽略。")
            analysis_parameters = None

    # Call the main processing function
    # Note: sys.exit() is called within process_wind_data_parallel based on outcome
    process_wind_data_parallel(
        data_folder=args.input,
        output_folder=args.output,
        analysis_id=args.analysisId,
        max_workers=args.workers,
        files_to_process=files_to_process_list,
        analysis_name=args.analysisName,
        description=args.description,
        parameters=analysis_parameters
    )