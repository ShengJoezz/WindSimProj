rm speed.bin;
rm output.json;
rm -rf ./run;
mkdir ./run;
cp -r ../../base/initcase/* ./run;
cd ./run
python3 ../../../base/solver/makeGmsh.py
gmsh -3 modeling.geo -o flat.msh
python3 ../../../base/solver/buildTerrain.py

python3 ../../../base/solver/makeInput.py

gambitToFoam output.neu
../../../base/solver/modifyBoundary
decomposePar
mpirun --allow-run-as-root -n 4 admFoam -parallel
reconstructPar
postFoam
python3 ../../../base/solver/post.py
cd ..