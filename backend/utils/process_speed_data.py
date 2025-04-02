# @Author: joe 847304926@qq.com
# @Date: 2025-04-01 21:29:08
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-04-01 21:57:00
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\process_speed_data.py
# @Description:
#
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import math
import argparse
import numpy as np
from scipy.interpolate import RegularGridInterpolator
import sys
import traceback

# 添加NumPy类型转换为Python原生类型的函数
def numpy_to_python(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, (np.bool_)):
        return bool(obj)
    elif isinstance(obj, (np.void)):
        return None
    return obj

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

    data = np.fromfile(binfile, dtype=np.float32)
    expected_size = post_width * post_height * num_layers
    if data.size != expected_size:
        # Provide more context in the error message
        rel_binfile = os.path.relpath(binfile) # Show relative path for brevity
        raise ValueError(
            f"Data size mismatch in '{rel_binfile}'. "
            f"Expected {expected_size} values ({post_width}x{post_height}x{num_layers}), "
            f"but found {data.size}. Check 'size' in output.json or the binary file itself."
        )
    # Reshape: (layers, height, width) matching common indexing [z, y, x]
    data = data.reshape((num_layers, post_height, post_width))
    return data, post_width, post_height, num_layers

def get_data_for_frontend(case_id, target_height, selected_turbine_id_str=None):
    """Loads data, processes it, and returns a JSON structure for the frontend."""
    try:
        base_path = os.path.join(os.path.dirname(__file__), '..', 'uploads', case_id) # Adjust path as needed
        meta_path = os.path.join(base_path, 'output.json')
        info_path = os.path.join(base_path, 'info.json') # Path to info.json

        # --- Load Metadata (output.json) ---
        if not os.path.exists(meta_path):
            return {"success": False, "message": f"Metadata file not found: {meta_path}"}
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except Exception as e:
            return {"success": False, "message": f"Error reading metadata file {meta_path}: {e}"}

        # --- Load Speed Data (speed.bin) ---
        binfile = meta.get("file", "speed.bin")
        if not os.path.isabs(binfile):
            binfile = os.path.join(os.path.dirname(meta_path), binfile)

        if not os.path.exists(binfile):
            return {"success": False, "message": f"Speed data file not found: {binfile}"}

        try:
            data, post_width, post_height, num_layers = load_speed_data(binfile, meta)
        except ValueError as e:
            return {"success": False, "message": str(e)}
        except Exception as e:
            return {"success": False, "message": f"Error loading speed data from {binfile}: {e}"}

        # --- Load Info Data (info.json) ---
        turbines = []
        info_data = None
        center_lon, center_lat = None, None
        lt = 10000 # Default domain size in meters
        scale_factor = 0.001 # Default scale (meters to km)
        wind_angle = 270 # Default wind angle

        if os.path.exists(info_path):
            try:
                with open(info_path, 'r', encoding='utf-8') as f:
                    info_data = json.load(f)
                if info_data and isinstance(info_data, dict):
                    if "turbines" in info_data:
                        turbines = info_data["turbines"] # Keep original structure for now
                    if "center" in info_data:
                        center_lon = info_data["center"].get("lon")
                        center_lat = info_data["center"].get("lat")
                    lt = info_data.get("domain", {}).get("lt", lt)
                    scale_factor = info_data.get("mesh", {}).get("scale", scale_factor)
                    wind_angle = info_data.get("wind", {}).get("angle", wind_angle)
            except Exception as e:
                # Non-fatal error, proceed without info data
                print(f"Warning: Error reading info file {info_path}: {e}", file=sys.stderr)
                info_data = None # Ensure info_data is None if loading failed
        else:
            print(f"Warning: Info file not found: {info_path}", file=sys.stderr)

        # --- Prepare Coordinates and Interpolator ---
        domain_size_km = float(lt * scale_factor) # Convert to Python float
        x_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_width)
        y_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_height)
        extent_km = [float(x_coords_km[0]), float(x_coords_km[-1]),
                    float(y_coords_km[0]), float(y_coords_km[-1])]

        dh = float(meta.get("dh", 10)) # Layer spacing in meters, convert to Python float
        H_levels_m = np.arange(1, num_layers + 1) * dh # Height levels in meters

        # Validate target_height
        if not isinstance(target_height, (int, float)):
            return {"success": False, "message": f"Invalid height value: {target_height}, must be a number"}

        target_height = float(target_height)  # 确保是Python float类型

        # Ensure target_height is within range
        if target_height < H_levels_m[0] or target_height > H_levels_m[-1]:
            print(f"Warning: Target height {target_height}m is outside data range [{float(H_levels_m[0])}, {float(H_levels_m[-1])}]m",
                  file=sys.stderr)
            # Use closest valid height instead of failing
            target_height = min(max(target_height, float(H_levels_m[0])), float(H_levels_m[-1]))

        # Create interpolator: points are (Height_m, Y_km, X_km)
        try:
            # Use y_coords_km, x_coords_km for consistency with how data was reshaped
            f_interp = RegularGridInterpolator(
                (H_levels_m, y_coords_km, x_coords_km),
                data, # data shape is (num_layers, post_height, post_width)
                bounds_error=False,
                fill_value=np.nan # Use NaN for points outside bounds
            )
        except ValueError as e:
            return {"success": False, "message": f"Interpolator creation failed. Check data shape ({data.shape}) vs coordinate dimensions ({len(H_levels_m)}, {len(y_coords_km)}, {len(x_coords_km)}). Error: {e}"}

        # --- Get Data Slice for Target Height ---
        height_idx = np.abs(H_levels_m - target_height).argmin()
        actual_height_m = float(H_levels_m[height_idx])  # 转换为Python float
        slice_data = data[height_idx, :, :] # Slice shape (post_height, post_width)

        # --- Prepare Turbine Data for Frontend ---
        frontend_turbines = []
        if info_data and 'turbines' in info_data:
            for t in info_data['turbines']:
                # Calculate km coordinates directly from info.json x,y (which are in meters)
                tx_km = float(t.get("x", 0) * scale_factor)
                ty_km = float(t.get("y", 0) * scale_factor)
                frontend_turbines.append({
                    "id": t.get("id", "N/A"),
                    "x": tx_km,
                    "y": ty_km,
                    "hubHeight": float(t.get("hub", 90)),
                    "rotorDiameter": float(t.get("d", 120)),
                    "name": t.get("name", t.get("id", "N/A")) # Use name if available
                })

        # --- Calculate Wind Direction Vector ---
        # Angle: 0=N, 90=E, 180=S, 270=W. Convert meteorological angle to mathematical angle for plotting
        math_angle_rad = np.deg2rad(270 - wind_angle)
        wind_dir_vector = np.array([np.cos(math_angle_rad), np.sin(math_angle_rad)])
        wind_dir_vector = [float(wind_dir_vector[0]), float(wind_dir_vector[1])]  # 转换为Python list

        # --- Calculate Info for Selected Turbine ---
        selected_turbine_info = None
        selected_turbine_obj = None
        if selected_turbine_id_str and frontend_turbines:
            # Find the selected turbine in the frontend_turbines list
            selected_turbine_obj = next((t for t in frontend_turbines if str(t.get("id")) == selected_turbine_id_str), None)

            if selected_turbine_obj:
                # Use km coordinates for interpolation points
                tx_km = selected_turbine_obj["x"]
                ty_km = selected_turbine_obj["y"]
                hub_height_m = selected_turbine_obj["hubHeight"]

                # Points for interpolation: (Height_m, Y_km, X_km)
                hub_point = np.array([[hub_height_m, ty_km, tx_km]])
                current_point = np.array([[actual_height_m, ty_km, tx_km]])

                # Interpolate speeds
                hub_speed = float(f_interp(hub_point)[0])
                current_height_speed = float(f_interp(current_point)[0])

                selected_turbine_info = {
                    "id": selected_turbine_obj["id"],
                    "displayCoords": f"({tx_km:.2f}, {ty_km:.2f}) km",
                    "hubHeight": hub_height_m,
                    "rotorDiameter": selected_turbine_obj["rotorDiameter"],
                    "hubSpeed": float(hub_speed) if not np.isnan(hub_speed) else None,
                    "currentHeightSpeed": float(current_height_speed) if not np.isnan(current_height_speed) else None,
                }

        # --- Calculate Wind Profiles for ALL turbines ---
        profiles = []
        if frontend_turbines:
            h_eval_m = np.linspace(float(H_levels_m[0]), float(H_levels_m[-1]), 50) # Evaluate profile at 50 points
            for t in frontend_turbines:
                tx_km = t["x"]
                ty_km = t["y"]
                # Points for interpolation: (Height_m, Y_km, X_km)
                pts_vp = np.column_stack((h_eval_m, np.full_like(h_eval_m, ty_km), np.full_like(h_eval_m, tx_km)))
                vp_speed = f_interp(pts_vp)
                profiles.append({
                    "id": t["id"],
                    "heights": [float(h) for h in h_eval_m],  # Convert to list of Python floats
                    "speeds": [float(s) if not np.isnan(s) else None for s in vp_speed] # Handle NaN
                })

        # --- Calculate Wake Analysis for ALL turbines ---
        wakes = []
        if frontend_turbines:
            for t in frontend_turbines:
                tx_km = t["x"]
                ty_km = t["y"]
                hub_height_m = t["hubHeight"]
                rotor_diameter_m = t["rotorDiameter"]

                # Define wake analysis distance (e.g., -5D to +15D) in km
                wake_dist_upstream_km = 5 * rotor_diameter_m * scale_factor
                wake_dist_downstream_km = 15 * rotor_diameter_m * scale_factor
                s_vals_km = np.linspace(-wake_dist_upstream_km, wake_dist_downstream_km, 100)

                # Calculate points along the wind direction in km
                xp_km = tx_km + s_vals_km * wind_dir_vector[0]
                yp_km = ty_km + s_vals_km * wind_dir_vector[1]

                # Points for interpolation at hub height: (Height_m, Y_km, X_km)
                sample_height_m = min(hub_height_m, float(H_levels_m[-1])) # Ensure sample height is within data range
                pts_hp = np.column_stack((np.full_like(s_vals_km, sample_height_m), yp_km, xp_km))
                hp_speed = f_interp(pts_hp)

                wakes.append({
                    "id": t["id"],
                    "distances": [float(d) for d in s_vals_km],  # Convert to list of Python floats
                    "speeds": [float(s) if not np.isnan(s) else None for s in hp_speed] # Handle NaN
                })

        # --- Prepare Final JSON Output ---
        result = {
            "success": True,
            "sliceData": {
                # Convert slice data to list for JSON compatibility, handle NaN
                "values": [[float(v) if not np.isnan(v) else None for v in row] for row in slice_data],
                # Send km coordinates
                "xCoords": [float(x) for x in x_coords_km],
                "yCoords": [float(y) for y in y_coords_km],
                "extent": extent_km,
                "height": actual_height_m
            },
            "turbines": frontend_turbines,
            "windAngle": float(wind_angle),
            "windDirectionVector": wind_dir_vector, # Already converted to list of Python floats
            "selectedTurbineInfo": selected_turbine_info,
            "profiles": profiles,
            "wakes": wakes,
            "meta": {
                "vmin": float(meta.get("range", [0, 15])[0]),
                "vmax": float(meta.get("range", [0, 15])[1]),
                "heightLevels": [float(h) for h in H_levels_m],
                "scaleFactor": float(scale_factor) # Send scale factor to frontend
            }
            # contours data can be added here if calculated backend
        }
        return result

    except FileNotFoundError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": f"An unexpected error occurred: {e}\n{traceback.format_exc()}"}


