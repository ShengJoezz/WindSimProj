# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-07-22 18:33:50
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-07-22 18:51:55
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\base\postprocess_only.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash

# ==============================================================================
# 脚本：postprocess_streamlines_only.sh（修正版）
# ==============================================================================

# --- 输出函数 ---
emit_progress() {
  echo "{\"action\":\"progress\",\"progress\": $1, \"taskId\":\"$2\"}"
}
emit_task_start() {
  echo "{\"action\":\"taskStart\", \"taskId\":\"$1\"}"
}

echo "=== 开始执行仅流线后处理流程 ==="

# --- Step 0: 环境检查和准备 ---
emit_task_start "setup_check"
if [ ! -d "./run" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"setup_check\", \"message\": \"错误：未找到 ./run 目录。\"}" >&2
  exit 1
fi
cd ./run

if [ ! -f "../info.json" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"setup_check\", \"message\": \"错误：找不到配置文件 ../info.json\"}" >&2
  exit 1
fi

emit_progress 100 "setup_check"
sleep 1

# --- Step 0.5: 处理VTK文件（关键步骤！）---
emit_task_start "process_vtk"
emit_progress 0 "process_vtk"
echo "=== 开始处理VTK文件 ==="

# 查找VTK输出目录
VTK_RUN_DIR=$(ls -d ./VTK/run_* 2>/dev/null | head -n 1)
if [ -z "$VTK_RUN_DIR" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"process_vtk\", \"message\": \"找不到VTK输出目录！\"}" >&2
  exit 1
fi

# 创建processed目录
mkdir -p ./VTK/processed

# 调用process_vtk.py处理VTK文件（与第一个脚本保持一致）
echo "[Info] 使用process_vtk.py处理VTK文件..."
python3 ../../../utils/process_vtk.py "$VTK_RUN_DIR/internal.vtu" ./VTK/processed
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"process_vtk\", \"message\": \"VTK文件处理失败！\"}" >&2
  exit 1
fi

# 确保additional文件被正确复制
if [ -f "$VTK_RUN_DIR/boundary/bot.vtp" ] && [ ! -f "./VTK/processed/bot.vtp" ]; then
  cp "$VTK_RUN_DIR/boundary/bot.vtp" ./VTK/processed/
fi

# 复制original internal.vtu用于流线生成
if [ -f "$VTK_RUN_DIR/internal.vtu" ]; then
  cp "$VTK_RUN_DIR/internal.vtu" ./VTK/processed/internal.vtu
fi

emit_progress 100 "process_vtk"
echo "=== VTK文件处理完成 ==="
sleep 1

# --- 验证处理结果 ---
emit_task_start "verify_processed_files"
emit_progress 0 "verify_processed_files"

FIELD_FOR_STREAMLINES="./VTK/processed/internal.vtu"
VTP_SURFACES_DIR="./postProcessing/VTP_Surfaces"

# 检查关键文件
REQUIRED_FILES=(
  "./VTK/processed/mesh.vtp"
  "./VTK/processed/bot.vtp"
  "./VTK/processed/internal.vtu"
  "./VTK/processed/metadata.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"verify_processed_files\", \"message\": \"缺少处理后的文件: $file\"}" >&2
    exit 1
  fi
  echo "[Info] ✓ 找到文件: $file"
done

if [ ! -d "${VTP_SURFACES_DIR}" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"verify_processed_files\", \"message\": \"错误：找不到存放VTP种子表面的目录: ${VTP_SURFACES_DIR}\"}" >&2
  exit 1
fi

echo "[Info] 所有必需文件均已找到，验证通过。"
emit_progress 100 "verify_processed_files"
sleep 1

# --------------------------------------------------
# Step 1: 基于各高度VTP文件生成多高度Web流线
# --------------------------------------------------
emit_task_start "generate_web_streamlines"
emit_progress 0 "generate_web_streamlines"
echo "=== 开始基于各高度VTP文件生成多高度Web流线 ==="
echo "[Info] 当前工作目录: $(pwd)"

# --- 路径和配置定义 ---
PROCESSED_VTK_DIR="./VTK/processed"
UTILS_DIR="../../../utils"

echo "[Info] 使用速度场文件进行流线追踪: ${FIELD_FOR_STREAMLINES}"
echo "[Info] 使用VTP种子表面目录: ${VTP_SURFACES_DIR}"

# --- 循环为每个高度生成流线 ---
num_result_layers=$(jq '.post.numh' ../info.json -r)
layer_spacing=$(jq '.post.dh' ../info.json -r)
declare -a heights=()
for ((i=1; i<=${num_result_layers}; i++)); do
  height=$((i * layer_spacing))
  heights+=("$height")
done
total_heights=${#heights[@]}
height_count=0
echo "[Info] 将为以下高度生成流线切片: ${heights[@]}"

TARGET_SEED_SAMPLE=2000

for height in "${heights[@]}"
do
  height_count=$((height_count + 1))
  progress_percent=$((100 * height_count / total_heights))
  emit_progress ${progress_percent} "generate_web_streamlines"

  echo "---------------------------"
  echo ">> 开始处理高度: ${height} 米"

  SEED_SURFACE_VTP="${VTP_SURFACES_DIR}/${height}m.vtp"
  if [ ! -f "${SEED_SURFACE_VTP}" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"找不到高度 ${height}m 的VTP种子表面文件: ${SEED_SURFACE_VTP}\"}" >&2
    exit 1
  fi

  WEB_STREAM_VTP_PATH="${PROCESSED_VTK_DIR}/internal_${height}m_web.vtp"

  echo "[Info] 使用VTP种子表面: ${SEED_SURFACE_VTP}"
  echo "[Info] 将从种子表面采样 ${TARGET_SEED_SAMPLE} 个点生成流线..."
  
  python3 "${UTILS_DIR}/preStreamLines.py" \
    "${FIELD_FOR_STREAMLINES}" \
    -H "${height}" \
    --scale 1000 \
    -o "${WEB_STREAM_VTP_PATH}" \
    --vec "U" \
    --delta 0.5 \
    --seed-surface "${SEED_SURFACE_VTP}" \
    --seed-sample ${TARGET_SEED_SAMPLE}
  
  if [ $? -ne 0 ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"为高度 ${height}m 生成Web流线失败！请检查Python脚本输出。\"}" >&2
    exit 1
  fi
  
  echo "✓ 已成功生成基于 ${height}m 高度VTP的Web流线文件: ${WEB_STREAM_VTP_PATH}"
done
emit_progress 100 "generate_web_streamlines"
echo "=== 所有高度VTP Web流线生成完成 ==="
sleep 1

# --------------------------------------------------
# Step 2: 可视化预计算
# --------------------------------------------------
emit_task_start "precompute_visualization"
emit_progress 0 "precompute_visualization"
echo "=== 开始执行可视化预计算脚本 ==="
CASE_ID=$(basename "$(dirname "$(pwd)")")
if [ -z "${CASE_ID}" ]; then 
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"precompute_visualization\", \"message\": \"无法自动检测 Case ID！\"}" >&2
  exit 1
fi
echo "[Info] 自动检测到的 Case ID: ${CASE_ID}"

python3 "${UTILS_DIR}/precompute_visualization.py" --caseId "${CASE_ID}"
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"precompute_visualization\", \"message\": \"执行 precompute_visualization.py 失败！\"}" >&2
  exit 1
fi

emit_progress 100 "precompute_visualization"
echo "=== 可视化预计算完成 ==="
sleep 1

# --------------------------------------------------
# Step 3: 结束
# --------------------------------------------------
emit_task_start "streamline_postprocessing_end"
cd ..
emit_progress 100 "streamline_postprocessing_end"

updateStatus() {
  echo "{\"action\": \"info\", \"message\": \"流线后处理流程成功完成。\"}"
  echo "{\"action\": \"updateStatus\", \"status\": \"completed\", \"completedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
}
trap updateStatus EXIT

echo "=== 脚本执行完毕 ==="