@echo off
echo =====================================================
echo Simple WSL FUSE Drive Mapper
echo =====================================================
echo.

REM Just try to map the drive directly
echo Removing any existing O: drive...
net use O: /delete /y >nul 2>&1

echo.
echo Mapping WSL FUSE mount to drive O:...
net use O: "\\wsl$\Ubuntu\home\gecko\one-files" /persistent:yes

if %errorlevel% == 0 (
    echo.
    echo SUCCESS! Drive O: is now mapped.
    echo.
    echo Opening in Explorer...
    explorer O:\
) else (
    echo.
    echo ERROR: Failed to map drive.
    echo.
    echo The WSL path may not be accessible. Make sure:
    echo 1. WSL is running (Ubuntu)
    echo 2. The path /home/gecko/one-files exists
    echo 3. one.filer is running with FUSE mount
)

echo.
pause