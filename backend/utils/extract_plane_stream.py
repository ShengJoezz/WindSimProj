#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
plane_stream_web.py  –  固定高度流线裁剪 & 压缩成 Web 友好的 .vtp.gz
"""

import pyvista as pv, numpy as np, pathlib, argparse, gzip, shutil, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-i', '--infile', required=True, help='原始流线 .vtp/.vtu')
    ap.add_argument('-H', '--height',  type=float, required=True, help='目标高度 (m)')
    ap.add_argument('-d', '--delta',   type=float, default=0.15,   help='半厚度 Δ (m)')
    ap.add_argument('--target',        type=int,   default=500_000,
                    help='保留的最大顶点数 (默认 5e5)')
    ap.add_argument('-o', '--outfile', help='输出文件名 (自动附 .vtp.gz)')
    args = ap.parse_args()

    in_path  = pathlib.Path(args.infile).expanduser().resolve()
    mesh_all = pv.read(in_path)
    print(f'载入 {in_path.name}:  {mesh_all.n_cells} 条线 / {mesh_all.n_points} 顶点')
    print(f'Z 范围: {mesh_all.bounds[4]:.3f}  →  {mesh_all.bounds[5]:.3f} m')

    # ------------------------------------------------------------
    # 1) 选出 z ∈ [H-Δ, H+Δ] 流线
    H, d = args.height, args.delta
    z_min, z_max = H - d, H + d
    mesh_all.point_data['zCoord'] = mesh_all.points[:, 2]
    slab = mesh_all.threshold((z_min, z_max), scalars='zCoord', preference='point')
    del mesh_all
    print(f'提取薄层:  z ∈ [{z_min}, {z_max}],  剩余 {slab.n_cells} 条线')

    # 2) UnstructuredGrid → PolyData，合并碎线
    slab = slab.extract_geometry().connectivity(lines_only=True)
    print(f'PolyData: {slab.n_cells} 条线 / {slab.n_points} 顶点')

    # 3) 轻量化
    if slab.n_points > args.target:
        ratio = args.target / slab.n_points
        slab = slab.mask_points(on_ratio=int(1/ratio), random=True, inplace=False)
        slab = slab.connectivity(lines_only=True)
        print(f'轻量化 → {slab.n_cells} 条线 / {slab.n_points} 顶点')

    # 4) 保存 .vtp.gz
    out_base = pathlib.Path(args.outfile) if args.outfile \
               else in_path.with_stem(f'{in_path.stem}_{H:.0f}m')
    out_vtp = out_base.with_suffix('.vtp')
    slab.save(out_vtp)

    with open(out_vtp, 'rb') as f_in, gzip.open(f'{out_vtp}.gz', 'wb') as f_out:
        shutil.copyfileobj(f_in, f_out)
    out_vtp.unlink()
    print(f'✓ 已写 {out_vtp}.gz  (web-friendly)')

if __name__ == '__main__':
    main()