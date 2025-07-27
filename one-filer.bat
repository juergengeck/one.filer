@echo off
setlocal enabledelayedexpansion

:: Change to script directory to handle "Run as Administrator" correctly
cd /d "%~dp0"

:: ONE Filer - Unified Entry Point
:: ================================
:: Usage: one-filer.bat [command] [options]
::
:: Commands:
::   start       - Start ONE Filer with FUSE mount (default)
::   no-fuse     - Start without FUSE mounting
::   demo        - Start with demo configuration
::   ui          - Launch Electron UI
::   init        - Initialize ONE instance
::   test        - Run tests
::   help        - Show this help

set "COMMAND=%~1"
if "%COMMAND%"=="" set "COMMAND=start"

:: Handle commands
if /i "%COMMAND%"=="help" goto :show_help
if /i "%COMMAND%"=="start" goto :start_filer
if /i "%COMMAND%"=="setup" goto :setup_instance
if /i "%COMMAND%"=="no-fuse" goto :start_no_fuse
if /i "%COMMAND%"=="demo" goto :start_demo
if /i "%COMMAND%"=="ui" goto :start_ui
if /i "%COMMAND%"=="init" goto :init_instance
if /i "%COMMAND%"=="test" goto :run_tests

echo Error: Unknown command "%COMMAND%"
goto :show_help

:start_filer
:: Start ONE Filer with FUSE mount (via Electron UI)
echo Starting ONE Filer...
cd electron-app

:: Check if dist folder exists (app is built)
if not exist "dist\main.js" (
    echo First time setup - building Electron app...
    call npm run build
)

start npm start
cd ..
goto :end

:start_no_fuse
:: Start without FUSE mounting
echo Starting ONE Filer without FUSE...
echo Press Ctrl+C to stop
echo.
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && exec npm start -- --config configs/filer.json --one:filer:fuse:enabled=false"
pause
goto :end

:start_demo
:: Start with demo configuration
echo Starting ONE Filer with demo configuration...
echo Press Ctrl+C to stop
echo.
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && exec npm start -- --config configs/demo-config.json"
pause
goto :end

:setup_instance
:: Set up complete instance
call scripts\setup-instance.bat
goto :end

:start_ui
:: Launch Electron UI
echo Launching ONE Filer Electron UI...
cd electron-app
call npm start
cd ..
goto :end

:init_instance
:: Initialize ONE instance
echo Initializing ONE instance...
shift
call scripts\init.bat %*
goto :end

:run_tests
:: Run tests
echo Running tests...
shift
call scripts\test.bat %*
goto :end

:show_help
echo.
echo ONE Filer - Unified Entry Point
echo ================================
echo.
echo Usage: one-filer.bat [command] [options]
echo.
echo Commands:
echo   start [config]           - Start ONE Filer with FUSE mount (default)
echo   setup                    - Set up new instance with all recipes
echo   no-fuse                  - Start without FUSE mounting  
echo   demo                     - Start with demo configuration
echo   ui                       - Launch Electron UI
echo   init [type]              - Initialize ONE instance (demo/full)
echo   test [type]              - Run tests (unit/fuse/integration)
echo   help                     - Show this help
echo.
echo Examples:
echo   one-filer.bat setup                    - First-time setup
echo   one-filer.bat                          - Start with default config
echo   one-filer.bat demo                     - Start demo instance
echo   one-filer.bat test fuse                - Run FUSE tests
echo.

:end
endlocal