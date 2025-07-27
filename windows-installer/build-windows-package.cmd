@echo off
echo 🔨 Building ONE Filer Windows Package
echo ====================================
echo.

REM Check if we're in the right directory
if not exist "..\package.json" (
    echo ❌ Error: This script must be run from the windows-installer directory
    pause
    exit /b 1
)

cd ..

REM Create package directory
echo 📁 Creating package directory...
if exist "windows-package" rmdir /s /q "windows-package"
mkdir "windows-package"
mkdir "windows-package\installer"
mkdir "windows-package\wsl-files"

REM Copy installer files
echo 📋 Copying installer files...
copy "windows-installer\*.ps1" "windows-package\installer\"
copy "windows-installer\*.bat" "windows-package\installer\"
copy "windows-installer\README.md" "windows-package\"

REM Package one.filer source
echo 📦 Packaging one.filer...
mkdir "windows-package\wsl-files\one.filer"
xcopy /E /I /Y "src" "windows-package\wsl-files\one.filer\src"
xcopy /E /I /Y "lib" "windows-package\wsl-files\one.filer\lib"
xcopy /E /I /Y "configs" "windows-package\wsl-files\one.filer\configs"
xcopy /E /I /Y "scripts" "windows-package\wsl-files\one.filer\scripts"
xcopy /E /I /Y "test" "windows-package\wsl-files\one.filer\test"
copy "package.json" "windows-package\wsl-files\one.filer\"
copy "tsconfig.json" "windows-package\wsl-files\one.filer\"
copy "*.md" "windows-package\wsl-files\one.filer\"

REM Copy vendor packages
echo 📦 Copying vendor packages...
mkdir "windows-package\wsl-files\one.filer\vendor"
copy "vendor\*.tgz" "windows-package\wsl-files\one.filer\vendor\"

REM Create setup script for WSL
echo 📝 Creating WSL setup script...
(
echo #!/bin/bash
echo set -e
echo echo "🚀 Setting up ONE Filer in Ubuntu WSL2..."
echo cd /home/$USER/one.filer
echo echo "📦 Installing system dependencies..."
echo sudo apt-get update
echo sudo apt-get install -y nodejs npm build-essential python3 git libfuse3-dev fuse3
echo echo "📦 Installing Node.js dependencies..."
echo npm install
echo echo "🔧 Setting up FUSE permissions..."
echo sudo chmod 666 /dev/fuse
echo echo "✅ ONE Filer setup complete!"
) > "windows-package\wsl-files\setup-one-filer.sh"

REM Convert to Unix line endings
powershell -Command "(Get-Content 'windows-package\wsl-files\setup-one-filer.sh') -join \"`n\" | Set-Content -NoNewline 'windows-package\wsl-files\setup-one-filer.sh'"

echo.
echo ✅ Windows package created successfully!
echo 📁 Package location: windows-package\
echo.
echo 📋 Package contents:
echo    - installer\         Windows installer scripts
echo    - wsl-files\         Files to be deployed to WSL
echo    - README.md          Installation guide
echo.
cd windows-installer
pause