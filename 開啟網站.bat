@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在開啟南投家鄉景觀探險隊（http://127.0.0.1:8091）...
echo 關閉這個視窗即可停止。
start "" http://127.0.0.1:8091/index.html
python -m http.server 8091 --bind 127.0.0.1
