#!/usr/bin/env python3
"""
One-off helper: overlay an analytic/FLORIS wake field on top of an existing
terrain-only CFD speed field, and re-render the cached slice PNGs so the
frontend can display a "wake deflection" effect without re-running CFD with
turbines.

Default mode uses a lightweight analytic Gaussian wake with a simple lateral
deflection model. If you have FLORIS installed locally, you can switch to
--model floris and provide a FLORIS YAML config to compute the wake plane.

This script is intentionally standalone and does NOT modify the CFD results,
only the visualization cache images under:
  backend/uploads/<caseId>/visualization_cache/slices_img/
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal

import numpy as np

# Matplotlib is already used in precompute_visualization.py; keep consistent.
import matplotlib

matplotlib.use("Agg")
import matplotlib.colors as mcolors
import matplotlib.pyplot as plt


ModelKind = Literal["simple", "floris"]


@dataclass(frozen=True)
class LayoutPoint:
    id: str
    x_m: float
    y_m: float
    yaw_deg: float | None = None


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _maybe_float(value) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _load_layout_points(
    *,
    layout_file: Path | None,
    layout_from_case: str | None,
    uploads_dir: Path,
) -> list[LayoutPoint]:
    if bool(layout_file) == bool(layout_from_case):
        raise ValueError("Provide exactly one of --layout-file or --layout-from-case.")

    if layout_from_case:
        info_path = uploads_dir / layout_from_case / "info.json"
        if not info_path.exists():
            raise FileNotFoundError(f"Layout case info.json not found: {info_path}")
        info = _read_json(info_path)
        points: list[LayoutPoint] = []
        for i, t in enumerate(info.get("turbines", []) or []):
            x = _maybe_float(t.get("x"))
            y = _maybe_float(t.get("y"))
            if x is None or y is None:
                continue
            points.append(LayoutPoint(id=str(t.get("id") or f"WT{i+1}"), x_m=x, y_m=y))
        if not points:
            raise ValueError(f"No turbines found in {info_path}")
        return points

    assert layout_file is not None
    if not layout_file.exists():
        raise FileNotFoundError(layout_file)

    ext = layout_file.suffix.lower()
    points: list[LayoutPoint] = []

    if ext in {".csv", ".txt"}:
        import csv

        with layout_file.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                x = _maybe_float(row.get("x") or row.get("X") or row.get("x_m"))
                y = _maybe_float(row.get("y") or row.get("Y") or row.get("y_m"))
                if x is None or y is None:
                    continue
                yaw = _maybe_float(row.get("yaw") or row.get("yaw_deg"))
                tid = (row.get("id") or row.get("ID") or f"WT{i+1}").strip()
                points.append(LayoutPoint(id=tid, x_m=x, y_m=y, yaw_deg=yaw))

    elif ext in {".json"}:
        data = _read_json(layout_file)
        if isinstance(data, dict) and isinstance(data.get("turbines"), list):
            data = data["turbines"]
        if not isinstance(data, list):
            raise ValueError("JSON layout must be a list, or {turbines:[...]}.")
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                continue
            x = _maybe_float(item.get("x"))
            y = _maybe_float(item.get("y"))
            if x is None or y is None:
                continue
            yaw = _maybe_float(item.get("yaw") or item.get("yaw_deg"))
            tid = str(item.get("id") or f"WT{i+1}")
            points.append(LayoutPoint(id=tid, x_m=x, y_m=y, yaw_deg=yaw))

    elif ext in {".xlsx", ".xls"}:
        import pandas as pd

        df = pd.read_excel(layout_file)
        # try some common column names
        col_x = next((c for c in df.columns if str(c).lower() in {"x", "x_m", "utm_e", "easting"}), None)
        col_y = next((c for c in df.columns if str(c).lower() in {"y", "y_m", "utm_n", "northing"}), None)
        if col_x is None or col_y is None:
            raise ValueError("Excel layout must contain columns x/y (meters).")
        col_id = next((c for c in df.columns if str(c).lower() in {"id", "name", "turbine"}), None)
        col_yaw = next((c for c in df.columns if str(c).lower() in {"yaw", "yaw_deg"}), None)
        for i, row in df.iterrows():
            x = _maybe_float(row[col_x])
            y = _maybe_float(row[col_y])
            if x is None or y is None:
                continue
            tid = str(row[col_id]) if col_id is not None and row.get(col_id) is not None else f"WT{i+1}"
            yaw = _maybe_float(row[col_yaw]) if col_yaw is not None else None
            points.append(LayoutPoint(id=tid, x_m=x, y_m=y, yaw_deg=yaw))

    else:
        raise ValueError(f"Unsupported layout file type: {layout_file}")

    if not points:
        raise ValueError(f"No valid turbine coordinates found in {layout_file}")
    return points


def _apply_layout_transform(
    points: list[LayoutPoint],
    *,
    scale: float,
    shift_x: float,
    shift_y: float,
    auto_center: bool,
    target_center: tuple[float, float],
) -> list[LayoutPoint]:
    scaled = [
        LayoutPoint(
            id=p.id,
            x_m=p.x_m * scale,
            y_m=p.y_m * scale,
            yaw_deg=p.yaw_deg,
        )
        for p in points
    ]

    if auto_center and scaled:
        cx = float(np.mean([p.x_m for p in scaled]))
        cy = float(np.mean([p.y_m for p in scaled]))
        tx, ty = target_center
        shift_x += tx - cx
        shift_y += ty - cy

    return [
        LayoutPoint(
            id=p.id,
            x_m=p.x_m + shift_x,
            y_m=p.y_m + shift_y,
            yaw_deg=p.yaw_deg,
        )
        for p in scaled
    ]


def _wind_from_to_unit_vectors(wind_from_deg: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Match the project's existing convention (see precompute_visualization.py):
      math_angle = deg2rad(270 - wind_from_deg)
      wind_vec = [cos(math_angle), sin(math_angle)]

    Here we return:
      u = downwind unit vector (flow direction)
      v = crosswind unit vector (left of flow; +v is CCW from u)
    """

    math_angle = math.radians(270.0 - float(wind_from_deg))
    u = np.array([math.cos(math_angle), math.sin(math_angle)], dtype=np.float64)
    v = np.array([-u[1], u[0]], dtype=np.float64)
    return u, v


