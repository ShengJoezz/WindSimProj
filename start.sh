#!/bin/bash
# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-24 19:40:30
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-24 19:40:38
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\start.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONDA_ENV="${WINDSIM_CONDA_ENV:-Wind_env}"

activate_conda_env() {
  local conda_sh=""
  local had_nounset=0
  for candidate in \
    "${HOME}/miniconda3/etc/profile.d/conda.sh" \
    "${HOME}/anaconda3/etc/profile.d/conda.sh"; do
    if [ -f "${candidate}" ]; then
      conda_sh="${candidate}"
      break
    fi
  done

  if [ -n "${conda_sh}" ]; then
    case $- in
      *u*)
        had_nounset=1
        set +u
        ;;
    esac
    # shellcheck disable=SC1090
    source "${conda_sh}"
    if conda env list | awk '{print $1}' | grep -qx "${DEFAULT_CONDA_ENV}"; then
      conda activate "${DEFAULT_CONDA_ENV}"
      echo "Activated conda env: ${DEFAULT_CONDA_ENV}"
    else
      echo "Conda env '${DEFAULT_CONDA_ENV}' not found, continuing without activation."
    fi
  else
    echo "Conda profile not found, continuing without activation."
  fi

  if [ "${had_nounset}" -eq 1 ]; then
    set -u
  fi
}

activate_node_env() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return
  fi

  local nvm_sh="${HOME}/.nvm/nvm.sh"
  if [ -f "${nvm_sh}" ]; then
    # shellcheck disable=SC1090
    source "${nvm_sh}"
    nvm use 20.17.0 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
  fi
}

activate_conda_env
activate_node_env

echo "Python: $(command -v python3 || echo not-found)"
echo "Node: $(command -v node || echo not-found)"
echo "Npm: $(command -v npm || echo not-found)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is not available. Please load nvm or install Node.js in WSL." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available. Please load nvm or install Node.js in WSL." >&2
  exit 1
fi

echo "Starting frontend..."
cd "${PROJECT_ROOT}/frontend"
npm run dev &

echo "Starting backend..."
cd "${PROJECT_ROOT}/backend"
node app.js &

wait
