@echo off
REM ============================================================
REM  Start the Analytics dashboard (read-only view of POS data)
REM  Double-click this file. It launches BOTH services:
REM    - analytics-api  (FastAPI)  -> http://localhost:8000
REM    - analytics-web  (Next.js)  -> http://localhost:3001
REM  The data is read straight from the shared POS database,
REM  so there is nothing to import or sync. Just open the page.
REM ============================================================

cd /d "%~dp0"

echo.
echo  Starting analytics-api (port 8000)...
start "analytics-api" cmd /k "cd apps\analytics-api && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && uvicorn app.main:app --port 8000 --reload"

echo  Starting analytics-web (port 3001)...
start "analytics-web" cmd /k "cd apps\analytics-web && npm run dev"

echo.
echo  ------------------------------------------------------------
echo   Both services are starting in their own windows.
echo   When ready, open:  http://localhost:3001
echo   (give it ~15-20 seconds the first time)
echo  ------------------------------------------------------------
echo.

REM Open the dashboard in the default browser after a short delay
timeout /t 12 /nobreak >nul
start "" "http://localhost:3001"
