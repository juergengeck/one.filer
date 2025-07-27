@echo off
cls
echo ========================================
echo  ONE.filer Windows Access Fix
echo ========================================
echo.

echo Step 1: Restarting WSL2...
wsl --shutdown
timeout /t 3 /nobreak >nul
echo WSL2 restarted.
echo.

echo Step 2: Testing WSL2 access...
wsl -d Ubuntu echo "Ubuntu WSL2 is accessible"
if %errorlevel% neq 0 (
    echo ERROR: Cannot access Ubuntu WSL2
    pause
    exit /b 1
)
echo.

echo Step 3: Setting up project in Ubuntu...
wsl -d Ubuntu bash -c "mkdir -p /home/gecko/one.filer && cd /home/gecko/one.filer && echo 'Directory ready'"
echo.

echo Step 4: Copying project files to Ubuntu...
wsl -d Ubuntu bash -c "cd /home/gecko && cp -r /mnt/c/Users/juerg/source/one.filer/* ./one.filer/ 2>/dev/null || echo 'Files already present'"
echo.

echo Step 5: Running FUSE fix script...
wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && chmod +x fix-windows-access.sh && ./fix-windows-access.sh"
echo.

echo Step 6: Testing Windows access...
timeout /t 5 /nobreak >nul
echo Checking Windows access to \\wsl.localhost\Ubuntu\mnt\one-files
dir "\\wsl.localhost\Ubuntu\mnt\one-files" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo  SUCCESS! Windows access working!
    echo ========================================
    echo.
    echo Open Windows Explorer and navigate to:
    echo \\wsl.localhost\Ubuntu\mnt\one-files
    echo.
) else (
    echo.
    echo ========================================
    echo  Access test failed - manual check needed
    echo ========================================
    echo.
    echo Try manually opening Windows Explorer to:
    echo \\wsl.localhost\Ubuntu\mnt\one-files
    echo.
)

echo Press any key to continue...
pause >nul 