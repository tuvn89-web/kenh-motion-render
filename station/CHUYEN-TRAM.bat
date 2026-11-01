@echo off
chcp 65001 >nul
title Chuyen tram render vao 3_may\tram
rem Chay 1 lan sau khi xep lai thu muc kenh-motion (31/10/2026). File nay nam trong 3_may\tram\.
cd /d "%~dp0..\.."
echo.
echo  1) DONG cua so den "TRAM RENDER kenh-motion" truoc (neu dang mo).
echo  2) Bam phim bat ky de chuyen jobs, done, logs, _deploy, status.json vao 3_may\tram
echo     va cat thu muc station cu vao 9_de-xoa\station-cu (khong xoa gi).
pause >nul
for %%d in (jobs done logs _deploy) do (
  if exist "%%d" (
    if exist "3_may\tram\%%d" (move "%%d" "9_de-xoa\%%d-tram-cu" >nul) else (move "%%d" "3_may\tram\%%d" >nul)
  )
)
if exist status.json move status.json "3_may\tram\status.json" >nul
if exist station (
  move station "9_de-xoa\station-cu" >nul
  if exist station (
    echo.
    echo  LOI: chua chuyen duoc thu muc station - cua so tram cu van dang mo. Dong no roi chay lai file nay.
    pause
    exit /b 1
  )
)
echo  Da chuyen xong. Cai lai tu bat tram cung Windows (duong dan moi)...
call "%~dp0install-autostart.bat"
start "" /min "%~dp0start-station.bat"
echo  Tram moi da chay (cua so thu nho). Xong.
pause
