#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Experimental CFD slice backend.

Purpose:
1. Read authoritative CFD results from an OpenFOAM `.foam` file when present,
   otherwise fall back to the exported `internal.vtu`.
2. Build a lightweight vector-volume cache on the server.
3. Serve arbitrary plane slices sampled from that cache for isolated web labs.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyvista as pv


CACHE_VERSION = 2
DEFAULT_TARGET_CELLS = 1_500_000
DEFAULT_MIN_DIMS = (64, 64, 24)
DEFAULT_MAX_DIMS = (220, 220, 96)
DEFAULT_SLICE_RESOLUTION = (220, 160)
DEFAULT_PARTICLE_COUNT = 24_000
MIN_PARTICLE_COUNT = 4_000
MAX_PARTICLE_COUNT = 60_000


def log(message: str) -> None:
    print(message, file=sys.stderr)


def json_dump(payload: dict) -> None:
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


def normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm < 1e-9:
        raise ValueError("零长度法向量无效。")
    return vector / norm


def choose_basis(normal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    candidates = (
        np.array([0.0, 0.0, 1.0], dtype=np.float64),
        np.array([0.0, 1.0, 0.0], dtype=np.float64),
        np.array([1.0, 0.0, 0.0], dtype=np.float64),
    )
    tangent = None
    for axis in candidates:
        cross = np.cross(axis, normal)
        if np.linalg.norm(cross) > 1e-6:
            tangent = normalize(cross)
            break
    if tangent is None:
        tangent = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    bitangent = normalize(np.cross(normal, tangent))
    return tangent, bitangent


def generate_bbox_corners(bounds: list[float]) -> np.ndarray:
    xmin, xmax, ymin, ymax, zmin, zmax = bounds
    return np.array([
        [xmin, ymin, zmin],
        [xmin, ymin, zmax],
        [xmin, ymax, zmin],
        [xmin, ymax, zmax],
        [xmax, ymin, zmin],
        [xmax, ymin, zmax],
        [xmax, ymax, zmin],
        [xmax, ymax, zmax],
    ], dtype=np.float64)


def compute_projected_extents(bounds_m: list[float], origin_m: np.ndarray, tangent: np.ndarray, bitangent: np.ndarray) -> tuple[float, float, float, float]:
    corners = generate_bbox_corners(bounds_m)
    relative = corners - origin_m[None, :]
    u_coords = relative @ tangent
    v_coords = relative @ bitangent
    pad_u = max(1.0, 0.03 * max(1.0, float(u_coords.max() - u_coords.min())))
    pad_v = max(1.0, 0.03 * max(1.0, float(v_coords.max() - v_coords.min())))
    return (
        float(u_coords.min() - pad_u),
        float(u_coords.max() + pad_u),
        float(v_coords.min() - pad_v),
        float(v_coords.max() + pad_v),
    )


@dataclass
class SourceSelection:
    kind: str
    path: Path


def select_source(run_dir: Path) -> SourceSelection:
    foam_files = sorted(run_dir.glob("*.foam")) + sorted(run_dir.glob("*.OpenFOAM"))
    if foam_files:
        return SourceSelection("foam", foam_files[0])

    processed_internal = run_dir / "VTK" / "processed" / "internal.vtu"
    if processed_internal.exists():
        return SourceSelection("internal_vtu", processed_internal)

    vtk_run_dirs = sorted((run_dir / "VTK").glob("run_*"))
    for vtk_run_dir in vtk_run_dirs:
        candidate = vtk_run_dir / "internal.vtu"
        if candidate.exists():
            return SourceSelection("internal_vtu", candidate)

    raise FileNotFoundError("未找到可用的 .foam 或 internal.vtu 源文件。")


def load_case_info(case_dir: Path) -> dict:
    info_path = case_dir / "info.json"
    if not info_path.exists():
        raise FileNotFoundError(f"找不到 info.json: {info_path}")
    return json.loads(info_path.read_text(encoding="utf-8"))


def resolve_scale(info: dict) -> float:
    scale = float(info.get("mesh", {}).get("scale", 0.001) or 0.001)
    if not np.isfinite(scale) or abs(scale) < 1e-12:
        return 0.001
    return scale


def read_dataset(source: SourceSelection) -> pv.DataSet:
    if source.kind == "foam":
        reader_cls = getattr(pv, "POpenFOAMReader", None) or getattr(pv, "OpenFOAMReader", None)
        if reader_cls is None:
            raise RuntimeError("当前 PyVista 环境不支持 OpenFOAM Reader。")

        reader = reader_cls(str(source.path))
        for attr, value in (
            ("cell_to_point_creation", True),
            ("decompose_polyhedra", True),
            ("skip_zero_time", False),
        ):
            if hasattr(reader, attr):
                try:
                    setattr(reader, attr, value)
                except Exception:
                    pass

        data = reader.read()
        if isinstance(data, pv.MultiBlock):
            for key in ("internalMesh", "internalMesh-region0"):
                try:
                    block = data[key]
                except Exception:
                    block = None
                if block is not None:
                    data = block
                    break
            else:
                for block in data:
                    if block is not None:
                        data = block
                        break
        if data is None:
            raise RuntimeError(f"无法从 OpenFOAM 结果中解析内部网格: {source.path}")
    else:
        data = pv.read(source.path)

    if "U" not in getattr(data, "point_data", {}):
        if "U" in getattr(data, "cell_data", {}):
            data = data.cell_data_to_point_data(pass_cell_data=True)
        else:
            raise KeyError("结果数据中未找到速度矢量场 U。")

    return data


def compute_volume_dims(bounds_model: list[float], target_cells: int) -> np.ndarray:
    lengths = np.array([
        max(1e-6, bounds_model[1] - bounds_model[0]),
        max(1e-6, bounds_model[3] - bounds_model[2]),
        max(1e-6, bounds_model[5] - bounds_model[4]),
    ], dtype=np.float64)
    scale = float((target_cells / float(np.prod(lengths))) ** (1.0 / 3.0))
    dims = np.round(lengths * scale).astype(np.int32) + 1
    dims = np.maximum(dims, np.array(DEFAULT_MIN_DIMS, dtype=np.int32))
    dims = np.minimum(dims, np.array(DEFAULT_MAX_DIMS, dtype=np.int32))
    return dims


def ensure_cache(case_dir: Path, *, target_cells: int = DEFAULT_TARGET_CELLS, force_rebuild: bool = False) -> dict:
    info = load_case_info(case_dir)
    scale = resolve_scale(info)
    run_dir = case_dir / "run"
    source = select_source(run_dir)

    cache_dir = case_dir / "flow_lab_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = cache_dir / "vector_volume_metadata.json"
    volume_path = cache_dir / "vector_volume_cache.npz"
    volume_texture_path = cache_dir / "speed_volume_u8.bin"
    case_id = case_dir.name

    if not force_rebuild and metadata_path.exists() and volume_path.exists() and volume_texture_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if (
                int(metadata.get("cacheVersion", -1)) == CACHE_VERSION
                and metadata.get("sourceKind") == source.kind
                and metadata.get("sourcePath") == str(source.path)
                and metadata.get("targetCells") == int(target_cells)
            ):
                metadata["cacheReady"] = True
                metadata["cacheDir"] = str(cache_dir)
                metadata["cacheFile"] = str(volume_path)
                metadata["volumeTextureFile"] = str(volume_texture_path)
                return metadata
        except Exception:
            pass

    started = time.time()
    dataset = read_dataset(source)
    bounds_model = [float(value) for value in dataset.bounds]
    dims = compute_volume_dims(bounds_model, target_cells)
    lengths_model = np.array([
        bounds_model[1] - bounds_model[0],
        bounds_model[3] - bounds_model[2],
        bounds_model[5] - bounds_model[4],
    ], dtype=np.float64)
    spacing_model = lengths_model / np.maximum(dims - 1, 1)

    image = pv.ImageData(
        dimensions=tuple(int(value) for value in dims),
        spacing=tuple(float(value) for value in spacing_model),
        origin=(bounds_model[0], bounds_model[2], bounds_model[4]),
    )
    sampled = image.sample(dataset)

    vectors = np.asarray(sampled["U"], dtype=np.float32)
    valid_mask = np.asarray(sampled["vtkValidPointMask"], dtype=np.float32)

    nz, ny, nx = int(dims[2]), int(dims[1]), int(dims[0])
    vectors_zyx = vectors.reshape((nz, ny, nx, 3))
    valid_zyx = valid_mask.reshape((nz, ny, nx))
    speed_zyx = np.linalg.norm(vectors_zyx, axis=-1).astype(np.float32)

    origin_m = np.array([
        bounds_model[0] / scale,
        bounds_model[2] / scale,
        bounds_model[4] / scale,
    ], dtype=np.float64)
    spacing_m = np.array([
        spacing_model[0] / scale,
        spacing_model[1] / scale,
        spacing_model[2] / scale,
    ], dtype=np.float64)
    bounds_m = [
        bounds_model[0] / scale,
        bounds_model[1] / scale,
        bounds_model[2] / scale,
        bounds_model[3] / scale,
        bounds_model[4] / scale,
        bounds_model[5] / scale,
    ]
    valid_points = valid_zyx > 0.5
    valid_speed = speed_zyx[valid_points]
    if valid_speed.size == 0:
        valid_speed = speed_zyx.reshape(-1)
    speed_min = float(np.nanmin(valid_speed))
    speed_max = float(np.nanmax(valid_speed))

    texture_u8 = np.zeros(speed_zyx.shape, dtype=np.uint8)
    if speed_max - speed_min < 1e-6:
        texture_u8[valid_points] = 255
    else:
        normalized = np.clip((speed_zyx[valid_points] - speed_min) / (speed_max - speed_min), 0.0, 1.0)
        texture_u8[valid_points] = np.clip(np.round(normalized * 254.0) + 1.0, 1.0, 255.0).astype(np.uint8)

    np.savez(
        volume_path,
        vectors=vectors_zyx.astype(np.float32),
        speed=speed_zyx.astype(np.float32),
        valid=valid_zyx.astype(np.float32),
        origin_m=origin_m.astype(np.float64),
        spacing_m=spacing_m.astype(np.float64),
        dims=np.array([nx, ny, nz], dtype=np.int32),
        bounds_m=np.array(bounds_m, dtype=np.float64),
        center_m=np.array([
            0.5 * (bounds_m[0] + bounds_m[1]),
            0.5 * (bounds_m[2] + bounds_m[3]),
            0.5 * (bounds_m[4] + bounds_m[5]),
        ], dtype=np.float64),
        scale=np.array([scale], dtype=np.float64),
    )
    volume_texture_path.write_bytes(texture_u8.tobytes(order="C"))

    metadata = {
        "cacheVersion": CACHE_VERSION,
        "cacheReady": True,
        "cacheDir": str(cache_dir),
        "cacheFile": str(volume_path),
        "volumeTextureFile": str(volume_texture_path),
        "volumeTextureUrl": f"/uploads/{case_id}/flow_lab_cache/{volume_texture_path.name}",
        "sourceKind": source.kind,
        "sourcePath": str(source.path),
        "targetCells": int(target_cells),
        "dims": [int(nx), int(ny), int(nz)],
        "voxelCount": int(nx * ny * nz),
        "origin_m": [float(value) for value in origin_m],
        "spacing_m": [float(value) for value in spacing_m],
        "bounds_m": [float(value) for value in bounds_m],
        "scale": float(scale),
        "validRatio": float(np.mean(valid_zyx)),
        "speedRange": [
            speed_min,
            speed_max,
        ],
        "volumeTextureRange": [1.0 / 255.0, 1.0],
        "speedP95": float(np.nanpercentile(valid_speed, 95.0)),
        "speedP995": float(np.nanpercentile(valid_speed, 99.5)),
        "buildSeconds": round(time.time() - started, 3),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def load_cached_volume(case_dir: Path, *, target_cells: int = DEFAULT_TARGET_CELLS, ensure: bool = True) -> tuple[dict, dict]:
    if ensure:
        metadata = ensure_cache(case_dir, target_cells=target_cells)
    else:
        metadata_path = case_dir / "flow_lab_cache" / "vector_volume_metadata.json"
        if not metadata_path.exists():
            raise FileNotFoundError("矢量体缓存不存在。")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    cache_file = Path(metadata["cacheFile"])
    with np.load(cache_file) as payload:
        volume = {
            "vectors": payload["vectors"].astype(np.float32),
            "speed": payload["speed"].astype(np.float32),
            "valid": payload["valid"].astype(np.float32),
            "origin_m": payload["origin_m"].astype(np.float64),
            "spacing_m": payload["spacing_m"].astype(np.float64),
            "dims": payload["dims"].astype(np.int32),
            "bounds_m": payload["bounds_m"].astype(np.float64),
            "center_m": payload["center_m"].astype(np.float64),
        }
    return metadata, volume


def build_particle_cloud(case_dir: Path, metadata: dict, volume: dict, *, particle_count: int, force_rebuild: bool = False) -> dict:
    cache_dir = case_dir / "flow_lab_cache"
    sample_count = int(np.clip(int(particle_count), MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT))
    particle_path = cache_dir / f"particle_cloud_{sample_count}.f32.bin"
    particle_meta_path = cache_dir / f"particle_cloud_{sample_count}.json"
    case_id = case_dir.name

    if not force_rebuild and particle_path.exists() and particle_meta_path.exists():
        try:
            payload = json.loads(particle_meta_path.read_text(encoding="utf-8"))
            payload["particleCloudFile"] = str(particle_path)
            payload["particleCloudUrl"] = f"/uploads/{case_id}/flow_lab_cache/{particle_path.name}"
            return payload
        except Exception:
            pass

    started = time.time()
    valid_mask = np.asarray(volume["valid"] > 0.5, dtype=bool)
    flat_valid = np.flatnonzero(valid_mask.reshape(-1))
    if flat_valid.size == 0:
        raise ValueError("当前体缓存里没有可用于粒子云的有效体素。")

    flat_speed = volume["speed"].reshape(-1).astype(np.float32)
    flat_vectors = volume["vectors"].reshape((-1, 3)).astype(np.float32)
    candidate_speed = flat_speed[flat_valid]
    candidate_vectors = flat_vectors[flat_valid]
    candidate_speed_max = float(np.nanmax(candidate_speed))
    candidate_speed_p95 = float(np.nanpercentile(candidate_speed, 95.0))
    speed_scale = max(1e-6, candidate_speed_p95)

    # Favor energetic regions, but retain a baseline weight so slower recirculation zones still appear.
    weights = 0.14 + np.power(np.clip(candidate_speed / speed_scale, 0.0, 1.4), 1.2)
    weights = np.where(np.isfinite(weights), weights, 0.14).astype(np.float64)
    weights_sum = float(np.sum(weights))
    if weights_sum < 1e-9:
        weights = np.full_like(weights, 1.0 / max(1, weights.size), dtype=np.float64)
    else:
        weights /= weights_sum

    replace = flat_valid.size < sample_count
    seed = int((metadata["voxelCount"] * 1315423911 + sample_count * 2654435761) % (2 ** 32))
    rng = np.random.default_rng(seed=seed)
    chosen_indices = rng.choice(flat_valid.size, size=sample_count, replace=replace, p=weights)
    chosen_flat = flat_valid[chosen_indices]

    nx, ny, nz = (int(value) for value in volume["dims"])
    z_idx, y_idx, x_idx = np.unravel_index(chosen_flat, (nz, ny, nx))
    origin_m = volume["origin_m"]
    spacing_m = volume["spacing_m"]

    positions = np.column_stack((
        origin_m[0] + (x_idx.astype(np.float32) * spacing_m[0]),
        origin_m[1] + (y_idx.astype(np.float32) * spacing_m[1]),
        origin_m[2] + (z_idx.astype(np.float32) * spacing_m[2]),
    )).astype(np.float32)
    jitter = (rng.random((sample_count, 3), dtype=np.float32) - 0.5) * spacing_m.astype(np.float32)[None, :]
    positions += jitter

    directions = flat_vectors[chosen_flat].copy()
    direction_norm = np.linalg.norm(directions, axis=1, keepdims=True)
    valid_dir = direction_norm[:, 0] > 1e-6
    directions[valid_dir] /= direction_norm[valid_dir]
    directions[~valid_dir] = np.array([1.0, 0.0, 0.0], dtype=np.float32)

    speeds = flat_speed[chosen_flat].astype(np.float32)
    phase = rng.random(sample_count, dtype=np.float32)

    records = np.column_stack((
        positions,
        directions.astype(np.float32),
        speeds,
        phase,
    )).astype(np.float32)
    particle_path.write_bytes(records.tobytes(order="C"))

    payload = {
        "success": True,
        "particleCount": int(sample_count),
        "particleStrideFloats": 8,
        "particleFields": [
            "x_m",
            "y_m",
            "z_m",
            "dir_x",
            "dir_y",
            "dir_z",
            "speed_mps",
            "phase01",
        ],
        "particleCloudFile": str(particle_path),
        "particleCloudUrl": f"/uploads/{case_id}/flow_lab_cache/{particle_path.name}",
        "particleCloudByteLength": int(records.nbytes),
        "particleSpeedRange": [
            float(np.nanmin(speeds)),
            float(np.nanmax(speeds)),
        ],
        "particleSpeedP95": float(np.nanpercentile(speeds, 95.0)),
        "sampleBias": "weighted_by_speed",
        "buildSeconds": round(time.time() - started, 3),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    particle_meta_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def build_normal_from_mode(mode: str, azimuth_deg: float, tilt_deg: float) -> np.ndarray:
    if mode == "xy":
        return np.array([0.0, 0.0, 1.0], dtype=np.float64)
    if mode == "xz":
        return np.array([0.0, 1.0, 0.0], dtype=np.float64)
    if mode == "yz":
        return np.array([1.0, 0.0, 0.0], dtype=np.float64)

    az = math.radians(float(azimuth_deg))
    tilt = math.radians(float(tilt_deg))
    return normalize(np.array([
        math.sin(tilt) * math.cos(az),
        math.sin(tilt) * math.sin(az),
        math.cos(tilt),
    ], dtype=np.float64))


def interpolate_trilinear(volume: dict, points_m: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    vectors = volume["vectors"]
    valid = volume["valid"]
    origin = volume["origin_m"]
    spacing = volume["spacing_m"]
    nx, ny, nz = (int(value) for value in volume["dims"])

    fx = (points_m[:, 0] - origin[0]) / spacing[0]
    fy = (points_m[:, 1] - origin[1]) / spacing[1]
    fz = (points_m[:, 2] - origin[2]) / spacing[2]

    inside = (
        (fx >= 0.0) & (fx <= (nx - 1)) &
        (fy >= 0.0) & (fy <= (ny - 1)) &
        (fz >= 0.0) & (fz <= (nz - 1))
    )

    result_vectors = np.zeros((points_m.shape[0], 3), dtype=np.float32)
    result_valid = np.zeros((points_m.shape[0],), dtype=np.float32)
    if not np.any(inside):
        return result_vectors, result_valid

    fx_i = fx[inside]
    fy_i = fy[inside]
    fz_i = fz[inside]

    x0 = np.floor(fx_i).astype(np.int32)
    y0 = np.floor(fy_i).astype(np.int32)
    z0 = np.floor(fz_i).astype(np.int32)

    x1 = np.clip(x0 + 1, 0, nx - 1)
    y1 = np.clip(y0 + 1, 0, ny - 1)
    z1 = np.clip(z0 + 1, 0, nz - 1)
    x0 = np.clip(x0, 0, nx - 1)
    y0 = np.clip(y0, 0, ny - 1)
    z0 = np.clip(z0, 0, nz - 1)

    wx = (fx_i - x0).astype(np.float32)
    wy = (fy_i - y0).astype(np.float32)
    wz = (fz_i - z0).astype(np.float32)

    def sample(arr, xi, yi, zi):
        return arr[zi, yi, xi]

    c000 = sample(vectors, x0, y0, z0)
    c100 = sample(vectors, x1, y0, z0)
    c010 = sample(vectors, x0, y1, z0)
    c110 = sample(vectors, x1, y1, z0)
    c001 = sample(vectors, x0, y0, z1)
    c101 = sample(vectors, x1, y0, z1)
    c011 = sample(vectors, x0, y1, z1)
    c111 = sample(vectors, x1, y1, z1)

    m000 = sample(valid, x0, y0, z0)
    m100 = sample(valid, x1, y0, z0)
    m010 = sample(valid, x0, y1, z0)
    m110 = sample(valid, x1, y1, z0)
    m001 = sample(valid, x0, y0, z1)
    m101 = sample(valid, x1, y0, z1)
    m011 = sample(valid, x0, y1, z1)
    m111 = sample(valid, x1, y1, z1)

    def mix(a, b, weight):
        return a * (1.0 - weight[:, None]) + b * weight[:, None]

    c00 = mix(c000, c100, wx)
    c10 = mix(c010, c110, wx)
    c01 = mix(c001, c101, wx)
    c11 = mix(c011, c111, wx)
    c0 = mix(c00, c10, wy)
    c1 = mix(c01, c11, wy)
    interpolated_vectors = mix(c0, c1, wz).astype(np.float32)

    def mix_scalar(a, b, weight):
        return a * (1.0 - weight) + b * weight

    m00 = mix_scalar(m000, m100, wx)
    m10 = mix_scalar(m010, m110, wx)
    m01 = mix_scalar(m001, m101, wx)
    m11 = mix_scalar(m011, m111, wx)
    m0 = mix_scalar(m00, m10, wy)
    m1 = mix_scalar(m01, m11, wy)
    interpolated_valid = mix_scalar(m0, m1, wz).astype(np.float32)

    result_vectors[inside] = interpolated_vectors
    result_valid[inside] = interpolated_valid
    return result_vectors, result_valid


def build_slice(case_dir: Path, args: argparse.Namespace) -> dict:
    metadata, volume = load_cached_volume(case_dir, target_cells=args.target_cells, ensure=True)

    normal = build_normal_from_mode(args.mode, args.azimuth_deg, args.tilt_deg)
    tangent, bitangent = choose_basis(normal)
    center_m = volume["center_m"]
    bounds_m = volume["bounds_m"].tolist()

    corners = generate_bbox_corners(bounds_m)
    projected_n = (corners - center_m[None, :]) @ normal
    min_offset = float(projected_n.min())
    max_offset = float(projected_n.max())
    offset_m = float(np.clip(args.offset_m, min_offset, max_offset))
    origin_m = center_m + normal * offset_m

    min_u, max_u, min_v, max_v = compute_projected_extents(bounds_m, origin_m, tangent, bitangent)
    res_x = max(32, int(args.resolution_x))
    res_y = max(32, int(args.resolution_y))
    u_axis = np.linspace(min_u, max_u, res_x, dtype=np.float64)
    v_axis = np.linspace(min_v, max_v, res_y, dtype=np.float64)
    uu, vv = np.meshgrid(u_axis, v_axis)
    points_m = (
        origin_m[None, None, :]
        + uu[..., None] * tangent[None, None, :]
        + vv[..., None] * bitangent[None, None, :]
    ).reshape((-1, 3))

    vectors_flat, valid_flat = interpolate_trilinear(volume, points_m)
    vectors_grid = vectors_flat.reshape((res_y, res_x, 3))
    valid_grid = valid_flat.reshape((res_y, res_x))
    plane_u = np.tensordot(vectors_grid, tangent, axes=([2], [0])).astype(np.float32)
    plane_v = np.tensordot(vectors_grid, bitangent, axes=([2], [0])).astype(np.float32)
    speed_grid = np.linalg.norm(vectors_grid, axis=2).astype(np.float32)

    valid_mask = valid_grid >= 0.5
    coverage = float(np.mean(valid_mask))
    if np.any(valid_mask):
        speed_min = float(np.nanmin(speed_grid[valid_mask]))
        speed_max = float(np.nanmax(speed_grid[valid_mask]))
        speed_p95 = float(np.nanpercentile(speed_grid[valid_mask], 95.0))
    else:
        speed_min = 0.0
        speed_max = 0.0
        speed_p95 = 0.0

    return {
        "success": True,
        "sourceKind": metadata["sourceKind"],
        "sourcePath": metadata["sourcePath"],
        "cacheVersion": metadata["cacheVersion"],
        "cacheDims": metadata["dims"],
        "plane": {
            "mode": args.mode,
            "normal": [float(value) for value in normal],
            "tangent": [float(value) for value in tangent],
            "bitangent": [float(value) for value in bitangent],
            "origin_m": [float(value) for value in origin_m],
            "offset_m": offset_m,
            "offsetRange_m": [min_offset, max_offset],
            "uRange_m": [float(min_u), float(max_u)],
            "vRange_m": [float(min_v), float(max_v)],
            "resolution": [res_x, res_y],
        },
        "bounds_m": bounds_m,
        "uAxis_m": [float(value) for value in u_axis],
        "vAxis_m": [float(value) for value in v_axis],
        "speed": speed_grid.tolist(),
        "planeU": plane_u.tolist(),
        "planeV": plane_v.tolist(),
        "validMask": valid_mask.astype(np.uint8).tolist(),
        "stats": {
            "coverage": coverage,
            "speedMin": speed_min,
            "speedMax": speed_max,
            "speedP95": speed_p95,
        },
    }


def build_particles_payload(case_dir: Path, args: argparse.Namespace) -> dict:
    metadata, volume = load_cached_volume(case_dir, target_cells=args.target_cells, ensure=True)
    particle_payload = build_particle_cloud(
        case_dir,
        metadata,
        volume,
        particle_count=args.particle_count,
        force_rebuild=bool(args.force_rebuild),
    )
    return {
        "success": True,
        "sourceKind": metadata["sourceKind"],
        "sourcePath": metadata["sourcePath"],
        "cacheVersion": metadata["cacheVersion"],
        "cacheDims": metadata["dims"],
        "bounds_m": metadata["bounds_m"],
        "scale": metadata["scale"],
        "speedRange": metadata["speedRange"],
        "speedP95": metadata["speedP95"],
        "speedP995": metadata["speedP995"],
        **particle_payload,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Experimental CFD slice backend")
    subparsers = parser.add_subparsers(dest="command", required=True)

    metadata_parser = subparsers.add_parser("metadata", help="Build or inspect vector-volume cache")
    metadata_parser.add_argument("--case-dir", required=True, help="Case directory path")
    metadata_parser.add_argument("--target-cells", type=int, default=DEFAULT_TARGET_CELLS)
    metadata_parser.add_argument("--force-rebuild", action="store_true")

    slice_parser = subparsers.add_parser("slice", help="Extract an arbitrary plane slice from cached vector volume")
    slice_parser.add_argument("--case-dir", required=True, help="Case directory path")
    slice_parser.add_argument("--target-cells", type=int, default=DEFAULT_TARGET_CELLS)
    slice_parser.add_argument("--mode", choices=("xy", "xz", "yz", "oblique"), default="xy")
    slice_parser.add_argument("--offset-m", type=float, default=0.0)
    slice_parser.add_argument("--azimuth-deg", type=float, default=35.0)
    slice_parser.add_argument("--tilt-deg", type=float, default=55.0)
    slice_parser.add_argument("--resolution-x", type=int, default=DEFAULT_SLICE_RESOLUTION[0])
    slice_parser.add_argument("--resolution-y", type=int, default=DEFAULT_SLICE_RESOLUTION[1])

    particle_parser = subparsers.add_parser("particles", help="Build a sparse 3D particle cloud from cached vector volume")
    particle_parser.add_argument("--case-dir", required=True, help="Case directory path")
    particle_parser.add_argument("--target-cells", type=int, default=DEFAULT_TARGET_CELLS)
    particle_parser.add_argument("--particle-count", type=int, default=DEFAULT_PARTICLE_COUNT)
    particle_parser.add_argument("--force-rebuild", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    case_dir = Path(args.case_dir).resolve()
    if not case_dir.exists():
        raise FileNotFoundError(f"工况目录不存在: {case_dir}")

    if args.command == "metadata":
        payload = ensure_cache(
            case_dir,
            target_cells=max(250_000, int(args.target_cells)),
            force_rebuild=bool(args.force_rebuild),
        )
        payload["success"] = True
        json_dump(payload)
        return 0

    if args.command == "slice":
        payload = build_slice(case_dir, args)
        json_dump(payload)
        return 0

    if args.command == "particles":
        payload = build_particles_payload(case_dir, args)
        json_dump(payload)
        return 0

    raise ValueError(f"未知命令: {args.command}")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        log(f"[experimental_cfd_slice] {type(exc).__name__}: {exc}")
        json_dump({
            "success": False,
            "error": str(exc),
            "errorType": type(exc).__name__,
        })
        sys.exit(1)
