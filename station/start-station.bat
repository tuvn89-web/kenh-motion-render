@echo off
chcp 65001 >nul
title TRAM RENDER kenh-motion (dung tat cua so nay)
cd /d "%~dp0"
:loop
node station.mjs
echo Tram bi dung, tu khoi dong lai sau 10 giay... (Ctrl+C de thoat han)
timeout /t 10 >nul
goto loop
