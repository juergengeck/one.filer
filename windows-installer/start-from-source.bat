@echo off
echo Starting ONE Filer from Source
echo =================================
echo.

echo Creating mount directory...
mkdir "C:\Users\%USERNAME%\OneFiler" 2>nul

echo Checking WSL Ubuntu...
wsl -d Ubuntu --exec echo "Ubuntu is accessible"
if %errorlevel% neq 0 (
    echo ERROR: Ubuntu not accessible
    pause
    exit /b 1
)

echo Creating WSL mount directory...
wsl -d Ubuntu --exec mkdir -p /mnt/c/Users/%USERNAME%/OneFiler

echo Starting ONE Filer from source...
echo Mount point: C:\Users\%USERNAME%\OneFiler
echo.
echo Press Ctrl+C to stop ONE Filer
echo.

wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm start -- --mount /mnt/c/Users/%USERNAME%/OneFiler"

pause