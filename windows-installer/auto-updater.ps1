# ONE Filer Auto-Updater
# This script checks for and installs updates for both the replicant and electron app

param(
    [string]$InstallPath = "C:\Program Files\ONE Filer",
    [string]$WSLDistro = "ONE-Debian",
    [bool]$Silent = $false
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to console
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARN"  { Write-Host $logMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        default { Write-Host $logMessage -ForegroundColor White }
    }
    
    # Write to log file
    $logFile = "$InstallPath\update.log"
    Add-Content -Path $logFile -Value $logMessage
}

function Get-GitHubLatestRelease {
    param([string]$Owner, [string]$Repo)
    
    try {
        $uri = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
        $response = Invoke-RestMethod -Uri $uri -Method Get
        return $response
    } catch {
        Write-Log "Failed to check GitHub releases for $Owner/$Repo" "ERROR"
        return $null
    }
}

function Get-CurrentVersion {
    param([string]$Type)
    
    $versionFile = "$InstallPath\$Type.version"
    if (Test-Path $versionFile) {
        return Get-Content $versionFile -Raw
    }
    return "0.0.0"
}

function Set-CurrentVersion {
    param([string]$Type, [string]$Version)
    
    $versionFile = "$InstallPath\$Type.version"
    Set-Content -Path $versionFile -Value $Version
}

function Update-Replicant {
    Write-Log "Checking for replicant updates..."
    
    # Get latest release from GitHub
    $latestRelease = Get-GitHubLatestRelease -Owner "refinio" -Repo "one.filer"
    if (-not $latestRelease) {
        Write-Log "Could not check for replicant updates" "WARN"
        return $false
    }
    
    $latestVersion = $latestRelease.tag_name -replace '^v', ''
    $currentVersion = Get-CurrentVersion -Type "replicant"
    
    if ($latestVersion -eq $currentVersion) {
        Write-Log "Replicant is up to date (version $currentVersion)"
        return $false
    }
    
    Write-Log "New replicant version available: $latestVersion (current: $currentVersion)" "SUCCESS"
    
    if (-not $Silent) {
        $response = Read-Host "Update replicant to version $latestVersion? (Y/N)"
        if ($response -ne 'Y' -and $response -ne 'y') {
            Write-Log "Update cancelled by user"
            return $false
        }
    }
    
    # Stop the service
    Write-Log "Stopping ONE Filer service..."
    & "$InstallPath\stop-one-filer.bat"
    
    # Update replicant in WSL
    Write-Log "Updating replicant in WSL..."
    $updateScript = @"
cd /opt/one-filer-source
sudo git fetch --all
sudo git checkout $latestVersion || sudo git checkout v$latestVersion
sudo npm install
sudo npm run build
"@
    
    $result = wsl -d $WSLDistro -- bash -c $updateScript
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Failed to update replicant" "ERROR"
        return $false
    }
    
    # Update version file
    Set-CurrentVersion -Type "replicant" -Value $latestVersion
    
    Write-Log "Replicant updated successfully to version $latestVersion" "SUCCESS"
    return $true
}

function Update-ElectronApp {
    Write-Log "Checking for Electron app updates..."
    
    # For the electron app, we'll check package.json version
    $packageJsonPath = "$InstallPath\electron-app\package.json"
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        $latestVersion = $packageJson.version
        $currentVersion = Get-CurrentVersion -Type "electron"
        
        if ($latestVersion -eq $currentVersion) {
            Write-Log "Electron app is up to date (version $currentVersion)"
            return $false
        }
        
        Write-Log "New Electron app version available: $latestVersion (current: $currentVersion)" "SUCCESS"
        
        if (-not $Silent) {
            $response = Read-Host "Update Electron app to version $latestVersion? (Y/N)"
            if ($response -ne 'Y' -and $response -ne 'y') {
                Write-Log "Update cancelled by user"
                return $false
            }
        }
        
        # Stop the app
        Write-Log "Stopping Electron app..."
        taskkill /F /IM "ONE Filer Login.exe" 2>$null
        
        # Update Electron app
        Write-Log "Updating Electron app..."
        Push-Location "$InstallPath\electron-app"
        
        # Pull latest changes
        git pull origin main 2>$null
        if ($LASTEXITCODE -ne 0) {
            # If git pull fails, try npm update
            npm update
        }
        
        # Rebuild
        npm install
        npm run build
        npm run build-win
        
        Pop-Location
        
        # Copy new build
        Copy-Item -Path "$InstallPath\electron-app\dist-app\*" -Destination "$InstallPath" -Recurse -Force
        
        # Update version file
        Set-CurrentVersion -Type "electron" -Value $latestVersion
        
        Write-Log "Electron app updated successfully to version $latestVersion" "SUCCESS"
        return $true
    }
    
    return $false
}

function Update-Dependencies {
    Write-Log "Checking system dependencies..."
    
    # Update WSL
    Write-Log "Updating WSL..."
    wsl --update
    
    # Update packages in WSL
    Write-Log "Updating WSL packages..."
    wsl -d $WSLDistro -- sudo apt-get update
    wsl -d $WSLDistro -- sudo apt-get upgrade -y
    
    Write-Log "Dependencies updated" "SUCCESS"
}

# Main update process
Write-Log "=== ONE Filer Auto-Update Started ==="

# Check if ONE Filer is installed
if (-not (Test-Path $InstallPath)) {
    Write-Log "ONE Filer is not installed at $InstallPath" "ERROR"
    exit 1
}

# Create scheduled task for auto-updates if not exists
$taskName = "ONE Filer Auto Update"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Log "Creating scheduled task for auto-updates..."
    
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallPath\scripts\auto-updater.ps1`" -Silent `$true"
    
    $trigger = New-ScheduledTaskTrigger -Daily -At "3:00AM"
    
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable
    
    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Automatically updates ONE Filer components" `
        -RunLevel Highest
    
    Write-Log "Scheduled task created" "SUCCESS"
}

# Perform updates
$replicantUpdated = Update-Replicant
$electronUpdated = Update-ElectronApp

if ($replicantUpdated -or $electronUpdated) {
    Update-Dependencies
    
    # Restart service
    Write-Log "Restarting ONE Filer..."
    & "$InstallPath\start-one-filer.bat"
    
    Write-Log "Update complete. ONE Filer has been restarted." "SUCCESS"
} else {
    Write-Log "No updates available. System is up to date."
}

Write-Log "=== ONE Filer Auto-Update Completed ==="

# If not silent, wait for user input
if (-not $Silent) {
    Write-Host ""
    Write-Host "Press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}