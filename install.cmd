@echo off
node "%~dp0manage.cjs" install %*
if errorlevel 1 pause
