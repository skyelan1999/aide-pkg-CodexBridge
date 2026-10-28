@echo off
node "%~dp0manage.cjs" key
set "BRIDGE_KEY_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %BRIDGE_KEY_RESULT%
