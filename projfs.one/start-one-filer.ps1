# ONE.filer with ProjFS Integration Launcher

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    ONE.FILER with ProjFS Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   First-time setup requires admin privileges" -ForegroundColor Yellow
    Write-Host "   to register the ProjectedFS provider." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to continue anyway..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Set environment variables with defaults
if (-not $env:ONE_DIRECTORY) {
    $env:ONE_DIRECTORY = "$env:USERPROFILE\.one-data"
    Write-Host "ℹ️  Using default data directory: $env:ONE_DIRECTORY" -ForegroundColor Cyan
}

if (-not $env:ONE_SECRET) {
    $env:ONE_SECRET = "development-secret-please-change"
    Write-Host "⚠️  Using default development secret" -ForegroundColor Yellow
}

if (-not $env:PROJFS_ROOT) {
    $env:PROJFS_ROOT = "C:\OneFiler"
    Write-Host "ℹ️  Virtual drive will be created at: $env:PROJFS_ROOT" -ForegroundColor Cyan
}

# Optional: Set communication server
if (-not $env:ONE_COMM_URL) {
    $env:ONE_COMM_URL = "https://comm.one-dragon.com"
}

# Set log level
if (-not $env:LOG_LEVEL) {
    $env:LOG_LEVEL = "info"
}

Write-Host ""
Write-Host "📦 Building TypeScript..." -ForegroundColor Yellow

# Change to script directory
Set-Location -Path $PSScriptRoot

# Build TypeScript
$buildResult = & npm run build:ts 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed:" -ForegroundColor Red
    Write-Host $buildResult
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Create data directory if it doesn't exist
if (-not (Test-Path $env:ONE_DIRECTORY)) {
    Write-Host "📁 Creating data directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $env:ONE_DIRECTORY -Force | Out-Null
}

# Check if ProjFS root exists and warn
if (Test-Path $env:PROJFS_ROOT) {
    Write-Host "⚠️  Warning: $env:PROJFS_ROOT already exists" -ForegroundColor Yellow
    Write-Host "   Existing files may interfere with the virtual filesystem" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🚀 Starting ONE.filer with ProjFS..." -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Data Directory:  $env:ONE_DIRECTORY" -ForegroundColor White
Write-Host "  Virtual Drive:   $env:PROJFS_ROOT" -ForegroundColor White
Write-Host "  Comm Server:     $env:ONE_COMM_URL" -ForegroundColor White
Write-Host "  Log Level:       $env:LOG_LEVEL" -ForegroundColor White
Write-Host ""

# Start the application
try {
    & node dist/examples/full-stack-integration.js
} catch {
    Write-Host ""
    Write-Host "❌ Application failed to start:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "   1. Ensure Windows ProjectedFS is enabled" -ForegroundColor White
    Write-Host "   2. Try running as Administrator" -ForegroundColor White
    Write-Host "   3. Check that all dependencies are installed" -ForegroundColor White
    Write-Host "   4. Review the error message above" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")