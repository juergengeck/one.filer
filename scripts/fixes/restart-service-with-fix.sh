#!/bin/bash

echo "🔄 Restarting ONE.filer service with callback fix..."
echo "=================================================="

# Set PATH
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Function to check if process is running
check_service() {
    /usr/bin/pgrep -f "lib/index.js" > /dev/null
    return $?
}

# Function to kill service
kill_service() {
    echo "🛑 Stopping existing ONE.filer service..."
    /usr/bin/pkill -f "lib/index.js" 2>/dev/null || true
    /bin/sleep 2
    
    # Force kill if still running
    if check_service; then
        echo "⚠️ Force killing service..."
        /usr/bin/pkill -9 -f "lib/index.js" 2>/dev/null || true
        /bin/sleep 2
    fi
}

# Function to unmount FUSE
unmount_fuse() {
    echo "📤 Unmounting FUSE filesystem..."
    
    # Try graceful unmount first
    if /bin/mountpoint -q /home/refinio/one-files 2>/dev/null; then
        /bin/fusermount -u /home/refinio/one-files 2>/dev/null || true
        /bin/sleep 1
    fi
    
    # Force unmount if still mounted
    if /bin/mountpoint -q /home/refinio/one-files 2>/dev/null; then
        echo "⚠️ Force unmounting..."
        /bin/umount -f /home/refinio/one-files 2>/dev/null || true
        /bin/fusermount -u -z /home/refinio/one-files 2>/dev/null || true
        /bin/sleep 1
    fi
    
    # Check if mount point directory exists and is empty
    if [ -d "/home/refinio/one-files" ]; then
        if [ "$(/bin/ls -A /home/refinio/one-files 2>/dev/null)" ]; then
            echo "⚠️ Mount point not empty, cleaning up..."
            /bin/rm -rf /home/refinio/one-files/* 2>/dev/null || true
        fi
    fi
}

# Function to rebuild if needed
rebuild_if_needed() {
    echo "🔨 Checking if rebuild is needed..."
    
    # Check if source is newer than lib
    if [ src/filer/FuseFrontend.ts -nt lib/filer/FuseFrontend.js ]; then
        echo "📦 Rebuilding with latest changes..."
        npm run build
        if [ $? -ne 0 ]; then
            echo "❌ Build failed!"
            exit 1
        fi
        echo "✅ Build completed"
    else
        echo "ℹ️ No rebuild needed"
    fi
}

# Function to start service
start_service() {
    echo "🚀 Starting ONE.filer service..."
    
    # Ensure mount point directory exists
    /bin/mkdir -p /home/refinio/one-files 2>/dev/null || true
    
    # Start service with logging
    nohup node lib/index.js start --config ./configs/filer-fixed.json --secret testsecret > service_output.log 2>&1 &
    
    # Wait for service to start
    /bin/sleep 3
    
    if check_service; then
        echo "✅ ONE.filer service started successfully"
        
        # Wait a bit more for mount to be ready
        /bin/sleep 2
        
        # Check mount status
        if /bin/mountpoint -q /home/refinio/one-files 2>/dev/null; then
            echo "✅ FUSE filesystem mounted at /home/refinio/one-files"
        else
            echo "⚠️ FUSE filesystem not mounted, checking logs..."
            /usr/bin/tail -10 service_output.log
        fi
    else
        echo "❌ Failed to start ONE.filer service"
        echo "📄 Last 10 lines of log:"
        /usr/bin/tail -10 service_output.log
        exit 1
    fi
}

# Main execution
echo "Starting restart sequence..."

# Step 1: Kill existing service
kill_service

# Step 2: Unmount FUSE
unmount_fuse

# Step 3: Rebuild if needed
rebuild_if_needed

# Step 4: Start service
start_service

echo ""
echo "🎉 Service restart completed!"
echo "📋 Current status:"
echo "   Service running: $(check_service && echo "✅ Yes" || echo "❌ No")"
echo "   FUSE mounted: $(/bin/mountpoint -q /home/refinio/one-files && echo "✅ Yes" || echo "❌ No")"
echo ""
echo "🧪 Test the mount with: ls /home/refinio/one-files"
echo "🪟 Test Windows access via: \\\\wsl.localhost\\kali-linux\\home\\refinio\\one-files" 