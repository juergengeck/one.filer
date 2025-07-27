@echo off
echo ONE Filer Installer for Windows (Standalone)
echo ============================================
echo.
echo This installer will set up ONE Filer with Ubuntu WSL2
echo.
echo Press any key to continue or close this window to cancel...
pause > nul

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    REM Already admin, run directly
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0install-one-filer-standalone.ps1"
) else (
    REM Request elevation
    echo Requesting administrator privileges...
    powershell.exe -Command "Start-Process cmd -ArgumentList '/c cd /d %~dp0 && powershell.exe -ExecutionPolicy Bypass -File install-one-filer-standalone.ps1 && pause' -Verb RunAs"
    exit
)

pause