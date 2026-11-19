@echo off
rem 用 Bypass 策略跑同名 ps1，绕开「禁止运行脚本」的执行策略。
setlocal
set SCRIPT=%~dp0install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
echo.
pause
