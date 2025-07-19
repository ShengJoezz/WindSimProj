# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-06-26 22:32:35
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-06-26 22:59:21
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\base\run_fast.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash
# @Author: joe 847304926@qq.com
# @Date: 2025-06-23 17:02:17
# @LastEditors: joe 847304926@qq.com
# @LastEditTime: 2025-06-26 23:30:00
# @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\base\run_fast.sh
# @Description: 一个完全自包含的脚本，负责单次计算的所有步骤，包括完整的后处理。
#
# Copyright (c) 2025 by joe, All Rights Reserved.

# --- [FIX 1] 确保任何命令失败时，脚本立即退出 ---
set -e

# --- 函数定义 ---
emit_progress() {
  echo "{\"action\":\"progress\",\"progress\": $1, \"taskId\":\"$2\"}"
}

emit_task_start() {
  echo "{\"action\":\"taskStart\", \"taskId\":\"$1\"}"
}

handle_error() {
  echo "{\"action\":\"progress\", \"progress\": \"ERROR\", \"taskId\":\"$1\", \"message\": \"$2\"}" >&2
  exit 1
}

# --- 脚本主逻辑 ---

emit_task_start "computation_start"
emit_progress 0 "computation_start"

emit_task_start "prepare_directory"
rm -f speed.bin output.json
rm -rf ./run
mkdir ./run
emit_progress 5 "prepare_directory"

emit_task_start "setup_case"
cp -r ../../base/initcase/* ./run
cd ./run
emit_progress 10 "setup_case"

emit_task_start "template_configs"
delta_t=$(jq '.simulation.deltaT' ../info.json -r)
end_time=$(jq '.simulation.step_count' ../info.json -r)
num_cores=$(jq '.simulation.core' ../info.json -r)
wind_speed=$(jq '.wind.speed' ../info.json -r)
export deltaT="${delta_t}"
export endTime="${end_time}"
export Ux="${wind_speed}"
export Uy="0"
export Uz="0"
mkdir -p system constant 0
envsubst < ../../../base/initcase/system/controlDict.template > system/controlDict
envsubst < ../../../base/initcase/0/U.template > 0/U
emit_progress 15 "template_configs"

emit_task_start "meshing_pipeline"
python3 ../../../base/solver/makeGmsh.py
gmsh -3 modeling.geo -o flat.msh
python3 ../../../base/solver/buildTerrain.py
python3 ../../../base/solver/makeInput.py
gambitToFoam output.neu
emit_progress 50 "meshing_pipeline"

emit_task_start "finalize_mesh"
../../../base/solver/modifyBoundary
checkMesh > checkMesh.log
emit_progress 60 "finalize_mesh"

emit_task_start "decompose_parallel"
sed -i "s/numberOfSubdomains [0-9]\+;/numberOfSubdomains ${num_cores};/" system/decomposeParDict
decomposePar
emit_progress 65 "decompose_parallel"

emit_task_start "run_admfoam"
mpirun --allow-run-as-root -n ${num_cores} admFoam -parallel
emit_progress 90 "run_admfoam"

# --- [FIX 2] 集成完整的、正确的后处理流程 ---
emit_task_start "post_process"
echo "=== 开始后处理 ==="
reconstructPar

# 准备并执行 C++ 后处理器
echo "--- 执行 C++ postFoam ---"
mkdir -p ./Input ./Output/plt
cp ../info.json ./Input/input.json
postFoam

# 执行 Python 后处理器以生成最终文件
echo "--- 执行 Python post.py ---"
python3 ../../../base/solver/post.py


echo "=== 后处理完成 ==="
emit_progress 100 "post_process"


# --- 计算结束 ---
emit_task_start "computation_end"
cd .. # 返回到工况根目录
emit_progress 100 "computation_end"


# --- 退出处理 ---
# 函数：更新最终状态
updateStatus() {
  echo "{\"action\": \"updateStatus\", \"status\": \"completed\", \"completedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
  echo "FINISHED" # 添加一个明确的结束标志
}

# 更新info.json中的计算状态
info_json_path="./info.json"
if [ -f "$info_json_path" ]; then
  jq '.calculationStatus = "completed"' "$info_json_path" > tmp.$$.json && mv tmp.$$.json "$info_json_path"
  echo "{\"action\": \"info\", \"message\": \"计算完成，状态已更新为 completed\"}"
fi

# 在脚本正常退出时，执行状态更新
updateStatus