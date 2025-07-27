@echo off
echo Building simplified native module...
echo.

node-gyp rebuild --binding=binding_simple.gyp

if %errorlevel% equ 0 (
    echo.
    echo ✅ Simple build successful!
    echo.
    echo This means your build environment is working correctly.
    echo The issue is specifically with the ProjectedFS headers.
    echo.
    echo Next steps:
    echo 1. Check Windows SDK version
    echo 2. Enable ProjectedFS feature in Windows
    echo 3. Verify ProjectedFSLib.h exists
) else (
    echo.
    echo ❌ Simple build failed.
    echo.
    echo This indicates a general build environment issue.
    echo Please check:
    echo 1. Visual Studio 2022 is installed
    echo 2. node-gyp is properly configured
    echo 3. Python is accessible
)

pause