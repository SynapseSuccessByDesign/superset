@echo off
cd /d C:\ProjectDocs\Microsoft_Bing\Bing-SupersetII\superset

echo Stopping Superset Dev...
docker stop superset-superset-1
docker stop superset-node-1
docker stop superset-nginx-1
docker stop superset-worker-1
docker stop superset-worker-beat-1

echo Done.
pause
