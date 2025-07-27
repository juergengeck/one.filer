# Windows test runner for OneFiler
# Run this from Windows PowerShell to test WSL access

Write-Host "=== OneFiler Windows Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# Check if WSL is available
try {
    $wslStatus = wsl --status 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "WSL is not installed"
    }
    Write-Host "✅ WSL is available" -ForegroundColor Green
} catch {
    Write-Host "❌ WSL is not installed or not running" -ForegroundColor Red
    exit 1
}

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed on Windows" -ForegroundColor Red
    Write-Host "Install Node.js or run tests from WSL" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green
Write-Host ""

# Build in WSL first
Write-Host "🔨 Building project in WSL..." -ForegroundColor Yellow
wsl -d Ubuntu -e bash -c "cd /mnt/c/Users/$env:USERNAME/source/one.filer; npm run build"

Write-Host ""
Write-Host "🧪 Running Windows access tests..." -ForegroundColor Yellow
Write-Host ""

# Run Windows access test
Write-Host "Test 01: WSL Filesystem Access from Windows" -ForegroundColor Cyan
node test\integration\01-wsl-access.test.js

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Windows access tests completed."
Write-Host "Run ./test/scripts/run-tests.sh in WSL for FUSE tests."