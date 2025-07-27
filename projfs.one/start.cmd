@echo off
echo 🚀 ProjFS.ONE Launcher
echo.

echo Choose demo mode:
echo 1. Development Demo (Core functionality)
echo 2. Full Demo (Windows ProjectedFS simulation)
echo 3. Run Tests
echo 4. Build Project
echo.

set /p choice="Enter choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo 🛠️ Starting Development Demo...
    call npm run build:ts
    node dist/examples/dev-demo.js
    goto end
)

if "%choice%"=="2" (
    echo.
    echo 🔧 Starting Full Demo...
    call npm run build:ts
    node dist/examples/demo-mode.js
    goto end
)

if "%choice%"=="3" (
    echo.
    echo 🧪 Running Tests...
    call run-tests.cmd
    goto end
)

if "%choice%"=="4" (
    echo.
    echo 📦 Building Project...
    call npm run build
    goto end
)

echo Invalid choice. Please run again.

:end
echo.
pause