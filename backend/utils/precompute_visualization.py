# precompute_visualization.py
import os
import json
import math
import argparse
import numpy as np
from scipy.interpolate import RegularGridInterpolator
import sys
import traceback
import time

def numpy_to_python(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, (np.int_, np.intc, np.intp, np.int8, np.int16, np.int32, np.int64, np.uint8, np.uint16, np.uint32, np.uint64)): # 更全面的整数类型
        return int(obj)
    elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)): # 更全面的浮点类型
        # 处理 NaN 和 Inf，JSON不支持它们
        if np.isnan(obj):
            return None # 或者返回 "NaN" 字符串，取决于前端如何处理
        elif np.isinf(obj):
            return None # 或者根据情况返回极大/极小值字符串
        return float(obj)
    elif isinstance(obj, np.ndarray):
        # 递归处理数组中的元素
        return [numpy_to_python(item) for item in obj]
    elif isinstance(obj, (np.bool_)):
        return bool(obj)
    elif isinstance(obj, (np.void)): # 比如结构化数组的元素
        return None
    # 添加对 Python 原生类型的处理，防止递归错误
    elif isinstance(obj, (int, float, str, bool, list, dict, type(None))):
        return obj
    else:
        # 对于不确定类型，尝试转换为字符串或报告错误
        print(f"Warning: Unhandled type {type(obj)} during serialization. Converting to string.", file=sys.stderr)
        return str(obj)


def load_speed_data(binfile, meta):
    """Loads speed data, ensuring correct dimensions."""
    if not meta or not isinstance(meta, dict):
        raise ValueError("Invalid metadata: metadata must be a dictionary")

    size = meta.get("size")
    if not size or len(size) != 3:
        raise ValueError("output.json 'size' must be an array of [width, height, num_layers]")

    # Ensure dimensions are positive integers
    try:
        post_width, post_height, num_layers = map(int, size)
        if not all(d > 0 for d in [post_width, post_height, num_layers]):
            raise ValueError("Dimensions must be positive integers.")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid dimensions in output.json: {size}. {e}") from e

    if not os.path.exists(binfile):
         raise FileNotFoundError(f"Speed data file not found: {binfile}") # Check file existence here

    try:
        data = np.fromfile(binfile, dtype=np.float32)
    except IOError as e:
        raise IOError(f"Error reading speed data file {binfile}: {e}") from e

    expected_size = post_width * post_height * num_layers
    if data.size != expected_size:
        rel_binfile = os.path.relpath(binfile)
        raise ValueError(
            f"Data size mismatch in '{rel_binfile}'. "
            f"Expected {expected_size} values ({post_width}x{post_height}x{num_layers}), "
            f"but found {data.size}. Check 'size' in output.json or the binary file itself."
        )
    data = data.reshape((num_layers, post_height, post_width))
    # 处理 NaN 和 Inf 值，替换为 None，以便 JSON 序列化
    data = np.where(np.isnan(data), None, data)
    data = np.where(np.isinf(data), None, data)
    return data, post_width, post_height, num_layers


