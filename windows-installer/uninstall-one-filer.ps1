# ONE Filer Uninstaller
# Completely removes ONE Filer and optionally WSL components

param(
    [string]$InstallPath = "C:\Program Files\ONE Filer",
    [string]$WSLDistro = "ONE-Debian",
    [bool]$RemoveWSL = $false,
    [bool]$KeepUserData = $false
)

# Ensure running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Exiting..."
    exit 1
}

Write-Host "=== ONE Filer Uninstaller ===" -ForegroundColor Red
Write-Host ""
Write-Host "This will remove ONE Filer from your system." -ForegroundColor Yellow
Write-Host ""

# Confirm uninstallation
$response = Read-Host "Are you sure you want to uninstall ONE Filer? (Y/N)"
if ($response -ne 'Y' -and $response -ne 'y') {
    Write-Host "Uninstallation cancelled."
    exit 0
}

# Step 1: Stop all services
Write-Host ""
Write-Host "Step 1: Stopping services..." -ForegroundColor Yellow

# Stop Windows service if exists
$service = Get-Service -Name "ONEFilerService" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Stopping Windows service..."
    Stop-Service -Name "ONEFilerService" -Force
    
    # Remove service
    Write-Host "Removing Windows service..."
    & "$InstallPath\nssm.exe" remove "ONEFilerService" confirm
}

# Kill Electron app
Write-Host "Stopping Electron app..."
taskkill /F /IM "ONE Filer Login.exe" 2>$null

# Stop replicant in WSL
Write-Host "Stopping replicant in WSL..."
wsl -d $WSLDistro -- sudo systemctl stop one-filer 2>$null
wsl -d $WSLDistro -- sudo systemctl disable one-filer 2>$null

# Step 2: Remove scheduled tasks
Write-Host ""
Write-Host "Step 2: Removing scheduled tasks..." -ForegroundColor Yellow

Unregister-ScheduledTask -TaskName "ONE Filer Auto Update" -Confirm:$false -ErrorAction SilentlyContinue

# Step 3: Remove shortcuts
Write-Host ""
Write-Host "Step 3: Removing shortcuts..." -ForegroundColor Yellow

# Desktop shortcut
$desktopShortcut = "$env:USERPROFILE\Desktop\ONE Filer.lnk"
if (Test-Path $desktopShortcut) {
    Remove-Item $desktopShortcut -Force
    Write-Host "Removed desktop shortcut"
}

# Start menu shortcuts
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ONE Filer"
if (Test-Path $startMenuPath) {
    Remove-Item $startMenuPath -Recurse -Force
    Write-Host "Removed start menu shortcuts"
}

# Startup shortcut
$startupShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\ONE Filer.lnk"
if (Test-Path $startupShortcut) {
    Remove-Item $startupShortcut -Force
    Write-Host "Removed startup shortcut"
}

# Step 4: Backup user data (if requested)
if ($KeepUserData) {
    Write-Host ""
    Write-Host "Step 4: Backing up user data..." -ForegroundColor Yellow
    
    $backupPath = "$env:USERPROFILE\Documents\ONE-Filer-Backup-$(Get-Date -Format 'yyyy-MM-dd')"
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
    
    # Export WSL data
    Write-Host "Exporting WSL data..."
    wsl -d $WSLDistro -- sudo tar -czf /tmp/one-filer-data.tar.gz /opt/one-filer-source/data /etc/one-filer 2>$null
    wsl -d $WSLDistro -- cat /tmp/one-filer-data.tar.gz > "$backupPath\one-filer-data.tar.gz"
    
    # Copy config files
    if (Test-Path "$InstallPath\config.json") {
        Copy-Item "$InstallPath\config.json" "$backupPath\"
    }
    
    Write-Host "User data backed up to: $backupPath" -ForegroundColor Green
}

# Step 5: Remove installation files
Write-Host ""
Write-Host "Step 5: Removing installation files..." -ForegroundColor Yellow

if (Test-Path $InstallPath) {
    Remove-Item $InstallPath -Recurse -Force
    Write-Host "Removed installation directory"
}

# Step 6: Clean up WSL
Write-Host ""
Write-Host "Step 6: Cleaning up WSL..." -ForegroundColor Yellow

# Remove ONE Filer from WSL
wsl -d $WSLDistro -- sudo rm -rf /opt/one-filer-source 2>$null
wsl -d $WSLDistro -- sudo rm -rf /etc/one-filer 2>$null
wsl -d $WSLDistro -- sudo rm -rf /var/log/one-filer 2>$null
wsl -d $WSLDistro -- sudo rm -f /etc/systemd/system/one-filer.service 2>$null

# Optionally remove WSL distro
if ($RemoveWSL) {
    $response = Read-Host "Remove WSL distribution '$WSLDistro'? This will delete all data in it! (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Removing WSL distribution..."
        wsl --unregister $WSLDistro
        Write-Host "WSL distribution removed"
    }
}

# Step 7: Clean registry (if any)
Write-Host ""
Write-Host "Step 7: Cleaning registry..." -ForegroundColor Yellow

# Remove any registry entries
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "ONE Filer" -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\Software\ONE Filer" -Recurse -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\Software\ONE Filer" -Recurse -ErrorAction SilentlyContinue

# Step 8: Clean up environment variables
Write-Host ""
Write-Host "Step 8: Cleaning environment variables..." -ForegroundColor Yellow

# Remove from PATH if added
$path = [Environment]::GetEnvironmentVariable("PATH", "Machine")
$newPath = ($path.Split(';') | Where-Object { $_ -notlike "*ONE Filer*" }) -join ';'
if ($path -ne $newPath) {
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "Machine")
    Write-Host "Removed from system PATH"
}

# Final cleanup
Write-Host ""
Write-Host "=== Uninstallation Complete ===" -ForegroundColor Green
Write-Host ""

if ($KeepUserData) {
    Write-Host "Your data has been backed up to:" -ForegroundColor Yellow
    Write-Host "  $backupPath" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "ONE Filer has been removed from your system." -ForegroundColor Green
Write-Host ""

# Prompt for restart
$response = Read-Host "A restart is recommended. Restart now? (Y/N)"
if ($response -eq 'Y' -or $response -eq 'y') {
    Restart-Computer
}