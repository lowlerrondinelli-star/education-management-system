@echo off
chcp 65001 >nul
cd /d "%~dp0app"
echo 正在启动教务管理系统本地原型...
echo 打开地址: http://localhost:5177
start "" "http://localhost:5177"
python -m http.server 5177
