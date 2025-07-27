# Create simple test package
Write-Host "Creating simple test package..." -ForegroundColor Cyan

$wslCommand = @"
cd /tmp && rm -rf test-pkg && mkdir -p test-pkg/DEBIAN test-pkg/usr/local/bin
chmod 755 test-pkg test-pkg/DEBIAN test-pkg/usr test-pkg/usr/local test-pkg/usr/local/bin
echo 'Package: one-leute-replicant
Version: 4.0.0-beta-1
Section: base
Priority: optional
Architecture: amd64
Maintainer: REFINIO GmbH
Description: ONE Filer Test Package' > test-pkg/DEBIAN/control
echo '#!/bin/bash
echo \"ONE Filer Test Works!\"
echo \"Package installed successfully\"' > test-pkg/usr/local/bin/one-filer
chmod +x test-pkg/usr/local/bin/one-filer
dpkg-deb --build test-pkg one-leute-replicant_4.0.0-beta-1_amd64.deb
cp one-leute-replicant_4.0.0-beta-1_amd64.deb /mnt/c/Users/juerg/source/one.filer/
"@

wsl -d kali-linux bash -c $wslCommand

if (Test-Path "one-leute-replicant_4.0.0-beta-1_amd64.deb") {
    Write-Host "Test package created successfully!" -ForegroundColor Green
    Write-Host "Package: one-leute-replicant_4.0.0-beta-1_amd64.deb" -ForegroundColor Cyan
} else {
    Write-Host "Failed to create test package" -ForegroundColor Red
} 