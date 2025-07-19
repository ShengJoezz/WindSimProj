
# Copyright (c) 2025 by joe, All Rights Reserved.

# --- 配置区 ---
# 定义测试用的高度（可以设置一个或多个，用空格隔开）
TEST_HEIGHTS=(10 20)
# 定义输入的速度场名称
VECTOR_FIELD="U"
# 是否保存中间生成的3D全流线文件 (方便调试)
# 设置为 "true" 来保存, 其他任何值则不保存
SAVE_INTERMEDIATE="false"

# --- 脚本正文 ---
echo "========= 开始独立测试 '一步到位' 流线处理器 ========="

# 检查是否在正确的目录下执行
if [ ! -d "./run" ]; then
  echo "[错误] 找不到 './run' 目录。请确保您在 'backend/base/' 目录下，并且 run.sh 已成功运行过一次。"
  exit 1
fi

# 切换到工作目录
cd ./run
echo "[信息] 已进入工作目录: $(pwd)"

# --- 路径定义 ---
PROCESSED_VTK_DIR="./VTK/processed"
MESH_VTP_PATH="${PROCESSED_VTK_DIR}/mesh.vtp"
UTILS_DIR="../../../utils" # Python脚本工具目录

# 检查核心输入文件是否存在
if [ ! -f "${MESH_VTP_PATH}" ]; then
  echo "[错误] 找不到输入文件: ${MESH_VTP_PATH}"
  echo "[提示] 请确保 run.sh 已成功运行，并生成了此文件。"
  exit 1
fi

echo -e "\n--- 开始为指定高度生成Web流线切片 ---"
echo "[信息] 将为以下测试高度生成流线切片: ${TEST_HEIGHTS[@]}"
echo "[信息] 输入网格文件: ${MESH_VTP_PATH}"
echo "[信息] 使用的速度场: ${VECTOR_FIELD}"

for height in "${TEST_HEIGHTS[@]}"
do
  echo "========================================================"
  echo ">> 开始处理高度: ${height} 米"

  # 定义最终输出的web流线文件名
  WEB_STREAM_VTP_PATH="${PROCESSED_VTK_DIR}/internal_${height}m_web_TEST.vtp"
  echo "[信息] 输出文件将为: ${WEB_STREAM_VTP_PATH}"

  # 构建命令行参数
  CMD_ARGS=("${MESH_VTP_PATH}")
  CMD_ARGS+=("-H" "${height}")
  CMD_ARGS+=("--scale" "1000")
  CMD_ARGS+=("-o" "${WEB_STREAM_VTP_PATH}")
  CMD_ARGS+=("--vec" "${VECTOR_FIELD}")

  if [ "${SAVE_INTERMEDIATE}" == "true" ]; then
    CMD_ARGS+=("--save-intermediate")
    echo "[信息] 将保存中间生成的3D全流线文件。"
  fi

  # 调用 "一步到位" 脚本
  python3 "${UTILS_DIR}/preStreamLines.py" "${CMD_ARGS[@]}"
  
  if [ $? -ne 0 ]; then
    echo "[!! 错误 !!] 为高度 ${height}m 生成Web流线失败！"
  else
    echo "[✓✓ 成功 !!] 已为高度 ${height}m 生成Web流线文件。"
  fi
done

# 返回上一级目录
cd ..
echo -e "\n========= '一步到位' 流线处理器测试完成 ========="