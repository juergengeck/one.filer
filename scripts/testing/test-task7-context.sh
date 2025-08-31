#!/bin/bash

echo "================================================"
echo "Testing Task 7: WSL2-Windows Bridge Configuration"
echo "================================================"
echo

echo "🔍 Current environment:"
echo "  - User: $(whoami)"
echo "  - PWD: $(pwd)"
echo "  - Platform: WSL2/Linux"
echo

echo "📁 Step 1: Ensure /mnt/c/one-files exists..."
if [ ! -d "/mnt/c/one-files" ]; then
    echo "Creating /mnt/c/one-files directory..."
    sudo mkdir -p /mnt/c/one-files
    sudo chmod 755 /mnt/c/one-files
    echo "✓ Created /mnt/c/one-files"
else
    echo "✓ /mnt/c/one-files already exists"
fi

echo
echo "📋 Step 2: Check directory permissions..."
ls -la /mnt/c/ | grep one-files
echo

echo "🚀 Step 3: Starting ONE.filer with WSL2-Windows bridge config..."
echo "Config: configs/filer-windows-bridge.json"
echo "Mount: /mnt/c/one-files"
echo "Expected Windows access: C:\\one-files\\"
echo

# Build if needed
if [ ! -f "dist/one.filer.js" ]; then
    echo "Building ONE.filer..."
    npm run build
fi

echo "Starting filer (will run for 30 seconds for testing)..."
timeout 30s node dist/one.filer.js --config-file=configs/filer-windows-bridge.json &
FILER_PID=$!

echo "Waiting for filer to start..."
sleep 5

echo
echo "📊 Step 4: Check mount status..."
echo "Mount point contents:"
ls -la /mnt/c/one-files/ 2>/dev/null || echo "Mount not ready yet"

echo
sleep 10
echo "After 10 more seconds:"
ls -la /mnt/c/one-files/ 2>/dev/null || echo "Mount still not ready"

echo
echo "🪟 Step 5: Test Windows access path..."
echo "Expected Windows path: C:\\one-files\\"
echo "Expected WSL access via: \\\\wsl\$\\Debian\\mnt\\one-files" 
echo

# Create test file from WSL side
echo "Creating test file from WSL side..."
echo "Hello from WSL2" > /tmp/test-wsl-file.txt
if cp /tmp/test-wsl-file.txt /mnt/c/one-files/ 2>/dev/null; then
    echo "✓ Successfully copied file to mount point"
    ls -la /mnt/c/one-files/test-wsl-file.txt
else
    echo "✗ Failed to copy file to mount point"
fi

echo
echo "💡 Manual test steps for Windows:"
echo "1. Open Windows Explorer"
echo "2. Navigate to C:\\one-files\\"
echo "3. Try to access the contents"
echo "4. Alternative: Try \\\\wsl\$\\Debian\\mnt\\one-files"

echo
echo "⏹️  Stopping filer..."
kill $FILER_PID 2>/dev/null
wait $FILER_PID 2>/dev/null

echo
echo "================================================"
echo "Task 7 WSL2-Windows Bridge Test Complete"  
echo "================================================" 