# Map WSL FUSE mount to Windows drive letter
param(
    [string]$DriveLetter = "O",
    [string]$WSLDistro = "Ubuntu",
    [string]$MountPoint = "/home/gecko/one-files"
)

Write-Host "Mapping ONE.filer FUSE mount to drive ${DriveLetter}:..." -ForegroundColor Cyan

# Remove existing mapping if present
try {
    Remove-PSDrive -Name $DriveLetter -Force -ErrorAction SilentlyContinue
    net use "${DriveLetter}:" /delete /y 2>$null | Out-Null
} catch {
    # Ignore errors if drive doesn't exist
}

# Build the UNC path
$UNCPath = "\\wsl$\$WSLDistro$($MountPoint -replace '/', '\')"

Write-Host "Mapping $UNCPath to ${DriveLetter}:..." -ForegroundColor Yellow

try {
    # Method 1: Try with New-PSDrive (PowerShell method)
    New-PSDrive -Name $DriveLetter -PSProvider FileSystem -Root $UNCPath -Persist -Scope Global
    Write-Host "SUCCESS: ONE.filer is now accessible as drive ${DriveLetter}:" -ForegroundColor Green
} catch {
    # Method 2: Fallback to net use (Windows method)
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    $result = net use "${DriveLetter}:" $UNCPath /persistent:yes 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: ONE.filer is now accessible as drive ${DriveLetter}:" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to map drive" -ForegroundColor Red
        Write-Host $result
        Write-Host "`nMake sure:" -ForegroundColor Yellow
        Write-Host "  1. one.filer is running in WSL ($WSLDistro)"
        Write-Host "  2. The mount point $MountPoint exists"
        Write-Host "  3. You have the necessary permissions"
        exit 1
    }
}

# Test access
if (Test-Path "${DriveLetter}:\") {
    Write-Host "`nDrive contents:" -ForegroundColor Cyan
    Get-ChildItem "${DriveLetter}:\" | Format-Table Name, LastWriteTime -AutoSize
    
    # Open in Explorer
    Write-Host "`nOpening ${DriveLetter}: drive in Explorer..." -ForegroundColor Green
    explorer "${DriveLetter}:\"
} else {
    Write-Host "WARNING: Drive mapped but not accessible" -ForegroundColor Yellow
}