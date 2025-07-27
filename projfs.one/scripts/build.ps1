# Build script for projfs.one native module
# Requires: Visual Studio 2019+ with C++ workload, Windows SDK

param(
    [Parameter()]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release',
    
    [Parameter()]
    [switch]$Clean,
    
    [Parameter()]
    [switch]$Test
)

$ErrorActionPreference = "Stop"

Write-Host "projfs.one Native Module Build Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check for node-gyp
try {
    $nodeGypVersion = npm list -g node-gyp --depth=0 2>$null
    if (-not $nodeGypVersion) {
        Write-Host "Installing node-gyp globally..." -ForegroundColor Yellow
        npm install -g node-gyp
    }
} catch {
    Write-Host "Error checking node-gyp: $_" -ForegroundColor Red
    exit 1
}

# Check for Visual Studio
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -property installationPath
    if ($vsPath) {
        Write-Host "Found Visual Studio at: $vsPath" -ForegroundColor Green
    } else {
        Write-Host "Visual Studio not found. Please install Visual Studio 2019 or later with C++ workload." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "vswhere not found. Please install Visual Studio 2019 or later." -ForegroundColor Red
    exit 1
}

# Check for Windows SDK
$sdkReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots" -ErrorAction SilentlyContinue
if ($sdkReg -and $sdkReg.KitsRoot10) {
    Write-Host "Found Windows SDK at: $($sdkReg.KitsRoot10)" -ForegroundColor Green
} else {
    Write-Host "Windows SDK not found. Please install Windows SDK 10.0.18362 or later." -ForegroundColor Red
    exit 1
}

# Clean if requested
if ($Clean) {
    Write-Host "`nCleaning build artifacts..." -ForegroundColor Yellow
    if (Test-Path "build") {
        Remove-Item -Recurse -Force "build"
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    Write-Host "Clean complete." -ForegroundColor Green
}

# Build TypeScript
Write-Host "`nBuilding TypeScript..." -ForegroundColor Yellow
npm run build:ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript build failed." -ForegroundColor Red
    exit 1
}

# Configure native build
Write-Host "`nConfiguring native module build..." -ForegroundColor Yellow
node-gyp configure --msvs_version=2019
if ($LASTEXITCODE -ne 0) {
    Write-Host "node-gyp configure failed." -ForegroundColor Red
    exit 1
}

# Build native module
Write-Host "`nBuilding native module ($Configuration)..." -ForegroundColor Yellow
node-gyp build --$($Configuration.ToLower())
if ($LASTEXITCODE -ne 0) {
    Write-Host "node-gyp build failed." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green

# Copy build output
$buildOutput = "build/$Configuration/projfs_native.node"
if (Test-Path $buildOutput) {
    Write-Host "Native module built at: $buildOutput" -ForegroundColor Green
    
    # Copy to expected location for bindings module
    $bindingsDir = "build/Release"
    if (-not (Test-Path $bindingsDir)) {
        New-Item -ItemType Directory -Path $bindingsDir -Force | Out-Null
    }
    Copy-Item $buildOutput "$bindingsDir/projfs_native.node" -Force
    Write-Host "Copied to: $bindingsDir/projfs_native.node" -ForegroundColor Green
}

# Run tests if requested
if ($Test) {
    Write-Host "`nRunning tests..." -ForegroundColor Yellow
    npm test
}