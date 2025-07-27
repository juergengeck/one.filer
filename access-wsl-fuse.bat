@echo off
REM Access WSL FUSE mount from Windows
REM This script starts one.filer in WSL and maps it to a Windows drive

echo =====================================================
echo ONE.filer WSL FUSE Access for Windows
echo =====================================================
echo.

REM Check if WSL is running
echo Checking WSL status...
wsl -l -v | findstr "Ubuntu.*Running" >nul
if %errorlevel% NEQ 0 (
    echo Starting WSL Ubuntu...
    wsl -d Ubuntu echo WSL Started
)

REM Check if one.filer is running in WSL
echo.
echo Checking if one.filer is running in WSL...
wsl -d Ubuntu -- bash -c "ps aux | grep 'node.*filer' | grep -v grep" >nul 2>&1
if %errorlevel% NEQ 0 (
    echo one.filer is not running. Starting it now...
    echo.
    
    REM Start one.filer in WSL (in background)
    start "ONE.filer WSL" cmd /c "wsl -d Ubuntu -- bash -c \"cd /mnt/c/Users/juerg/source/one.filer && npm start -- start --config configs/filer-wsl-accessible.json\""
    
    echo Waiting for one.filer to start (15 seconds)...
    timeout /t 15 /nobreak >nul
) else (
    echo one.filer is already running in WSL
)

REM Test access to WSL filesystem
echo.
echo Testing WSL filesystem access...
if exist "\\wsl.localhost\Ubuntu\home\gecko\one-files" (
    echo SUCCESS: Can access mount point
) else (
    echo ERROR: Cannot access mount point at \\wsl.localhost\Ubuntu\home\gecko\one-files
    echo Make sure one.filer is running with FUSE enabled
    pause
    exit /b 1
)

REM Remove existing drive mapping
echo.
echo Removing any existing O: drive mapping...
net use O: /delete /y >nul 2>&1

REM Map the drive
echo Mapping WSL FUSE mount to drive O:...
net use O: "\\wsl.localhost\Ubuntu\home\gecko\one-files" /persistent:yes

if %errorlevel% == 0 (
    echo.
    echo =====================================================
    echo SUCCESS! ONE.filer is accessible as drive O:
    echo =====================================================
    echo.
    echo Opening drive O: in Windows Explorer...
    explorer O:\
    echo.
    echo Directory contents:
    dir O:\ /w
) else (
    echo.
    echo ERROR: Failed to map drive
    echo.
    echo Troubleshooting tips:
    echo 1. Make sure one.filer is running in WSL with FUSE support
    echo 2. Check that /home/gecko/one-files exists in WSL
    echo 3. Verify Windows can access \\wsl.localhost\Ubuntu
    echo 4. Try running this script as Administrator
)

echo.
pause