@echo off
echo Starting Moktashif Application...

REM Create data directory for MongoDB if it doesn't exist
if not exist "data\db" mkdir data\db

REM Start MongoDB (if installed locally)
echo Starting MongoDB...
start /b mongod --dbpath=./data/db

REM Install required Python packages
echo Installing Python packages...
pip install flask flask-pymongo flask-bcrypt flask-jwt-extended python-dotenv requests flask-cors sentence-transformers pinecone-client

REM Start the backend server
echo Starting Backend Server...
cd src\Components\ChatBot
start /b python chat.py

REM Wait a moment for the backend to initialize
timeout /t 5

REM Start the frontend
echo Starting Frontend...
cd ..\..\..
npm run dev

echo All services started! 