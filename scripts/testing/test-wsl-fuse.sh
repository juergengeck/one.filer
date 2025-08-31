#!/bin/bash

echo "🧪 Testing ONE Filer FUSE in WSL"
echo "================================"

# Quick test to see if we can run the FUSE components
cd /mnt/c/Users/juerg/source/one.filer

# Check if the project files are accessible
if [ -f "lib/Replicant.js" ]; then
    echo "✅ Project files accessible"
else
    echo "❌ Cannot find lib/Replicant.js"
    echo "   Building project..."
    npm run build
fi

# Test if we can import the module
node -e "
try {
    const Replicant = require('./lib/Replicant.js').default;
    console.log('✅ Replicant module loads successfully');
    
    // Check if Filer class is available
    const { Filer } = require('./lib/filer/Filer.js');
    console.log('✅ Filer module loads successfully');
    
    // Check platform
    if (process.platform === 'linux') {
        console.log('✅ Running on Linux - FUSE mode available');
    } else {
        console.log('⚠️  Platform:', process.platform);
    }
} catch (error) {
    console.error('❌ Error loading modules:', error.message);
    process.exit(1);
}
"

echo ""
echo "📊 System Info:"
echo "   Node version: $(node --version)"
echo "   Platform: $(uname -s)"
echo "   FUSE available: $(which fusermount)"
echo ""
echo "✨ WSL FUSE test complete!"