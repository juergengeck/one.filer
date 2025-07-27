#!/bin/bash
# Start ONE.filer with FUSE mount accessible from Windows

echo "Starting ONE.filer with Windows-accessible FUSE mount..."
echo "========================================================"

# Ensure we're in the project directory
cd "$(dirname "$0")"

# Kill any existing one.filer processes
echo "Stopping any existing one.filer processes..."
pkill -f "node.*filer" 2>/dev/null
sleep 2

# Ensure mount directory exists and has proper permissions
MOUNT_DIR="/home/gecko/one-files"
echo "Setting up mount directory: $MOUNT_DIR"
mkdir -p "$MOUNT_DIR"
chmod 755 "$MOUNT_DIR"

# Start one.filer with the WSL-accessible config
echo "Starting one.filer..."
npm start -- start --config configs/filer-wsl-accessible.json &

# Wait for FUSE mount to be established
echo "Waiting for FUSE mount to be established..."
for i in {1..30}; do
    if mountpoint -q "$MOUNT_DIR"; then
        echo "✓ FUSE mount established successfully!"
        break
    fi
    echo -n "."
    sleep 1
done

# Check if mount was successful
if ! mountpoint -q "$MOUNT_DIR"; then
    echo "✗ ERROR: FUSE mount failed to establish"
    exit 1
fi

echo ""
echo "ONE.filer is now running with FUSE mount at: $MOUNT_DIR"
echo ""
echo "To access from Windows:"
echo "1. Run the following in Windows Command Prompt or PowerShell:"
echo "   net use O: \\\\wsl$\\Ubuntu\\home\\gecko\\one-files /persistent:yes"
echo "2. Or run: test-wsl-access.bat"
echo ""
echo "Press Ctrl+C to stop ONE.filer"

# Keep script running
wait