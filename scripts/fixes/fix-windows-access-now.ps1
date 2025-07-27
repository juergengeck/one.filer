# Windows Access Fix for ONE.filer
Write-Host "=== Fixing Windows Access to ONE.filer FUSE Mount ===" -ForegroundColor Cyan

# Step 1: Restart WSL to ensure clean state
Write-Host "`n1. Restarting WSL2 for clean state..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 3
Write-Host "WSL2 restarted"

# Step 2: Test basic WSL connectivity
Write-Host "`n2. Testing WSL2 connectivity..." -ForegroundColor Yellow
$wslTest = wsl -d Ubuntu whoami 2>$null
if ($wslTest) {
    Write-Host "✅ WSL2 Ubuntu is accessible" -ForegroundColor Green
} else {
    Write-Host "❌ WSL2 Ubuntu not accessible" -ForegroundColor Red
    exit 1
}

# Step 3: Test Windows Explorer access to WSL
Write-Host "`n3. Testing Windows access to WSL filesystem..." -ForegroundColor Yellow
if (Test-Path "\\wsl.localhost\Ubuntu\home") {
    Write-Host "✅ Can access WSL filesystem from Windows" -ForegroundColor Green
} else {
    Write-Host "❌ Cannot access WSL filesystem from Windows" -ForegroundColor Red
}

# Step 4: Set up the project directory in Ubuntu
Write-Host "`n4. Setting up project in Ubuntu..." -ForegroundColor Yellow
wsl -d Ubuntu bash -c "
    # Ensure project directory exists with correct permissions
    mkdir -p /home/gecko/one.filer
    
    # Copy files if needed
    if [ ! -f /home/gecko/one.filer/package.json ]; then
        cp -r /mnt/c/Users/juerg/source/one.filer/* /home/gecko/one.filer/
        chown -R gecko:gecko /home/gecko/one.filer
    fi
    
    cd /home/gecko/one.filer
    echo 'Project directory set up in Ubuntu'
"

# Step 5: Run the FUSE fix script
Write-Host "`n5. Running FUSE Windows access fix..." -ForegroundColor Yellow
wsl -d Ubuntu bash -c "
    cd /home/gecko/one.filer
    chmod +x fix-windows-access.sh
    ./fix-windows-access.sh
"

# Step 6: Test the result
Write-Host "`n6. Testing Windows access to FUSE mount..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

if (Test-Path "\\wsl.localhost\Ubuntu\mnt\one-files") {
    Write-Host "✅ SUCCESS! Windows can access FUSE mount" -ForegroundColor Green
    Write-Host "📂 Access your files at: \\wsl.localhost\Ubuntu\mnt\one-files" -ForegroundColor Cyan
} else {
    Write-Host "❌ Windows still cannot access FUSE mount" -ForegroundColor Red
    Write-Host "Manual troubleshooting needed" -ForegroundColor Yellow
}

Write-Host "`n=== Fix Complete ===" -ForegroundColor Cyan
Write-Host "Try opening Windows Explorer and navigating to:" -ForegroundColor White
Write-Host "\\wsl.localhost\Ubuntu\mnt\one-files" -ForegroundColor Yellow 