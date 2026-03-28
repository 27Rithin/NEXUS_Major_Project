@echo off
setlocal enabledelayedexpansion
title NEXUS Launcher - Extreme Reliability Mode
set LOG_FILE=%~dp0startup.log
echo =============================================================
echo   NEXUS Disaster Response System - Automated Recovery
echo =============================================================
echo [%DATE% %TIME%] NEXUS Launcher started. >> "%LOG_FILE%"

:: --- PRE-FLIGHT: Targeted Cleanup ---
echo [1/5] Cleaning up existing backend instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [OK] Cleanup complete.

echo [2/5] Verifying PostgreSQL...
:check_postgres
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ALERT] PostgreSQL not running. Attempting to start...
    net start postgresql-x64-16 >nul 2>&1
    if %errorlevel% neq 0 net start postgresql-x64-15 >nul 2>&1
    if %errorlevel% neq 0 net start postgresql-x64-14 >nul 2>&1
    ping 127.0.0.1 -n 6 >nul
    netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] PostgreSQL failed to start. Start it manually.
        pause
        goto check_postgres
    )
)
echo [OK] PostgreSQL is active.

echo [3/5] Syncing Database (Init + Migrations)...
cd /d %~dp0backend
call venv\Scripts\activate
echo [%TIME%] Running DB Init... >> "%LOG_FILE%"
python init_db.py >> "%LOG_FILE%" 2>&1
echo [%TIME%] Running Alembic Migrations... >> "%LOG_FILE%"
call alembic upgrade head >> "%LOG_FILE%" 2>&1
echo [OK] Database is up to date (Logs: startup.log).

echo [4/5] Launching Frontend...
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [%TIME%] Starting Frontend... >> "%LOG_FILE%"
    start "NEXUS Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"
)

:: --- SERVICE STARTUP WITH RETRY LIMIT ---
set /a retry_count=0

:restart_backend
set /a retry_count+=1
if %retry_count% gtr 5 (
    echo [FATAL] Backend failed to stabilize after 5 attempts. Manual check required.
    echo [%TIME%] FATAL: Retry limit exceeded. >> "%LOG_FILE%"
    pause
    exit /b 1
)

echo [5/5] Starting Backend (Attempt %retry_count%)...
start "NEXUS Backend" cmd /c "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000"
echo [%TIME%] Backend service launched. >> "%LOG_FILE%"

:: Startup safety delay
ping 127.0.0.1 -n 4 >nul

:: Wait for REAL health
echo Waiting for backend health...
set /a tries=0
:wait_health
set /a tries+=1
if %tries% gtr 30 (
    echo [ERROR] Backend failed to become healthy in time!
    goto restart_backend
)
:: Strict health validation
curl -s --max-time 2 http://127.0.0.1:8000/api/health | findstr "\"status\":\"healthy\"" >nul
if %errorlevel% equ 0 goto healthy
ping 127.0.0.1 -n 3 >nul
goto wait_health

:healthy
echo [OK] Backend is healthy!
set /a retry_count=0
echo =============================================================
echo   ALL SYSTEMS ONLINE. MONITORING ACTIVE.
echo =============================================================
start "" "http://localhost:5173"

:: --- MONITORING LOOP ---
:monitor_loop
ping 127.0.0.1 -n 11 >nul

:: REAL health check via curl with timeout and strict matching
curl -s --max-time 2 http://127.0.0.1:8000/api/health | findstr "\"status\":\"healthy\"" >nul
if %errorlevel% neq 0 (
    echo [%TIME%] [CRITICAL] Backend unhealthy! Restarting...
    echo [%TIME%] UNHEALTHY STATUS DETECTED. >> "%LOG_FILE%"
    
    :: Cleanup targeted
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    
    goto restart_backend
)

:: Periodic Frontend Check with Restart Logging
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [%TIME%] [WARNING] Frontend service down. Restarting...
    echo [%TIME%] Frontend restart triggered. >> "%LOG_FILE%"
    start "NEXUS Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"
)

goto monitor_loop
