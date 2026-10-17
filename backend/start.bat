@echo off
REM Smart Parking Backend Startup Script
REM This script starts the backend server with the vision service

echo ========================================
echo Smart Parking Backend Startup
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

echo [OK] Python found
echo.

REM Check if node is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js
    pause
    exit /b 1
)

echo [OK] Node.js found
echo.

REM Check if vision model exists
if not exist "vision\models\license-plate-yolo11n.pt" (
    echo WARNING: Vision model not found at vision\models\license-plate-yolo11n.pt
    echo Camera detection will be unavailable
    echo.
    echo To train the model, run:
    echo   npm run vision:download
    echo   npm run vision:train
    echo.
) else (
    echo [OK] Vision model found
)

echo.
echo Starting backend server...
echo The vision service will start automatically if the model exists
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm start
