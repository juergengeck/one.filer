@echo off
echo ONE Filer Installer for Windows
echo ===============================
echo.
echo This installer will set up ONE Filer with Ubuntu WSL2
echo.
echo Press any key to continue or close this window to cancel...
pause > nul

REM Run PowerShell installer with elevated privileges
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install-one-filer-ubuntu-fixed.ps1"

pause