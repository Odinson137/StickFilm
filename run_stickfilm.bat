@echo off
title Stickfilm Studio Launcher
echo ========================================================
echo           STARTING STICKFILM STUDIO...
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching Python FastAPI Backend on http://localhost:8000 ...
start "Stickfilm Backend" cmd /k "cd /d "%~dp0backend" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Launching React Frontend on http://localhost:5173 ...
start "Stickfilm Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo   Stickfilm Studio is running! Enjoy video creation!
echo ========================================================
