@echo off
echo =====================================================
echo WSL FUSE Access - Alternative Methods
echo =====================================================
echo.

REM Method 1: Try wsl.localhost syntax (Windows 11)
echo Method 1: Trying wsl.localhost syntax...
net use O: /delete /y >nul 2>&1
net use O: "\\wsl.localhost\Ubuntu\home\gecko\one-files" /persistent:yes >nul 2>&1
if %errorlevel% == 0 (
    echo SUCCESS with wsl.localhost!
    explorer O:\
    goto :end
)

REM Method 2: Try direct path mapping
echo Method 2: Trying direct path with pushd...
pushd "\\wsl$\Ubuntu\home\gecko\one-files" >nul 2>&1
if %errorlevel% == 0 (
    echo SUCCESS: Accessed via pushd - Current dir: %CD%
    popd
    goto :end
)

REM Method 3: Try restarting WSL
echo Method 3: Restarting WSL...
echo Shutting down WSL...
wsl --shutdown
timeout /t 3 /nobreak >nul
echo Starting WSL...
wsl -d Ubuntu -- echo "WSL Started"
timeout /t 5 /nobreak >nul

echo Trying to map again...
net use O: "\\wsl$\Ubuntu\home\gecko\one-files" /persistent:yes
if %errorlevel% == 0 (
    echo SUCCESS after WSL restart!
    explorer O:\
    goto :end
)

REM Method 4: Create symbolic link in Windows
echo Method 4: Creating junction point...
if exist "C:\ONE-Files" rmdir "C:\ONE-Files" >nul 2>&1
mklink /J "C:\ONE-Files" "\\wsl$\Ubuntu\home\gecko\one-files" >nul 2>&1
if %errorlevel% == 0 (
    echo SUCCESS: Created junction at C:\ONE-Files
    explorer "C:\ONE-Files"
    goto :end
)

echo.
echo All methods failed. Please run diagnose-wsl-access.bat for details.

:end
echo.
pause