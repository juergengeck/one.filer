# Simple test runner for Windows FUSE implementation
Write-Host "Testing Windows FUSE3 Implementation" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location "C:\Users\juerg\source\one.filer"

# Run the basic test
Write-Host "Running basic Windows FUSE test..." -ForegroundColor Yellow
& npm run build

Write-Host ""
Write-Host "Running test..." -ForegroundColor Yellow
& npx mocha "test/functional/test-windows-fuse-basic.ts" --require ts-node/register --timeout 30000

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green