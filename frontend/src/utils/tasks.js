/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 18:04:57
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\utils\tasks.js
 * @Description: 定义前端计算各阶段任务
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
export const knownTasks = [
    { id: 'computation_start', name: '计算启动' },
    { id: 'clean_files', name: '清理文件' },
    { id: 'rebuild_directories', name: '重建目录' },
    { id: 'copy_files', name: '复制文件' },
    { id: 'change_directory', name: '进入运行目录' },
    { id: 'overlay_curves', name: '覆盖性能曲线' },
    { id: 'validate_curves', name: '验证性能曲线' },
    { id: 'modeling', name: '模型构建' },
    { id: 'build_terrain', name: '地形构建' },
    { id: 'make_input', name: '生成输入文件' },
    { id: 'gambit_to_foam', name: 'Gambit到Foam转换' },
    { id: 'modify_boundaries', name: '修改边界' },
    { id: 'decompose_parallel', name: '并行分解' },
    { id: 'run_roughFoam', name: '运行计算' },
    { id: 'post_process', name: '后处理' },
    { id: 'execute_post_script', name: '执行后处理脚本' },
    { id: 'process_vtk', name: 'VTK数据处理' },
    { id: 'multi_height_sampling', name: '多高度采样' },
    { id: 'multi_height_sampling_loop', name: '多高度采样（循环）' },
    { id: 'generate_web_streamlines', name: '生成Web流线' },
    { id: 'precompute_visualization', name: '可视化预计算' },
    { id: 'computation_end', name: '计算完成' },
  ];
