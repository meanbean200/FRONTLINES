@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo FRONTLINES DEV requires the local Node.js development runtime.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Run npm install in this folder once, then launch FRONTLINES DEV again.
  pause
  exit /b 1
)
echo FRONTLINES DEV - keep this window open while authoring.
echo The editor opens at http://127.0.0.1:4176/dev.html
call npm run dev:author
pause
