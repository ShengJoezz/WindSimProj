# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-24 23:14:37
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-24 23:23:31
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_cases\generate_data.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-24 19:08:43
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-24 19:08:43
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\batch_cases\generate_data.sh
# # @Description:
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash
# 批量计算后处理脚本

set -e  # 遇到错误时退出

# 设置路径 (请确保这些路径对您的环境是正确的)
BASE_DIR="/home/joe/wind_project/WindSimProj/backend"
BATCH_DIR="/home/joe/wind_project/WindSimProj/backend/batch_cases"
UTILS_DIR="${BASE_DIR}/utils"
UPLOADS_DIR="${BASE_DIR}/uploads"

# 后处理目录
POST_DIR="${BASE_DIR}/post_processing"
DATA_DIR="${POST_DIR}/data"
DATA_WAKE_DIR="${POST_DIR}/data_wake" # 用于存放筛选后的 *11.json 文件

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                        批量计算后处理脚本                                  ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"
echo "║ 批量计算目录：${BATCH_DIR}"
echo "║ 后处理输出目录：${POST_DIR}"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"

# 创建后处理目录
echo ""
echo "🏗️  创建后处理目录结构..."
mkdir -p "${POST_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${DATA_WAKE_DIR}" # 确保此目录存在

# 检查必要的脚本
echo ""
echo "🔍 检查后处理脚本..."
PRECOMPUTE_SCRIPT="${UTILS_DIR}/precompute_visualization.py"
LIDAR_SCRIPT="${UTILS_DIR}/visualize_lidar_wake_view.py"
WAKE_SCRIPT="${UTILS_DIR}/plot_wake_comparison.py"

for script in "$PRECOMPUTE_SCRIPT" "$LIDAR_SCRIPT" "$WAKE_SCRIPT"; do
    if [ ! -f "$script" ]; then
        echo "❌ 错误：脚本不存在 - $script"
        exit 1
    else
        echo "✅ $script"
    fi
done

# 第一步：整理计算结果到data文件夹
echo ""
echo "📂 第一步：整理计算结果到data文件夹..."

declare -a successful_cases=()
case_counter=1

