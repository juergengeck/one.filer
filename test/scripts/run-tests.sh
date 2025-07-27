#!/bin/bash

# Test runner script for OneFiler
# This script runs tests in the correct order and environment

echo "=== OneFiler Test Suite ==="
echo

# Check if we're in WSL
if ! grep -qi microsoft /proc/version 2>/dev/null; then
    echo "❌ This script must be run in WSL2"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✅ Environment: WSL2"
echo "✅ Node.js: $(node --version)"
echo

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
# Skip build due to TypeScript issues with vendor packages
echo "⚠️  Skipping build - using existing lib files"

echo
echo "🧪 Running tests..."
echo

# Test 00: Basic FUSE mount
echo "Test 00: Basic FUSE Mount"
node test/integration/00-basic-fuse-mount.test.js

# Test 02: Minimal FUSE example
echo
echo "Test 02: Minimal Module Load"
node test/integration/02-minimal-module-load.test.js

echo
echo "=== Test Summary ==="
echo "Run the Windows access test (01-wsl-access.test.ts) from Windows PowerShell"
echo "to verify Windows can access WSL filesystem."