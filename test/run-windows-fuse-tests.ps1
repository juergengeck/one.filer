# PowerShell script to run Windows FUSE tests with better error handling

# Self-elevate if not running as admin
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    # Relaunch as administrator
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Windows FUSE (ProjFS) Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Running with Administrator privileges" -ForegroundColor Green

# Check if ProjFS is available
$projfsEnabled = $false

# Method 1: Check if ProjFS is enabled via DISM (more reliable than checking for DLL)
Write-Host "Checking ProjFS status..." -ForegroundColor Yellow
try {
    $dismResult = & dism /online /get-featureinfo /featurename:Client-ProjFS 2>&1
    if ($LASTEXITCODE -eq 0 -and $dismResult -match "State : Enabled") {
        Write-Host "[OK] ProjFS is enabled" -ForegroundColor Green
        $projfsEnabled = $true
        
        # Check if PrjFlt.dll exists (it might not on Windows 10 Home)
        if (Test-Path "C:\Windows\System32\PrjFlt.dll") {
            Write-Host "[OK] PrjFlt.dll found" -ForegroundColor Green
        } else {
            Write-Host "[INFO] PrjFlt.dll not found - this is normal on Windows 10 Home" -ForegroundColor Yellow
            Write-Host "[INFO] Proceeding with ProjFS tests anyway..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] ProjFS is not enabled" -ForegroundColor Yellow
    }
} catch {
    # Fallback to checking for DLL
    if (Test-Path "C:\Windows\System32\PrjFlt.dll") {
        Write-Host "[OK] ProjFS found (via DLL check)" -ForegroundColor Green
        $projfsEnabled = $true
    } else {
        Write-Host "[WARN] ProjFS not found on this system" -ForegroundColor Yellow
    }
}

if (-not $projfsEnabled) {
    
    # Check Windows version
    $os = Get-WmiObject -Class Win32_OperatingSystem
    $version = [System.Environment]::OSVersion.Version
    Write-Host "Windows version: $($os.Caption)" -ForegroundColor Cyan
    Write-Host "Build: $($version.Build)" -ForegroundColor Cyan
    
    # Check if Windows version supports ProjFS
    if ($version.Major -lt 10 -or ($version.Major -eq 10 -and $version.Build -lt 17763)) {
        Write-Host "ERROR: ProjFS requires Windows 10 version 1809 (build 17763) or later" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "ProjFS is not enabled. Attempting to enable it..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try Method 1: DISM (more reliable)
    Write-Host "Method 1: Checking ProjFS via DISM..." -ForegroundColor Cyan
    try {
        $dismResult = & dism /online /get-featureinfo /featurename:Client-ProjFS 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "ProjFS feature found via DISM" -ForegroundColor Green
            
            # Check if it's already enabled
            if ($dismResult -match "State : Enabled") {
                Write-Host "[WARN] ProjFS is enabled via DISM but PrjFlt.dll not found" -ForegroundColor Yellow
                Write-Host "A restart may be required to complete installation" -ForegroundColor Yellow
                
                $response = Read-Host "Would you like to restart now? (Y/N)"
                if ($response -eq 'Y' -or $response -eq 'y') {
                    Restart-Computer -Force
                }
                exit 0
            } else {
                # Try to enable via DISM
                Write-Host "Attempting to enable ProjFS via DISM..." -ForegroundColor Yellow
                & dism /online /enable-feature /featurename:Client-ProjFS /all /norestart
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] ProjFS enabled via DISM!" -ForegroundColor Green
                    Write-Host "[!] IMPORTANT: You must restart your computer for ProjFS to activate" -ForegroundColor Yellow
                    Write-Host ""
                    
                    $response = Read-Host "Would you like to restart now? (Y/N)"
                    if ($response -eq 'Y' -or $response -eq 'y') {
                        Write-Host "Restarting in 10 seconds..." -ForegroundColor Yellow
                        Start-Sleep -Seconds 10
                        Restart-Computer -Force
                    }
                    exit 0
                } else {
                    Write-Host "DISM enable failed, trying PowerShell method..." -ForegroundColor Yellow
                }
            }
        }
    } catch {
        Write-Host "DISM method failed: $_" -ForegroundColor Yellow
    }
    
    # Method 2: PowerShell WindowsOptionalFeature (fallback)
    Write-Host ""
    Write-Host "Method 2: Checking via PowerShell WindowsOptionalFeature..." -ForegroundColor Cyan
    $projfsFeature = Get-WindowsOptionalFeature -Online -FeatureName "Client-ProjFS" -ErrorAction SilentlyContinue
    
    if ($projfsFeature) {
        if ($projfsFeature.State -eq "Disabled") {
            Write-Host "ProjFS feature found but disabled. Enabling..." -ForegroundColor Yellow
            
            try {
                # Try to enable ProjFS
                Enable-WindowsOptionalFeature -Online -FeatureName "Client-ProjFS" -All -NoRestart -ErrorAction Stop | Out-Null
                
                Write-Host "[OK] ProjFS has been enabled!" -ForegroundColor Green
                Write-Host "[!] IMPORTANT: You must restart your computer for ProjFS to activate" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "Please:" -ForegroundColor Cyan
                Write-Host "1. Restart your computer" -ForegroundColor White
                Write-Host "2. Run this test script again" -ForegroundColor White
                Write-Host ""
                
                $response = Read-Host "Would you like to restart now? (Y/N)"
                if ($response -eq 'Y' -or $response -eq 'y') {
                    Write-Host "Restarting in 10 seconds..." -ForegroundColor Yellow
                    Start-Sleep -Seconds 10
                    Restart-Computer -Force
                }
                exit 0
            } catch {
                Write-Host "[FAILED] Could not enable ProjFS via PowerShell: $_" -ForegroundColor Red
            }
        } elseif ($projfsFeature.State -eq "Enabled") {
            Write-Host "[WARN] ProjFS is enabled but PrjFlt.dll not found" -ForegroundColor Yellow
            Write-Host "A restart may be required to complete installation" -ForegroundColor Yellow
            
            $response = Read-Host "Would you like to restart now? (Y/N)"
            if ($response -eq 'Y' -or $response -eq 'y') {
                Restart-Computer -Force
            }
            exit 0
        }
    }
    
    # If both methods failed, provide manual instructions
    Write-Host ""
    Write-Host "[FAILED] Could not enable ProjFS automatically" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please enable ProjFS manually:" -ForegroundColor Yellow
    Write-Host "Option 1: Run 'optionalfeatures.exe' and check 'Windows Projected File System'" -ForegroundColor White
    Write-Host "Option 2: Go to Settings > Apps > Optional features > Add a feature" -ForegroundColor White
    Write-Host "         Search for 'Windows Projected File System' and install it" -ForegroundColor White
    Write-Host "Option 3: This might be a Windows edition that doesn't support ProjFS" -ForegroundColor White
    exit 1
}

