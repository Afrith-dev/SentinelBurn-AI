@echo off
title SentinelBurn AI - Mission Launcher
echo ======================================================================
echo    SENTINELBURN AI - ISRO QUALIFICATION SCREENING PLATFORM (SIH26170)
echo ======================================================================
echo Starting all microservices concurrently...

set PYTHON_EXE=python
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
)

start "Sentinel ML Core (Port 8000)" cmd /k "cd /d "%~dp0ml-service" && "%PYTHON_EXE%" app.py"
start "Sentinel Telemetry Simulator (Port 8001)" cmd /k "cd /d "%~dp0simulator" && "%PYTHON_EXE%" telemetry_generator.py"
start "Sentinel Backend API (Port 4000)" cmd /k "cd /d "%~dp0server" && npm run dev"
start "Sentinel Mission Console (Port 5173)" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo All microservices launched!
echo Operations Console URL: http://localhost:5173
echo Backend REST API URL:   http://localhost:4000/api
echo ML Microservice URL:    http://localhost:8000
echo Telemetry Simulator:    http://localhost:8001
echo ======================================================================
