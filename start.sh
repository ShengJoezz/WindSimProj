#!/bin/bash


echo "Starting frontend..."
cd frontend
npm run dev &  


echo "Starting backend..."
cd ../backend
node app.js &  


wait
