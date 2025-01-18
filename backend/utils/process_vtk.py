#!/usr/bin/env python3

import pyvista as pv
import json
import os
import sys
from pathlib import Path
import traceback

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
        
        if isinstance(data, pv.MultiBlock):
            print("Processing MultiBlock with", len(data), "blocks")
            for i in range(len(data)):
                if data[i] is not None:
                    print("Processing block", i)
                    block = data[i]
                    if not isinstance(block, pv.PolyData):
                        print("Converting block", i, "to PolyData")
                        block = block.extract_geometry()
                    
                    output_filename = f"block_{i}.vtp"
                    output_path = os.path.join(output_dir, output_filename)
                    print("Saving block to:", output_path)
                    block.save(output_path)
                    
                    # Get array names safely
                    scalar_fields = []
                    try:
                        scalar_fields = list(block.array_names)
                    except AttributeError:
                        print(f"Warning: Could not get array names for block {i}")
                    
                    block_metadata = {
                        "index": i,
                        "filename": output_filename,
                        "n_points": block.n_points,
                        "n_cells": block.n_cells,
                        "bounds": list(block.bounds),
                        "scalar_fields": scalar_fields
                    }
                    metadata["blocks"].append(block_metadata)
                    output_files.append(output_path)
        else:
            print("Processing single dataset")
            if not isinstance(data, pv.PolyData):
                print("Converting to PolyData")
                data = data.extract_geometry()
            
            output_filename = "single_block.vtp"
            output_path = os.path.join(output_dir, output_filename)
            print("Saving to:", output_path)
            data.save(output_path)
            
            scalar_fields = []
            try:
                scalar_fields = list(data.array_names)
            except AttributeError:
                print("Warning: Could not get array names for single dataset")
            
            metadata["blocks"].append({
                "index": 0,
                "filename": output_filename,
                "n_points": data.n_points,
                "n_cells": data.n_cells,
                "bounds": list(data.bounds),
                "scalar_fields": scalar_fields
            })
            output_files.append(output_path)
        
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
