@echo off
echo 🧪 ProjFS.ONE Test Runner (Windows)
echo.

echo 📦 Compiling TypeScript...
call npx tsc
if %errorlevel% neq 0 (
    echo ❌ TypeScript compilation failed
    exit /b 1
)
echo ✅ TypeScript compilation successful
echo.

echo 🧪 Running Unit Tests...
echo ────────────────────────────────────────────────────────
call npx mocha "dist/test/unit/**/*.test.js" --timeout 5000
if %errorlevel% neq 0 (
    echo ❌ Unit tests failed
    set FAILED=1
)

if exist "dist\test\integration" (
    echo.
    echo 🧪 Running Integration Tests...
    echo ────────────────────────────────────────────────────────
    call npx mocha "dist/test/integration/**/*.test.js" --timeout 30000
    if %errorlevel% neq 0 (
        echo ❌ Integration tests failed
        set FAILED=1
    )
)

if exist "dist\test\performance" (
    echo.
    echo 🧪 Running Performance Tests...
    echo ────────────────────────────────────────────────────────
    call npx mocha "dist/test/performance/**/*.test.js" --timeout 60000
    if %errorlevel% neq 0 (
        echo ❌ Performance tests failed
        set FAILED=1
    )
)

echo.
echo 📊 Test Summary
echo ════════════════════════════════════════════════════════

if defined FAILED (
    echo ❌ Some tests failed
    exit /b 1
) else (
    echo ✅ All tests passed!
    exit /b 0
)