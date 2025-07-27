#Requires -RunAsAdministrator

<#
.SYNOPSIS
    ONE Filer Windows Installer - Standalone Version
    
.DESCRIPTION
    This script automates the installation of ONE Filer on Windows.
    It can be run from any location and will find the wsl-files automatically.
#>

param(
    [switch]$SkipWSLSetup,
    [string]$MountPoint = "$env:USERPROFILE\OneFiler"
)

# Configuration
$WSL_DISTRO_NAME = "Ubuntu"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "ONE Filer Windows Installer (Ubuntu)" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Find wsl-files directory
function Find-WSLFiles {
    # Check multiple possible locations
    $possiblePaths = @(
        (Join-Path $SCRIPT_DIR "..\windows-package\wsl-files"),
        (Join-Path $SCRIPT_DIR "..\wsl-files"),
        (Join-Path $SCRIPT_DIR "wsl-files"),
        "C:\Users\$env:USERNAME\source\one.filer\windows-package\wsl-files",
        "C:\Users\$env:USERNAME\source\one.filer\wsl-files"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            Write-Host "Found wsl-files at: $path" -ForegroundColor Green
            return (Resolve-Path $path).Path
        }
    }
    
    # If not found, ask user
    Write-Host "Could not find wsl-files directory automatically." -ForegroundColor Yellow
    $userPath = Read-Host "Please enter the full path to the wsl-files directory"
    if (Test-Path $userPath) {
        return $userPath
    }
    
    Write-Error "wsl-files directory not found"
    exit 1
}

# Function to check if WSL2 is enabled
function Test-WSL2Enabled {
    try {
        $wslStatus = wsl --status 2>$null
        return $?
    }
    catch {
        return $false
    }
}