def precompute_all_data(case_id):
    """Loads all data, performs all calculations, and saves results to cache files."""
    start_time = time.time()
    print(f"Starting pre-computation for case: {case_id}")

    base_path = os.path.join(os.path.dirname(__file__), '..', 'uploads', case_id)
    meta_path = os.path.join(base_path, 'output.json')
    info_path = os.path.join(base_path, 'info.json')
    cache_base_path = os.path.join(base_path, 'visualization_cache')
    slices_path = os.path.join(cache_base_path, 'slices')
    profiles_path = os.path.join(cache_base_path, 'profiles')
    wakes_path = os.path.join(cache_base_path, 'wakes')

    # --- 0. 创建缓存目录 ---
    os.makedirs(slices_path, exist_ok=True)
    os.makedirs(profiles_path, exist_ok=True)
    os.makedirs(wakes_path, exist_ok=True)
    print(f"Cache directories ensured/created at {cache_base_path}")

    try:
        # --- 1. 加载元数据和工况信息 ---
        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Metadata file not found: {meta_path}")
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        binfile = meta.get("file", "speed.bin")
        if not os.path.isabs(binfile):
            binfile = os.path.join(os.path.dirname(meta_path), binfile)
        if not os.path.exists(binfile):
            raise FileNotFoundError(f"Speed data file not found: {binfile}")

        info_data = None
        turbines = []
        scale_factor = 0.001
        lt = 10000
        wind_angle = 270
        if os.path.exists(info_path):
            with open(info_path, 'r', encoding='utf-8') as f:
                info_data = json.load(f)
            if info_data and isinstance(info_data, dict):
                turbines = info_data.get("turbines", [])
                scale_factor = info_data.get("mesh", {}).get("scale", 0.001)
                lt = info_data.get("domain", {}).get("lt", 10000)
                wind_angle = info_data.get("wind", {}).get("angle", 270)
            else:
                 print("Warning: info.json is invalid.", file=sys.stderr)
        else:
            print(f"Warning: Info file not found: {info_path}", file=sys.stderr)
        print("Metadata and info data loaded.")

        # --- 2. 加载速度数据和计算坐标/高度 ---
        data, post_width, post_height, num_layers = load_speed_data(binfile, meta)
        domain_size_km = float(lt * scale_factor)
        x_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_width)
        y_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_height)
        extent_km = [float(x_coords_km[0]), float(x_coords_km[-1]),
                     float(y_coords_km[0]), float(y_coords_km[-1])]
        dh = float(meta.get("dh", 10))
        H_levels_m = np.arange(1, num_layers + 1) * dh
        print(f"Speed data loaded. Shape: {data.shape}. Height levels (m): {H_levels_m[0]:.1f} to {H_levels_m[-1]:.1f}")

        # --- 3. 创建插值器 ---
        f_interp = RegularGridInterpolator(
            (H_levels_m, y_coords_km, x_coords_km), data,
            bounds_error=False, fill_value=np.nan
        )
        print("Interpolator created.")

        # --- 4. 准备并保存元数据 ---
        math_angle_rad = np.deg2rad(270 - wind_angle)
        wind_dir_vector = [float(np.cos(math_angle_rad)), float(np.sin(math_angle_rad))]

        frontend_turbines = []
        if turbines:
            for i, t in enumerate(turbines):
                turbine_id = t.get("id") or f"WT{i+1}" # Ensure ID exists
                frontend_turbines.append({
                    "id": turbine_id,
                    "x": float(t.get("x", 0) * scale_factor),
                    "y": float(t.get("y", 0) * scale_factor),
                    "hubHeight": float(t.get("hub", 90)),
                    "rotorDiameter": float(t.get("d", 120)),
                    "name": t.get("name", turbine_id)
                })

        metadata_content = {
            "heightLevels": [float(h) for h in H_levels_m],
            "turbines": frontend_turbines,
            "vmin": float(meta.get("range", [0, 15])[0]),
            "vmax": float(meta.get("range", [0, 15])[1]),
            "windAngle": float(wind_angle),
            "windDirectionVector": wind_dir_vector,
            "scaleFactor": float(scale_factor),
            "xCoordsKm": [float(x) for x in x_coords_km], # Also store base coords
            "yCoordsKm": [float(y) for y in y_coords_km],
            "extentKm": extent_km
        }
        metadata_filepath = os.path.join(cache_base_path, 'metadata.json')
        with open(metadata_filepath, 'w', encoding='utf-8') as f:
            json.dump(metadata_content, f, default=numpy_to_python, indent=2) # 添加 indent=2
        print(f"Metadata saved to {metadata_filepath}")

        # --- 5. 预计算并保存风廓线 ---
        print(f"Precomputing profiles for {len(frontend_turbines)} turbines...")
        h_eval_m = np.linspace(float(H_levels_m[0]), float(H_levels_m[-1]), 50)
        for t_idx, t in enumerate(frontend_turbines):
            # ... (计算 vp_speed) ...
            turbine_id = t["id"]
            tx_km = t["x"]
            ty_km = t["y"]
            pts_vp = np.column_stack((h_eval_m, np.full_like(h_eval_m, ty_km), np.full_like(h_eval_m, tx_km)))
            vp_speed = f_interp(pts_vp)
            profile_data = {
                "id": t["id"],
                "heights": h_eval_m, # Let numpy_to_python handle conversion
                "speeds": vp_speed  # Let numpy_to_python handle conversion (incl. NaN)
            }
            profile_filepath = os.path.join(profiles_path, f'turbine_{t["id"]}.json')
            with open(profile_filepath, 'w', encoding='utf-8') as f:
                json.dump(profile_data, f, default=numpy_to_python, indent=2) # 添加 indent=2
            print(f"  Profile {t_idx+1}/{len(frontend_turbines)} saved: {profile_filepath}")


        # --- 6. 预计算并保存尾流数据 ---
        print(f"Precomputing wakes for {len(frontend_turbines)} turbines...")
        for t_idx, t in enumerate(frontend_turbines):
             # ... (计算 hp_speed) ...
            turbine_id = t["id"]
            tx_km = t["x"]
            ty_km = t["y"]
            hub_height_m = t["hubHeight"]
            rotor_diameter_m = t["rotorDiameter"]

            wake_dist_upstream_km = 5 * rotor_diameter_m * scale_factor
            wake_dist_downstream_km = 15 * rotor_diameter_m * scale_factor
            s_vals_km = np.linspace(-wake_dist_upstream_km, wake_dist_downstream_km, 100)

            xp_km = tx_km + s_vals_km * wind_dir_vector[0]
            yp_km = ty_km + s_vals_km * wind_dir_vector[1]

            sample_height_m = min(hub_height_m, float(H_levels_m[-1]))
            pts_hp = np.column_stack((np.full_like(s_vals_km, sample_height_m), yp_km, xp_km))
            hp_speed = f_interp(pts_hp)

            wake_data = {
                "id": turbine_id,
                "hubHeightUsed": sample_height_m,
                "distances": s_vals_km, # Let numpy_to_python handle conversion
                "speeds": hp_speed    # Let numpy_to_python handle conversion (incl. NaN)
            }
            wake_filepath = os.path.join(wakes_path, f'turbine_{t["id"]}.json')
            with open(wake_filepath, 'w', encoding='utf-8') as f:
                json.dump(wake_data, f, default=numpy_to_python, indent=2) # 添加 indent=2
            print(f"  Wake {t_idx+1}/{len(frontend_turbines)} saved: {wake_filepath}")

        # --- 7. 预计算并保存速度切片 ---
        print(f"Precomputing {total_slices} height slices...")
        for i, height_m in enumerate(H_levels_m):
            # ... (准备 slice_content) ...
            slice_data = data[i, :, :] # Shape (post_height, post_width)
            slice_content = {
                "height": float(height_m),
                "values": [[float(v) if not np.isnan(v) else None for v in row] for row in slice_data],
                # Store references or basic info, actual coords are in metadata.json
                "xCoordRef": "metadata.json",
                "yCoordRef": "metadata.json",
                "extent": extent_km
            }
            slice_filepath = os.path.join(slices_path, f'height_{height_m:.1f}.json')
            with open(slice_filepath, 'w', encoding='utf-8') as f:
                 # 使用 numpy_to_python 处理嵌套列表和可能的 NaN/Inf
                json.dump(slice_content, f, default=numpy_to_python, indent=2) # 添加 indent=2
            print(f"  Slice {i+1}/{total_slices} saved: {slice_filepath}")

        end_time = time.time()
        print(f"Pre-computation finished successfully in {end_time - start_time:.2f} seconds.")
        return True

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return False
    except ValueError as e:
        print(f"Data Error: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Precompute visualization data for a case.")
    parser.add_argument("--caseId", required=True, help="Case ID")
    args = parser.parse_args()

    success = precompute_all_data(args.caseId)
    sys.exit(0 if success else 1)