def _load_speed_cube(case_dir: Path) -> tuple[np.ndarray, dict]:
    meta_path = case_dir / "output.json"
    if not meta_path.exists():
        raise FileNotFoundError(meta_path)
    meta = _read_json(meta_path)

    size = meta.get("size")
    if not size or len(size) != 3:
        raise ValueError("output.json missing size=[Nx,Ny,Nz]")
    nx, ny, nz = map(int, size)

    bin_name = meta.get("file", "speed.bin")
    bin_path = Path(bin_name)
    if not bin_path.is_absolute():
        bin_path = case_dir / bin_name
    if not bin_path.exists():
        raise FileNotFoundError(bin_path)

    expected = nx * ny * nz
    data = np.fromfile(bin_path, dtype=np.float32)
    if data.size != expected:
        raise ValueError(f"speed.bin size mismatch: expected {expected} float32, got {data.size}")
    cube = data.reshape((nz, ny, nx)).astype(np.float32)
    cube[np.isinf(cube)] = np.nan
    return cube, meta


def _resolve_case_wind(case_dir: Path, viz_meta: dict | None) -> tuple[float, float]:
    """Return (wind_from_deg, wind_speed_mps) with reasonable fallbacks."""

    wind_from = None
    wind_speed = None

    if viz_meta:
        wind_from = _maybe_float(viz_meta.get("windAngle"))

    info_path = case_dir / "info.json"
    if info_path.exists():
        info = _read_json(info_path)
        wind = info.get("wind") or {}
        wind_from = wind_from if wind_from is not None else _maybe_float(wind.get("angle"))
        wind_speed = _maybe_float(wind.get("speed"))

    if wind_from is None:
        wind_from = 270.0
    if wind_speed is None:
        wind_speed = 10.0
    return float(wind_from), float(wind_speed)


