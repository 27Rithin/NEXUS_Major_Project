@echo off
echo Starting NEXUS System...

REM Activate backend
cd backend
call venv\Scripts\activate.bat
start cmd /k "uvicorn main:app --reload --port 8000 > backend.log 2>&1"

REM Start frontend
cd ../frontend
start cmd /k "npm run dev"

echo NEXUS started successfully!
pause
