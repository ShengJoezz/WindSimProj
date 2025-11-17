#!/usr/bin/env python3
# backend/utils/query_speed.py

import os
import sys
import json
import argparse

try:
    import numpy as np
    from scipy.interpolate import RegularGridInterpolator
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Missing required Python package: {e}. Please ensure numpy and scipy are installed in your conda environment."}))
    sys.exit(1)

def get_speed_at_point(case_id, x_query, y_query, z_query):
    try:
        base_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", case_id)
        meta_path = os.path.join(base_dir, "output.json")
        bin_path = os.path.join(base_dir, "speed.bin")

        if not os.path.exists(meta_path) or not os.path.exists(bin_path):
            return {"success": False, "error": "Data files (output.json/speed.bin) not found."}

        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        
        size = meta.get("size")
        if not size or len(size) != 3:
            return {"success": False, "error": "Invalid 'size' in metadata."}
        
        Nx, Ny, Nz = map(int, size)
        dh = float(meta.get("dh", 10))
        
        lt = 10000
        info_path = os.path.join(base_dir, "info.json")
        if os.path.exists(info_path):
            with open(info_path, "r", encoding="utf-8") as f:
                info = json.load(f)
            lt = info.get("domain", {}).get("lt", lt)

        expected_elements = Nx * Ny * Nz
        data = np.fromfile(bin_path, dtype=np.float32)
        if data.size != expected_elements:
            return {"success": False, "error": f"Binary data size mismatch. Expected {expected_elements}, got {data.size}."}
        
        data = data.reshape((Nz, Ny, Nx))

        domain_size_m = float(lt)
        x_coords = np.linspace(-domain_size_m / 2, domain_size_m / 2, Nx)
        y_coords = np.linspace(-domain_size_m / 2, domain_size_m / 2, Ny)
        H_levels = np.arange(1, Nz + 1) * dh

        interpolator = RegularGridInterpolator(
            (H_levels, y_coords, x_coords),
            data,
            method="linear",
            bounds_error=False,
            fill_value=np.nan
        )

        point = (z_query, y_query, x_query)
        
        # --- FIX: Robustly handle interpolator output ---
        interpolated_value = interpolator(point)

        # np.isnan() works correctly on both 0-dim and 1-dim arrays
        if np.isnan(interpolated_value):
            return {"success": True, "speed": None, "message": "Point is outside the computation domain."}
        else:
            # Use .item() to safely extract the scalar value
            speed = float(interpolated_value.item())
            return {"success": True, "speed": speed}

    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    """主执行函数，包含参数解析和错误捕获。"""
    parser = argparse.ArgumentParser(description="Query wind speed at a specific point.")
    parser.add_argument("--caseId", required=True, help="Case ID")
    parser.add_argument("--x", required=True, type=float, help="X coordinate")
    parser.add_argument("--y", required=True, type=float, help="Y coordinate")
    parser.add_argument("--z", required=True, type=float, help="Z coordinate (height)")
    args = parser.parse_args()

    result = get_speed_at_point(args.caseId, args.x, args.y, args.z)
    
    print(json.dumps(result))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"success": False, "error": f"A critical error occurred in the script execution: {e}"}))
