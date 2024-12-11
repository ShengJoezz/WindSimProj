#!/bin/bash

# backend/base/run.sh

echo "Progress: 0%"  # 计算开始

rm speed.bin
rm output.json
echo "Progress: 10%"  # 完成清理文件

rm -rf ./run
mkdir ./run
echo "Progress: 20%"  # 完成目录重建

cp -r ../../base/initcase/* ./run
echo "Progress: 30%"  # 完成文件复制

cd ./run
echo "Progress: 40%"  # 进入运行目录

python3 ../../../base/solver/makeGmsh.py
gmsh -3 modeling.geo -o flat.msh
echo "Progress: 50%"  # 完成建模

python3 ../../../base/solver/buildTerrain.py
echo "Progress: 60%"  # 完成地形构建

python3 ../../../base/solver/makeInput.py
echo "Progress: 70%"  # 完成输入文件生成

gambitToFoam output.neu
echo "Progress: 80%"  # 完成Gambit到Foam

../../../base/solver/modifyBoundary
echo "Progress: 85%"  # 完成边界修改

decomposePar
echo "Progress: 90%"  # 完成并行分解

mpirun --allow-run-as-root -n 4 admFoam -parallel
echo "Progress: 95%"  # 完成并行运行

reconstructPar
postFoam
echo "Progress: 100%"  # 完成后处理

python3 ../../../base/solver/post.py
echo "Progress: 100%"  # 确保完全完成

cd ..
echo "Progress: 100%"  # 结束