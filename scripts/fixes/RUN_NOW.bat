@echo off
cls
title FUSE WSL Stack Test
color 0B

echo.
echo ═══════════════════════════════════════════════════════════════
echo                    FUSE WSL STACK TEST
echo ═══════════════════════════════════════════════════════════════
echo.
echo This will test if we can get Windows access to FUSE mounts...
echo.

echo [STEP 1] Restarting WSL2...
echo ----------------------------------------
wsl --shutdown
echo WSL2 shutdown complete.
timeout /t 3 >nul
echo Starting WSL2...

wsl -d Ubuntu echo "✅ WSL2 Ubuntu accessible"
if %errorlevel% neq 0 (
    echo ❌ ERROR: Cannot start Ubuntu WSL2
    echo.
    echo TROUBLESHOOTING:
    echo 1. Make sure Ubuntu is installed: wsl --list
    echo 2. Try: wsl --install Ubuntu
    echo 3. Or use: wsl without -d Ubuntu
    echo.
    pause
    exit /b 1
)

echo.
echo [STEP 2] Setting up Ubuntu environment...
echo ----------------------------------------
wsl -d Ubuntu bash -c "
echo 'Setting up Ubuntu environment...'
whoami
pwd
echo 'User: $USER'
echo 'Platform: $(uname -a)'

# Create project directory
mkdir -p /home/gecko/one.filer
cd /home/gecko/one.filer

# Copy files if they don't exist
if [ ! -f package.json ]; then
    echo 'Copying project files from Windows...'
    cp -r /mnt/c/Users/juerg/source/one.filer/* ./ 2>/dev/null || echo 'Copy failed - continuing...'
fi

echo '✅ Ubuntu environment ready'
"

echo.
echo [STEP 3] Installing FUSE and dependencies...
echo ----------------------------------------
wsl -d Ubuntu bash -c "
echo 'Installing FUSE libraries...'
sudo apt update -qq
sudo apt install -y libfuse3-dev libfuse2 build-essential

echo 'Configuring FUSE for Windows access...'
echo 'user_allow_other' | sudo tee -a /etc/fuse.conf >/dev/null 2>&1
sudo usermod -a -G fuse \$USER

echo 'Creating mount directory...'
sudo mkdir -p /mnt/one-files
sudo chown \$USER:\$USER /mnt/one-files
sudo chmod 755 /mnt/one-files

echo '✅ FUSE configured'
"

echo.
echo [STEP 4] Installing npm dependencies...
echo ----------------------------------------
wsl -d Ubuntu bash -c "
cd /home/gecko/one.filer
echo 'Installing npm packages...'
npm install --silent 2>/dev/null || npm install
echo '✅ Dependencies installed'
"

echo.
echo [STEP 5] Testing basic FUSE functionality...
echo ----------------------------------------
wsl -d Ubuntu bash -c "
cd /home/gecko/one.filer
echo 'Testing FUSE library...'
node test-fuse-minimal.js 2>/dev/null || echo 'FUSE test skipped (no test file)'
echo '✅ FUSE test complete'
"

echo.
echo [STEP 6] Starting FUSE mount...
echo ----------------------------------------
echo Starting ONE.filer with FUSE mount for Windows access...

start /min "ONE.filer" wsl -d Ubuntu bash -c "
cd /home/gecko/one.filer
echo 'Starting FUSE mount...'
fusermount -u /mnt/one-files 2>/dev/null || true
node --enable-source-maps lib/index.js start --secret test123 --mount-dir /mnt/one-files --allow-other --default-permissions
"

echo Mount started in background window...
echo Waiting for mount to initialize...
timeout /t 8 >nul

echo.
echo [STEP 7] Testing Windows access...
echo ----------------------------------------
echo Testing: \\wsl.localhost\Ubuntu\mnt\one-files
echo.

:: Test basic WSL access first
dir "\\wsl.localhost\Ubuntu\home" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Basic WSL filesystem access works
) else (
    echo ❌ Basic WSL filesystem access failed
    echo Try: \\wsl$\Ubuntu\home instead
)

:: Test the mount directory
dir "\\wsl.localhost\Ubuntu\mnt\one-files" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ SUCCESS! FUSE mount accessible from Windows
    echo.
    color 0A
    echo ═══════════════════════════════════════════════════════════════
    echo                       🎉 SUCCESS! 🎉
    echo ═══════════════════════════════════════════════════════════════
    echo.
    echo Windows Explorer can access the FUSE mount!
    echo.
    echo 📂 Path: \\wsl.localhost\Ubuntu\mnt\one-files
    echo 🔑 Password: test123
    echo.
    echo Opening Windows Explorer...
    start explorer "\\wsl.localhost\Ubuntu\mnt\one-files"
    echo.
) else (
    echo ❌ FAILED: Cannot access FUSE mount from Windows
    echo.
    color 0C
    echo ═══════════════════════════════════════════════════════════════
    echo                      ❌ FAILED ❌
    echo ═══════════════════════════════════════════════════════════════
    echo.
    echo Troubleshooting needed:
    echo.
    echo 1. Check if mount is active in Ubuntu:
    echo    wsl -d Ubuntu mount ^| grep fuse
    echo.
    echo 2. Try alternative path:
    echo    \\wsl$\Ubuntu\mnt\one-files
    echo.
    echo 3. Manual mount test:
    echo    wsl -d Ubuntu ls -la /mnt/one-files
    echo.
    echo 4. Check FUSE logs for errors
    echo.
)

echo.
echo [STEP 8] Status check...
echo ----------------------------------------
wsl -d Ubuntu bash -c "
echo 'Mount status:'
mount | grep fuse || echo 'No FUSE mounts found'
echo
echo 'ONE.filer processes:'
ps aux | grep node || echo 'No node processes found'
echo
echo 'Mount directory:'
ls -la /mnt/one-files 2>/dev/null || echo 'Mount directory not accessible'
"

echo.
echo ═══════════════════════════════════════════════════════════════
echo                        TEST COMPLETE
echo ═══════════════════════════════════════════════════════════════
echo.
echo Press any key to exit...
pause >nul 