# Function to enable WSL2
function Enable-WSL2 {
    Write-Host "Enabling WSL2 feature..." -ForegroundColor Yellow
    
    # Enable WSL feature
    Write-Host "   Enabling Windows Subsystem for Linux..." -ForegroundColor Gray
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
    
    # Enable Virtual Machine Platform
    Write-Host "   Enabling Virtual Machine Platform..." -ForegroundColor Gray
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
    
    # Download and install WSL2 kernel update
    Write-Host "   Downloading WSL2 kernel update..." -ForegroundColor Gray
    $kernelUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
    $kernelPath = "$env:TEMP\wsl_update_x64.msi"
    Invoke-WebRequest -Uri $kernelUrl -OutFile $kernelPath -UseBasicParsing
    
    Write-Host "   Installing WSL2 kernel update..." -ForegroundColor Gray
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$kernelPath`" /quiet"
    
    # Set WSL2 as default
    wsl --set-default-version 2 | Out-Null
    
    Write-Host "WSL2 feature enabled" -ForegroundColor Green
}

# Function to install Ubuntu
function Install-Ubuntu {
    Write-Host "Installing Ubuntu distribution..." -ForegroundColor Yellow
    
    # Check if Ubuntu is already installed
    $existingDistros = wsl --list --quiet 2>$null
    if ($existingDistros -match "Ubuntu") {
        Write-Host "Ubuntu is already installed" -ForegroundColor Green
        return
    }
    
    # Install Ubuntu from Microsoft Store
    Write-Host "   Installing Ubuntu from Microsoft Store..." -ForegroundColor Gray
    wsl --install -d Ubuntu
    
    # Wait for installation to complete
    Write-Host "   Waiting for Ubuntu installation to complete..." -ForegroundColor Gray
    Write-Host "   If prompted, create a username and password for Ubuntu" -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Write-Host "Ubuntu installed successfully" -ForegroundColor Green
}

# Function to deploy ONE Filer
function Deploy-ONEFiler {
    param([string]$WSLFilesPath)
    
    Write-Host "Deploying ONE Filer to Ubuntu..." -ForegroundColor Yellow
    
    # Copy files to Ubuntu home directory
    Write-Host "   Copying ONE Filer files to Ubuntu..." -ForegroundColor Gray
    $windowsPath = $WSLFilesPath.Replace('\', '/')
    $windowsPath = $windowsPath -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    
    # Create deployment script
    $deployScript = @"
#!/bin/bash
set -e
echo "Setting up ONE Filer..."

# Copy files
cp -r '$windowsPath/one.filer' ~/
cp '$windowsPath/setup-one-filer.sh' ~/
chmod +x ~/setup-one-filer.sh

# Run setup
cd ~
./setup-one-filer.sh

echo "ONE Filer setup complete!"
"@
    
    $deployScriptPath = "$env:TEMP\deploy-one-filer.sh"
    $deployScript | Out-File -FilePath $deployScriptPath -Encoding UTF8 -NoNewline
    
    # Copy and run deployment script
    $tempPath = $deployScriptPath.Replace('\', '/')
    $tempPath = $tempPath -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    
    Write-Host "   Running deployment script..." -ForegroundColor Gray
    wsl -d Ubuntu -- bash -c "cp '$tempPath' ~/deploy.sh ; chmod +x ~/deploy.sh ; ./deploy.sh"
    
    Write-Host "ONE Filer deployed successfully" -ForegroundColor Green
}

# Function to configure mount point
function Configure-MountPoint {
    param([string]$MountPoint)
    
    Write-Host "Configuring mount point: $MountPoint" -ForegroundColor Yellow
    
    # Create mount point directory
    $mountDir = Split-Path $MountPoint -Parent
    $mountDrive = Split-Path $MountPoint -Qualifier
    
    # Check if drive exists
    if ($mountDrive -and -not (Test-Path "$mountDrive\")) {
        Write-Warning "Drive $mountDrive does not exist. Mount point will be created in WSL only."
    }
    elseif ($mountDir -and -not (Test-Path $mountDir)) {
        try {
            New-Item -ItemType Directory -Path $mountDir -Force -ErrorAction Stop | Out-Null
            Write-Host "   Created directory: $mountDir" -ForegroundColor Gray
        }
        catch {
            Write-Warning "Could not create Windows directory: $mountDir. Mount point will be created in WSL only."
        }
    }
    
    # Create WSL mount configuration
    $wslMountPath = $MountPoint.Replace('\', '/')
    $wslMountPath = $wslMountPath -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    
    # Create start script
    $startScript = @"
#!/bin/bash
cd ~/one.filer
# Create mount point in WSL
sudo mkdir -p $wslMountPath
# Start ONE Filer with the mount point
echo "Starting ONE Filer at $wslMountPath"
npm start -- --mount $wslMountPath
"@
    
    $startScriptPath = "$env:TEMP\start-one-filer.sh"
    $startScript | Out-File -FilePath $startScriptPath -Encoding UTF8 -NoNewline
    
    # Copy to WSL
    $tempPath = $startScriptPath.Replace('\', '/')
    $tempPath = $tempPath -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    wsl -d Ubuntu -- bash -c "cp '$tempPath' ~/one.filer/start.sh ; chmod +x ~/one.filer/start.sh"
    
    Write-Host "Mount point configured" -ForegroundColor Green
}

# Function to create Windows shortcuts
function Create-Shortcuts {
    Write-Host "Creating Windows shortcuts..." -ForegroundColor Yellow
    
    # Create desktop shortcut
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "ONE Filer.lnk"
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "wsl.exe"
    $Shortcut.Arguments = "-d Ubuntu -- bash -l -c 'cd ~/one.filer ; ./start.sh'"
    $Shortcut.WorkingDirectory = $env:USERPROFILE
    $Shortcut.IconLocation = "imageres.dll,3"
    $Shortcut.Description = "Start ONE Filer"
    $Shortcut.Save()
    
    Write-Host "   Created desktop shortcut" -ForegroundColor Gray
    
    # Create start menu shortcut
    $startMenuPath = [Environment]::GetFolderPath("StartMenu")
    $programsPath = Join-Path $startMenuPath "Programs\ONE Filer"
    if (-not (Test-Path $programsPath)) {
        New-Item -ItemType Directory -Path $programsPath -Force | Out-Null
    }
    
    $startMenuShortcut = Join-Path $programsPath "ONE Filer.lnk"
    Copy-Item $shortcutPath $startMenuShortcut
    
    Write-Host "   Created Start Menu shortcut" -ForegroundColor Gray
    Write-Host "Shortcuts created" -ForegroundColor Green
}

# Main installation flow
try {
    # Find wsl-files
    $wslFilesPath = Find-WSLFiles
    
    # Step 1: Check/Enable WSL2
    if (-not $SkipWSLSetup) {
        if (-not (Test-WSL2Enabled)) {
            Enable-WSL2
            Write-Host ""
            Write-Host "WSL2 has been enabled. A system restart may be required." -ForegroundColor Yellow
            Write-Host "Please restart your computer and run this installer again." -ForegroundColor Yellow
            pause
            exit 0
        }
        else {
            Write-Host "WSL2 is already enabled" -ForegroundColor Green
        }
    }
    
    # Step 2: Install Ubuntu
    Install-Ubuntu
    Write-Host ""
    
    # Step 3: Deploy ONE Filer
    Deploy-ONEFiler -WSLFilesPath $wslFilesPath
    Write-Host ""
    
    # Step 4: Configure mount point
    Configure-MountPoint -MountPoint $MountPoint
    Write-Host ""
    
    # Step 5: Create shortcuts
    Create-Shortcuts
    Write-Host ""
    
    # Success message
    Write-Host "ONE Filer installation completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation Summary:" -ForegroundColor Cyan
    Write-Host "   - Ubuntu WSL2 installed and configured" -ForegroundColor Gray
    Write-Host "   - ONE Filer deployed to Ubuntu" -ForegroundColor Gray
    Write-Host "   - Mount point configured at: $MountPoint" -ForegroundColor Gray
    Write-Host "   - Desktop and Start Menu shortcuts created" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To start ONE Filer:" -ForegroundColor Cyan
    Write-Host "   - Use the desktop shortcut 'ONE Filer'" -ForegroundColor Gray
    Write-Host "   - Or run: wsl -d Ubuntu -- bash -l -c 'cd ~/one.filer ; ./start.sh'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Access your files at: $MountPoint" -ForegroundColor Cyan
    Write-Host ""
}
catch {
    Write-Error "Installation failed: $_"
    exit 1
}

pause