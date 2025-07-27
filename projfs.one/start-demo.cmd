@echo off
echo 🚀 Starting ProjFS.ONE Demo
echo.

echo 📦 Building TypeScript...
call npm run build:ts
if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)

echo.
echo ✅ Build successful
echo.
echo 🔧 Starting virtual filesystem...
echo.

node dist/examples/basic-mount.js