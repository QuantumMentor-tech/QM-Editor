@echo off
setlocal enabledelayedexpansion

title QM Editor - QuantumMentor Code Editor
color 0B

echo.
echo =================================================================
echo             QM EDITOR - QuantumMentor Code Editor
echo =================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not found in your system PATH!
    echo.
    echo Please install Node.js (v18 or higher recommended) from:
    echo   https://nodejs.org/
    echo.
    echo After installing Node.js, run this batch file again.
    echo.
    pause
    exit /b 1
)

:: 2. Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] npm is not found in your system PATH!
    echo.
    echo Please verify your Node.js and npm installation.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js and npm detected:
for /f "tokens=*" %%v in ('node -v') do echo      Node: %%v
for /f "tokens=*" %%v in ('npm -v') do echo      npm:  %%v
echo.

:: 3. Check for node_modules directory
if not exist "%~dp0node_modules\" (
    echo [INFO] First-time setup detected: dependencies not installed.
    echo [INFO] Installing project dependencies with npm install...
    echo.
    cd /d "%~dp0"
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo.
        echo [ERROR] Failed to install npm dependencies!
        echo Please check your internet connection and try running 'npm install' manually.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed successfully!
    echo.
)

:: 4. Start the Vite Development Server
echo =================================================================
echo Starting QM Editor Development Server...
echo App URL: http://localhost:3000
echo Press Ctrl+C in this terminal window to stop the server.
echo =================================================================
echo.

cd /d "%~dp0"

:: Start browser after 2 seconds in parallel
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Launch Vite Dev Server
call npm run dev

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Development server exited with an error.
    echo.
    pause
)
