# #!/bin/bash
# # @Author: joe 847304926@qq.com
# # @Date: 2025-05-24 19:40:30
# # @LastEditors: joe 847304926@qq.com
# # @LastEditTime: 2025-05-24 19:40:38
# # @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\start.sh
# # @Description: 
# #
# # Copyright (c) 2025 by joe, All Rights Reserved.

#!/bin/bash


echo "Starting frontend..."
cd frontend
npm run dev &  


echo "Starting backend..."
cd ../backend
node app.js &  

wait