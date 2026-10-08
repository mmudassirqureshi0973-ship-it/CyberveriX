@echo off
REM CyberVeriX start script (Windows)
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.9+ is required but was not found on PATH.
  pause
  exit /b 1
)
echo Starting CyberVeriX on http://127.0.0.1:8000
echo Demo login: student@cyberverix.local / Cyber@1234
echo Press Ctrl+C to stop.
python backend\app.py --port 8000
pause
