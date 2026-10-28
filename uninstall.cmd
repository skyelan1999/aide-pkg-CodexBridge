@echo off
setlocal EnableDelayedExpansion
(
  node "%~dp0manage.cjs" uninstall
  set "BRIDGE_UNINSTALL_RESULT=!ERRORLEVEL!"
  pause
  exit /b !BRIDGE_UNINSTALL_RESULT!
)
