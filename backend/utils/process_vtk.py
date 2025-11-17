# @Author: joe 847304926@qq.com
# @Date: 2025-01-19 20:17:24
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-02-16 16:17:18
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\process_vtk.py
# @Description: 
# 
# Copyright (c) 2025 by joe, All Rights Reserved.

#!/usr/bin/env python3
import pyvista as pv
import json
import os
import sys
from pathlib import Path
import traceback
import numpy as np
np.bool = np.bool_

def convert_multiblock_to_polydata(input_path, output_dir):
    try:
        print("Processing file:", input_path)
        print("Output directory:", output_dir)

        if not os.path.exists(input_path):
            raise FileNotFoundError("Input file not found: " + input_path)

        print("Reading VTK file...")
        data = pv.read(input_path)
        print("Data type:", type(data))

        os.makedirs(output_dir, exist_ok=True)
        
        output_files = []
        metadata = {"blocks": []}
        # candidate 用于后续计算流线，即我们选取网格数据作为流场的候选
        candidate = None

        if isinstance(data, pv.MultiBlock):
            # 处理整体网格，假设第一个 block 为底面，其余 block 合并为网格
            mesh_block = None
            bottom_surface = None
            
            for i in range(len(data)):
                if data[i] is not None:
                    block = data[i]
                    if not isinstance(block, pv.PolyData):
                        block = block.extract_geometry()
                    
                    # 假设第一个 block 是底面
                    if i == 0:
                        bottom_surface = block
                        output_filename = "bot.vtp"
                        output_path = os.path.join(output_dir, output_filename)
                        bottom_surface.save(output_path)
                        metadata["blocks"].append({
                            "filename": output_filename,
                            "type": "bottom",
                            "n_points": bottom_surface.n_points,
                            "n_cells": bottom_surface.n_cells,
                            "bounds": list(bottom_surface.bounds)
                        })
                    else:
                        # 合并后续 block 作为网格
                        if mesh_block is None:
                            mesh_block = block
                        else:
                            mesh_block = mesh_block.merge(block)
            candidate = mesh_block
            if mesh_block is not None:
                output_filename = "mesh.vtp"
                output_path = os.path.join(output_dir, output_filename)
                mesh_block.save(output_path)
                metadata["blocks"].append({
                    "filename": output_filename,
                    "type": "mesh",
                    "n_points": mesh_block.n_points,
                    "n_cells": mesh_block.n_cells,
                    "bounds": list(mesh_block.bounds)
                })
        else:
            print("Processing single dataset")
            if not isinstance(data, pv.PolyData):
                print("Converting to PolyData")
                data = data.extract_geometry()
            
            output_filename = "mesh.vtp"
            output_path = os.path.join(output_dir, output_filename)
            print("Saving to:", output_path)
            data.save(output_path)
            
            metadata["blocks"].append({
                "index": 0,
                "filename": output_filename,
                "n_points": data.n_points,
                "n_cells": data.n_cells,
                "bounds": list(data.bounds),
                "scalar_fields": list(data.array_names) if hasattr(data, "array_names") else []
            })
            candidate = data
        
        metadata_path = os.path.join(output_dir, "metadata.json")
        print("Saving metadata to:", metadata_path)
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
            
        print("Processing completed successfully")
        return True, metadata
        
    except Exception as e:
        print("Error:", str(e))
        print("Traceback:")
        traceback.print_exc()
        return False, str(e)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python process_vtk.py <input_path> <output_dir>")
        sys.exit(1)
    
    print("Starting VTK processing script")
    print("Arguments:", sys.argv)
    
    success, result = convert_multiblock_to_polydata(sys.argv[1], sys.argv[2])
    if success:
        print(json.dumps(result))
        sys.exit(0)
    else:
        print("Error:", result, file=sys.stderr)
        sys.exit(1)