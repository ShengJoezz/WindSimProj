#!/usr/bin/env python
"""
make_stream.py  --  依据向量 U 生成流线 *_stream.vtp
用法:
    python make_stream.py -i <file_or_dir> [-o outdir]
"""
from __future__ import annotations
import argparse, pathlib, sys, numpy as np, pyvista as pv

# ------------------------------------------------------------------
# 帮助函数: 找到或拼接三分量向量
# ------------------------------------------------------------------
def find_or_build_vector(mesh: pv.DataSet) -> tuple[str, str, pv.DataSet]:
    """
    返回可用的向量字段名、数据位置（'point' 或 'cell'）以及可能修改后的网格。
    若不存在 U/Velocity，则尝试把 Ux,Uy,Uz (或 speed_x...) 拼成临时向量 U_tmp
    """
    print("="*50)
    print("调试信息：")
    print(f"数据集类型: {type(mesh)}")
    
    # 根据数据集类型获取合适的维度信息
    if hasattr(mesh, 'dimensions'):
        print(f"维度: {mesh.dimensions}")
    else:
        print(f"边界盒: {mesh.bounds}")
    
    print(f"中心点: {mesh.center}")
    print(f"点数量: {mesh.n_points}")
    print(f"单元数量: {mesh.n_cells}")
    
    # 打印所有可用字段
    print("\n点数据字段:")
    if hasattr(mesh, 'point_data') and mesh.point_data:
        for key in mesh.point_data.keys():
            data = mesh.point_data[key]
            shape_info = getattr(data, 'shape', 'unknown shape')
            dtype_info = getattr(data, 'dtype', 'unknown type')
            print(f"  - {key}: 类型={dtype_info}, 形状={shape_info}")
    else:
        print("  [无点数据]")
    
    print("\n点数组:")
    if hasattr(mesh, 'point_arrays') and mesh.point_arrays:
        for key in mesh.point_arrays.keys():
            data = mesh.point_arrays[key]
            shape_info = getattr(data, 'shape', 'unknown shape')
            dtype_info = getattr(data, 'dtype', 'unknown type')
            print(f"  - {key}: 类型={dtype_info}, 形状={shape_info}")
    else:
        print("  [无点数组]")
    
    print("\n单元数据字段:")
    if hasattr(mesh, 'cell_data') and mesh.cell_data:
        for key in mesh.cell_data.keys():
            data = mesh.cell_data[key]
            shape_info = getattr(data, 'shape', 'unknown shape')
            dtype_info = getattr(data, 'dtype', 'unknown type')
            print(f"  - {key}: 类型={dtype_info}, 形状={shape_info}")
    else:
        print("  [无单元数据]")
    print("="*50)
    
    # 1) 首先在点数据中查找向量场
    if hasattr(mesh, 'point_data') and mesh.point_data:
        print("检查点数据中的向量场...")
        vector_field_candidates = ['U', 'Velocity', 'velocity', 'V', 'v']
        for name in vector_field_candidates:
            if name in mesh.point_data:
                try:
                    arr = mesh.point_data[name]
                    print(f"检查字段 {name}, 类型: {type(arr)}, 形状: {getattr(arr, 'shape', 'unknown')}")
                    
                    # 检查是否为3分量向量
                    if hasattr(arr, 'ndim') and arr.ndim == 2 and arr.shape[1] == 3:
                        print(f"找到点数据中的3分量向量字段: {name}, 形状: {arr.shape}")
                        return name, 'point', mesh
                    elif hasattr(arr, 'ndim') and arr.ndim == 1 and len(arr) % 3 == 0:
                        # 尝试重塑为3分量向量
                        try:
                            reshaped_arr = arr.reshape(-1, 3)
                            print(f"将1D数组 {name} 重塑为3分量向量, 新形状: {reshaped_arr.shape}")
                            mesh.point_data[f"{name}_reshaped"] = reshaped_arr
                            return f"{name}_reshaped", 'point', mesh
                        except Exception as e:
                            print(f"重塑 {name} 失败: {e}")
                    else:
                        print(f"字段 {name} 不是3分量向量")
                except Exception as e:
                    print(f"访问字段 {name} 时出错: {e}")
    
    # 2) 在单元数据中查找向量场
    if hasattr(mesh, 'cell_data') and mesh.cell_data:
        print("检查单元数据中的向量场...")
        vector_field_candidates = ['U', 'Velocity', 'velocity', 'V', 'v']
        for name in vector_field_candidates:
            if name in mesh.cell_data:
                try:
                    arr = mesh.cell_data[name]
                    print(f"检查字段 {name}, 类型: {type(arr)}, 形状: {getattr(arr, 'shape', 'unknown')}")
                    
                    # 检查是否为3分量向量
                    if hasattr(arr, 'ndim') and arr.ndim == 2 and arr.shape[1] == 3:
                        print(f"找到单元数据中的3分量向量字段: {name}, 形状: {arr.shape}")
                        
                        # 方法1：尝试使用 cell_data_to_point_data
                        try:
                            print("尝试使用 cell_data_to_point_data 将单元数据转换为点数据...")
                            new_mesh = mesh.copy()
                            new_mesh.cell_data_to_point_data()
                            if name in new_mesh.point_data:
                                print(f"转换成功！点数据中已有 {name} 字段")
                                return name, 'point', new_mesh
                        except Exception as e:
                            print(f"使用 cell_data_to_point_data 转换失败: {e}")
                        
                        # 方法2：使用单元中心点替代原始网格
                        print("使用单元中心点作为新网格...")
                        cell_centers = mesh.cell_centers()
                        cell_centers.point_data[name] = arr
                        print(f"创建了包含 {cell_centers.n_points} 个点的单元中心点数据集")
                        print(f"单元中心点数据集包含向量字段 {name}, 形状: {cell_centers.point_data[name].shape}")
                        return name, 'point', cell_centers
                        
                except Exception as e:
                    print(f"处理单元数据字段 {name} 时出错: {e}")
    
    # 3) 尝试从分量组装向量
    print("尝试从分量组装向量...")
    # 检查点数据
    if hasattr(mesh, 'point_data') and mesh.point_data:
        component_patterns = [
            # 标准分量
            ('Ux', 'Uy', 'Uz'),
            ('U_x', 'U_y', 'U_z'),
            ('Vx', 'Vy', 'Vz'),
            ('V_x', 'V_y', 'V_z'),
            ('speed_x', 'speed_y', 'speed_z'),
            ('velocity_x', 'velocity_y', 'velocity_z'),
            # OpenFOAM格式
            ('U_0', 'U_1', 'U_2'),
            ('U:0', 'U:1', 'U:2'),
            ('V_0', 'V_1', 'V_2'),
            ('V:0', 'V:1', 'V:2'),
            # ParaView格式
            ('U_X', 'U_Y', 'U_Z'),
            ('V_X', 'V_Y', 'V_Z')
        ]
        
        for components in component_patterns:
            cx, cy, cz = components
            if cx in mesh.point_data and cy in mesh.point_data and cz in mesh.point_data:
                try:
                    print(f"尝试组合点数据分量: {cx}, {cy}, {cz}")
                    x_comp = mesh.point_data[cx]
                    y_comp = mesh.point_data[cy]
                    z_comp = mesh.point_data[cz]
                    
                    # 检查形状兼容性
                    print(f"分量形状: {cx}={getattr(x_comp, 'shape', 'unknown')}, "
                          f"{cy}={getattr(y_comp, 'shape', 'unknown')}, "
                          f"{cz}={getattr(z_comp, 'shape', 'unknown')}")
                    
                    # 创建向量字段
                    vec = np.column_stack([x_comp, y_comp, z_comp])
                    print(f"成功组合向量字段, 形状: {vec.shape}")
                    mesh.point_data['U_tmp'] = vec
                    print(f"创建临时字段 'U_tmp', 从 {cx}, {cy}, {cz} 组合而来")
                    return 'U_tmp', 'point', mesh
                except Exception as e:
                    print(f"组合分量 {cx}, {cy}, {cz} 时出错: {e}")
    
    # 检查单元数据 - 组装分量后也使用单元中心点
    if hasattr(mesh, 'cell_data') and mesh.cell_data:
        component_patterns = [
            # 标准分量
            ('Ux', 'Uy', 'Uz'),
            ('U_x', 'U_y', 'U_z'),
            ('Vx', 'Vy', 'Vz'),
            ('V_x', 'V_y', 'V_z'),
            ('speed_x', 'speed_y', 'speed_z'),
            ('velocity_x', 'velocity_y', 'velocity_z'),
            # OpenFOAM格式
            ('U_0', 'U_1', 'U_2'),
            ('U:0', 'U:1', 'U:2'),
            ('V_0', 'V_1', 'V_2'),
            ('V:0', 'V:1', 'V:2'),
            # ParaView格式
            ('U_X', 'U_Y', 'U_Z'),
            ('V_X', 'V_Y', 'V_Z')
        ]
        
        for components in component_patterns:
            cx, cy, cz = components
            if cx in mesh.cell_data and cy in mesh.cell_data and cz in mesh.cell_data:
                try:
                    print(f"尝试组合单元数据分量: {cx}, {cy}, {cz}")
                    x_comp = mesh.cell_data[cx]
                    y_comp = mesh.cell_data[cy]
                    z_comp = mesh.cell_data[cz]
                    
                    # 检查形状兼容性
                    print(f"分量形状: {cx}={getattr(x_comp, 'shape', 'unknown')}, "
                          f"{cy}={getattr(y_comp, 'shape', 'unknown')}, "
                          f"{cz}={getattr(z_comp, 'shape', 'unknown')}")
                    
                    # 创建向量字段
                    vec = np.column_stack([x_comp, y_comp, z_comp])
                    print(f"成功组合向量字段, 形状: {vec.shape}")
                    
                    # 使用单元中心点
                    cell_centers = mesh.cell_centers()
                    cell_centers.point_data['U_tmp'] = vec
                    print(f"创建了包含 {cell_centers.n_points} 个点的单元中心点数据集")
                    return 'U_tmp', 'point', cell_centers
                except Exception as e:
                    print(f"组合单元数据分量 {cx}, {cy}, {cz} 时出错: {e}")
    
    # 4) 作为最后尝试，检查任何可能的向量字段
    print("搜索任何可能的向量字段...")
    # 检查点数据
    if hasattr(mesh, 'point_data') and mesh.point_data:
        for name in mesh.point_data.keys():
            try:
                arr = mesh.point_data[name]
                if hasattr(arr, 'shape'):
                    print(f"检查点数据字段 {name}, 形状: {arr.shape}")
                    if arr.ndim == 2 and arr.shape[1] == 3:
                        print(f"找到3分量向量字段: {name}")
                        return name, 'point', mesh
            except Exception as e:
                print(f"检查点数据字段 {name} 时出错: {e}")
    
    # 检查单元数据
    if hasattr(mesh, 'cell_data') and mesh.cell_data:
        for name in mesh.cell_data.keys():
            try:
                arr = mesh.cell_data[name]
                if hasattr(arr, 'shape'):
                    print(f"检查单元数据字段 {name}, 形状: {arr.shape}")
                    if arr.ndim == 2 and arr.shape[1] == 3:
                        print(f"找到单元数据中的3分量向量字段: {name}")
                        
                        # 使用单元中心点
                        cell_centers = mesh.cell_centers()
                        cell_centers.point_data[name] = arr
                        print(f"创建了包含 {cell_centers.n_points} 个点的单元中心点数据集")
                        return name, 'point', cell_centers
            except Exception as e:
                print(f"检查单元数据字段 {name} 时出错: {e}")
    
    raise RuntimeError('未找到3分量向量 (U/Velocity)，也无法从分量组装。请检查VTK文件中的数据字段。')

