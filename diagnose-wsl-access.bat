@echo off
echo =====================================================
echo WSL Access Diagnostics
echo =====================================================
echo.

echo 1. Checking WSL status...
wsl -l -v
echo.

echo 2. Testing basic WSL command...
wsl -d Ubuntu -- echo "WSL is responding"
echo.

echo 3. Checking WSL network service...
sc query LxssManager >nul 2>&1
if %errorlevel% == 0 (
    echo WSL service (LxssManager) is installed
    sc query LxssManager | findstr "RUNNING" >nul
    if %errorlevel% == 0 (
        echo WSL service is RUNNING
    ) else (
        echo WSL service is NOT running - trying to start it...
        net start LxssManager
    )
) else (
    echo WSL service not found
)
echo.

echo 4. Testing WSL$ share access...
echo Trying to access: \\wsl$\Ubuntu
dir "\\wsl$\Ubuntu" >nul 2>&1
if %errorlevel% == 0 (
    echo SUCCESS: Can access \\wsl$\Ubuntu
    echo.
    echo 5. Listing Ubuntu home directory...
    dir "\\wsl$\Ubuntu\home" 2>nul
) else (
    echo FAILED: Cannot access \\wsl$\Ubuntu
    echo.
    echo Trying alternative: \\wsl.localhost\Ubuntu
    dir "\\wsl.localhost\Ubuntu" >nul 2>&1
    if %errorlevel% == 0 (
        echo SUCCESS: Can access \\wsl.localhost\Ubuntu
    ) else (
        echo FAILED: Cannot access \\wsl.localhost\Ubuntu either
    )
)

echo.
echo 6. Checking Windows features...
dism /online /get-features | findstr /i "VirtualMachinePlatform" | findstr "Enabled" >nul
if %errorlevel% == 0 (
    echo Virtual Machine Platform: Enabled
) else (
    echo Virtual Machine Platform: NOT enabled or not found
)

dism /online /get-features | findstr /i "Microsoft-Windows-Subsystem-Linux" | findstr "Enabled" >nul
if %errorlevel% == 0 (
    echo Windows Subsystem for Linux: Enabled
) else (
    echo Windows Subsystem for Linux: NOT enabled or not found
)

echo.
echo 7. Testing localhost access...
ping -n 1 localhost >nul 2>&1
if %errorlevel% == 0 (
    echo Localhost ping: SUCCESS
) else (
    echo Localhost ping: FAILED
)

echo.
pause