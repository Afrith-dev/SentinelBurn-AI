@echo off
title SentinelBurn AI - Mission Launcher
echo ======================================================================
echo    SENTINELBURN AI - ISRO QUALIFICATION SCREENING PLATFORM (SIH26170)
echo ======================================================================
echo Starting all microservices concurrently...

start "Sentinel ML Core (Port 8000)" cmd /k "cd ml-service && python app.py"
start "Sentinel Telemetry Simulator (Port 8001)" cmd /k "cd simulator && python telemetry_generator.py"
start "Sentinel Backend API (Port 4000)" cmd /k "cd server && npm run dev"
start "Sentinel Mission Console (Port 5173)" cmd /k "cd client && npm run dev"

echo.
echo All microservices launched!
echo Operations Console URL: http://localhost:5173
echo Backend REST API URL:   http://localhost:4000/api
echo ML Microservice URL:    http://localhost:8000
echo Telemetry Simulator:    http://localhost:8001
echo ======================================================================
