# ONE Filer Unified Installer for Windows
# This script installs WSL2, ONE Filer replicant, and the Electron control app

param(
    [string]$InstallPath = "C:\Program Files\ONE Filer",
    [string]$WSLDistro = "ONE-Debian",
    [string]$MountPoint = "Z:",
    [bool]$SkipWSLSetup = $false,
    [bool]$InstallAsService = $true,
    [bool]$AutoStart = $true
)

# Ensure running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Exiting..."
    exit 1
}

Write-Host "=== ONE Filer Unified Installer ===" -ForegroundColor Cyan
Write-Host ""

# Create installation directory
Write-Host "Creating installation directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallPath\electron-app" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallPath\replicant" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallPath\scripts" | Out-Null

# Step 1: Setup WSL2 if needed
if (-not $SkipWSLSetup) {
    Write-Host ""
    Write-Host "Step 1: Setting up WSL2..." -ForegroundColor Green
    
    # Enable WSL feature
    Write-Host "Enabling Windows Subsystem for Linux..." -ForegroundColor Yellow
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    
    # Enable Virtual Machine Platform
    Write-Host "Enabling Virtual Machine Platform..." -ForegroundColor Yellow
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    
    # Set WSL2 as default
    Write-Host "Setting WSL2 as default..." -ForegroundColor Yellow
    wsl --set-default-version 2
    
    # Install Debian
    Write-Host "Installing Debian distribution..." -ForegroundColor Yellow
    wsl --install -d Debian
    
    # Wait for installation
    Write-Host "Waiting for WSL installation to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Step 2: Setup ONE Filer in WSL
Write-Host ""
Write-Host "Step 2: Setting up ONE Filer in WSL..." -ForegroundColor Green

# Create setup script for WSL
$wslSetupScript = @'
#!/bin/bash
set -e

echo "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm git build-essential fuse libfuse2

echo "Creating directories..."
sudo mkdir -p /opt/one-filer
sudo mkdir -p /var/log/one-filer
sudo mkdir -p /etc/one-filer

echo "Cloning ONE Filer repository..."
cd /opt
sudo git clone https://github.com/refinio/one.filer.git one-filer-source || true

echo "Installing ONE Filer..."
cd /opt/one-filer-source
sudo npm install
sudo npm run build

echo "Creating systemd service..."
sudo tee /etc/systemd/system/one-filer.service > /dev/null << EOF
[Unit]
Description=ONE Filer Replicant Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/one-filer-source
ExecStart=/usr/bin/node /opt/one-filer-source/dist/index.js start -s PLACEHOLDER_SECRET
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/one-filer/replicant.log
StandardError=append:/var/log/one-filer/replicant-error.log

[Install]
WantedBy=multi-user.target
EOF

echo "Setup complete!"
'@

# Save and execute setup script
$wslSetupScript | Out-File -FilePath "$InstallPath\scripts\wsl-setup.sh" -Encoding UTF8
wsl -d Debian -- bash /mnt/c/Program\ Files/ONE\ Filer/scripts/wsl-setup.sh

# Step 3: Build and install Electron app
Write-Host ""
Write-Host "Step 3: Building Electron control app..." -ForegroundColor Green

# Copy electron app source
Write-Host "Copying Electron app source..." -ForegroundColor Yellow
Copy-Item -Path ".\electron-app\*" -Destination "$InstallPath\electron-app" -Recurse -Force

# Build electron app
Write-Host "Building Electron app..." -ForegroundColor Yellow
Push-Location "$InstallPath\electron-app"
npm install
npm run build
npm run build-win
Pop-Location

# Copy built app to installation directory
Write-Host "Installing Electron app..." -ForegroundColor Yellow
Copy-Item -Path "$InstallPath\electron-app\dist-app\*" -Destination "$InstallPath" -Recurse -Force

# Step 4: Create management scripts
Write-Host ""
Write-Host "Step 4: Creating management scripts..." -ForegroundColor Green

# Create start script
$startScript = @"
@echo off
echo Starting ONE Filer...

REM Start WSL if not running
wsl --list --running | findstr "$WSLDistro" > nul
if errorlevel 1 (
    echo Starting WSL...
    wsl -d $WSLDistro -e echo "WSL Started"
)

REM Start the Electron app
start "" "%ProgramFiles%\ONE Filer\ONE Filer Login.exe"
"@

$startScript | Out-File -FilePath "$InstallPath\start-one-filer.bat" -Encoding ASCII

# Create stop script
$stopScript = @"
@echo off
echo Stopping ONE Filer...

REM Stop the replicant in WSL
wsl -d $WSLDistro -e sudo systemctl stop one-filer

REM Kill any running Electron app
taskkill /F /IM "ONE Filer Login.exe" 2>nul

echo ONE Filer stopped.
"@

$stopScript | Out-File -FilePath "$InstallPath\stop-one-filer.bat" -Encoding ASCII

# Create update script
$updateScript = @'
@echo off
echo Updating ONE Filer...

REM Stop services
call "%ProgramFiles%\ONE Filer\stop-one-filer.bat"

REM Update replicant in WSL
wsl -d ONE-Debian -e bash -c "cd /opt/one-filer-source && sudo git pull && sudo npm install && sudo npm run build"

REM Update Electron app
cd "%ProgramFiles%\ONE Filer\electron-app"
npm update
npm run build

echo Update complete. Restarting ONE Filer...
call "%ProgramFiles%\ONE Filer\start-one-filer.bat"
'@

$updateScript | Out-File -FilePath "$InstallPath\update-one-filer.bat" -Encoding ASCII

# Step 5: Create Windows Service (optional)
if ($InstallAsService) {
    Write-Host ""
    Write-Host "Step 5: Creating Windows Service..." -ForegroundColor Green
    
    # Create service wrapper script
    $serviceScript = @"
# ONE Filer Service Wrapper
`$serviceName = "ONEFilerService"
`$displayName = "ONE Filer Service"
`$description = "Manages ONE Filer replicant and control app"
`$startScript = "$InstallPath\start-one-filer.bat"

# Create service using NSSM (Non-Sucking Service Manager)
# Download NSSM if not present
if (-not (Test-Path "$InstallPath\nssm.exe")) {
    Write-Host "Downloading NSSM..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$InstallPath\nssm.zip"
    Expand-Archive -Path "$InstallPath\nssm.zip" -DestinationPath "$InstallPath\nssm-temp"
    Copy-Item -Path "$InstallPath\nssm-temp\nssm-2.24\win64\nssm.exe" -Destination "$InstallPath"
    Remove-Item -Path "$InstallPath\nssm.zip" -Force
    Remove-Item -Path "$InstallPath\nssm-temp" -Recurse -Force
}

# Install service
& "$InstallPath\nssm.exe" install `$serviceName "$InstallPath\start-one-filer.bat"
& "$InstallPath\nssm.exe" set `$serviceName DisplayName `$displayName
& "$InstallPath\nssm.exe" set `$serviceName Description `$description
& "$InstallPath\nssm.exe" set `$serviceName Start SERVICE_AUTO_START
"@

    $serviceScript | Invoke-Expression
}

# Step 6: Create shortcuts
Write-Host ""
Write-Host "Step 6: Creating shortcuts..." -ForegroundColor Green

# Desktop shortcut
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\ONE Filer.lnk")
$Shortcut.TargetPath = "$InstallPath\ONE Filer Login.exe"
$Shortcut.IconLocation = "$InstallPath\ONE Filer Login.exe,0"
$Shortcut.Save()

# Start menu shortcut
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path "$startMenuPath\ONE Filer" | Out-Null
$Shortcut = $WshShell.CreateShortcut("$startMenuPath\ONE Filer\ONE Filer.lnk")
$Shortcut.TargetPath = "$InstallPath\ONE Filer Login.exe"
$Shortcut.IconLocation = "$InstallPath\ONE Filer Login.exe,0"
$Shortcut.Save()

# Auto-start shortcut (if requested)
if ($AutoStart) {
    $Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\ONE Filer.lnk")
    $Shortcut.TargetPath = "$InstallPath\ONE Filer Login.exe"
    $Shortcut.IconLocation = "$InstallPath\ONE Filer Login.exe,0"
    $Shortcut.Save()
}

# Step 7: Configure system tray integration
Write-Host ""
Write-Host "Step 7: Configuring system tray integration..." -ForegroundColor Green

# The Electron app already has system tray support built-in
# Just need to ensure it starts minimized to tray

# Create configuration file for Electron app
$electronConfig = @{
    startMinimized = $true
    showInSystemTray = $true
    autoConnect = $false
    wslDistro = $WSLDistro
    replicantPath = "/opt/one-filer-source"
} | ConvertTo-Json

$electronConfig | Out-File -FilePath "$InstallPath\config.json" -Encoding UTF8

Write-Host ""
Write-Host "=== Installation Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "ONE Filer has been installed successfully!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Details:" -ForegroundColor Yellow
Write-Host "  - Installation Path: $InstallPath"
Write-Host "  - WSL Distribution: $WSLDistro"
Write-Host "  - Mount Point: $MountPoint"
Write-Host "  - Service Installed: $InstallAsService"
Write-Host "  - Auto-Start Enabled: $AutoStart"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Launch ONE Filer from the desktop shortcut"
Write-Host "  2. Enter your ONE instance secret when prompted"
Write-Host "  3. The app will start the replicant in WSL automatically"
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Yellow
Write-Host "  - Start: $InstallPath\start-one-filer.bat"
Write-Host "  - Stop: $InstallPath\stop-one-filer.bat"
Write-Host "  - Update: $InstallPath\update-one-filer.bat"
Write-Host ""

# Prompt to start now
$response = Read-Host "Would you like to start ONE Filer now? (Y/N)"
if ($response -eq 'Y' -or $response -eq 'y') {
    & "$InstallPath\start-one-filer.bat"
}