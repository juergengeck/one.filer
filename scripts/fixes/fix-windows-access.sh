#!/bin/bash

echo "=== Fixing Windows Access to FUSE Mounts in WSL2 ==="
echo

# Ensure we're in Ubuntu WSL environment
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "❌ This script must run within Ubuntu WSL2"
    exit 1
fi

echo "1. Setting up FUSE permissions for Windows access..."

# Add user to fuse group
sudo usermod -a -G fuse $USER

# Enable user_allow_other in fuse configuration  
echo "user_allow_other" | sudo tee -a /etc/fuse.conf >/dev/null

echo "2. Creating Windows-accessible mount directory..."
sudo mkdir -p /mnt/one-files
sudo chown $USER:$USER /mnt/one-files
sudo chmod 755 /mnt/one-files

echo "3. Testing basic FUSE setup..."
ls -la /mnt/one-files
mount | grep fuse || echo "No current FUSE mounts"

echo "4. Installing clean dependencies..."
cd /home/gecko/one.filer
npm install --silent

echo "5. Creating test FUSE mount..."
# Unmount any existing mounts
fusermount -u /mnt/one-files 2>/dev/null || true

# Start the service with Windows-accessible configuration
echo "Starting ONE.filer with Windows-accessible mount..."
node --enable-source-maps lib/index.js start --secret test123 -c /mnt/c/Users/juerg/source/one.filer/configs/filer-windows-accessible.json &

FILER_PID=$!
echo "Service started with PID: $FILER_PID"

# Wait for mount to initialize
sleep 5

echo "6. Verifying mount..."
if mount | grep -q "/mnt/one-files"; then
    echo "✅ FUSE mount successful"
    ls -la /mnt/one-files
    
    echo "7. Setting proper permissions for Windows access..."
    # Ensure proper permissions
    sudo chmod 755 /mnt/one-files
    
    echo "✅ Mount is ready for Windows access at:"
    echo "   \\\\wsl.localhost\\Ubuntu\\mnt\\one-files"
    echo
    echo "Try accessing this path in Windows Explorer"
    
else
    echo "❌ FUSE mount failed"
    kill $FILER_PID 2>/dev/null
    exit 1
fi

echo
echo "=== Windows Access Fix Complete ==="
echo "Mount location: /mnt/one-files"
echo "Windows path: \\\\wsl.localhost\\Ubuntu\\mnt\\one-files"
echo "Service PID: $FILER_PID (running in background)" 