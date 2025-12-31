# 输出函数：以 JSON 格式输出进度消息
emit_progress() {
  echo "{\"action\":\"progress\",\"progress\": $1, \"taskId\":\"$2\"}"
  echo "[Debug] 当前工作目录: $(pwd)"
}

# 输出函数：以 JSON 格式输出任务启动消息
emit_task_start() {
  echo "{\"action\":\"taskStart\", \"taskId\":\"$1\"}"
  echo "[Debug] 当前工作目录: $(pwd)"
}

# 启动计算
emit_task_start "computation_start"
emit_progress 0 "computation_start"
sleep 1

# Step 1: Clean up files
emit_task_start "clean_files"
rm -f speed.bin
rm -f output.json
emit_progress 10 "clean_files"
sleep 1

# Step 2: Rebuild directories
emit_task_start "rebuild_directories"
rm -rf ./run
mkdir ./run
emit_progress 20 "rebuild_directories"
sleep 1

# Step 3: Copy initial case files
emit_task_start "copy_files"
cp -r ../../base/initcase/* ./run
# 清理 Windows 复制/解压产生的杂质文件，避免影响求解器与打包分发
find ./run -type f \( -name '*:Zone.Identifier' -o -name '*Zone.Identifier*' \) -delete 2>/dev/null || true
emit_progress 30 "copy_files"
sleep 1
# Step 4: Change to run directory
emit_task_start "change_directory"
cd ./run
emit_progress 40 "change_directory"
sleep 1

CURVE_SRC_DIR="../customCurves"
CURVE_DST_DIR="./Input" # <-- [修正] 移除多余的 "./run/"
if [ -d "${CURVE_SRC_DIR}" ]; then
  echo "[Info] 发现自定义曲线目录 (${CURVE_SRC_DIR})，开始复制到 (${CURVE_DST_DIR})..."
  mkdir -p "${CURVE_DST_DIR}"
  cp -vf ${CURVE_SRC_DIR}/*-U-P-Ct.txt "${CURVE_DST_DIR}/" 2>/dev/null || echo "[警告] 在源目录中未找到可复制的性能曲线文件 (*-U-P-Ct.txt)。"
  echo "[Info] 自定义曲线复制完成。"
else
  echo "[Info] 未发现自定义曲线目录 (${CURVE_SRC_DIR})，如果后续检查失败，则说明必须上传文件。"
fi
emit_progress 100 "overlay_curves"
# ===== [修复方案 1c] 运行前置检查：验证性能曲线文件是否存在 =====
# 在启动OpenFOAM之前，验证每个风机型号都有对应的性能曲线文件。
emit_task_start "validate_curves"
echo "[Info] 正在验证所有必需的性能曲线文件是否都已提供..."

# 从info.json中读取所有唯一的风机型号ID
# 使用 jq 工具解析json, -r 表示输出原始字符串, .turbines[].model 获取每个涡轮机的模型字段, sort -u 去重并排序
ids=$(jq -r '.turbines[].model' ../info.json | sort -u)

# 检查jq是否成功执行，以及是否成功获取到ID
if [ $? -ne 0 ] || [ -z "$ids" ]; then
    echo "[ERROR] 无法从 info.json 读取风机型号，或者风机列表为空。请检查文件格式或确保已定义风机。" >&2
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"validate_curves\"}"
    exit 1 # 退出脚本，返回错误码1
fi

missing=0
for id in $ids; do
  # 检查文件是否存在且不为空 (-s)
  if [ ! -s "${CURVE_DST_DIR}/${id}-U-P-Ct.txt" ]; then
    # 如果文件不存在或为空，打印错误信息到标准错误输出
    echo "[ERROR] 关键错误：缺少风机型号 ${id} 的性能曲线文件。预期的文件是: ${id}-U-P-Ct.txt" >&2
    missing=1 # 标记为缺失
  fi
done

if [ $missing -eq 1 ]; then
  echo "[ERROR] 一个或多个性能曲线文件缺失，仿真中止。" >&2
  # 发送错误状态到前端
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"validate_curves\"}"
  exit 2 # 退出脚本，返回一个不同的错误码
fi
echo "[Info] 所有必需的性能曲线文件均已找到。检查通过。"
emit_progress 100 "validate_curves"
# ========================================================

# ===== [新增] 复制粗糙度文件 =====
ROU_SRC_FILE="../rou"
ROU_DST_FILE="./Input/rou"
if [ -f "${ROU_SRC_FILE}" ]; then
    echo "[Info] 发现粗糙度文件，开始复制到 (${ROU_DST_FILE})..."
    cp -v "${ROU_SRC_FILE}" "${ROU_DST_FILE}"
    if [ $? -ne 0 ]; then
      echo "[ERROR] 复制粗糙度文件失败！" >&2
      # 根据需要决定是否中止脚本
      # exit 1 
    fi
    echo "[Info] 粗糙度文件复制完成。"
else
    echo "[警告] 未发现粗糙度文件 (${ROU_SRC_FILE})，将按无植被情况计算。"
fi
# ==================================


# Step 4.5: 模板化配置文件
# --------------------------------------------------
echo "=== 开始模板化配置文件 ==="

# --- 读取公共参数 ---
delta_t=$(jq '.simulation.deltaT' ../info.json -r)
end_time=$(jq '.simulation.step_count' ../info.json -r)
wind_speed=$(jq '.wind.speed' ../info.json -r) # 读取风速

# --- 导出 controlDict 环境变量 ---
export deltaT="${delta_t}"
export endTime="${end_time}"

# --- 导出 U 文件的环境变量 (风始终沿X轴) ---
export Ux="${wind_speed}"
export Uy="0"
export Uz="0"

# --- 模板化 controlDict ---
echo "模板化 controlDict..."
envsubst < ../../../base/initcase/system/controlDict.template > system/controlDict
if [ $? -ne 0 ]; then
  echo "模板化 controlDict 失败!" >&2
  exit 1
fi

# --- 模板化 U 文件 ---
echo "模板化 U 文件，使用风速: ${Ux} m/s..."
envsubst < ../../../base/initcase/0/U.template > 0/U
if [ $? -ne 0 ]; then
  echo "模板化 U 文件失败!" >&2
  exit 1
fi

echo "=== 配置文件模板化完成 ==="
# --------------------------------------------------

# Step 5: Execute makeGmsh.py and gmsh
emit_task_start "modeling"
python3 ../../../base/solver/makeGmsh.py
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"modeling\"}"
  exit 1
fi
gmsh -3 modeling.geo -o flat.msh
emit_progress 50 "modeling"
sleep 1

# Step 6: Execute buildTerrain.py
emit_task_start "build_terrain"
python3 ../../../base/solver/buildTerrain.py
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"build_terrain\"}"
  exit 1
fi
emit_progress 60 "build_terrain"
sleep 1

# Step 7: Execute makeInput.py
emit_task_start "make_input"
python3 ../../../base/solver/makeInput.py
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"make_input\"}"
  exit 1
fi
emit_progress 70 "make_input"
sleep 1

# Step 8: Execute gambitToFoam
emit_task_start "gambit_to_foam"
gambitToFoam output.neu
emit_progress 80 "gambit_to_foam"
sleep 1

# Step 9: Modify boundaries
emit_task_start "modify_boundaries"
../../../base/solver/modifyBoundary
emit_progress 85 "modify_boundaries"
sleep 1

# Step 10: Decompose for parallel processing
emit_task_start "decompose_parallel"
echo "=== 动态设置 decomposeParDict 并执行 decomposePar ==="

# 读取核数 (num_cores) 再次确认
num_cores=$(jq '.simulation.core' ../info.json -r)
echo "[Info] 使用 ${num_cores} 核进行并行计算"

# 动态修改 decomposeParDict 中的 numberOfSubdomains
sed -i "s/numberOfSubdomains [0-9]\+;/numberOfSubdomains ${num_cores};/" system/decomposeParDict
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"decompose_parallel\", \"message\": \"修改 decomposeParDict 失败!\"}"
  exit 1
fi
echo "[Info] decomposeParDict 已更新为 numberOfSubdomains = ${num_cores}"

decomposePar
emit_progress 90 "decompose_parallel"
sleep 1
echo "=== decomposePar 执行完成 ==="

# Step 11: Run roughFoam in parallel
emit_task_start "run_roughFoam"
mpirun --allow-run-as-root -n ${num_cores} roughFoam -parallel  # 使用变量 ${num_cores}
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"run_roughFoam\"}"
  exit 1
fi
emit_progress 95 "run_roughFoam"
sleep 1

# Step 12: Reconstruct and post-process
emit_task_start "post_process"
reconstructPar
postFoam
emit_progress 100 "post_process"
sleep 1

# Final step: Execute post.py
emit_task_start "execute_post_script"
python3 ../../../base/solver/post.py
emit_progress 100 "execute_post_script"
sleep 1

foamToVTK -latestTime -fields '(U)'
echo "{\"action\": \"info\", \"message\": \"OpenFOAM 计算和 VTK 导出完成\"}"
sleep 1

# Step 12之后添加VTK处理
VTK_RUN_DIR=$(ls -d ./VTK/run_* 2>/dev/null | head -n 1)
if [ -z "$VTK_RUN_DIR" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"process_vtk\", \"message\": \"找不到VTK输出目录！\"}"
  exit 1
fi

# 处理VTK数据
emit_task_start "process_vtk"
mkdir -p ./VTK/processed  # 使用相对路径
# 将 internal.vtu 和 bot.vtp 复制并处理到 processed 目录
python3 ../../../utils/process_vtk.py "$VTK_RUN_DIR/internal.vtu" ./VTK/processed
mv "$VTK_RUN_DIR/boundary/bot.vtp" ./VTK/processed
cp "$VTK_RUN_DIR/internal.vtu" ./VTK/processed/internal.vtu
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"process_vtk\"}"
  exit 1
fi
emit_progress 100 "process_vtk"
sleep 1

# --------------------------------------------------
# Step 13: 多高度速度场采样
# --------------------------------------------------
emit_task_start "multi_height_sampling"
emit_progress 0 "multi_height_sampling"
echo "=== 开始多高度速度场采样 ==="
echo "[Info] 当前工作目录: $(pwd)"

# 检查 constant/triSurface 目录是否存在，若不存在则创建
if [ ! -d "constant/triSurface" ]; then
  mkdir -p constant/triSurface
fi

#--------------------------------------------------
# Step 13.1: 提取底面 STL 文件（patch: bot）
#--------------------------------------------------
emit_task_start "extract_bot_stl"
emit_progress 10 "extract_bot_stl"
echo "Step 13.1: 提取底面 STL 文件（patch: bot）..."
surfaceMeshExtract -latestTime -patches bot bot.stl
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"extract_bot_stl\", \"message\": \"提取底面 STL 失败！\"}"
  exit 1
fi
echo "底面 STL 文件生成成功：bot.stl"
sleep 1

#--------------------------------------------------
# Step 13.2: 针对多个高度进行采样测试
#--------------------------------------------------
emit_task_start "multi_height_sampling_loop"
emit_progress 20 "multi_height_sampling_loop"

echo "[Info] 动态生成采样高度..."
# 从 info.json 读取 "结果层数" (numh) 和 "层数间距" (dh)
num_result_layers=$(jq '.post.numh' ../info.json -r)
layer_spacing=$(jq '.post.dh' ../info.json -r)

# 动态生成 heights 数组
declare -a heights=()  # 声明 heights 为数组
for ((i=1; i<=${num_result_layers}; i++))
do
  height=$((i * layer_spacing))  # 计算高度: 层数 * 层数间距
  heights+=("$height")          # 添加到 heights 数组
done
total_heights=${#heights[@]}
echo "[Info] 动态生成的采样高度: ${heights[@]}" # 输出生成的 heights 数组
height_count=0

# 创建统一的VTP文件存放目录
mkdir -p postProcessing/VTP_Surfaces

for height in "${heights[@]}"
do
  height_count=$((height_count + 1))
  progress_percent=$((20 + (height_count * 80 / total_heights))) # 采样循环占 80% 进度
  emit_progress ${progress_percent} "multi_height_sampling_loop"

  echo "---------------------------"
  echo "开始采样高度: ${height} 米"

  # 计算平移量 d（例如 1000m * 0.001 = 1）
  d=$(echo "scale=3; $height * 0.001" | bc)

  # 生成平移后的 STL 文件名，例如 bot_translated_1000.stl
  stl_translated="bot_translated_${height}.stl"

  emit_task_start "translate_stl_${height}"
  echo "生成平移后的 STL 文件：${stl_translated} (平移距离 d=${d})"
  surfaceTransformPoints -translate "(0 0 ${d})" bot.stl ${stl_translated}
  if [ $? -ne 0 ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"translate_stl_${height}\", \"message\": \"生成 ${stl_translated} 失败！\"}"
    exit 1
  fi
  sleep 1

  emit_task_start "copy_stl_to_trisurface_${height}"
  # 将生成的 STL 文件复制到 constant/triSurface 中
  cp "${stl_translated}" constant/triSurface/
  if [ $? -ne 0 ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"copy_stl_to_trisurface_${height}\", \"message\": \"复制 ${stl_translated} 到 constant/triSurface 失败！\"}"
    exit 1
  fi
  echo "STL 文件已复制至 constant/triSurface/"

  emit_task_start "create_sampledict_${height}"
  # 为当前高度生成专用的 sampleDict 文件，基于 system/sampleDict 模板
  sampleDict_curr="system/sampleDict_${height}"
  cp system/sampleDict ${sampleDict_curr}
  if [ $? -ne 0 ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"create_sampledict_${height}\", \"message\": \"复制 sampleDict 模板失败！\"}"
    exit 1
  fi

  emit_task_start "modify_sampledict_${height}"
  # 修改 sampleDict 文件中默认的 STL 文件名称（模板中应包含 bot_translated.stl 关键字）
  sed -i "s/bot_translated\.stl/${stl_translated}/g" ${sampleDict_curr}

  echo "当前工作目录: $(pwd)"
  emit_task_start "postprocess_sampling_${height}"
  echo "执行 postProcess 对 ${height} 米进行采样..."
  postProcess -func sampleDict_${height} -latestTime
  if [ $? -ne 0 ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"postprocess_sampling_${height}\", \"message\": \"对 ${height} 米采样失败！\"}"
    exit 1
  fi
  sleep 1

  emit_task_start "organize_sampling_results_${height}"
  # 查找采样结果目录，此目录位于 postProcessing/sampleDict_${height} 下，
  # 且其目录名称为 OpenFOAM 生成的最新时刻（非固定为 latestTime）。
  baseSampleDir="postProcessing/sampleDict_${height}"
  if [ ! -d "${baseSampleDir}" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"organize_sampling_results_${height}\", \"message\": \"目录 ${baseSampleDir} 不存在！\"}"
    exit 1
  fi

  # 获取最新时刻目录（假设结果目录的名称为数值）
  latestDir=$(ls -1d ${baseSampleDir}/* 2>/dev/null | sort -n | tail -1)
  if [ -z "${latestDir}" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"organize_sampling_results_${height}\", \"message\": \"在 ${baseSampleDir} 下未找到采样结果目录！\"}"
    exit 1
  fi
  echo "找到最新采样目录：${latestDir}"

  # 处理采样结果
  mkdir -p postProcessing/Data
  for file in "${latestDir}"/*; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      # 判断是否为 VTP 文件（用于流线生成的种子表面）
      if [[ "$filename" == *.vtp ]]; then
        # VTP 文件保存到 VTP_Surfaces 目录，用作流线种子
        cp "$file" "postProcessing/VTP_Surfaces/${height}m.vtp"
        echo "VTP 种子表面文件已保存: postProcessing/VTP_Surfaces/${height}m.vtp"
      fi
      
      # 将所有文件（包括数据文件）重命名保存到 Data 目录
      if [[ "$filename" == *.* ]]; then
        ext="${filename##*.}"
        newname="${height}.${ext}"
      else
        newname="${height}"
      fi
      cp "$file" "postProcessing/Data/${newname}"
      echo "采样结果文件 $file 已复制为 postProcessing/Data/${newname}"
    fi
  done

  # 如有需要，可以删除空的最新时刻目录
  rmdir "${latestDir}" 2>/dev/null
  sleep 1
done
emit_progress 100 "multi_height_sampling_loop"
emit_progress 100 "multi_height_sampling"
echo "=== 所有高度采样测试完成 ==="

# --------------------------------------------------

# --------------------------------------------------
# Step 14: 基于各高度VTP文件生成多高度Web流线
# --------------------------------------------------
emit_task_start "generate_web_streamlines"
emit_progress 0 "generate_web_streamlines"
echo "=== 开始基于各高度VTP文件生成多高度Web流线 ==="
echo "[Info] 当前工作目录: $(pwd)"

# --- 路径和配置定义 ---
PROCESSED_VTK_DIR="./VTK/processed"
VTP_SURFACES_DIR="./postProcessing/VTP_Surfaces"
UTILS_DIR="../../../utils" # Python脚本工具目录

# --- 查找用于流线追踪的体积速度场文件 ---
FIELD_FOR_STREAMLINES="${PROCESSED_VTK_DIR}/internal.vtu"
if [ ! -f "${FIELD_FOR_STREAMLINES}" ]; then
    # 如果在 processed 目录找不到，则回退到原始的VTK导出目录
    VTK_RUN_DIR=$(ls -d ./VTK/run_* 2>/dev/null | head -n 1)
    FIELD_FOR_STREAMLINES="${VTK_RUN_DIR}/internal.vtu"
fi

# --- 检查核心输入文件是否存在 ---
if [ ! -f "${FIELD_FOR_STREAMLINES}" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"找不到流线生成的输入文件: ${FIELD_FOR_STREAMLINES}\"}"
  exit 1
fi

if [ ! -d "${VTP_SURFACES_DIR}" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"找不到VTP种子表面目录: ${VTP_SURFACES_DIR}\"}"
  exit 1
fi

echo "[Info] 使用速度场文件进行流线追踪: ${FIELD_FOR_STREAMLINES}"
echo "[Info] 使用VTP种子表面目录: ${VTP_SURFACES_DIR}"

# --- 循环为每个高度生成流线 ---
# 读取高度配置，与速度场采样保持一致
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

for height in "${heights[@]}"
do
  height_count=$((height_count + 1))
  progress_percent=$((100 * height_count / total_heights))
  emit_progress ${progress_percent} "generate_web_streamlines"

  echo "---------------------------"
  echo ">> 开始处理高度: ${height} 米 (使用对应高度的VTP种子表面)"

  # 查找对应高度的VTP种子表面文件
  SEED_SURFACE_VTP="${VTP_SURFACES_DIR}/${height}m.vtp"
  
  if [ ! -f "${SEED_SURFACE_VTP}" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"找不到高度 ${height}m 的VTP种子表面文件: ${SEED_SURFACE_VTP}\"}"
    exit 1
  fi

  # 定义输出文件路径（基于新的命名格式）
  WEB_STREAM_VTP_PATH="${PROCESSED_VTK_DIR}/internal_${height}m_web.vtp"

  echo "[Info] 使用VTP种子表面: ${SEED_SURFACE_VTP}"

  TARGET_SEED_SAMPLE=1500

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
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"为高度 ${height}m 生成Web流线失败！\"}"
    exit 1
  fi
  
  # 验证输出文件是否成功创建
  if [ ! -f "${WEB_STREAM_VTP_PATH}" ]; then
    echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"generate_web_streamlines\", \"message\": \"Web流线文件未生成: ${WEB_STREAM_VTP_PATH}\"}"
    exit 1
  fi
  
  echo "✓ 已成功生成基于 ${height}m 高度VTP的Web流线文件: ${WEB_STREAM_VTP_PATH}"
done
emit_progress 100 "generate_web_streamlines"
echo "=== 所有高度VTP Web流线生成完成 ==="

emit_task_start "precompute_visualization"
emit_progress 0 "precompute_visualization"
echo "=== 开始执行可视化预计算脚本 ==="
echo "[Info] 当前工作目录: $(pwd)"

# 从当前路径的上级目录名中提取 caseId (例如从 .../uploads/test/run 提取出 'test')
CASE_ID=$(basename "$(dirname "$(pwd)")")
if [ -z "${CASE_ID}" ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"precompute_visualization\", \"message\": \"无法自动检测 Case ID！\"}"
  exit 1
fi
echo "[Info] 自动检测到的 Case ID: ${CASE_ID}"

# 定义 utils 目录的路径
UTILS_DIR="../../../utils"

# 调用脚本，并使用 --caseId 参数传入ID (使用简洁的单行写法)
python3 "${UTILS_DIR}/precompute_visualization.py" --caseId "${CASE_ID}"
if [ $? -ne 0 ]; then
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"precompute_visualization\", \"message\": \"执行 precompute_visualization.py 失败！\"}"
  exit 1
fi

emit_progress 100 "precompute_visualization"
echo "=== 可视化预计算完成 ==="
sleep 1
# ##################################################

emit_task_start "computation_end"
cd ..
emit_progress 100 "computation_end"
# 添加在脚本退出时更新状态
updateStatus() {
  echo "{\"action\": \"updateStatus\", \"status\": \"completed\", \"completedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
}
trap updateStatus EXIT

info_json_path="../info.json"
if [ -f "$info_json_path" ]; then
  jq '.calculationStatus = "completed"' "$info_json_path" > tmp.$$.json && mv tmp.$$.json "$info_json_path"
  echo "{\"action\": \"progress\", \"progress\": 100, \"taskId\": \"computation_end\", \"message\": \"计算完成\"}"
else
  echo "{\"action\": \"progress\", \"progress\": 100, \"taskId\": \"computation_end\", \"message\": \"info.json 未找到，无法标记计算状态\"}"
fi

cleanup_intermediate_files() {
  echo "=== 开始清理中间文件 ==="
  
  # 确保在正确的目录
  if [ -d "./run" ]; then
    cd ./run
    
    # 1. 删除网格生成的中间文件
    rm -f modeling.geo flat.msh output.neu
    echo "    ✓ 删除网格文件"
    
    # 2. 删除并行计算的分解目录
    rm -rf processor*
    echo "    ✓ 删除并行处理器目录"
    
    # 3. 删除临时的STL文件
    rm -f bot_translated_*.stl
    if [ -d "constant/triSurface" ]; then
      rm -f constant/triSurface/bot_translated_*.stl
      rmdir constant/triSurface 2>/dev/null
    fi
    echo "    ✓ 删除临时STL文件"
    
    # 4. 删除临时的sampleDict文件
    rm -f system/sampleDict_*
    echo "    ✓ 删除临时sampleDict文件"
    
    # 5. 删除postProcessing中的临时目录
    if [ -d "postProcessing" ]; then
      find postProcessing -type d -name "sampleDict_*" -exec rm -rf {} + 2>/dev/null
    fi
    echo "    ✓ 清理postProcessing临时目录"

    cd ..
  else
    echo "    ✗ ./run 目录不存在，跳过清理"
  fi
  
  echo "=== 中间文件清理完成 ==="
}

# 在脚本退出前调用清理函数
trap 'cleanup_intermediate_files; updateStatus' EXIT