def cache_result(case_id, height, turbine_id, result):
    """Cache the result to a file for faster retrieval later."""
    try:
        cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache', case_id)
        os.makedirs(cache_dir, exist_ok=True)

        # Create cache filename based on parameters
        cache_file = os.path.join(cache_dir, f"h{height}_t{turbine_id or 'none'}.json")

        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(result, f)

        print(f"Result cached to {cache_file}", file=sys.stderr)
    except Exception as e:
        print(f"Warning: Failed to cache result: {e}", file=sys.stderr)

def get_cached_result(case_id, height, turbine_id):
    """Try to retrieve a cached result."""
    try:
        cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache', case_id)
        cache_file = os.path.join(cache_dir, f"h{height}_t{turbine_id or 'none'}.json")

        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                result = json.load(f)
                print(f"Using cached result from {cache_file}", file=sys.stderr)
                return result
    except Exception as e:
        print(f"Warning: Failed to retrieve cached result: {e}", file=sys.stderr)

    return None

# 在main部分修改
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process speed data for web frontend.")
    parser.add_argument("--caseId", required=True, help="Case ID")
    parser.add_argument("--height", required=True, type=float, help="Target height level in meters")
    parser.add_argument("--turbineId", required=False, default=None, help="ID of the selected turbine (optional)")
    parser.add_argument("--useCache", action="store_true", help="Use cached results if available")
    parser.add_argument("--skipCache", action="store_true", help="Skip writing results to cache")

    args = parser.parse_args()

    # Try to get result from cache first if enabled
    cached_result = None
    if args.useCache:
        cached_result = get_cached_result(args.caseId, args.height, args.turbineId)

    # If no cache or cache disabled, process data
    if cached_result is None:
        processed_data = get_data_for_frontend(args.caseId, args.height, args.turbineId)

        # Cache result if caching is enabled
        if processed_data["success"] and not args.skipCache:
            cache_result(args.caseId, args.height, args.turbineId, processed_data)
    else:
        processed_data = cached_result

    # 使用自定义编码器确保NumPy类型被转换为Python原生类型
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            return numpy_to_python(obj)

    # Print JSON output to stdout using the custom encoder
    print(json.dumps(processed_data, cls=NumpyEncoder))