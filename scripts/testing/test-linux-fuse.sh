#!/bin/bash
echo "=== Testing Linux FUSE mount ==="

# Clean up any existing mount
fusermount -u /tmp/test-linux-mount 2>/dev/null
rm -rf /tmp/test-linux-mount
mkdir -p /tmp/test-linux-mount

# Start the FUSE mount in background with verbose output
echo "Starting FUSE mount..."
node lib/index.js start -s test123 --filer true --filer-mount-point /tmp/test-linux-mount 2>&1 | tee fuse-output.log &
PID=$!

# Wait for mount to initialize
echo "Waiting for mount to initialize..."
sleep 5

# Check if process is still running
if kill -0 $PID 2>/dev/null; then
    echo "✅ Process is running (PID: $PID)"
    
    # Check mount status
    if mount | grep -q "/tmp/test-linux-mount"; then
        echo "✅ FUSE mount detected in mount table"
    else
        echo "❌ No FUSE mount detected"
    fi
    
    # Try to list the mount point
    echo "Attempting to list mount point..."
    ls -la /tmp/test-linux-mount/ 2>&1 | head -5
    
    # Kill the process
    echo "Stopping FUSE mount..."
    kill $PID 2>/dev/null
    wait $PID 2>/dev/null
else
    echo "❌ Process died - checking logs..."
    tail -20 fuse-output.log
fi

echo "=== Test complete ==="
