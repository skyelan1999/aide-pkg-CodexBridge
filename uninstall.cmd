@echo off
if not exist "%~dp0manage.cjs" (
  echo Bridge program files are already removed. Configuration and key are retained.
  pause
  exit /b 0
)
node "%~dp0manage.cjs" uninstall --keep-launcher
set "BRIDGE_UNINSTALL_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %BRIDGE_UNINSTALL_RESULT%
