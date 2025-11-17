#!/bin/bash
set -x # 开启执行过程打印
# backend/utils/run_query.sh

# This script acts as a wrapper to ensure the python script is called
# in a consistent shell environment.

# Get the absolute directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Find the absolute path of the python3 executable to bypass any aliases
PYTHON_EXEC=$(which python3)

# Execute the python script using its absolute path, forwarding all command-line arguments
"$PYTHON_EXEC" "$DIR/query_speed.py" "$@"
