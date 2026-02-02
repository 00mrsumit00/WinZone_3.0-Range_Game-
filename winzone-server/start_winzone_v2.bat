@echo off
echo ========================================
echo   WinZone V2 Dashboard - Quick Setup
echo ========================================
echo.

echo [STEP 1] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is NOT installed!
    echo    Please install from: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js is installed
echo.

echo [STEP 2] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is NOT installed!
    pause
    exit /b 1
)
echo ✅ npm is installed
echo.

echo [STEP 3] Checking dependencies...
if not exist "node_modules" (
    echo ⚠️  node_modules folder not found
    echo    Installing dependencies...
    call npm install
    echo.
) else (
    echo ✅ Dependencies folder exists
)
echo.

echo [STEP 4] Verifying required files...
echo.
if not exist "db_pool.js" (
    echo ❌ Missing: db_pool.js
    set MISSING=1
) else (
    echo ✅ Found: db_pool.js
)

if not exist "result_server.js" (
    echo ❌ Missing: result_server.js
    set MISSING=1
) else (
    echo ✅ Found: result_server.js
)

if not exist "api_server.js" (
    echo ❌ Missing: api_server.js
    set MISSING=1
) else (
    echo ✅ Found: api_server.js
)

if not exist "views\admin_dashboard_v2.html" (
    echo ❌ Missing: views\admin_dashboard_v2.html
    set MISSING=1
) else (
    echo ✅ Found: views\admin_dashboard_v2.html
)

if not exist "public\admin_dashboard_v2.js" (
    echo ❌ Missing: public\admin_dashboard_v2.js
    set MISSING=1
) else (
    echo ✅ Found: public\admin_dashboard_v2.js
)

echo.
if defined MISSING (
    echo ❌ Some required files are missing!
    echo    Please ensure all files are in place.
    pause
    exit /b 1
)

echo ========================================
echo   ✅ All Checks Passed!
echo ========================================
echo.
echo Your WinZone V2 Dashboard is ready to run!
echo.
echo To start your servers, run:
echo   1. Open Terminal 1: node result_server.js
echo   2. Open Terminal 2: node api_server.js
echo   3. Access: http://localhost:3000/admin_dashboard_v2
echo.
echo Press any key to start BOTH servers automatically...
pause >nul

echo.
echo ========================================
echo   Starting WinZone Servers...
echo ========================================
echo.

REM Start result_server.js in new window
start "WinZone - Result Server" cmd /k "echo Starting Result Server... && node result_server.js"

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Start api_server.js in new window  
start "WinZone - API Server" cmd /k "echo Starting API Server... && node api_server.js"

echo.
echo ✅ Servers are starting in separate windows!
echo.
echo ⏳ Wait 5 seconds for servers to initialize...
timeout /t 5 /nobreak

echo.
echo 🚀 Opening Admin Dashboard V2 in browser...
start http://localhost:3000/admin_dashboard_v2

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Dashboard opened in your browser.
echo If login page appears, use your admin credentials.
echo.
echo Server windows will remain open.
echo Close this window to exit setup script.
echo.
pause
