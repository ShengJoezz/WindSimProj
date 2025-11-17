# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-23 20:42:13
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-23 20:42:43
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\uploads\cleanup_all_calculations.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash
# 批量清理OpenFOAM计算目录的中间文件
# 使用方法: ./cleanup_all_calculations.sh

# 设置基础目录
BASE_DIR="/home/joe/wind_project/WindSimProj/backend/uploads"

echo "=== 开始批量清理计算目录中的中间文件 ==="
echo "基础目录: $BASE_DIR"

# 统计函数
calculate_size() {
    du -sh "$1" 2>/dev/null | cut -f1
}

total_saved=0

# 遍历所有数字命名的目录
for calc_dir in "$BASE_DIR"/*/; do
    # 检查是否为数字目录
    dir_name=$(basename "$calc_dir")
    if [[ "$dir_name" =~ ^[0-9]+$ ]]; then
        echo ""
        echo "处理计算目录: $dir_name"
        
        # 记录清理前大小
        before_size=$(calculate_size "$calc_dir")
        echo "清理前大小: $before_size"
        
        run_dir="$calc_dir/run"
        if [ -d "$run_dir" ]; then
            cd "$run_dir"
            
            echo "  清理中间文件..."
            
            # 1. 删除网格生成文件
            rm -f modeling.geo flat.msh output.neu bot.stl
            echo "    ✓ 删除网格文件"
            
            # 2. 删除所有平移的STL文件
            rm -f bot_translated_*.stl
            echo "    ✓ 删除平移STL文件"
            
            # 3. 删除并行处理器目录
            rm -rf processor*
            echo "    ✓ 删除并行处理器目录"
            
            # 4. 删除triSurface中的临时文件
            if [ -d "constant/triSurface" ]; then
                rm -f constant/triSurface/bot_translated_*.stl
                # 如果triSurface目录为空，删除它
                rmdir constant/triSurface 2>/dev/null
            fi
            echo "    ✓ 清理triSurface目录"
            
            # 5. 删除临时sampleDict文件
            rm -f system/sampleDict_*
            echo "    ✓ 删除临时sampleDict文件"
            
            # 6. 清理postProcessing中的临时目录，保留Data目录
            if [ -d "postProcessing" ]; then
                find postProcessing -type d -name "sampleDict_*" -exec rm -rf {} + 2>/dev/null
                echo "    ✓ 清理postProcessing临时目录"
            fi
            
            # 7. 删除中间时刻的计算结果，只保留最新时刻
            # 获取所有数字目录，按数值排序
            time_dirs=($(ls -1d [0-9]* 2>/dev/null | sort -n))
            if [ ${#time_dirs[@]} -gt 1 ]; then
                # 保留最后一个（最新时刻），删除其他
                for ((i=0; i<${#time_dirs[@]}-1; i++)); do
                    rm -rf "${time_dirs[i]}"
                done
                echo "    ✓ 删除中间时刻数据，保留最新时刻: ${time_dirs[-1]}"
            fi
            
            # 8. 删除OpenFOAM日志文件
            rm -f log.* *.log
            echo "    ✓ 删除日志文件"
            
            cd - > /dev/null
        fi
        
        
        # 记录清理后大小
        after_size=$(calculate_size "$calc_dir")
        echo "清理后大小: $after_size"
        echo "✅ 目录 $dir_name 清理完成"
        
        cd - > /dev/null
    fi
done

echo ""
echo "=== 批量清理完成 ==="
echo ""
echo "保留的重要文件："
echo "  - info.json (计算参数)"
echo "  - output.json (计算结果)"
echo "  - parameters.json (参数配置)"
echo "  - run/postProcessing/Data/ (采样数据)"
echo "  - run/VTK/processed/ (可视化文件)"
echo "  - run/最新时刻目录 (最终场数据)"
echo ""
echo "如需进一步压缩，可以考虑："
echo "  1. 压缩VTK文件: tar -czf vtk_data.tar.gz run/VTK/"
echo "  2. 只保留关键采样点数据"
echo "  3. 删除不常用的场变量文件"