# Set up test environment
$env:NODE_ENV = "test"
$env:DEBUG = "fuse:*,projfs:*"

# Clean any existing test mounts
Write-Host "Cleaning up any existing test mounts..." -ForegroundColor Yellow
$testDirs = @("C:\FuseTest", "C:\FuseXPlatTest")
foreach ($dir in $testDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction Stop
            Write-Host "[OK] Cleaned up $dir" -ForegroundColor Green
        } catch {
            Write-Host "[WARN] Could not remove $dir - may be in use" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Running FUSE tests on Windows..." -ForegroundColor Cyan
Write-Host ""

# Run the tests
try {
    # First, run Windows-specific tests
    Write-Host "=== Running Windows-specific FUSE tests ===" -ForegroundColor Yellow
    npx mocha test/functional/fuse-windows-native.test.ts --timeout 60000
    
    Write-Host ""
    Write-Host "=== Running cross-platform FUSE tests ===" -ForegroundColor Yellow
    npx mocha test/functional/fuse-cross-platform.test.ts --timeout 60000
    
    Write-Host ""
    Write-Host "[OK] All tests completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "[FAILED] Tests failed with error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up after tests
    Write-Host ""
    Write-Host "Cleaning up test mounts..." -ForegroundColor Yellow
    foreach ($dir in $testDirs) {
        if (Test-Path $dir) {
            try {
                Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "[OK] Cleaned up $dir" -ForegroundColor Green
            } catch {
                Write-Host "[WARN] Could not remove $dir - manual cleanup may be required" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test run complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan