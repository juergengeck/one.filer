#!/bin/bash

echo "=== FUSE WSL Stack Test ==="
echo "Platform: $(uname -a)"
echo "User: $USER"
echo "Current directory: $(pwd)"
echo

echo "Step 1: Setting up project directory..."
mkdir -p /home/gecko/one.filer
cd /home/gecko/one.filer

echo "Step 2: Copying project files if needed..."
if [ ! -f package.json ]; then
    echo "Copying from Windows..."
    cp -r /mnt/c/Users/juerg/source/one.filer/* ./ 2>/dev/null || echo "Copy failed - continuing..."
else
    echo "Files already present"
fi

echo "Step 3: Configuring FUSE..."
echo 'user_allow_other' | sudo tee -a /etc/fuse.conf >/dev/null 2>&1
sudo usermod -a -G fuse $USER

echo "Step 4: Creating mount directory..."
sudo mkdir -p /mnt/one-files
sudo chown $USER:$USER /mnt/one-files
sudo chmod 755 /mnt/one-files

echo "Step 5: Installing npm dependencies..."
npm install --silent 2>/dev/null || npm install

echo "Step 6: Testing FUSE library..."
if [ -f test-fuse-minimal.js ]; then
    node test-fuse-minimal.js
else
    echo "No FUSE test file found - continuing..."
fi

echo "Step 7: Starting FUSE mount..."
echo "Unmounting any existing mounts..."
fusermount -u /mnt/one-files 2>/dev/null || true

echo "Starting ONE.filer with FUSE mount..."
echo "Command: node --enable-source-maps lib/index.js start --secret test123 --mount-dir /mnt/one-files --allow-other --default-permissions"

# Start in background
nohup node --enable-source-maps lib/index.js start \
  --secret test123 \
  --mount-dir /mnt/one-files \
  --allow-other \
  --default-permissions > fuse.log 2>&1 &

FUSE_PID=$!
echo "FUSE process started with PID: $FUSE_PID"

echo "Waiting for mount to initialize..."
sleep 5

echo "Step 8: Checking mount status..."
if mount | grep -q "/mnt/one-files"; then
    echo "✅ FUSE mount successful!"
    mount | grep fuse
    echo
    echo "Mount directory contents:"
    ls -la /mnt/one-files/
    echo
    echo "✅ Mount ready for Windows access at:"
    echo "   \\\\wsl.localhost\\Ubuntu\\mnt\\one-files"
    echo
    echo "🔑 Password: test123"
    echo
    echo "Try accessing this path in Windows Explorer!"
else
    echo "❌ FUSE mount failed"
    echo "Checking logs..."
    cat fuse.log 2>/dev/null || echo "No log file"
    echo
    echo "Process status:"
    ps aux | grep node | head -5
fi

echo
echo "=== Test Complete ==="
echo "FUSE PID: $FUSE_PID (running in background)" 