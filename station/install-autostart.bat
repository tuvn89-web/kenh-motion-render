@echo off
chcp 65001 >nul
set "TARGET=%~dp0start-station.bat"
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Tram render kenh-motion.lnk"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');$s.TargetPath='%TARGET%';$s.WorkingDirectory='%~dp0';$s.WindowStyle=7;$s.Save()"
echo Da cai: tram render se tu bat (thu nho) moi khi mo Windows.
pause
