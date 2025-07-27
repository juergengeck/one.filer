#Requires -RunAsAdministrator

<#
.SYNOPSIS
    ONE Filer Updater/Installer - Reuses existing Ubuntu installation
    
.DESCRIPTION
    This script updates or installs ONE Filer on an existing Ubuntu WSL2 instance.
    It's designed to be run multiple times safely.
#>

param(
    [string]$MountPoint = "$env:USERPROFILE\OneFiler",
    [switch]$Clean  # Remove existing ONE Filer installation before installing
)

# Configuration
$WSL_DISTRO_NAME = "Ubuntu"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "ONE Filer Updater/Installer" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Check if Ubuntu is installed
function Test-UbuntuInstalled {
    # Get list of distributions, handling encoding issues
    $distros = @(wsl --list --quiet 2>$null)
    
    # Debug output
    Write-Host "Raw distribution list:" -ForegroundColor Gray
    $distros | ForEach-Object { Write-Host "  [$_]" -ForegroundColor Gray }
    
    # Check for any Ubuntu variant, handling potential encoding issues
    foreach ($distro in $distros) {
        # Remove any non-printable characters and trim
        $cleanDistro = $distro -replace '[^\x20-\x7E]', '' | Where-Object { $_ } | ForEach-Object { $_.Trim() }
        
        if ($cleanDistro -like "*Ubuntu*" -or $cleanDistro -eq "Ubuntu") {
            $global:UbuntuDistro = $cleanDistro
            Write-Host "Found Ubuntu distribution: $global:UbuntuDistro" -ForegroundColor Green
            return $true
        }
    }
    
    # Fallback: try hardcoded "Ubuntu" if nothing found
    $testUbuntu = wsl -d Ubuntu --exec echo "test" 2>$null
    if ($?) {
        $global:UbuntuDistro = "Ubuntu"
        Write-Host "Found Ubuntu distribution via direct test: $global:UbuntuDistro" -ForegroundColor Green
        return $true
    }
    
    return $false
}

# Find wsl-files directory
function Find-WSLFiles {
    $possiblePaths = @(
        (Join-Path $SCRIPT_DIR "..\windows-package\wsl-files"),
        (Join-Path $SCRIPT_DIR "..\wsl-files"),
        (Join-Path $SCRIPT_DIR "wsl-files")
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            return (Resolve-Path $path).Path
        }
    }
    
    Write-Error "wsl-files directory not found"
    exit 1
}

# Main update function
function Update-ONEFiler {
    param(
        [string]$WSLFilesPath,
        [string]$MountPoint,
        [bool]$Clean
    )
    
    Write-Host "Updating ONE Filer..." -ForegroundColor Yellow
    
    # Convert paths for WSL
    $wslFilesPath = $WSLFilesPath.Replace('\', '/') -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    $wslMountPath = $MountPoint.Replace('\', '/') -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}
    
    # Create update script
    $updateScript = @"
#!/bin/bash
set -e

echo "Updating ONE Filer..."

# Clean existing installation if requested
if [ "$Clean" = "true" ]; then
    echo "Removing existing ONE Filer installation..."
    rm -rf ~/one.filer
    rm -f ~/setup-one-filer.sh
fi

# Copy new files
echo "Copying ONE Filer files..."
cp -r '$wslFilesPath/one.filer' ~/
cp '$wslFilesPath/setup-one-filer.sh' ~/
chmod +x ~/setup-one-filer.sh

# Run setup
cd ~
./setup-one-filer.sh

# Create start script with mount point
cat > ~/one.filer/start.sh << 'EOF'
#!/bin/bash
cd ~/one.filer
# Create mount point in WSL
sudo mkdir -p $wslMountPath
# Start ONE Filer with the mount point
echo "Starting ONE Filer at $wslMountPath"
npm start -- --mount $wslMountPath
EOF

chmod +x ~/one.filer/start.sh

echo "ONE Filer update complete!"
"@
    
    # Execute update script
    Write-Host "Running update in $global:UbuntuDistro..." -ForegroundColor Gray
    $updateScript | wsl -d $global:UbuntuDistro -- bash
    
    Write-Host "ONE Filer updated successfully!" -ForegroundColor Green
}

# Create Windows shortcuts
function Update-Shortcuts {
    Write-Host "Updating Windows shortcuts..." -ForegroundColor Yellow
    
    # Desktop shortcut
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "ONE Filer.lnk"
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "wsl.exe"
    $Shortcut.Arguments = "-d $global:UbuntuDistro -- bash -l -c 'cd ~/one.filer && ./start.sh'"
    $Shortcut.WorkingDirectory = $env:USERPROFILE
    $Shortcut.IconLocation = "imageres.dll,3"
    $Shortcut.Description = "Start ONE Filer"
    $Shortcut.Save()
    
    Write-Host "Shortcuts updated" -ForegroundColor Green
}

# Main execution
try {
    # Check Ubuntu installation
    if (-not (Test-UbuntuInstalled)) {
        Write-Host "Available WSL distributions:" -ForegroundColor Yellow
        wsl --list --verbose
        Write-Host ""
        Write-Error "No Ubuntu distribution found. Please run the full installer first."
        Write-Host "You can install Ubuntu by running: wsl --install -d Ubuntu" -ForegroundColor Yellow
        exit 1
    }
    
    # Find wsl-files
    $wslFilesPath = Find-WSLFiles
    Write-Host "Found wsl-files at: $wslFilesPath" -ForegroundColor Green
    
    # Update ONE Filer
    Update-ONEFiler -WSLFilesPath $wslFilesPath -MountPoint $MountPoint -Clean $Clean
    
    # Update shortcuts
    Update-Shortcuts
    
    # Success message
    Write-Host ""
    Write-Host "ONE Filer has been updated!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Mount point: $MountPoint" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start ONE Filer:" -ForegroundColor Cyan
    Write-Host "   - Use the desktop shortcut 'ONE Filer'" -ForegroundColor Gray
    Write-Host "   - Or run: wsl -d $global:UbuntuDistro -- bash -l -c 'cd ~/one.filer && ./start.sh'" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Error "Update failed: $_"
    exit 1
}