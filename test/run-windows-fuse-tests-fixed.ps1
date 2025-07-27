# PowerShell script to run Windows FUSE tests with better error handling

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Windows FUSE (ProjFS) Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: Administrator privileges required for ProjFS tests" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

# Check if ProjFS is available
try {
    $prjFlt = Get-Command "C:\Windows\System32\PrjFlt.dll" -ErrorAction Stop
    Write-Host "ProjFS found at: $($prjFlt.Source)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: ProjFS not found on this system" -ForegroundColor Red
    Write-Host "Please ensure Windows 10 version 1809 or later with ProjFS enabled" -ForegroundColor Yellow
    
    # Check Windows version
    $os = Get-WmiObject -Class Win32_OperatingSystem
    Write-Host "Current Windows version: $($os.Version)" -ForegroundColor Yellow
    
    exit 1
}

# Set up test environment
$env:NODE_ENV = "test"
$env:DEBUG = "fuse:*,projfs:*"

# Clean any existing test mounts
Write-Host "Cleaning up any existing test mounts..." -ForegroundColor Yellow
$testDirs = "C:\FuseTest", "C:\FuseXPlatTest"

foreach ($dir in $testDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction Stop
            Write-Host "Cleaned up $dir" -ForegroundColor Green
        } catch {
            Write-Host "Could not remove $dir - may be in use" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Running FUSE tests on Windows..." -ForegroundColor Cyan
Write-Host ""

# Run the tests
$testsFailed = $false

# First, run Windows-specific tests
Write-Host "=== Running Windows-specific FUSE tests ===" -ForegroundColor Yellow
& npx mocha test/functional/fuse-windows-native.test.ts --timeout 60000
if ($LASTEXITCODE -ne 0) {
    $testsFailed = $true
    Write-Host "Windows-specific tests failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Running cross-platform FUSE tests ===" -ForegroundColor Yellow
& npx mocha test/functional/fuse-cross-platform.test.ts --timeout 60000
if ($LASTEXITCODE -ne 0) {
    $testsFailed = $true
    Write-Host "Cross-platform tests failed!" -ForegroundColor Red
}

# Clean up after tests
Write-Host ""
Write-Host "Cleaning up test mounts..." -ForegroundColor Yellow

foreach ($dir in $testDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "Cleaned up $dir" -ForegroundColor Green
        } catch {
            Write-Host "Could not remove $dir - manual cleanup may be required" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($testsFailed) {
    Write-Host "Tests FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
} else {
    Write-Host "All tests completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
}