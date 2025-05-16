# utils/precompute_visualization.py
# Version: Includes Ground Truth Markers ('X') directly on saved PNG images for debugging.

import os
import json
import math
import argparse
import numpy as np
from scipy.interpolate import RegularGridInterpolator
import sys
import traceback
import time
import matplotlib
matplotlib.use('Agg') # Use Agg backend for non-interactive plotting, important for servers
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
# import io # Potentially useful in the future, but not currently needed

# --- numpy_to_python and load_speed_data remain the same ---
def numpy_to_python(obj):
    """Converts numpy types to Python native types for JSON serialization."""
    if isinstance(obj, (np.int_, np.intc, np.intp, np.int8, np.int16, np.int32, np.int64, np.uint8, np.uint16, np.uint32, np.uint64)):
        return int(obj)
    elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
        if np.isnan(obj):
            return None
        elif np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (np.complex_, np.complex64, np.complex128)):
        return {'real': float(obj.real), 'imag': float(obj.imag)}
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, (np.bool_)):
        return bool(obj)
    elif isinstance(obj, (np.void)):
        return None
    elif isinstance(obj, (int, float, str, bool, list, dict, type(None))):
        return obj
    elif hasattr(obj, 'isoformat'): # Handle datetime objects
        return obj.isoformat()
    else:
        print(f"Warning: Encountered unhandled type {type(obj)} during serialization. Trying str().", file=sys.stderr)
        try:
            return str(obj)
        except Exception as e:
            print(f"  Failed to convert {type(obj)} to string: {e}", file=sys.stderr)
            return None

def load_speed_data(binfile, meta):
    """Loads speed data, ensuring correct dimensions."""
    if not meta or not isinstance(meta, dict):
        raise ValueError("Invalid metadata: metadata must be a dictionary")
    size = meta.get("size")
    if not size or len(size) != 3:
        raise ValueError("output.json 'size' must be an array [width, height, layers]")
    try:
        post_width, post_height, num_layers = map(int, size)
        if not all(d > 0 for d in [post_width, post_height, num_layers]):
            raise ValueError("Dimensions must be positive integers.")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid dimensions in output.json: {size}. {e}") from e
    if not os.path.exists(binfile):
        raise FileNotFoundError(f"Speed data file not found: {binfile}")
    try:
        data = np.fromfile(binfile, dtype=np.float32)
    except IOError as e:
        raise IOError(f"Error reading speed data file {binfile}: {e}") from e

    data = data.astype(np.float32) # Ensure float32
    expected_size = post_width * post_height * num_layers
    if data.size != expected_size:
        rel_binfile = os.path.relpath(binfile)
        raise ValueError(
            f"Data size mismatch in '{rel_binfile}'. "
            f"Expected {expected_size} values ({post_width}x{post_height}x{num_layers}), "
            f"but found {data.size}. Check 'size' in output.json or the binary file."
        )
    data = data.reshape((num_layers, post_height, post_width))
    data[np.isinf(data)] = np.nan # Replace Inf with NaN for interpolation/plotting
    return data, post_width, post_height, num_layers

# --- Removed get_plot_area_pixels function ---

