@echo off
echo ================================================
echo 🎯 Task 7: Windows Integration Test Runner
echo ================================================
echo.

echo 📋 Step 1: Validate Configuration...
wsl node -e "
try {
    const config = require('./configs/filer-windows-bridge.json');
    console.log('✅ Configuration loaded successfully');
    console.log('✅ Mount point:', config.filerConfig.mountPoint);
    console.log('✅ Windows integration enabled:', config.filerConfig.windowsIntegration?.enabled);
    console.log('✅ WSL2 mode:', config.filerConfig.windowsIntegration?.wsl2Mode);
    console.log('✅ Windows mount point:', config.filerConfig.windowsIntegration?.windowsMountPoint);
    console.log('✅ FUSE options:', JSON.stringify(config.filerConfig.fuseOptions));
} catch (e) {
    console.error('❌ Configuration error:', e.message);
    process.exit(1);
}
"

if %errorlevel% neq 0 (
    echo ❌ Configuration validation failed
    pause
    exit /b 1
)

echo.
echo 📁 Step 2: Setup Environment...
echo Ensuring mount point exists...
wsl sudo mkdir -p /mnt/c/one-files
wsl sudo chmod 755 /mnt/c/one-files

echo ✅ Mount point prepared: /mnt/c/one-files
echo ✅ Expected Windows access: C:\one-files\

echo.
echo 🔧 Step 3: Build Project...
echo Building ONE.filer...
wsl npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo ✅ Build successful

echo.
echo 🚀 Step 4: Start Windows Integration Test...
echo Starting filer with Windows integration for 30 seconds...
echo.

wsl timeout 30s node dist/one.filer.js --config-file=configs/filer-windows-bridge.json 2>&1 | findstr /i "windows integration mount fuse started"

echo.
echo 🪟 Step 5: Test Windows Access...
echo Checking if C:\one-files is accessible...

timeout /t 5 /nobreak > nul

if exist "C:\one-files" (
    echo ✅ C:\one-files exists
    dir "C:\one-files" > nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ C:\one-files is accessible from Windows
        echo 📂 Contents:
        dir "C:\one-files"
        
        echo.
        echo 🧪 Testing file creation...
        echo test-content > "C:\one-files\test-from-windows.txt" 2>nul
        if %errorlevel% equ 0 (
            echo ✅ Successfully created file from Windows
        ) else (
            echo ⚠️  Could not create file from Windows
        )
    ) else (
        echo ⚠️  C:\one-files exists but is not accessible
    )
) else (
    echo ⚠️  C:\one-files not accessible from Windows
    echo 💡 Try alternative access: \\wsl$\Debian\mnt\one-files
)

echo.
echo ================================================
echo 🎯 Task 7 Windows Integration Test Complete
echo ================================================
echo.
echo 📊 Summary:
echo - Configuration: ✅ Validated
echo - Build: ✅ Successful  
echo - Windows Integration: Tested
echo.
echo 💡 Manual verification steps:
echo 1. Open Windows Explorer
echo 2. Navigate to C:\one-files\
echo 3. Look for folders: debug, invites, objects, types
echo 4. Try file operations
echo.
pause 