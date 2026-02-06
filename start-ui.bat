@echo off
cd /d C:\ProjectDocs\Microsoft_Bing\Bing-SupersetII\superset

echo Starting Superset Dev UI...

docker compose up -d

echo Waiting for UI (first start may take 1-2 mins)...
timeout /t 15 >nul

start http://localhost:8088

echo.
echo Superset UI Ready.
pause
