# ProjFS.ONE Test Runner (PowerShell)

Write-Host "🧪 ProjFS.ONE Test Runner (Windows PowerShell)" -ForegroundColor Cyan
Write-Host ""

# Compile TypeScript
Write-Host "📦 Compiling TypeScript..." -ForegroundColor Yellow
$compileResult = & npx tsc 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    Write-Host $compileResult
    exit 1
}
Write-Host "✅ TypeScript compilation successful" -ForegroundColor Green
Write-Host ""

$failed = $false

# Run Unit Tests
Write-Host "🧪 Running Unit Tests..." -ForegroundColor Yellow
Write-Host ("─" * 60) -ForegroundColor DarkGray
& npx mocha "dist/test/unit/**/*.test.js" --timeout 5000
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Unit tests failed" -ForegroundColor Red
    $failed = $true
}

# Run Integration Tests if they exist
if (Test-Path "dist\test\integration") {
    Write-Host ""
    Write-Host "🧪 Running Integration Tests..." -ForegroundColor Yellow
    Write-Host ("─" * 60) -ForegroundColor DarkGray
    & npx mocha "dist/test/integration/**/*.test.js" --timeout 30000
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Integration tests failed" -ForegroundColor Red
        $failed = $true
    }
}

# Run Performance Tests if they exist
if (Test-Path "dist\test\performance") {
    Write-Host ""
    Write-Host "🧪 Running Performance Tests..." -ForegroundColor Yellow
    Write-Host ("─" * 60) -ForegroundColor DarkGray
    & npx mocha "dist/test/performance/**/*.test.js" --timeout 60000
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Performance tests failed" -ForegroundColor Red
        $failed = $true
    }
}

# Summary
Write-Host ""
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor DarkGray

if ($failed) {
    Write-Host "❌ Some tests failed" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    exit 0
}