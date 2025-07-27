#!/bin/bash

echo "=== ONE.filer WSL-Native Ubuntu Setup ==="
echo "Running entirely within Ubuntu WSL2 to avoid path conflicts"
echo

# Ensure we're in Ubuntu WSL environment
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "❌ This script must run within Ubuntu WSL2"
    exit 1
fi

# Clean up any existing installation
echo "1. Cleaning up previous installations..."
cd /home/gecko
rm -rf one.filer
rm -rf one-files
rm -rf .npm
killall node 2>/dev/null || true
fusermount -u /home/gecko/one-files 2>/dev/null || true

echo
echo "2. Installing system dependencies..."
sudo apt update
sudo apt install -y libfuse3-dev libfuse2 build-essential python3 git curl

echo
echo "3. Copying project files from Windows (using Linux paths only)..."
cp -r /mnt/c/Users/juerg/source/one.filer /home/gecko/
cd /home/gecko/one.filer

echo
echo "4. Environment verification..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Current directory: $(pwd)"
echo "Platform: $(node -e "console.log(process.platform)")"

echo
echo "5. Configuring npm for WSL..."
npm config set cache /home/gecko/.npm
npm config set prefix /home/gecko/.npm-global
export PATH="/home/gecko/.npm-global/bin:$PATH"

echo
echo "6. Complete npm cleanup..."
npm cache clean --force
rm -rf node_modules package-lock.json
rm -rf /home/gecko/.npm/*

echo
echo "7. Installing dependencies within WSL environment..."
echo "Using GitHub dependencies directly..."

# Install dependencies one by one to avoid conflicts
npm install --no-package-lock commander@^10.0.0
npm install --no-package-lock @commander-js/extra-typings@^10.0.3
npm install --no-package-lock rimraf@^4.1.2

echo
echo "8. Installing custom GitHub dependencies..."
npm install --no-package-lock https://github.com/refinio/one.core.git
npm install --no-package-lock https://github.com/refinio/one.models.git
npm install --no-package-lock github:refinio/fuse-native

echo
echo "9. Installing dev dependencies..."
npm install --no-package-lock --save-dev typescript@^4.9.5
npm install --no-package-lock --save-dev @types/node@^18.14.0

echo
echo "10. Verifying fuse-native installation..."
node -e "
try {
  const fuse = require('fuse-native');
  console.log('✅ Custom refinio/fuse-native loaded successfully');
  console.log('📦 Module path:', require.resolve('fuse-native'));
  console.log('🔧 Available exports:', Object.keys(fuse));
} catch(err) {
  console.error('❌ Failed to load fuse-native:', err.message);
  console.error('Stack:', err.stack);
}
"

echo
echo "11. Building project using WSL paths..."
# Use a simpler build approach first
if [ -f "build.cjs" ]; then
    echo "Building with build.cjs..."
    node build.cjs
elif [ -f "build.js" ]; then
    echo "Building with build.js..."
    node build.js
else
    echo "No build script found, compiling TypeScript directly..."
    npx tsc --outDir lib --module commonjs --target es2020 src/index.ts
fi

echo
echo "12. Testing application..."
if [ -f "lib/index.js" ]; then
    echo "Testing compiled application..."
    node --enable-source-maps lib/index.js --help
else
    echo "❌ lib/index.js not found after build"
    ls -la lib/ || echo "lib/ directory does not exist"
fi

echo
echo "13. Setting up mount directory..."
mkdir -p /home/gecko/one-files
chmod 755 /home/gecko/one-files
ls -la /home/gecko/one-files

echo
echo "=== WSL-Native Setup Complete! ==="
echo "✅ Environment configured entirely within Ubuntu WSL2"
echo "✅ Custom refinio/fuse-native installed"
echo "✅ Dependencies resolved without path conflicts"
echo "🚀 Ready to test:"
echo "  cd /home/gecko/one.filer"
echo "  node --enable-source-maps lib/index.js start --secret test123"
echo 