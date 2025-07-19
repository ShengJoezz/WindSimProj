import pyvista as pv, numpy as np, sys, pathlib

infile = pathlib.Path(sys.argv[1])
mesh   = pv.read(infile)
vec    = 'U'

# 1. 根据网格尺寸自动计算采样密度
bounds = mesh.bounds
dx = bounds[1] - bounds[0]  # x方向长度
dy = bounds[3] - bounds[2]  # y方向长度  
dz = bounds[5] - bounds[4]  # z方向长度

print(f"网格尺寸: {dx:.2f} x {dy:.2f} x {dz:.2f}")

# 根据最大尺寸确定基础密度，然后按比例分配
target_total = 50000  # 目标种子点总数
max_dim = max(dx, dy, dz)
base_density = (target_total ** (1/3))  # 立方根作为基础密度

nx = max(10, int(base_density * dx / max_dim))
ny = max(10, int(base_density * dy / max_dim)) 
nz = max(5, int(base_density * dz / max_dim))   # z方向通常较薄

print(f"采样网格: {nx} x {ny} x {nz} = {nx*ny*nz} 个种子点")

x = np.linspace(bounds[0], bounds[1], nx)
y = np.linspace(bounds[2], bounds[3], ny)
z = np.linspace(bounds[4], bounds[5], nz)

xx, yy, zz = np.meshgrid(x, y, z, indexing='ij')
seed_points = np.c_[xx.ravel(), yy.ravel(), zz.ravel()]

# 只保留在网格内的种子点
seeds_mesh = pv.PolyData(seed_points)
seeds_in_mesh = mesh.select_enclosed_points(seeds_mesh)
valid_seeds = seed_points[seeds_in_mesh['SelectedPoints'].astype(bool)]
seeds = pv.PolyData(valid_seeds)

print(f"有效种子点: {len(valid_seeds)}")