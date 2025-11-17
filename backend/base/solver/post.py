# @Author: joe 847304926@qq.com
# @Date: 2025-06-27 16:23:28
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-07-03 22:30:24
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_1\windsim_run_20250626_020320\base\solver\post.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

import os
import numpy as np
from scipy.interpolate import griddata
from scipy.spatial.qhull import QhullError
import json
import sys

def process_data():
    """主处理函数，读取numh和dh来生成高度，并包含详细的错误处理。"""
    try:
        print("[INFO] Loading configuration from ../info.json...")
        with open("../info.json", 'r') as f:
            info = json.load(f)

        # 从配置中提取参数
        post_info = info['post']
        mesh_info = info['mesh']
        domain_info = info['domain']
        wind_info = info['wind']

        # --- CRITICAL FIX: Read numh and dh, then generate height_levels ---
        numh = post_info['numh']
        dh = post_info['dh']
        height_levels = [(i + 1) * dh for i in range(numh)]
        
        lt = domain_info['lt']
        width = post_info.get('width', 1000)
        height = post_info.get('height', 1000)
        
        print(f"[INFO] Parameters: numh={numh}, dh={dh}, grid_size=[{width}, {height}]")
        print(f"[INFO] Generated height levels: {height_levels}")

        # 初始化输出数组
        size = [width, height, numh]
        out = np.zeros([numh, height, width], dtype=np.float32)

        # 定义网格化的目标坐标
        x_range = np.linspace(-lt/2, lt/2, size[0])  # 这里保持不变
        y_range = np.linspace(-lt/2, lt/2, size[1])

        # ---- ① 打印网格整体范围 ----
        print(f"[DEBUG] Grid extent  : x [{x_range[0]:.2f}, {x_range[-1]:.2f}], "
              f"y [{y_range[0]:.2f}, {y_range[-1]:.2f}]  (total {width}×{height})")
        X, Y = np.meshgrid(x_range, y_range)

        # --- 主循环 ---
        for i, height_val in enumerate(height_levels):
            filepath = os.path.join('Output/plt', str(int(height_val))) # 使用int()确保文件名是整数
            print(f"\n[INFO] Processing height {height_val}m (index {i}) from file: {filepath}")

            if not os.path.exists(filepath):
                print(f"[WARNING] File not found: {filepath}. Skipping this height.")
                out[i,:,:] = np.nan
                continue
            
            if os.path.getsize(filepath) == 0:
                print(f"[WARNING] File is empty: {filepath}. Skipping this height.")
                out[i,:,:] = np.nan
                continue

            try:
                data = np.loadtxt(filepath)
                if data.ndim == 1: data = data.reshape(1, -1)
                if data.shape[1] < 6:
                    print(f"[WARNING] Not enough columns in {filepath}. Skipping.")
                    out[i,:,:] = np.nan
                    continue
            except ValueError as e:
                print(f"[ERROR] Failed to load {filepath}. Error: {e}. Skipping.")
                out[i,:,:] = np.nan
                continue

            print(f"[INFO] Loaded {data.shape[0]} data points.")
            scale = info['mesh']['scale']
            x = data[:, 0] /scale    
            y = data[:, 1]  /scale   

            # ---- ② 打印当前层散点范围 ----
            print(f"[DEBUG] Points range: x [{x.min():.2f}, {x.max():.2f}], "
                  f"y [{y.min():.2f}, {y.max():.2f}] "
                  f"({data.shape[0]} pts)")
            U = np.sqrt(np.sum(data[:, 3:6]**2, axis=1))

            U_interp = None
            try:
                print("[INFO] Attempting 'cubic' interpolation...")
                U_interp = griddata((x, y), U, (X, Y), method="cubic", fill_value=np.nan)
            except QhullError:
                print("[WARNING] 'cubic' interpolation failed. Falling back to 'linear'.")
                try:
                    U_interp = griddata((x, y), U, (X, Y), method="linear", fill_value=np.nan)
                except QhullError:
                    print("[WARNING] 'linear' interpolation also failed. Falling back to 'nearest'.")
                    U_interp = griddata((x, y), U, (X, Y), method="nearest")
            
            isnan_mask = np.isnan(U_interp)
            if np.any(isnan_mask):
                print(f"[INFO] Filling {np.sum(isnan_mask)} NaN values using 'nearest' neighbor.")
                U_interp_nn = griddata((x, y), U, (X, Y), method="nearest")
                U_interp[isnan_mask] = U_interp_nn[isnan_mask]

            # 之前我们猜测这里可能需要转置，这取决于X,Y的顺序和numpy数组索引的对应关系
            # 通常 griddata 的输出形状与 X, Y 相同，而 numpy 数组索引是 (row, col) 即 (y, x)
            # 所以 out[i, :, :] 对应 (height, width)，而 U_interp 是 (height, width) 形状，不需要转置
            out[i,:,:] = U_interp

            # ---- ③ 统计 NaN 比例 ----
            nan_ratio = np.isnan(U_interp).sum() / U_interp.size
            print(f"[DEBUG] NaN ratio after fill: {nan_ratio:.3%}")

        # 保存结果
        print("\n[INFO] Saving binary data to ../speed.bin")
        out.tofile("../speed.bin")

        print("[INFO] Saving metadata to ../output.json")
        output_meta = {
            "file": "speed.bin",
            "size": size,
            "range": [0, wind_info.get('speed', 1) * 1.5],
            "dh": dh,
            "heights": height_levels # 把具体的高度列表也存起来，这在后续可视化时很有用
        }
        with open("../output.json", 'w') as f:
            json.dump(output_meta, f, indent=4)
        
        print("\n[SUCCESS] FINISHED")

    except FileNotFoundError as e:
        print(f"[FATAL] A required file was not found: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyError as e:
        print(f"[FATAL] A required key was not found in the JSON configuration: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[FATAL] An unexpected error occurred: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    process_data()