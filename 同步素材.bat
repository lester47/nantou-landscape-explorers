@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -c "import PIL" 2>/dev/null || python -m pip install pillow
python sync_assets.py
pause
