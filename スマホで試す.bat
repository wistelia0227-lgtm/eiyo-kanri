@echo off
cd /d "%~dp0"
start "" http://localhost:8766/
python -X utf8 tools\serve.py
pause