def _render_slice_png(
    *,
    out_png: Path,
    slice_np: np.ndarray,
    height_m: float,
    extent_m: list[float],
    vmin: float,
    vmax: float,
    title_suffix: str,
) -> tuple[int, int]:
    cmap = plt.get_cmap("jet")
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    img_w, dpi = 800, 100
    domain_w = float(extent_m[1] - extent_m[0])
    domain_h = float(extent_m[3] - extent_m[2])
    aspect = domain_h / domain_w if domain_w > 0 else 1
    img_h = max(1, int(img_w * aspect))
    figsize = (img_w / dpi, img_h / dpi)

    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    fig.subplots_adjust(left=0.12, right=0.88, bottom=0.12, top=0.90)
    im = ax.imshow(
        slice_np.astype(float),
        cmap=cmap,
        norm=norm,
        origin="lower",
        extent=extent_m,
        aspect="auto",
    )
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_title(f"Wind speed @ {height_m:.1f} m{title_suffix}")
    cbar = plt.colorbar(im, ax=ax, pad=0.02, shrink=0.8)
    cbar.set_label("m/s")

    fig.canvas.draw()
    fw, fh = fig.get_size_inches() * dpi
    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=dpi)
    plt.close(fig)
    return int(fw), int(fh)


def _simple_wake_ratio_field(
    *,
    x_coords_m: np.ndarray,
    y_coords_m: np.ndarray,
    height_m: float,
    turbines: list[LayoutPoint],
    wind_from_deg: float,
    ct: float,
    rotor_diameter_m: float,
    hub_height_m: float,
    wake_expansion_k: float,
    deflection_deg: float,
    yaw_to_deflection_gain: float,
    vertical_spread_factor: float,
    max_deficit: float,
) -> np.ndarray:
    """
    Return a multiplicative ratio field in [0,1] where 1 means no wake deficit.

    Uses a Jensen-like centerline deficit with a Gaussian crosswind profile and
    a simple linear lateral deflection (for visualization purposes).
    """

    if ct <= 0:
        return np.ones((len(y_coords_m), len(x_coords_m)), dtype=np.float32)

    u, _ = _wind_from_to_unit_vectors(wind_from_deg)
    u_x, u_y = float(u[0]), float(u[1])

    # Crosswind axis (+ left of flow)
    v_x, v_y = float(-u_y), float(u_x)

    nx = len(x_coords_m)
    ny = len(y_coords_m)

    # Precompute 1D coordinate offsets for broadcasting.
    x_coords_m = x_coords_m.astype(np.float32)
    y_coords_m = y_coords_m.astype(np.float32)

    sum_sq = np.zeros((ny, nx), dtype=np.float32)

    d = float(rotor_diameter_m)
    r0 = d / 2.0
    ct = float(ct)
    ct = max(0.0, min(ct, 0.999))

    # Centerline deficit factor for Jensen (normalized).
    # a = (1 - sqrt(1 - Ct)) / 2; but we use the common speed deficit form:
    # deficit_center(x) = (1 - sqrt(1 - Ct)) / (1 + 2*k*x/D)^2
    one_minus_sqrt = float(1.0 - math.sqrt(1.0 - ct))

    sigma_z = max(1e-6, float(vertical_spread_factor) * r0)
    vertical_factor = math.exp(-0.5 * ((float(height_m) - float(hub_height_m)) / sigma_z) ** 2)

    # Global deflection if no per-turbine yaw.
    base_defl_rad = math.radians(float(deflection_deg))

    for t in turbines:
        dx = x_coords_m - np.float32(t.x_m)
        dy = y_coords_m - np.float32(t.y_m)

        # Downwind / crosswind coordinates via broadcasting.
        x_d = dx[None, :] * u_x + dy[:, None] * u_y
        y_d = dx[None, :] * v_x + dy[:, None] * v_y

        mask = x_d > 0.0
        if not mask.any():
            continue

        # Wake expansion.
        r = r0 + float(wake_expansion_k) * x_d
        sigma = np.maximum(1e-6, r / 2.0).astype(np.float32)

        # Deflection: per-turbine yaw (if provided) slightly changes deflection.
        defl_rad = base_defl_rad
        if t.yaw_deg is not None:
            defl_rad = math.radians(float(deflection_deg) + float(t.yaw_deg) * float(yaw_to_deflection_gain))
        defl = np.tan(defl_rad) * x_d

        denom = (1.0 + (2.0 * float(wake_expansion_k) * x_d / d)) ** 2
        deficit_center = (one_minus_sqrt / denom).astype(np.float32)

        # Gaussian crosswind profile; vertical scaling baked as a scalar.
        arg = (y_d - defl) / sigma
        deficit = deficit_center * np.exp(-0.5 * (arg**2)).astype(np.float32)
        deficit *= float(vertical_factor)

        # Apply downstream mask and clip.
        deficit = np.where(mask, deficit, 0.0).astype(np.float32)
        deficit = np.clip(deficit, 0.0, float(max_deficit)).astype(np.float32)

        sum_sq += deficit * deficit

    total_deficit = np.sqrt(sum_sq).astype(np.float32)
    total_deficit = np.clip(total_deficit, 0.0, float(max_deficit)).astype(np.float32)
    ratio = (1.0 - total_deficit).astype(np.float32)
    ratio = np.clip(ratio, 0.0, 1.0).astype(np.float32)
    return ratio


