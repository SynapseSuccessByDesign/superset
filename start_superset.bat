@echo off
echo Starting Superset...

docker compose up -d

echo Waiting for Superset to boot...
timeout /t 20 > nul

echo Restarting UI services...
docker compose restart superset superset-node nginx

echo.
echo Superset is starting...
echo Open: http://localhost:8088
echo Login: admin / admin
pause
