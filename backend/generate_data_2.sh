# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-26 20:09:02
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-26 20:11:27
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_cases\generate_data_2.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash
# 大气边界层数据后处理脚本

BASE_DIR="/home/joe/wind_project/WindSimProj/backend"
BATCH_DIR="/home/joe/wind_project/WindSimProj/backend/batch_cases_2"
UTILS_DIR="${BASE_DIR}/utils"
POST_DIR="${BASE_DIR}/atmospheric_post_processing"
DATA_DIR="${POST_DIR}/data"
ANALYSIS_DIR="${POST_DIR}/analysis"

# 添加这一行 - Python脚本期望数据在../uploads/目录下
UPLOADS_DIR="${BASE_DIR}/uploads"

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    大气边界层数据后处理脚本                                 ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"
echo "║ 批量计算目录：${BATCH_DIR}"
echo "║ 后处理输出目录：${POST_DIR}"
echo "║ 临时数据目录：${UPLOADS_DIR}"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"

# 创建后处理目录和临时目录
mkdir -p "${POST_DIR}" "${DATA_DIR}" "${ANALYSIS_DIR}" "${UPLOADS_DIR}"

# 检查脚本
PRECOMPUTE_SCRIPT="${UTILS_DIR}/precompute_atmospheric_data.py"
RADAR_SCRIPT="${UTILS_DIR}/visualize_atmospheric_radar.py"
ANALYSIS_SCRIPT="${UTILS_DIR}/plot_atmospheric_profiles.py"

for script in "$PRECOMPUTE_SCRIPT" "$RADAR_SCRIPT" "$ANALYSIS_SCRIPT"; do
    if [ ! -f "$script" ]; then
        echo "❌ 错误：脚本不存在 - $script"
        exit 1
    else
        echo "✅ $script"
    fi
done

echo ""
echo "📂 第一步：整理计算结果并提取大气数据..."

declare -a successful_cases=()
case_counter=1

