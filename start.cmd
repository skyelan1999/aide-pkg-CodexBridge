@echo off
node "%~dp0manage.cjs" start
if errorlevel 1 pause
