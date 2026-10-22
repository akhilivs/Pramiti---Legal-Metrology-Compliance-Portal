@echo off
REM Starts the Pramiti backend (port 8000) and frontend (port 3000) in two windows.
cd /d "%~dp0"

if not exist backend\.env (
  echo backend\.env not found. Copy backend\.env.example to backend\.env and add your GEMINI_API_KEY.
  pause
  exit /b 1
)

start "Pramiti backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --port 8000"
start "Pramiti frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend:  http://localhost:8000/api/health
echo Frontend: http://localhost:3000
timeout /t 6 >nul
start http://localhost:3000
