@echo off
setlocal
title NEXUS SYSTEM REPAIR - Automated Maintenance
echo =============================================================
echo   NEXUS Disaster Response - Automated System Repair
echo =============================================================

echo [1/4] Closing hanging backend instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [OK] Done.

echo [2/4] Verifying PostgreSQL...
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
netstat -ano | findstr "127.0.0.1:5432 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ALERT] PostgreSQL not running. Attempting to start...
    net start postgresql-x64-16 >nul 2>&1
    if %errorlevel% neq 0 net start postgresql-x64-15 >nul 2>&1
)
echo [OK] PostgreSQL is active.

echo [3/4] Running Database Migrations (Syncing Schema)...
echo --- Backend output follows ---
cd /d %~dp0backend
call venv\Scripts\activate
python -m alembic upgrade head
if %errorlevel% neq 0 (
    echo [ERROR] Migration failed. Check backend\alembic\versions for errors.
) else (
    echo [OK] Database is synchronized with the latest models.
)

echo [4/4] Clearing Frontend Cache (Optional)...
echo Clearing browser cache is recommended after a major update (Ctrl + Shift + R).
echo [OK] Done.

echo =============================================================
echo   REPAIR COMPLETE. Run start.bat to relaunch the system.
echo =============================================================
pause
