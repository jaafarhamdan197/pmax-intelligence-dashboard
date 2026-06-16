@echo off
:: PMax Dashboard Launcher — Windows
:: Double-click this file to start the dashboard

:: Move to the folder where this .bat file lives
cd /d "%~dp0"

:: Check if index.html exists
if not exist "index.html" (
    echo ERROR: index.html not found.
    echo Make sure launch_dashboard_windows.bat and index.html are in the same folder.
    pause
    exit /b 1
)

:: Kill anything already running on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Start Python server in background
echo Starting PMax Dashboard...
start /b python3 -m http.server 8000

:: Wait for server to start
timeout /t 2 /nobreak >nul

:: Open browser
start http://localhost:8000

echo.
echo  PMax Dashboard is running at http://localhost:8000
echo  Close this window to stop the server when you're done.
echo.

:: Keep window open so closing it stops the server
python3 -m http.server 8000 >nul 2>&1