for case_dir in "${BATCH_DIR}"/*/; do
    if [ -d "$case_dir" ]; then
        case_name=$(basename "$case_dir")
        
        if [ -f "${case_dir}/speed.bin" ] && [ -f "${case_dir}/output.json" ] && [ -f "${case_dir}/info.json" ]; then
            successful_cases+=("$case_dir")
            
            numbered_dir="${DATA_DIR}/${case_counter}"
            mkdir -p "$numbered_dir"
            
            cp "${case_dir}/info.json" "${numbered_dir}/"
            cp "${case_dir}/output.json" "${numbered_dir}/"
            cp "${case_dir}/speed.bin" "${numbered_dir}/"
            
            # 复制PLT数据（如果存在）
            if [ -d "${case_dir}/Output/plt" ]; then
                cp -r "${case_dir}/Output/plt" "${numbered_dir}/"
            elif [ -d "${case_dir}/run/Output/plt" ]; then
                cp -r "${case_dir}/run/Output/plt" "${numbered_dir}/"
            fi
            
            echo "${case_counter}:${case_name}" >> "${DATA_DIR}/case_mapping.txt"
            echo "   ✅ 工况 ${case_name} -> ${case_counter}"
            ((case_counter++))
        else
            echo "   ⚠️  工况 ${case_name} 结果文件不完整，跳过"
        fi
    fi
done

total_successful=$((case_counter - 1))
echo "📊 成功工况统计：${total_successful} 个"

if [ $total_successful -eq 0 ]; then
    echo "❌ 没有找到成功完成的工况"
    exit 1
fi

echo ""
echo "🔄 第二步：运行大气数据预处理..."

for i in $(seq 1 $total_successful); do
    echo "--- 处理工况 ID: ${i} ---"
    numbered_dir="${DATA_DIR}/${i}"
    uploads_case_dir="${UPLOADS_DIR}/${i}"
    
    # 检查源数据
    echo "   📂 检查源数据完整性..."
    if [ ! -f "${numbered_dir}/output.json" ]; then
        echo "   ❌ ${numbered_dir}/output.json 不存在"
        continue
    fi
    if [ ! -f "${numbered_dir}/info.json" ]; then
        echo "   ❌ ${numbered_dir}/info.json 不存在"
        continue
    fi
    if [ ! -f "${numbered_dir}/speed.bin" ]; then
        echo "   ❌ ${numbered_dir}/speed.bin 不存在"
        continue
    fi
    echo "   ✅ 源数据文件完整"
    
    # 检查PLT目录
    if [ -d "${numbered_dir}/plt" ]; then
        echo "   ✅ PLT目录存在: ${numbered_dir}/plt"
        plt_file_count=$(find "${numbered_dir}/plt" -type f | wc -l)
        echo "   📄 PLT文件数量: ${plt_file_count}"
    elif [ -d "${numbered_dir}/Output/plt" ]; then
        echo "   ✅ PLT目录存在: ${numbered_dir}/Output/plt"
        plt_file_count=$(find "${numbered_dir}/Output/plt" -type f | wc -l)
        echo "   📄 PLT文件数量: ${plt_file_count}"
    else
        echo "   ⚠️  未找到PLT目录"
    fi
    
    # 准备临时目录
    rm -rf "$uploads_case_dir"
    mkdir -p "$uploads_case_dir"
    
    # 修复：使用递归复制
    cp -r "${numbered_dir}"/* "${uploads_case_dir}/"  # ✅ 递归复制，包括目录
    echo "   📋 数据已递归复制到: ${uploads_case_dir}"
    
    # 验证PLT数据是否复制成功
    if [ -d "${uploads_case_dir}/plt" ]; then
        echo "   ✅ PLT数据复制成功: ${uploads_case_dir}/plt"
    elif [ -d "${uploads_case_dir}/Output/plt" ]; then
        echo "   ✅ PLT数据复制成功: ${uploads_case_dir}/Output/plt"
    else
        echo "   ⚠️  PLT数据未复制或不存在"
    fi
    
    # 运行预处理
    cd "${UTILS_DIR}"
    echo "   🔄 运行大气数据预处理..."
    if python3 precompute_atmospheric_data.py --caseId "${i}" --verbose 2>&1 | tee "${numbered_dir}/preprocess.log"; then
        echo "   ✅ 大气数据预处理完成 for case ID ${i}"
        
        # 检查缓存目录是否生成
        cache_dir="${uploads_case_dir}/atmospheric_cache"
        if [ -d "${cache_dir}" ] && [ "$(ls -A $cache_dir)" ]; then
            echo "   ✅ atmospheric_cache 生成成功，包含 $(ls $cache_dir | wc -l) 个文件"
            cp -r "${cache_dir}" "${numbered_dir}/"
            
            # 查找并复制汇总数据文件
            if [ -f "${cache_dir}/measurement_summary.json" ]; then
                case_info=$(sed -n "${i}p" "${DATA_DIR}/case_mapping.txt" | cut -d':' -f2)
                cp "${cache_dir}/measurement_summary.json" "${ANALYSIS_DIR}/summary_${case_info}.json"
                echo "   📋 汇总数据已复制: summary_${case_info}.json"
            else
                echo "   ⚠️  measurement_summary.json 未生成"
            fi
        else
            echo "   ❌ atmospheric_cache 为空或未生成"
            echo "   📝 检查日志: ${numbered_dir}/preprocess.log"
        fi
    else
        echo "   ❌ 大气数据预处理失败 for case ID ${i}"
        echo "   📝 错误日志保存在: ${numbered_dir}/preprocess.log"
    fi
    
    # 清理临时目录
    rm -rf "$uploads_case_dir"
done

echo ""
echo "🎯 第三步：生成大气雷达可视化..."

cd "${UTILS_DIR}"
if python3 visualize_atmospheric_radar.py "${DATA_DIR}" --height 100.0 --max_range 1200.0 --dpi 300; then
    echo "✅ 大气雷达可视化完成"
    if [ -d "${DATA_DIR}/atmospheric_radar_pics" ]; then
        mv "${DATA_DIR}/atmospheric_radar_pics" "${POST_DIR}/"
        echo "✅ 雷达图片已移动到 ${POST_DIR}/atmospheric_radar_pics"
    fi
else
    echo "❌ 大气雷达可视化失败"
fi

echo ""
echo "📈 第四步：生成大气剖面分析..."

if [ -z "$(ls -A ${ANALYSIS_DIR}/*.json 2>/dev/null)" ]; then
    echo "⚠️  ${ANALYSIS_DIR} 中没有找到分析数据文件，跳过剖面分析"
else
    cd "${ANALYSIS_DIR}"
    if python3 "${ANALYSIS_SCRIPT}"; then
        echo "✅ 大气剖面分析完成"
        if [ -d "${ANALYSIS_DIR}/atmospheric_profiles" ]; then
            mv "${ANALYSIS_DIR}/atmospheric_profiles" "${POST_DIR}/"
            echo "✅ 剖面分析图片已移动到 ${POST_DIR}/atmospheric_profiles"
        fi
    else
        echo "❌ 大气剖面分析失败"
    fi
fi

# 生成后处理报告
echo ""
echo "📋 生成后处理报告..."

cat > "${POST_DIR}/atmospheric_analysis_report.txt" << EOF
=== 大气边界层数据分析报告 ===
处理时间：$(date)
成功处理的工况数：${total_successful}

分析配置：
- 测量距离：3D, 5D, 8D (D = 87m)
- 缩尺比：1000:1
- 雷达位置：原风机位置 (ID ending with 17)

目录结构：
├── data/                          # 整理后的原始计算结果
├── analysis/                      # 大气剖面分析数据
├── atmospheric_radar_pics/        # 雷达扫描可视化图片
├── atmospheric_profiles/          # 大气剖面分析图片
└── atmospheric_analysis_report.txt # 本报告

工况映射：
EOF

if [ -f "${DATA_DIR}/case_mapping.txt" ]; then
    cat "${DATA_DIR}/case_mapping.txt" >> "${POST_DIR}/atmospheric_analysis_report.txt"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "🎉 大气边界层数据后处理完成！"
echo ""
echo "📁 结果目录：${POST_DIR}"
echo "📄 详细报告：${POST_DIR}/atmospheric_analysis_report.txt"
echo "═══════════════════════════════════════════════════════════════════════════"

# 显示统计信息
if [ -d "${POST_DIR}/atmospheric_radar_pics" ]; then
    radar_pics=$(find "${POST_DIR}/atmospheric_radar_pics" -name "*.png" -type f 2>/dev/null | wc -l)
    echo "🖼️  雷达扫描图片数量：${radar_pics}"
fi

if [ -d "${POST_DIR}/atmospheric_profiles" ]; then
    profile_pics=$(find "${POST_DIR}/atmospheric_profiles" -name "*.png" -type f 2>/dev/null | wc -l)
    echo "📊 大气剖面图片数量：${profile_pics}"
fi

analysis_files=$(find "${POST_DIR}/analysis" -name "*.json" -type f 2>/dev/null | wc -l)
echo "📝 分析数据文件数量：${analysis_files}"

echo ""
echo "✨ 大气边界层数据分析脚本执行完毕！"