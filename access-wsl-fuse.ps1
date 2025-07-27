# Access WSL FUSE mount from Windows
# This script starts one.filer in WSL and maps it to a Windows drive

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "ONE.filer WSL FUSE Access for Windows" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin (recommended for drive mapping)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Check WSL status
Write-Host "Checking WSL status..." -ForegroundColor Yellow
$wslStatus = wsl -l -v | Select-String "Ubuntu.*Running"
if (-not $wslStatus) {
    Write-Host "Starting WSL Ubuntu..." -ForegroundColor Yellow
    wsl -d Ubuntu echo "WSL Started"
}

# Check if one.filer is running
Write-Host ""
Write-Host "Checking if one.filer is running in WSL..." -ForegroundColor Yellow
$oneFilerRunning = wsl -d Ubuntu -- ps aux | Select-String "node.*filer" | Where-Object { $_ -notmatch "Select-String" }

if (-not $oneFilerRunning) {
    Write-Host "one.filer is not running. Starting it now..." -ForegroundColor Yellow
    Write-Host ""
    
    # Start one.filer in a new window
    $wslPath = "/mnt/c/Users/juerg/source/one.filer"
    $startCmd = "cd $wslPath && npm start -- start --config configs/filer-wsl-accessible.json"
    
    Start-Process wsl -ArgumentList "-d", "Ubuntu", "--", "bash", "-c", "`"$startCmd`"" -WindowStyle Normal
    
    Write-Host "Waiting for one.filer to start (20 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
} else {
    Write-Host "one.filer is already running in WSL" -ForegroundColor Green
}

# Test WSL filesystem access
Write-Host ""
Write-Host "Testing WSL filesystem access..." -ForegroundColor Yellow
$mountPath = "\\wsl$\Ubuntu\home\gecko\one-files"

if (Test-Path $mountPath) {
    Write-Host "SUCCESS: Can access mount point" -ForegroundColor Green
    
    # Try to list contents
    try {
        $contents = Get-ChildItem $mountPath -ErrorAction Stop
        Write-Host "Mount point contains $($contents.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Mount point exists but may be empty or not fully mounted" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: Cannot access mount point at $mountPath" -ForegroundColor Red
    Write-Host "Make sure one.filer is running with FUSE enabled" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Remove existing drive mapping
Write-Host ""
Write-Host "Removing any existing O: drive mapping..." -ForegroundColor Yellow
Remove-PSDrive -Name O -Force -ErrorAction SilentlyContinue
net use O: /delete /y 2>$null | Out-Null

# Map the drive
Write-Host "Mapping WSL FUSE mount to drive O:..." -ForegroundColor Yellow

try {
    # Try PowerShell method first
    New-PSDrive -Name O -PSProvider FileSystem -Root $mountPath -Persist -Scope Global -ErrorAction Stop
    $success = $true
} catch {
    # Fallback to net use
    Write-Host "Using alternative mapping method..." -ForegroundColor Yellow
    $result = net use O: $mountPath /persistent:yes 2>&1
    $success = $LASTEXITCODE -eq 0
}

if ($success) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host "SUCCESS! ONE.filer is accessible as drive O:" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host ""
    
    # Show drive contents
    Write-Host "Drive contents:" -ForegroundColor Cyan
    Get-ChildItem O:\ | Format-Table Name, LastWriteTime, Length -AutoSize
    
    # Open in Explorer
    Write-Host ""
    Write-Host "Opening drive O: in Windows Explorer..." -ForegroundColor Green
    Start-Process explorer "O:\"
} else {
    Write-Host ""
    Write-Host "ERROR: Failed to map drive" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Make sure one.filer is running in WSL with FUSE support"
    Write-Host "2. Check that /home/gecko/one-files exists in WSL"
    Write-Host "3. Verify Windows can access \\wsl$\Ubuntu"
    Write-Host "4. Try running PowerShell as Administrator"
    Write-Host "5. Check Windows Defender or antivirus settings"
}

Write-Host ""
Read-Host "Press Enter to exit"