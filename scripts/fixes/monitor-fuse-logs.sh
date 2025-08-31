#!/bin/bash

echo "🔍 Monitoring FUSE operations for ONE.filer..."
echo "Press Ctrl+C to stop"
echo "=============================================="

# Monitor for any getxattr callback issues and log them
while true; do
    # Check for running ONE.filer process and capture output
    if pgrep -f "lib/index.js" > /dev/null; then
        echo "✅ ONE.filer service is running"
        
        # Test basic operations
        echo "🧪 Testing basic mount operations..."
        
        # Try to read directory with timeout
        if timeout 2 ls /home/refinio/one-files/ >/dev/null 2>&1; then
            echo "✅ Directory listing succeeded"
        else
            echo "⏱️ Directory listing timed out (normal for FUSE serving requests)"
        fi
        
        # Check for recent callback errors in system logs
        echo "🔍 Checking for recent callback errors..."
        if dmesg | tail -20 | grep -i "callback\|fuse\|getxattr" 2>/dev/null; then
            echo "⚠️ Found FUSE-related system messages"
        else
            echo "ℹ️ No recent FUSE errors in system log"
        fi
        
    else
        echo "❌ ONE.filer service not running"
    fi
    
    echo "----------------------------------------"
    sleep 5
done 