# ------------------------------------------------------------------
def is_planar_dataset(mesh, tolerance=1e-5):
    """检查数据集是否为平面数据（所有点在同一平面上）"""
    # 获取边界盒
    bounds = mesh.bounds
    x_range = bounds[1] - bounds[0]
    y_range = bounds[3] - bounds[2]
    z_range = bounds[5] - bounds[4]
    
    # 检查是否某个维度的范围非常小
    min_range = min(x_range, y_range, z_range)
    max_range = max(x_range, y_range, z_range)
    
    # 如果最小范围与最大范围的比值很小，认为是平面数据
    if min_range / max_range < tolerance:
        flat_dim = 0 if x_range == min_range else (1 if y_range == min_range else 2)
        return True, flat_dim
    
    return False, -1

# ------------------------------------------------------------------
def create_2d_vector_display(mesh, vec_name, scale_factor=0.1, density=0.05):
    """
    为2D平面数据创建向量箭头显示，确保返回PolyData类型
    
    参数:
    mesh - 包含向量数据的网格
    vec_name - 向量场名称
    scale_factor - 箭头长度缩放因子
    density - 箭头密度（点的比例，0-1）
    
    返回:
    arrows - 包含箭头的PolyData
    """
    import random
    
    # 如果不是平面中心点数据，可能需要进行处理
    if not (isinstance(mesh, pv.PolyData) and mesh.n_points == mesh.n_cells):
        raise ValueError("只支持单元中心点数据集")
    
    # 获取向量场
    vectors = mesh.point_data[vec_name]
    points = mesh.points
    
    # 确定向量场的主要方向（去除垂直分量）
    is_planar, flat_dim = is_planar_dataset(mesh)
    print(f"数据集是否平面: {is_planar}, 平面法线方向: {'xyz'[flat_dim] if flat_dim >= 0 else 'none'}")
    
    # 随机选择部分点用于显示向量
    n_samples = max(20, int(mesh.n_points * density))
    random.seed(42)  # 确保可重复性
    selected_indices = random.sample(range(mesh.n_points), n_samples)
    
    # 计算平均向量长度以用于缩放
    if is_planar and flat_dim >= 0:
        # 对于平面数据，计算平面内的向量分量
        planar_vectors = []
        for i in range(mesh.n_points):
            v = vectors[i].copy()
            # 将法线方向分量设为零（保留平面内的分量）
            v[flat_dim] = 0
            planar_vectors.append(v)
        planar_vectors = np.array(planar_vectors)
        avg_vec_length = np.mean(np.sqrt(np.sum(planar_vectors**2, axis=1)))
    else:
        # 对于一般数据，使用完整向量长度
        avg_vec_length = np.mean(np.sqrt(np.sum(vectors**2, axis=1)))
    
    # 计算箭头长度
    bounds = mesh.bounds
    max_dim = max(bounds[1]-bounds[0], bounds[3]-bounds[2], bounds[5]-bounds[4])
    arrow_scale = max_dim * scale_factor / max(avg_vec_length, 1e-6)
    
    # 创建线段而不是箭头对象 - 确保最终是PolyData类型
    lines = []
    for idx in selected_indices:
        start_point = points[idx]
        vec = vectors[idx] * arrow_scale
        
        # 如果是平面数据，确保向量在平面内
        if is_planar and flat_dim >= 0:
            vec[flat_dim] = 0
        
        # 只创建有意义的线段（长度不为零）
        if np.linalg.norm(vec) > 1e-6:
            end_point = start_point + vec
            line = np.array([start_point, end_point])
            lines.append(line)
    
    # 创建线段数据集（确保是PolyData）
    if lines:
        line_poly = pv.PolyData()
        line_poly.points = np.vstack(lines)
        
        # 创建线段连接信息
        cells = []
        for i in range(len(lines)):
            cells.append([2, i*2, i*2+1])  # 每条线有2个点
            
        line_poly.lines = np.hstack(cells)
        
        # 添加向量场数据
        line_data = np.zeros((len(lines)*2, 3))
        for i, idx in enumerate(selected_indices):
            if i < len(lines):
                line_data[i*2] = vectors[idx]
                line_data[i*2+1] = vectors[idx]
        
        line_poly.point_data[vec_name] = line_data
        
        return line_poly
    else:
        # 如果没有线段，返回空的PolyData
        return pv.PolyData()

