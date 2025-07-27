@echo off
echo ========================================
echo     ONE.FILER with ProjFS Integration
echo ========================================
echo.

rem Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  WARNING: Not running as Administrator
    echo    First-time setup requires admin privileges
    echo    to register the ProjectedFS provider.
    echo.
    pause
)

rem Set environment variables
if not defined ONE_DIRECTORY (
    set ONE_DIRECTORY=%USERPROFILE%\.one-data
    echo ℹ️  Using default data directory: %ONE_DIRECTORY%
)

if not defined ONE_SECRET (
    set ONE_SECRET=development-secret-please-change
    echo ⚠️  Using default development secret
)

if not defined PROJFS_ROOT (
    set PROJFS_ROOT=C:\OneFiler
    echo ℹ️  Virtual drive will be created at: %PROJFS_ROOT%
)

echo.
echo 📦 Building TypeScript...
cd /d "%~dp0"
call npm run build:ts
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo 🚀 Starting ONE.filer with ProjFS...
echo.

node dist/examples/full-stack-integration.js

pause