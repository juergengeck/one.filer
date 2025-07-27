@echo off
REM ONE Filer Unified Installer Batch Wrapper
REM This makes it easy for users to run the PowerShell installer

echo ====================================
echo   ONE Filer Unified Installer
echo ====================================
echo.
echo This installer will set up:
echo   - WSL2 with Debian
echo   - ONE Filer replicant service
echo   - Windows control application
echo   - System tray integration
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause > nul

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: This installer must be run as Administrator.
    echo.
    echo Please right-click on this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Run the PowerShell installer
echo.
echo Starting installation...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-one-filer-unified.ps1" %*

echo.
echo Installation script completed.
echo.
pause