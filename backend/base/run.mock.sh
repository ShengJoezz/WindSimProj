#!/bin/sh
echo "mock run calculation"
rm output.json
rm speed0.bin
for i in $(seq 1 5)
do
  sleep 1s
  echo "loop $i ..."
done
cp ../../base/output.json .
cp ../../base/speed0.bin .
echo "done"