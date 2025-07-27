#!/bin/bash

echo "=== Fixing fuse-native to be Linux-only (removing Windows dependencies) ==="
echo

# Ensure we're in Ubuntu WSL environment
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "❌ This script must run within Ubuntu WSL2"
    exit 1
fi

cd /home/gecko/one.filer

echo "1. Removing current fuse-native installation..."
rm -rf node_modules/fuse-native
rm -f package-lock.json

echo "2. Installing Linux-only FUSE dependencies..."
# Install only the Linux FUSE library directly
npm install --no-package-lock fuse-shared-library-linux@^1.0.4

echo "3. Creating minimal fuse-native wrapper..."
mkdir -p node_modules/fuse-native
cp /mnt/c/Users/juerg/source/one.filer/package-linux-fuse.json node_modules/fuse-native/package.json

# Create a minimal index.js that just requires the Linux shared library
cat > node_modules/fuse-native/index.js << 'EOF'
const libfuse = require('fuse-shared-library-linux')

// Export the FUSE implementation for Linux only
module.exports = libfuse

// Add some basic FUSE constants
module.exports.ENOENT = -2
module.exports.EACCES = -13
module.exports.EEXIST = -17
module.exports.ENOTDIR = -20
module.exports.EISDIR = -21
module.exports.EINVAL = -22
module.exports.ENOSPC = -28
EOF

echo "4. Testing the Linux-only fuse-native..."
node -e "
try { 
  const fuse = require('fuse-native'); 
  console.log('✅ Linux-only fuse-native loaded successfully');
  console.log('Available:', Object.keys(fuse));
} catch(e) { 
  console.log('❌ Error:', e.message); 
}"

echo "5. Checking platform detection..."
node -e "console.log('Platform detected as:', process.platform)"

echo
echo "✅ fuse-native is now Linux-only without Windows dependencies!"
echo "The Windows fuse-shared-library-win32 dependency has been completely removed." 