def _floris_ratio_field(
    *,
    turbines: list[LayoutPoint],
    wind_from_deg: float,
    wind_speed_mps: float,
    ti: float,
    height_m: float,
    x_bounds_m: tuple[float, float],
    y_bounds_m: tuple[float, float],
    nx: int,
    ny: int,
    floris_config: Path,
) -> np.ndarray:
    """
    Compute a ratio field u / wind_speed on an (ny,nx) grid using FLORIS.
    Requires FLORIS installed in the current python environment.
    """

    try:
        from floris import FlorisModel  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "FLORIS not available. Install it in your python env and retry, e.g.:\n"
            "  pip install floris\n"
            f"Import error: {e}"
        ) from e

    if not floris_config.exists():
        raise FileNotFoundError(floris_config)

    fmodel = FlorisModel(str(floris_config))
    fmodel.set(
        layout_x=[t.x_m for t in turbines],
        layout_y=[t.y_m for t in turbines],
        wind_directions=[float(wind_from_deg)],
        wind_speeds=[float(wind_speed_mps)],
        turbulence_intensities=[float(ti)],
    )

    fmodel.run()

    # API surface differs a bit across FLORIS versions; try a couple of paths.
    plane = None
    last_err = None
    for kwargs in (
        dict(
            height=float(height_m),
            x_resolution=int(nx),
            y_resolution=int(ny),
            x_bounds=tuple(map(float, x_bounds_m)),
            y_bounds=tuple(map(float, y_bounds_m)),
        ),
        dict(
            height=float(height_m),
            x_resolution=int(nx),
            y_resolution=int(ny),
            x1_bounds=tuple(map(float, x_bounds_m)),
            x2_bounds=tuple(map(float, y_bounds_m)),
        ),
    ):
        try:
            plane = fmodel.calculate_horizontal_plane(**kwargs)
            break
        except Exception as e:
            last_err = e
            plane = None

    if plane is None:
        raise RuntimeError(f"Failed to compute FLORIS horizontal plane: {last_err}")

    # Convert plane to a (ny,nx) velocity grid.
    u = None
    if hasattr(plane, "df"):
        df = plane.df  # pandas DataFrame
        # Common FLORIS column names: x1,x2,u
        for u_col in ("u", "U", "ws", "wind_speed"):
            if u_col in df.columns:
                u = df[u_col].to_numpy()
                break
        # If the plane is a regular grid, ordering should match reshape.
    elif hasattr(plane, "u"):
        u = np.asarray(plane.u)

    if u is None:
        raise RuntimeError("Unable to extract velocity data from FLORIS plane output.")

    u = np.asarray(u, dtype=np.float32).reshape((ny, nx))
    ratio = u / float(wind_speed_mps)
    ratio = np.clip(ratio, 0.0, 1.0).astype(np.float32)
    return ratio