echo "   扫描成功完成的工况..."
for case_dir in "${BATCH_DIR}"/*/; do
    if [ -d "$case_dir" ]; then
        case_name=$(basename "$case_dir")

        # 检查关键结果文件是否存在
        if [ -f "${case_dir}/speed.bin" ] && \
           [ -f "${case_dir}/output.json" ] && \
           [ -f "${case_dir}/info.json" ]; then

            successful_cases+=("$case_dir") # 存储原始路径，如果后续需要

            # 创建以数字命名的目录
            numbered_dir="${DATA_DIR}/${case_counter}"
            mkdir -p "$numbered_dir"

            # 复制必要文件
            cp "${case_dir}/info.json" "${numbered_dir}/"
            cp "${case_dir}/output.json" "${numbered_dir}/"
            cp "${case_dir}/speed.bin" "${numbered_dir}/"

            # 创建映射文件记录原始工况名
            # 如果文件不存在则创建，否则追加
            if [ ! -f "${DATA_DIR}/case_mapping.txt" ] && [ $case_counter -eq 1 ]; then
                echo "# 工况ID : 原始工况名" > "${DATA_DIR}/case_mapping.txt"
            fi
            echo "${case_counter}:${case_name}" >> "${DATA_DIR}/case_mapping.txt"

            echo "   ✅ 工况 ${case_name} -> ${case_counter} (结果已整理到 ${numbered_dir})"
            ((case_counter++))
        else
            echo "   ⚠️  工况 ${case_name} 结果文件不完整，跳过"
        fi
    fi
done

total_successful=$((case_counter - 1))
echo ""
echo "📊 成功工况统计：${total_successful} 个"

if [ $total_successful -eq 0 ]; then
    echo "❌ 没有找到成功完成的工况，后处理终止"
    exit 1
fi

# 第二步：运行预计算生成wake数据
echo ""
echo "🔄 第二步：运行预计算生成wake数据..."

for i in $(seq 1 $total_successful); do
    echo ""
    echo "--- 处理工况 ID: ${i} ---"
    numbered_dir="${DATA_DIR}/${i}"       # 这是第一步整理好的数据所在目录
    uploads_case_dir="${UPLOADS_DIR}/${i}" # precompute_visualization.py 将操作此目录

    echo "   准备预计算输入 for case ID ${i}..."
    # 在uploads下创建临时目录 (如果已存在则清空重建，确保干净环境)
    rm -rf "$uploads_case_dir"
    mkdir -p "$uploads_case_dir"
    echo "   复制数据从 ${numbered_dir} 到 ${uploads_case_dir}"
    cp "${numbered_dir}"/* "${uploads_case_dir}/"

    # 运行预计算脚本
    echo "   执行预计算脚本: python3 precompute_visualization.py --caseId \"${i}\""
    cd "${UTILS_DIR}"
    if python3 precompute_visualization.py --caseId "${i}"; then
        echo "     ✅ 预计算完成 for case ID ${i}"

        wake_cache_dir="${uploads_case_dir}/visualization_cache"
        wakes_subdir="${wake_cache_dir}/wakes" # 定义wakes子目录

        if [ -d "${wakes_subdir}" ]; then
            echo "     ⭐ [工况 ID ${i}] 成功找到wakes目录: ${wakes_subdir}"
            echo "     🔍 列出其所有内容 (用于调试):"
            ls -Alh "${wakes_subdir}/" # 列出wakes目录的全部内容
            echo "     ----------------------------------------------------"
            echo "     ℹ️  开始查找并复制以 '11.json' 结尾的文件..."

            found_specific_wake_files=false
            for wake_file in "${wakes_subdir}"/*11.json; do # 从wakes子目录中筛选
                if [ -f "$wake_file" ]; then # 确保匹配到的确实是文件
                    found_specific_wake_files=true
                    base_name=$(basename "$wake_file" .json)
                    new_name="${base_name}_case${i}.json" # 添加工况标识
                    echo "       ✅ 正在复制: ${wake_file}  到  ${DATA_WAKE_DIR}/${new_name}"
                    cp "$wake_file" "${DATA_WAKE_DIR}/${new_name}"
                else
                    # 这个else分支通常在glob模式没有匹配到任何文件时会被触发一次（wake_file会是模式本身）
                    if [[ "$wake_file" == "${wakes_subdir}/*11.json" ]]; then
                        # 这种情况是glob没有匹配到任何文件
                        echo "       ⚠️  模式 '${wakes_subdir}/*11.json' 未匹配到任何文件。"
                        # 在这种情况下，for循环只会迭代一次，所以可以不break，让found_specific_wake_files保持false
                    else
                        # 这种情况是匹配到了，但不是一个普通文件（例如目录）
                        echo "       ⚠️  跳过非文件条目或无效匹配: ${wake_file}"
                    fi
                fi
            done

            if [ "$found_specific_wake_files" = true ]; then
                echo "     👍 至少一个以 '11.json' 结尾的Wake数据文件已复制到 ${DATA_WAKE_DIR}"
            else
                echo "     ⚠️  [工况 ID ${i}] 未找到以 '11.json' 结尾的wake数据文件可供复制"
            fi
            echo "     ----------------------------------------------------"
        else
            echo "     ⚠️  [工况 ID ${i}] 预计算后未找到wakes数据子目录: ${wakes_subdir}"
            echo "          请检查 precompute_visualization.py 的输出和行为。"
            if [ -d "${wake_cache_dir}" ]; then
                echo "          父目录 visualization_cache (${wake_cache_dir}) 存在，其内容为:"
                ls -Alh "${wake_cache_dir}/"
            else
                echo "          父目录 visualization_cache (${wake_cache_dir}) 也不存在。"
            fi
            echo "     ----------------------------------------------------"
        fi
    else
        echo "     ❌ [工况 ID ${i}] 预计算失败 (python3 precompute_visualization.py --caseId \"${i}\")"
        echo "     ----------------------------------------------------"
    fi

    # 清理uploads下的临时目录
    echo "   清理临时上传目录: ${uploads_case_dir}"
    rm -rf "$uploads_case_dir"
done

# 第三步：运行激光雷达可视化
echo ""
echo "🎯 第三步：运行激光雷达可视化..."

cd "${UTILS_DIR}" # 确保在正确的目录下
if python3 visualize_lidar_wake_view.py "${DATA_DIR}" \
    --height 75.0 \
    --lidar_turbine_id "S3F12" \
    --target_turbine_id "S2F15" \
    --az_width 40.0 \
    --max_range 1500.0 \
    --dpi 150; then
    echo "✅ 激光雷达可视化完成"

    # 移动生成的图片到后处理目录
    if [ -d "${DATA_DIR}/wake_pic" ]; then # 检查Python脚本是否在DATA_DIR下生成了wake_pic
        mkdir -p "${POST_DIR}/lidar_wake_pics" # 确保目标目录存在
        mv "${DATA_DIR}/wake_pic"/* "${POST_DIR}/lidar_wake_pics/" # 移动内容
        rm -rf "${DATA_DIR}/wake_pic" # 删除空的原目录
        echo "✅ 激光雷达图片已移动到 ${POST_DIR}/lidar_wake_pics"
    else
        echo "⚠️ 未找到激光雷达生成的图片目录 ${DATA_DIR}/wake_pic"
    fi
else
    echo "❌ 激光雷达可视化失败"
fi

# 第四步：运行尾流对比分析
echo ""
echo "📈 第四步：运行尾流对比分析..."

# 检查 DATA_WAKE_DIR 是否有内容，没有则跳过
if [ -z "$(ls -A ${DATA_WAKE_DIR}/*.json 2>/dev/null)" ]; then # 检查是否有json文件
    echo "⚠️  ${DATA_WAKE_DIR} 中没有找到 .json 文件，跳过尾流对比分析。"
else
    cd "${DATA_WAKE_DIR}" # 切换到包含 *11_caseX.json 文件的目录
    if python3 "${WAKE_SCRIPT}"; then # WAKE_SCRIPT 是 plot_wake_comparison.py
        echo "✅ 尾流对比分析完成"

        # 移动生成的图片
        if [ -d "${DATA_WAKE_DIR}/wake_pic" ]; then # 检查Python脚本是否在当前目录生成了wake_pic
            mkdir -p "${POST_DIR}/wake_comparison_pics" # 确保目标目录存在
            mv "${DATA_WAKE_DIR}/wake_pic"/* "${POST_DIR}/wake_comparison_pics/" # 移动内容
            rm -rf "${DATA_WAKE_DIR}/wake_pic" # 删除空的原目录
            echo "✅ 尾流对比图片已移动到 ${POST_DIR}/wake_comparison_pics"
        else
            echo "⚠️ 未找到尾流对比生成的图片目录 ${DATA_WAKE_DIR}/wake_pic"
        fi
    else
        echo "❌ 尾流对比分析失败"
    fi
fi


# 生成后处理报告
echo ""
echo "📋 生成后处理报告..."

cat > "${POST_DIR}/post_processing_report.txt" << EOF
=== 批量计算后处理报告 ===
处理时间：$(date)
成功整理并尝试预计算的工况数：${total_successful}

目录结构：
├── data/                    # 整理后的原始计算结果 (每个工况一个子目录)
│   ├── case_mapping.txt     # 工况名称到数字ID的映射
│   ├── 1/
│   │   ├── info.json
│   │   ├── output.json
│   │   └── speed.bin
│   └── ...
├── data_wake/               # 从预计算结果中提取的Wake数据文件 (通常是 *11_caseX.json)
│   ├── turbine_*_11_case1.json
│   └── ...
├── lidar_wake_pics/         # 激光雷达可视化图片
└── wake_comparison_pics/    # 尾流对比图片

工况映射 (ID: 原始工况名)：
EOF

if [ -f "${DATA_DIR}/case_mapping.txt" ]; then
    cat "${DATA_DIR}/case_mapping.txt" >> "${POST_DIR}/post_processing_report.txt"
else
    echo "未找到 case_mapping.txt" >> "${POST_DIR}/post_processing_report.txt"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "🎉 后处理完成！"
echo ""
echo "📁 结果目录：${POST_DIR}"
echo "📄 详细报告：${POST_DIR}/post_processing_report.txt"
echo ""
echo "生成的文件概览："
echo "  • 整理的原始数据：${DATA_DIR}"
echo "  • 提取的Wake数据 (JSON)：${DATA_WAKE_DIR}"
echo "  • 激光雷达图片：${POST_DIR}/lidar_wake_pics"
echo "  • 尾流对比图片：${POST_DIR}/wake_comparison_pics"
echo "═══════════════════════════════════════════════════════════════════════════"

# 显示统计信息
if [ -d "${POST_DIR}/lidar_wake_pics" ]; then
    lidar_pics=$(find "${POST_DIR}/lidar_wake_pics" -name "*.png" -type f 2>/dev/null | wc -l)
    echo "🖼️  激光雷达图片数量：${lidar_pics}"
fi

if [ -d "${POST_DIR}/wake_comparison_pics" ]; then
    wake_pics=$(find "${POST_DIR}/wake_comparison_pics" -name "*.png" -type f 2>/dev/null | wc -l)
    echo "📊 尾流对比图片数量：${wake_pics}"
fi

if [ -d "${DATA_WAKE_DIR}" ]; then
    wake_json_count=$(find "${DATA_WAKE_DIR}" -name "*.json" -type f 2>/dev/null | wc -l)
    echo "📝 提取的Wake JSON文件数量：${wake_json_count}"
fi

echo ""
echo "✨ 后处理脚本执行完毕！"