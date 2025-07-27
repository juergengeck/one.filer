@echo off
echo ========================================
echo Running Windows FUSE (ProjFS) Tests
echo ========================================
echo.

REM Check if running as admin (required for ProjFS)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Administrator privileges required for ProjFS tests
    echo Please run this script as Administrator
    exit /b 1
)

REM Check if ProjFS is available
where PrjFlt.dll >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: ProjFS not found on this system
    echo Please ensure Windows 10 version 1809 or later with ProjFS enabled
    exit /b 1
)

REM Set up test environment
set NODE_ENV=test
set DEBUG=fuse:*,projfs:*

REM Clean any existing test mounts
echo Cleaning up any existing test mounts...
if exist C:\FuseTest rmdir /s /q C:\FuseTest 2>nul
if exist C:\FuseXPlatTest rmdir /s /q C:\FuseXPlatTest 2>nul

REM Run the tests
echo.
echo Running FUSE tests on Windows...
echo.

npx mocha --config test/mocha.opts.windows

REM Clean up after tests
echo.
echo Cleaning up test mounts...
if exist C:\FuseTest rmdir /s /q C:\FuseTest 2>nul
if exist C:\FuseXPlatTest rmdir /s /q C:\FuseXPlatTest 2>nul

echo.
echo ========================================
echo Test run complete
echo ========================================