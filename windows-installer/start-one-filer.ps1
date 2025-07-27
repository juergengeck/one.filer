param(
    [string]$MountPath = "$env:USERPROFILE\OneFiler"
)

Write-Host "Starting ONE Filer..." -ForegroundColor Cyan
Write-Host "Mount point: $MountPath" -ForegroundColor Yellow
Write-Host ""

# Create mount directory if it doesn't exist
if (-not (Test-Path $MountPath)) {
    Write-Host "Creating mount directory: $MountPath" -ForegroundColor Gray
    New-Item -ItemType Directory -Path $MountPath -Force | Out-Null
}

# Convert Windows path to WSL path
$wslMountPath = $MountPath.Replace('\', '/') -replace '^([A-Z]):', {"/mnt/" + $matches[1].ToLower()}

# Check if Ubuntu is accessible
Write-Host "Checking Ubuntu..." -ForegroundColor Gray
try {
    $testResult = wsl -d Ubuntu --exec echo "test" 2>$null
    if (-not $?) {
        throw "Ubuntu not accessible"
    }
    Write-Host "Ubuntu is ready" -ForegroundColor Green
}
catch {
    Write-Error "Ubuntu is not accessible. Please ensure WSL and Ubuntu are properly installed."
    exit 1
}

# Start ONE Filer
Write-Host "Launching ONE Filer..." -ForegroundColor Green
Write-Host "Access your files at: $MountPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop ONE Filer" -ForegroundColor Yellow
Write-Host ""

wsl -d Ubuntu -- bash -c "cd ~/one.filer && npm start -- --mount '$wslMountPath'"