def _parse_heights_arg(heights_arg: str, available: Iterable[float]) -> list[float]:
    heights_arg = (heights_arg or "").strip().lower()
    if heights_arg in {"", "all"}:
        return list(map(float, available))
    parts = [p.strip() for p in heights_arg.split(",") if p.strip()]
    out: list[float] = []
    for p in parts:
        out.append(float(p))
    return out


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Overlay wake deficit onto slice PNGs (one-off demo helper).")
    p.add_argument("--caseId", required=True, help="Base case id under backend/uploads/")
    p.add_argument("--layout-file", type=Path, default=None, help="CSV/JSON/XLSX with x,y(,yaw) columns in meters.")
    p.add_argument("--layout-from-case", default=None, help="Read turbine layout from another case's info.json.")

    p.add_argument("--model", choices=["simple", "floris"], default="simple")
    p.add_argument("--floris-config", type=Path, default=None, help="FLORIS YAML config (required for --model floris).")

    p.add_argument("--wind-from-deg", type=float, default=None, help="Meteorological wind direction FROM (deg).")
    p.add_argument("--wind-speed", type=float, default=None, help="Wind speed used for FLORIS ratio (m/s).")
    p.add_argument("--ti", type=float, default=0.08, help="Turbulence intensity (0-1) used for FLORIS.")

    # Simple-model parameters
    p.add_argument("--ct", type=float, default=0.80, help="Thrust coefficient Ct for the simple model.")
    p.add_argument("--rotor-diameter", type=float, default=170.0, help="Rotor diameter D (m) for the simple model.")
    p.add_argument("--hub-height", type=float, default=120.0, help="Hub height (m) for the simple model.")
    p.add_argument("--wake-expansion-k", type=float, default=0.05, help="Wake expansion coefficient k (Jensen-like).")
    p.add_argument("--deflection-deg", type=float, default=5.0, help="Base wake deflection angle (deg, visualization).")
    p.add_argument(
        "--yaw-to-deflection-gain",
        type=float,
        default=0.0,
        help="Additional deflection per turbine yaw (defl += yaw * gain).",
    )
    p.add_argument("--vertical-spread-factor", type=float, default=1.0, help="sigma_z = factor*(D/2) for vertical decay.")
    p.add_argument("--max-deficit", type=float, default=0.95, help="Clamp maximum local deficit.")

    # Layout transform
    p.add_argument("--layout-scale", type=float, default=1.0, help="Scale factor for layout coordinates.")
    p.add_argument("--layout-shift-x", type=float, default=0.0, help="Translate layout x by this many meters.")
    p.add_argument("--layout-shift-y", type=float, default=0.0, help="Translate layout y by this many meters.")
    p.add_argument("--layout-auto-center", action="store_true", help="Shift layout centroid to domain center.")

    # Output controls
    p.add_argument("--heights", default="all", help="Comma list of heights (m), or 'all'.")
    p.add_argument("--no-backup", action="store_true", help="Do not backup existing slice images.")
    p.add_argument("--dry-run", action="store_true", help="Validate inputs but do not write outputs.")

    args = p.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[2]
    uploads_dir = repo_root / "backend" / "uploads"
    case_dir = uploads_dir / args.caseId
    if not case_dir.exists():
        raise FileNotFoundError(f"Case directory not found: {case_dir}")

    cache_dir = case_dir / "visualization_cache"
    viz_meta_path = cache_dir / "metadata.json"
    if not viz_meta_path.exists():
        raise FileNotFoundError(
            f"visualization_cache not found ({viz_meta_path}). Run precompute_visualization.py first."
        )
    viz_meta = _read_json(viz_meta_path)

    extent_m = viz_meta.get("extent_m")
    if not extent_m or len(extent_m) != 4:
        raise ValueError("visualization_cache/metadata.json missing extent_m=[xmin,xmax,ymin,ymax]")

    x_coords = np.asarray(viz_meta.get("xCoords_m") or [], dtype=np.float32)
    y_coords = np.asarray(viz_meta.get("yCoords_m") or [], dtype=np.float32)
    if x_coords.size == 0 or y_coords.size == 0:
        raise ValueError("visualization_cache/metadata.json missing xCoords_m/yCoords_m")

    vmin = float(viz_meta.get("vmin", 0.0))
    vmax = float(viz_meta.get("vmax", 15.0))

    cube, out_meta = _load_speed_cube(case_dir)
    heights_available = out_meta.get("heights") or viz_meta.get("heightLevels") or []
    if not heights_available:
        # Fallback to dh * layer index.
        dh = float(out_meta.get("dh", 10))
        heights_available = [dh * (i + 1) for i in range(int(out_meta["size"][2]))]

    heights_to_process = _parse_heights_arg(args.heights, heights_available)
    height_to_idx = {float(h): i for i, h in enumerate(map(float, heights_available))}

    # Resolve wind defaults from case
    default_wind_from, default_wind_speed = _resolve_case_wind(case_dir, viz_meta)
    wind_from = float(args.wind_from_deg) if args.wind_from_deg is not None else default_wind_from
    wind_speed = float(args.wind_speed) if args.wind_speed is not None else default_wind_speed

    # Load and transform layout.
    raw_layout = _load_layout_points(
        layout_file=args.layout_file,
        layout_from_case=args.layout_from_case,
        uploads_dir=uploads_dir,
    )
    domain_center = (float((x_coords[0] + x_coords[-1]) / 2.0), float((y_coords[0] + y_coords[-1]) / 2.0))
    layout = _apply_layout_transform(
        raw_layout,
        scale=float(args.layout_scale),
        shift_x=float(args.layout_shift_x),
        shift_y=float(args.layout_shift_y),
        auto_center=bool(args.layout_auto_center),
        target_center=domain_center,
    )

    if args.dry_run:
        print("DRY RUN — no files will be written.")

    print(f"Base case: {args.caseId}")
    print(f"Domain extent_m: {extent_m}")
    print(f"Grid: Nx={len(x_coords)} Ny={len(y_coords)} Nz={cube.shape[0]}")
    print(f"Wind: from={wind_from:.1f} deg, speed={wind_speed:.2f} m/s")
    print(f"Layout: {len(layout)} turbines (first: {layout[0].id} @ {layout[0].x_m:.1f},{layout[0].y_m:.1f})")
    print(f"Heights to process: {', '.join(f'{h:.1f}' for h in heights_to_process)}")

    if args.model == "floris" and not args.floris_config:
        raise ValueError("--floris-config is required when --model floris")

    # Backup existing images for the heights we touch.
    slices_img_dir = cache_dir / "slices_img"
    backup_dir = None
    if not args.no_backup and not args.dry_run:
        stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = cache_dir / f"slices_img_backup_{stamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)

    for h in heights_to_process:
        # Find closest exact layer; keep strict to match filenames toFixed(1)
        # to avoid accidentally writing a new height that's not present.
        if float(h) not in height_to_idx:
            # If exact match isn't present, pick closest.
            closest = min(height_to_idx.keys(), key=lambda x: abs(x - float(h)))
            idx = height_to_idx[closest]
            height_m = float(closest)
        else:
            idx = height_to_idx[float(h)]
            height_m = float(h)

        base_slice = cube[idx]
        if args.model == "simple":
            ratio = _simple_wake_ratio_field(
                x_coords_m=x_coords,
                y_coords_m=y_coords,
                height_m=height_m,
                turbines=layout,
                wind_from_deg=wind_from,
                ct=float(args.ct),
                rotor_diameter_m=float(args.rotor_diameter),
                hub_height_m=float(args.hub_height),
                wake_expansion_k=float(args.wake_expansion_k),
                deflection_deg=float(args.deflection_deg),
                yaw_to_deflection_gain=float(args.yaw_to_deflection_gain),
                vertical_spread_factor=float(args.vertical_spread_factor),
                max_deficit=float(args.max_deficit),
            )
        else:
            ratio = _floris_ratio_field(
                turbines=layout,
                wind_from_deg=wind_from,
                wind_speed_mps=wind_speed,
                ti=float(args.ti),
                height_m=height_m,
                x_bounds_m=(float(extent_m[0]), float(extent_m[1])),
                y_bounds_m=(float(extent_m[2]), float(extent_m[3])),
                nx=len(x_coords),
                ny=len(y_coords),
                floris_config=args.floris_config,
            )

        # Apply ratio to the base field (preserve NaNs).
        combined = (base_slice * ratio).astype(np.float32)
        combined = np.where(np.isnan(base_slice), np.nan, combined).astype(np.float32)

        height_str = f"{height_m:.1f}"
        out_png = slices_img_dir / f"slice_height_{height_str}.png"

        if backup_dir and out_png.exists():
            shutil.copy2(out_png, backup_dir / out_png.name)

        if args.dry_run:
            print(f"[dry-run] would write {out_png}")
            continue

        _render_slice_png(
            out_png=out_png,
            slice_np=combined,
            height_m=height_m,
            extent_m=list(map(float, extent_m)),
            vmin=vmin,
            vmax=vmax,
            title_suffix=" (wake overlay)",
        )
        print(f"Wrote {out_png}")

    if backup_dir:
        print(f"Backup saved to: {backup_dir}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        raise SystemExit(130)
