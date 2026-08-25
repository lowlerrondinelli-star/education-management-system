@echo off
chcp 65001 >nul
cd /d "%~dp0app"
echo 正在启动教务管理系统本地原型...
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\extract-template-data.ps1"
cd /d "%~dp0app"
echo 打开地址: http://localhost:5177
start "" "http://localhost:5177"
python -m http.server 5177
