#!/bin/bash
# backend/utils/run_query.sh

# This script acts as a wrapper to ensure the python script is called
# in a consistent shell environment.

# Enable trace only when explicitly requested (keeps API errors user-friendly).
if [ "${DEBUG_QUERY_SPEED:-0}" = "1" ]; then
  set -x
fi

set -euo pipefail

# Get the absolute directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Find the absolute path of the python3 executable to bypass any aliases
PYTHON_EXEC="$(command -v python3 || true)"
if [ -z "${PYTHON_EXEC}" ]; then
  echo "python3 not found in PATH" >&2
  exit 127
fi

# Execute the python script using its absolute path, forwarding all command-line arguments
exec "$PYTHON_EXEC" "$DIR/query_speed.py" "$@"
