#!/bin/bash

echo "=== ONE.filer Ubuntu WSL2 Setup ==="
echo "Using custom refinio/fuse-native with fuse3 libraries"
echo

echo "1. Checking Ubuntu environment..."
cd /home/gecko/one.filer
pwd
ls -la package.json

echo
echo "2. Installing Ubuntu dependencies for fuse3..."
sudo apt update
sudo apt install -y libfuse3-dev libfuse2 build-essential python3 git

echo
echo "3. Node.js version check..."
node --version
npm --version

echo
echo "4. Removing old node_modules and installing fresh dependencies..."
rm -rf node_modules package-lock.json
npm install

echo
echo "5. Building project..."
npm run build

echo
echo "6. Testing basic functionality..."
node --enable-source-maps lib/index.js --help

echo
echo "7. Setting up mount directory..."
mkdir -p /home/gecko/one-files
ls -la /home/gecko/one-files

echo
echo "8. Testing fuse-native custom implementation..."
node -e "const fuse = require('fuse-native'); console.log('✅ Custom fuse-native loaded successfully'); console.log('📋 Version info:', fuse.version || 'custom-refinio');"

echo
echo "=== Setup Complete! ==="
echo "✅ Custom refinio/fuse-native with fuse3 is ready"
echo "🚀 To start the service:"
echo "  node --enable-source-maps lib/index.js start --secret test123"
echo 