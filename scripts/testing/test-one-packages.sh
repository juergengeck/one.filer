#!/bin/bash
# Test script for ONE packages in WSL2

echo "🧪 Testing ONE packages in WSL2..."

# Navigate to project directory
cd /mnt/c/Users/juerg/source/one.filer

echo "📁 Current directory: $(pwd)"
echo "📋 Available packages:"
ls -la | grep "one\."

# Test one.leute.replicant
echo ""
echo "🔧 Testing one.leute.replicant..."
cd one.leute.replicant

if [ -f "package.json" ]; then
    echo "✅ package.json found"
    echo "📦 Package info:"
    node -e "console.log(JSON.stringify(require('./package.json'), null, 2))" | head -20
else
    echo "❌ package.json not found"
fi

# Check if dependencies are installed
if [ -d "node_modules" ]; then
    echo "✅ node_modules found"
    echo "📊 Dependency count: $(ls node_modules | wc -l)"
else
    echo "⚠️  node_modules not found - run npm install"
fi

# Test basic Node.js functionality
echo ""
echo "🔍 Testing Node.js environment..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Test if we can import ONE packages
echo ""
echo "📦 Testing ONE package imports..."
cd /mnt/c/Users/juerg/source/one.filer

# Test one.core import
if [ -d "one.core" ]; then
    echo "✅ one.core directory found"
    if [ -f "one.core/package.json" ]; then
        echo "📋 one.core package info:"
        node -e "console.log(require('./one.core/package.json').name + ' v' + require('./one.core/package.json').version)"
    fi
fi

# Test one.models import
if [ -d "one.models" ]; then
    echo "✅ one.models directory found"
    if [ -f "one.models/package.json" ]; then
        echo "📋 one.models package info:"
        node -e "console.log(require('./one.models/package.json').name + ' v' + require('./one.models/package.json').version)"
    fi
fi

echo ""
echo "🎯 Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Configure one.leute.replicant"
echo "  3. Set up FUSE mount"
echo "  4. Test filesystem integration"

echo ""
echo "✅ Test completed!" 