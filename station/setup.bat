@echo off
chcp 65001 >nul
title Cai dat tram render kenh-motion
cd /d "%~dp0\..\project"
where node >nul 2>nul
if errorlevel 1 (
  echo [1/3] Chua co Node.js - dang cai Node.js LTS bang winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Cai Node xong. HAY DONG cua so nay va bam lai setup.bat mot lan nua.
  pause
  exit /b
)
echo [1/3] Node.js:
node -v
echo [2/3] Cai thu vien (lan dau 3-6 phut)...
call npm install --no-audit --no-fund
if errorlevel 1 ( echo LOI khi npm install & pause & exit /b 1 )
echo [3/3] Tai trinh duyet render cua Remotion...
call npx remotion browser ensure
echo.
echo ======== CAI DAT XONG ========
echo Tiep theo: bam start-station.bat de bat tram render.
echo (Tuy chon) bam install-autostart.bat de tram tu bat cung Windows.
pause
