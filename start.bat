@echo off
REM Kyomatos Event Ticketing Platform - Startup Script

echo.
echo ========================================
echo  Kyomatos Event Ticketing Platform
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if backend dependencies are installed
if not exist "backend\node_modules" (
    echo [1/2] Installing backend dependencies (this may take a minute)...
    cd backend
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install backend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [1/2] Backend dependencies already installed
)

echo.
echo [2/2] Starting backend server on port 5000...
echo.
echo ========================================
echo  Backend Server Starting...
echo ========================================
echo.
echo Server running at http://localhost:5000
echo.
echo Open your frontend in the browser to start using the platform
echo (http://localhost:3000 locally or your Netlify URL for production)
echo.

REM Start backend in a new window so it keeps running
start "Kyomatos Backend Server" cmd /k "cd backend && node server.js"

REM Wait a moment for server to start
timeout /t 2 /nobreak

echo Backend is now running in a new window!
timeout /t 3 /nobreak
