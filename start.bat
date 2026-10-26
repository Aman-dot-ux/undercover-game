@echo off
title UNDERCOVER — Wi-Fi Multiplayer Party Game
cls

echo ===============================================================
echo   UNDERCOVER — WI-FI MULTIPLAYER PARTY GAME
echo ===============================================================
echo.
echo   Starting local party game server...
echo.

cd /d "%~dp0"

:: Check if Node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Open game in default browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Run server
node server.js

pause