# ------------------------------------------------------------------
def gen_stream(in_file: pathlib.Path, out_dir: pathlib.Path):
    print('Reading', in_file)
    try:
        mesh = pv.read(in_file)
        print(f"成功读取文件: {in_file}")
    except Exception as e:
        print(f"读取文件 {in_file} 时出错: {e}")
        raise
    
    # 检查是否为平面数据
    is_planar, flat_dim = is_planar_dataset(mesh)
    if is_planar:
        print(f"检测到平面数据，平面法线方向: {'xyz'[flat_dim]}")
    
    try:
        vec_name, location, mesh = find_or_build_vector(mesh)
        print(f"找到向量字段: {vec_name}, 位置: {location}")
    except Exception as e:
        print(f"查找向量字段时出错: {e}")
        raise

    # 平面数据特殊处理：创建向量场可视化而不是流线
    if is_planar and isinstance(mesh, pv.PolyData) and mesh.n_points == mesh.n_cells:
        try:
            print("检测到2D平面数据，创建向量场可视化...")
            stream = create_2d_vector_display(mesh, vec_name, scale_factor=0.15, density=0.01)
            if stream.n_cells > 0:
                print(f"成功创建向量场显示，包含 {stream.n_cells} 个向量线段")
                out_path = out_dir / f'{in_file.stem}_stream.vtp'
                stream.save(out_path)
                print(f'✓ {out_path}  ({stream.n_cells} 向量线段)')
                return
            else:
                print("向量场显示为空，尝试流线方法")
        except Exception as e:
            print(f"创建向量场可视化时出错: {e}，尝试流线方法")
    
    # 随机种子 # ---------------- 生成随机种子 ----------------
    try:
        # 计算用于缩放的最大尺寸
        bounds = mesh.bounds
        max_dim = max(bounds[1]-bounds[0], bounds[3]-bounds[2], bounds[5]-bounds[4])
        max_dim = max(max_dim, 1e-6)
        
        # 平面数据特殊处理种子点
        if is_planar:
            print(f"为平面数据生成特殊种子点，平面法线方向: {'xyz'[flat_dim]}")
            # 在平面内均匀分布种子点
            n_seeds = 400
            
            # 确定平面所在的维度
            if flat_dim == 0:  # YZ平面
                plane_dims = [1, 2]
            elif flat_dim == 1:  # XZ平面
                plane_dims = [0, 2]
            else:  # XY平面
                plane_dims = [0, 1]
            
            # 在平面上创建网格种子点
            grid_size = int(np.sqrt(n_seeds))
            seed_points = []
            
            # 计算平面的边界
            min_vals = [bounds[i*2] for i in range(3)]
            max_vals = [bounds[i*2+1] for i in range(3)]
            
            # 在平面上均匀分布点
            for i in range(grid_size):
                for j in range(grid_size):
                    point = [0, 0, 0]
                    point[flat_dim] = mesh.center[flat_dim]  # 平面的固定坐标
                    
                    # 设置平面内的两个坐标
                    point[plane_dims[0]] = min_vals[plane_dims[0]] + (max_vals[plane_dims[0]] - min_vals[plane_dims[0]]) * (i / (grid_size-1))
                    point[plane_dims[1]] = min_vals[plane_dims[1]] + (max_vals[plane_dims[1]] - min_vals[plane_dims[1]]) * (j / (grid_size-1))
                    
                    seed_points.append(point)
            
            seeds = pv.PolyData(np.array(seed_points))
            print(f"为平面数据生成网格种子点: {seeds.n_points}个点")
            
        elif location == 'point' and isinstance(mesh, pv.PolyData) and mesh.n_points == mesh.n_cells:
            print("使用单元中心点的子集作为种子点...")
            # 随机选择一部分单元中心作为种子点
            n_seeds = min(200, mesh.n_points)
            np.random.seed(42)  # 设置固定种子以获得可重复结果
            indices = np.random.choice(mesh.n_points, n_seeds, replace=False)
            seed_points = mesh.points[indices]
            seeds = pv.PolyData(seed_points)
            print(f"生成种子点: {seeds.n_points}个点 (随机选择单元中心的子集)")
        else:
            # 生成随机点
            n_seeds = 200
            np.random.seed(42)  # 设置固定种子以获得可重复结果
            seed_points = np.random.normal(0, .35, (n_seeds, 3)) * max_dim + mesh.center
            seeds = pv.PolyData(seed_points)
            print(f"生成随机种子点: {seeds.n_points}个点, 中心: {mesh.center}, 尺度: {max_dim}")
    except Exception as e:
        print(f"生成随机种子时出错: {e}")
        raise

    # ---------------- 计算流线 --------------------
    try:
        print(f"开始计算流线, 使用向量字段: {vec_name}")
        
        # 流线参数 - 对平面数据使用更小的步长
        if is_planar:
            initial_step_length = max_dim * 0.001  # 更小的步长
            max_steps = 5000                       # 更多步数
            max_time = 500                         # 更长时间
            print("使用平面数据特殊参数")
        else:
            initial_step_length = max_dim * 0.002
            max_steps = 2000
            max_time = 200
        
        print(f"流线参数：起始步长={initial_step_length}, 最大步数={max_steps}, 最大时间={max_time}")
        
        stream = None
        
        # 使用多种方法尝试生成流线
        try:
            # 为平面数据创建特殊的向量显示
            if is_planar:
                print("创建平面数据的向量场可视化...")
                try:
                    # 创建简单的向量线段表示
                    vectors = mesh.point_data[vec_name]
                    points = mesh.points
                    
                    # 计算适当的线段长度
                    avg_vec_length = np.mean(np.sqrt(np.sum(vectors**2, axis=1)))
                    scale_factor = max_dim * 0.1 / max(avg_vec_length, 1e-6)
                    
                    # 创建线段列表 - 确保结果是PolyData
                    line_poly = pv.PolyData()
                    line_points = []
                    line_cells = []
                    
                    step = 10  # 每10个点取一个
                    count = 0
                    
                    for i in range(0, mesh.n_points, step):
                        p1 = points[i]
                        v = vectors[i] * scale_factor
                        # 对于平面数据，将垂直分量设为0
                        if flat_dim >= 0:
                            v[flat_dim] = 0
                        p2 = p1 + v
                        
                        line_points.extend([p1, p2])
                        line_cells.append(2)  # 每条线有2个点
                        line_cells.append(count)
                        line_cells.append(count + 1)
                        count += 2
                    
                    if line_points:
                        line_poly.points = np.array(line_points)
                        line_poly.lines = np.array(line_cells)
                        stream = line_poly
                        print(f"创建了具有 {stream.n_cells} 条线的向量显示")
                except Exception as e:
                    print(f"创建向量场可视化失败: {e}")
            
            # 常规流线方法
            if stream is None:
                try:
                    # 尝试 PyVista 0.44+ 版本的 streamlines 方法
                    stream = mesh.streamlines(
                        vectors=vec_name,                # 向量字段名
                        source_center=mesh.center,       # 种子中心
                        source_radius=max_dim * 0.7,     # 种子半径
                        n_points=seeds.n_points,         # 种子点数量
                        integrator_type=45,              # Runge-Kutta 4
                        initial_step_length=initial_step_length,
                        max_steps=max_steps,
                        max_time=max_time,
                        integration_direction='both'     # 前向和后向
                    )
                    print("使用 streamlines 方法成功生成流线")
                except Exception as e1:
                    print(f"首次尝试生成流线失败，尝试替代方法: {e1}")
                    
                    try:
                        # 尝试使用 streamlines_from_source，但调整参数顺序和命名
                        stream = mesh.streamlines_from_source(
                            seeds,                        # 种子
                            integration_direction='both', # 积分方向
                            integrator_type=45,           # Runge-Kutta 4 (45)
                            initial_step_length=initial_step_length,
                            max_steps=max_steps,
                            vectors=vec_name,             # 向量字段名
                            max_time=max_time
                        )
                        print("使用 streamlines_from_source 方法成功生成流线")
                    except Exception as e2:
                        print(f"第二次尝试生成流线失败: {e2}")
        except Exception as e:
            print(f"所有流线生成方法都失败: {e}")
        
        # 检查流线结果
        if stream is None or stream.n_cells == 0:
            print("流线为空，创建向量箭头显示作为替代...")
            stream = create_2d_vector_display(mesh, vec_name, scale_factor=0.15, density=0.01)
            print(f"创建了向量箭头显示，包含 {stream.n_cells} 个向量线段")
        else:
            print(f"流线计算完成: {stream.n_points}个点, {stream.n_cells}条线")
    except Exception as e:
        print(f"计算流线时出错: {e}")
        # 打印详细异常信息
        import traceback
        traceback.print_exc()
        raise

    try:
        # 检查数据类型，选择正确的文件扩展名
        data_type = type(stream).__name__
        print(f"输出数据类型: {data_type}")
        
        if isinstance(stream, pv.PolyData):
            # PolyData可以保存为.vtp
            out_path = out_dir / f'{in_file.stem}_stream.vtp'
            stream.save(out_path)
            print(f'✓ {out_path}  ({stream.n_cells} 线/箭头)')
        else:
            # 其他类型保存为.vtu
            out_path = out_dir / f'{in_file.stem}_stream.vtu'
            stream.save(out_path)
            print(f'✓ {out_path}  ({stream.n_cells} 线/箭头)')
            
            # 如果需要.vtp文件，尝试转换为PolyData
            try:
                poly_stream = stream.extract_geometry()
                poly_path = out_dir / f'{in_file.stem}_stream.vtp'
                poly_stream.save(poly_path)
                print(f'✓ 也保存为PolyData: {poly_path}')
            except Exception as e:
                print(f"无法转换为PolyData: {e}")
            
    except Exception as e:
        print(f"保存流线文件时出错: {e}")
        raise

# ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-i', '--input', default='.',
                    help='VTP/VTU 文件或包含它们的目录')
    ap.add_argument('-o', '--outdir', help='输出目录 (默认=输入同级)')
    ap.add_argument('-v', '--verbose', action='store_true', help='输出详细信息')
    args = ap.parse_args()

    # 显示环境信息
    print(f"Python 版本: {sys.version}")
    print(f"NumPy 版本: {np.__version__}")
    print(f"PyVista 版本: {pv.__version__}")

    in_path = pathlib.Path(args.input).expanduser().resolve()
    out_dir = pathlib.Path(args.outdir).expanduser().resolve() if args.outdir else in_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"输入路径: {in_path}")
    print(f"输出目录: {out_dir}")

    # 收集待处理文件
    if in_path.is_dir():
        files = sorted(in_path.glob('*.vt?'))  # *.vtp, *.vtu
    else:
        files = [in_path]

    if not files:
        sys.exit('✗ 未找到任何 *.vtp / *.vtu 文件')

    print(f"找到 {len(files)} 个文件待处理:")
    for f in files:
        print(f"  - {f}")

    for f in files:
        try:
            print(f"\n处理文件: {f}")
            gen_stream(f, out_dir)
        except Exception as e:
            print(f'✗ {f}: {e}', file=sys.stderr)

if __name__ == '__main__':
    main()