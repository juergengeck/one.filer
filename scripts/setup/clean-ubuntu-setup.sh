#!/bin/bash

echo "=== ONE.filer Ubuntu Complete Clean Setup ==="
echo "This will completely remove and reinstall everything"
echo

# Clean up any existing installation
echo "1. Cleaning up previous installations..."
cd /home/gecko
rm -rf one.filer
rm -rf one-files
rm -rf .npm
killall node 2>/dev/null || true
fusermount -u /home/gecko/one-files 2>/dev/null || true

echo
echo "2. Installing Ubuntu system dependencies..."
sudo apt update
sudo apt install -y libfuse3-dev libfuse2 build-essential python3 git curl

echo
echo "3. Copying fresh project from Windows..."
cp -r /mnt/c/Users/juerg/source/one.filer /home/gecko/
cd /home/gecko/one.filer

echo
echo "4. Node.js environment check..."
node --version
npm --version
which node
which npm

echo
echo "5. Completely clean npm cache and modules..."
npm cache clean --force
rm -rf node_modules package-lock.json

echo
echo "6. Installing dependencies with custom fuse-native..."
npm install --verbose

echo
echo "7. Verifying custom fuse-native installation..."
node -e "
try {
  const fuse = require('fuse-native');
  console.log('✅ Custom refinio/fuse-native loaded successfully');
  console.log('📦 Module path:', require.resolve('fuse-native'));
  console.log('📋 Available methods:', Object.getOwnPropertyNames(fuse).filter(x => typeof fuse[x] === 'function'));
} catch(err) {
  console.error('❌ Failed to load fuse-native:', err.message);
  process.exit(1);
}
"

echo
echo "8. Building project..."
npm run build

echo
echo "9. Testing application..."
node --enable-source-maps lib/index.js --help

echo
echo "10. Setting up mount directory with proper permissions..."
mkdir -p /home/gecko/one-files
chmod 755 /home/gecko/one-files
ls -la /home/gecko/one-files

echo
echo "=== Setup Complete! ==="
echo "✅ Custom refinio/fuse-native with fuse3 is ready"
echo "✅ Ubuntu environment fully configured"
echo "🚀 Ready to test the service"
echo 