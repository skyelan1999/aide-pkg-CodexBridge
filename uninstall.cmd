@echo off
node "%~dp0manage.cjs" uninstall --keep-launcher
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
pause
del "%~f0" & exit /b 0
