/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-15 18:06:27
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\backend\src\utils\tasks.js  <-- 注意路径是 backend
 * @Description: 定义后端计算各阶段任务 (CommonJS 导出)
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
const knownTasks = [
    { id: 'computation_start', name: '计算启动' },
    { id: 'clean_files', name: '清理文件' },
    { id: 'rebuild_directories', name: '重建目录' },
    { id: 'copy_files', name: '复制文件' },
    { id: 'change_directory', name: '进入运行目录' },
    { id: 'modeling', name: '模型构建' },
    { id: 'build_terrain', name: '地形构建' },
    { id: 'make_input', name: '生成输入文件' },
    { id: 'gambit_to_foam', name: 'Gambit到Foam转换' },
    { id: 'modify_boundaries', name: '修改边界' },
    { id: 'decompose_parallel', name: '并行分解' },
    { id: 'run_admfoam', name: '运行计算' },
    { id: 'post_process', name: '后处理' },
    { id: 'execute_post_script', name: '执行后处理脚本' },
    { id: 'computation_end', name: '计算完成' },
  ];
  
  module.exports = { knownTasks }; // 使用 module.exports 导出