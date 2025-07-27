#!/bin/bash
# Build and test FUSE3 N-API addon in WSL

echo "Building FUSE3 N-API addon in WSL..."

# Convert Windows path to WSL path
WSL_PATH="/mnt/c/Users/juerg/source/one.filer/src/fuse/n-api"

# Run build in WSL
wsl.exe bash -c "cd $WSL_PATH && npm install && npm run build && echo 'Build completed successfully!'"

echo ""
echo "To test the addon, run in WSL:"
echo "  wsl"
echo "  cd $WSL_PATH"
echo "  sudo node test.js"