def precompute_all_data(case_id):
    """Loads all data, performs all calculations, and saves results to cache files."""
    start_time = time.time()
    print(f"Starting precomputation for case: {case_id}")

    # --- Paths ---
    base_path = os.path.join(os.path.dirname(__file__), '..', 'uploads', case_id)
    meta_path = os.path.join(base_path, 'output.json')
    info_path = os.path.join(base_path, 'info.json')
    cache_base_path = os.path.join(base_path, 'visualization_cache')
    profiles_path = os.path.join(cache_base_path, 'profiles')
    wakes_path = os.path.join(cache_base_path, 'wakes')
    slices_img_path = os.path.join(cache_base_path, 'slices_img')
    slices_info_path = os.path.join(cache_base_path, 'slices_info') # Directory for per-slice info JSONs

    # --- 0. Create cache directories ---
    os.makedirs(profiles_path, exist_ok=True)
    os.makedirs(wakes_path, exist_ok=True)
    os.makedirs(slices_img_path, exist_ok=True)
    os.makedirs(slices_info_path, exist_ok=True)
    print(f"Cache directories ensured/created at {cache_base_path}")

    try:
        # --- 1. Load metadata and case info ---
        if not os.path.exists(meta_path): raise FileNotFoundError(f"Metadata file not found: {meta_path}")
        with open(meta_path, 'r', encoding='utf-8') as f: meta = json.load(f)
        binfile = meta.get("file", "speed.bin")
        if not os.path.isabs(binfile): binfile = os.path.join(os.path.dirname(meta_path), binfile)
        if not os.path.exists(binfile): raise FileNotFoundError(f"Speed data file not found: {binfile}")
        info_data = None; turbines = []; scale_factor = 0.001; lt = 10000; wind_angle = 270
        if os.path.exists(info_path):
            try:
                with open(info_path, 'r', encoding='utf-8') as f: info_data = json.load(f)
                if info_data and isinstance(info_data, dict):
                    turbines = info_data.get("turbines", [])
                    scale_factor = info_data.get("mesh", {}).get("scale", 0.001)
                    lt = info_data.get("domain", {}).get("lt", 10000)
                    wind_angle = info_data.get("wind", {}).get("angle", 270)
                else: print("Warning: info.json is invalid.", file=sys.stderr)
            except Exception as e: print(f"Warning: Error reading info.json: {e}", file=sys.stderr)
        else: print(f"Warning: Info file not found: {info_path}", file=sys.stderr)
        print("Metadata and info data loaded.")

        # --- 2. Load speed data and calculate coordinates/heights ---
        data, post_width, post_height, num_layers = load_speed_data(binfile, meta)
        domain_size_km = float(lt * scale_factor)
        x_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_width)
        y_coords_km = np.linspace(-domain_size_km / 2, domain_size_km / 2, post_height)
        dx = (x_coords_km[1]-x_coords_km[0]) if post_width > 1 else 0
        dy = (y_coords_km[1]-y_coords_km[0]) if post_height > 1 else 0
        extent_km = [
            float(x_coords_km[0] - dx/2), float(x_coords_km[-1] + dx/2),
            float(y_coords_km[0] - dy/2), float(y_coords_km[-1] + dy/2)
        ]
        dh = float(meta.get("dh", 10))
        H_levels_m = np.arange(1, num_layers + 1) * dh
        print(f"Speed data loaded. Shape: {data.shape}. Height levels (m): {H_levels_m[0]:.1f} to {H_levels_m[-1]:.1f}")

        # --- 3. Create interpolator ---
        f_interp = RegularGridInterpolator(
            (H_levels_m, y_coords_km, x_coords_km), data,
            method='linear', bounds_error=False, fill_value=np.nan
        )
        print("Interpolator created.")

        # --- 4. Prepare metadata (wind direction, turbines in km) ---
        math_angle_rad = np.deg2rad(270 - wind_angle)
        wind_dir_vector = [float(np.cos(math_angle_rad)), float(np.sin(math_angle_rad))]
        frontend_turbines = []
        if turbines:
            for i, t in enumerate(turbines):
                raw_x = t.get("x"); raw_y = t.get("y")
                if raw_x is not None and raw_y is not None:
                    turbine_id = t.get("id") or f"WT{i+1}"
                    frontend_turbines.append({
                        "id": turbine_id, "x": float(raw_x * scale_factor), "y": float(raw_y * scale_factor),
                        "hubHeight": float(t.get("hub", 90)), "rotorDiameter": float(t.get("d", 120)),
                        "name": t.get("name", turbine_id)
                    })
                else: print(f"Warning: Turbine {t.get('id', i+1)} missing coords, skipped.", file=sys.stderr)
        else: print("Warning: No turbine info found.")

        # --- 5. Precompute and save wind profiles ---
        print(f"Precomputing wind profiles for {len(frontend_turbines)} turbines...")
        h_eval_m = np.linspace(float(H_levels_m[0]), float(H_levels_m[-1]), 50)
        for t_idx, t in enumerate(frontend_turbines):
            turbine_id = t["id"]; tx_km = t["x"]; ty_km = t["y"]
            pts_vp = np.column_stack((h_eval_m, np.full_like(h_eval_m, ty_km), np.full_like(h_eval_m, tx_km)))
            vp_speed = f_interp(pts_vp)
            # Directly save the structure expected by the frontend/backend API
            profile_data = {"id": turbine_id, "heights": h_eval_m.tolist(), "speeds": vp_speed.tolist()}
            profile_filepath = os.path.join(profiles_path, f'turbine_{turbine_id}.json')
            with open(profile_filepath, 'w', encoding='utf-8') as f:
                json.dump(profile_data, f, default=numpy_to_python, indent=2)
        print("Wind profile precomputation complete.")

        # --- 6. Precompute and save wake data ---
        print(f"Precomputing wake data for {len(frontend_turbines)} turbines...")
        for t_idx, t in enumerate(frontend_turbines):
            turbine_id = t["id"]; tx_km = t["x"]; ty_km = t["y"]
            hub_height_m = t["hubHeight"]; rotor_diameter_m = t["rotorDiameter"]
            wake_dist_upstream_km = 2 * rotor_diameter_m * scale_factor
            wake_dist_downstream_km = 10 * rotor_diameter_m * scale_factor
            s_vals_km = np.linspace(-wake_dist_upstream_km, wake_dist_downstream_km, 100)
            xp_km = tx_km + s_vals_km * wind_dir_vector[0]
            yp_km = ty_km + s_vals_km * wind_dir_vector[1]
            sample_height_m = max(H_levels_m[0], min(hub_height_m, H_levels_m[-1])) # Clamp height
            pts_hp = np.column_stack((np.full_like(s_vals_km, sample_height_m), yp_km, xp_km))
            hp_speed = f_interp(pts_hp)
            # Directly save the structure expected by the frontend/backend API
            wake_data = {"id": turbine_id, "hubHeightUsed": float(sample_height_m), "distances": s_vals_km.tolist(), "speeds": hp_speed.tolist()}
            wake_filepath = os.path.join(wakes_path, f'turbine_{turbine_id}.json')
            with open(wake_filepath, 'w', encoding='utf-8') as f:
                json.dump(wake_data, f, default=numpy_to_python, indent=2)
        print("Wake precomputation complete.")

        # --- 7. Precompute velocity slices: Save images (WITH GROUND TRUTH MARKERS) AND calculate turbine pixel coords ---
        total_slices = len(H_levels_m)
        print(f"Precomputing {total_slices} height slice images (with ground truth markers) and turbine pixel coordinates...")
        vmin = float(meta.get("range", [0, 15])[0])
        vmax = float(meta.get("range", [0, 15])[1])
        cmap = plt.get_cmap('jet')
        norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
        img_width_pixels = 800; img_dpi = 100
        domain_width_km = extent_km[1] - extent_km[0]
        domain_height_km = extent_km[3] - extent_km[2]
        aspect_ratio = domain_height_km / domain_width_km if domain_width_km > 0 and domain_height_km > 0 else 1
        img_height_pixels = max(1, int(img_width_pixels * aspect_ratio))
        figsize = (img_width_pixels / img_dpi, img_height_pixels / img_dpi)

        all_heights_info = [] # To store info for main metadata

        for i, height_m in enumerate(H_levels_m):
            print(f"  Processing slice {i + 1}/{total_slices}, height {height_m:.1f}m...")
            slice_data_np = data[i, :, :].copy().astype(float)

            fig, ax = plt.subplots(figsize=figsize, dpi=img_dpi)
            fig.subplots_adjust(left=0.12, right=0.90, bottom=0.12, top=0.90)
            im = ax.imshow(slice_data_np, cmap=cmap, norm=norm, interpolation='nearest', origin='lower', extent=extent_km, aspect='auto')
            ax.set_xlabel('X (km)'); ax.set_ylabel('Y (km)'); ax.set_title(f'Wind Speed at {height_m:.1f} m')
            cbar = plt.colorbar(im, ax=ax, shrink=0.8, pad=0.03); cbar.set_label('Wind Speed (m/s)')

            # --- *** PLOT GROUND TRUTH MARKERS ON IMAGE *** ---
            print(f"    Overlaying ground truth markers (black 'X') for {len(frontend_turbines)} turbines...")
            for turbine in frontend_turbines:
                tx_km, ty_km = turbine['x'], turbine['y']
                # Plot black 'X' at the turbine's km coordinates
                ax.plot(tx_km, ty_km, marker='x', markersize=10, color='black', linestyle='None', markeredgewidth=2, label='_nolegend_', zorder=10)
                # Add turbine ID text
                ax.text(tx_km + 0.02 * (extent_km[1] - extent_km[0]), ty_km, turbine['id'], fontsize=7, color='black', ha='left', va='center', bbox=dict(boxstyle='round,pad=0.1', fc='white', alpha=0.6, ec='none'), zorder=11)
            # --- *** END GROUND TRUTH MARKERS *** ---

            # --- Calculate turbine pixel coordinates for THIS slice image ---
            fig.canvas.draw() # IMPORTANT: Ensure layout is finalized BEFORE transforming
            fig_width_px = fig.get_size_inches()[0] * img_dpi
            fig_height_px = fig.get_size_inches()[1] * img_dpi
            image_dims = {"width": int(round(fig_width_px)), "height": int(round(fig_height_px)), "dpi": int(img_dpi)}
            slice_turbines_pixels = []
            for turbine in frontend_turbines:
                tx_km, ty_km = turbine['x'], turbine['y']
                try:
                    display_coords = ax.transData.transform((tx_km, ty_km))
                    pixel_x = display_coords[0]
                    pixel_y = fig_height_px - display_coords[1] # Invert Y-axis for top-left origin
                    buffer = 10 # Allow markers slightly outside strict bounds
                    if -buffer <= pixel_x <= fig_width_px + buffer and -buffer <= pixel_y <= fig_height_px + buffer:
                         slice_turbines_pixels.append({
                            "id": turbine['id'], "x": float(round(pixel_x, 2)), "y": float(round(pixel_y, 2))
                        })
                except Exception as transform_err:
                    print(f"    Error transforming coords for turbine {turbine['id']} on slice {height_m:.1f}m: {transform_err}", file=sys.stderr)

            # --- Save slice info JSON ---
            height_str = f"{height_m:.1f}" # Consistent formatting
            slice_info_filename = f'slice_info_{height_str}.json'
            slice_info_filepath = os.path.join(slices_info_path, slice_info_filename)
            slice_info_data = {
                "actualHeight": float(height_m),
                "imageDimensions": image_dims,
                "turbinesPixels": slice_turbines_pixels
            }
            try:
                with open(slice_info_filepath, 'w', encoding='utf-8') as f:
                    json.dump(slice_info_data, f, default=numpy_to_python, indent=2)
            except IOError as io_err: print(f"    Error saving slice info JSON '{slice_info_filepath}': {io_err}", file=sys.stderr)

            # --- Save slice image (includes ground truth markers now) ---
            image_filename = f'slice_height_{height_str}.png'
            image_filepath = os.path.join(slices_img_path, image_filename)
            try:
                fig.savefig(image_filepath, dpi=img_dpi, transparent=False, facecolor='white')
                print(f"    Image with ground truth markers saved: {image_filepath}")
            except Exception as img_err: print(f"    Error saving image for height {height_m:.1f}m: {img_err}", file=sys.stderr); traceback.print_exc(file=sys.stderr)

            plt.close(fig) # Close figure

            # Add info for main metadata (including generated filenames)
            all_heights_info.append({
                 "height": float(height_m),
                 "imageFile": image_filename, # Store filename for easier lookup
                 "infoFile": slice_info_filename # Store filename
            })

        print("Slice images and turbine pixel info precomputation complete.")

        # --- 8. Assemble and save the main metadata file ---
        metadata_content = {
            # Replace heightLevels with the more informative list
            "heightLevelsInfo": all_heights_info,
            # Keep plain heightLevels list for compatibility or slider use if needed
            "heightLevels": [float(h_info["height"]) for h_info in all_heights_info],
            "turbines": frontend_turbines, # Keep turbines with km coords
            "vmin": vmin, "vmax": vmax,
            "windAngle": float(wind_angle), "windDirectionVector": wind_dir_vector,
            "scaleFactor": float(scale_factor),
            "xCoordsKm": [float(x) for x in x_coords_km],
            "yCoordsKm": [float(y) for y in y_coords_km],
            "extentKm": extent_km, "extent": extent_km,
            # Removed plotAreaPixels and imageDimensions from main metadata
        }
        metadata_filepath = os.path.join(cache_base_path, 'metadata.json')
        with open(metadata_filepath, 'w', encoding='utf-8') as f:
            json.dump(metadata_content, f, default=numpy_to_python, indent=2)
        print(f"Main metadata saved to {metadata_filepath}")

        end_time = time.time()
        print(f"Precomputation completed successfully in {end_time - start_time:.2f} seconds.")
        return True

    except FileNotFoundError as e: print(f"File Error: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); return False
    except ValueError as e: print(f"Data Error: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); return False
    except Exception as e: print(f"An unexpected error occurred: {e}", file=sys.stderr); print(traceback.format_exc(), file=sys.stderr); return False

# --- Main entry point ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Precompute visualization data for a case study.")
    parser.add_argument("--caseId", required=True, help="The Case ID")
    args = parser.parse_args()
    success = precompute_all_data(args.caseId)
    sys.exit(0 if success else 1)