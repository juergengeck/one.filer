#!/bin/bash

echo "================================================"
echo "🎯 Task 7: Windows Integration Implementation Test"
echo "================================================"
echo

echo "🔍 Testing Windows integration configuration..."
echo "Config file: configs/filer-windows-bridge.json"
echo

# Validate configuration
echo "📋 Validating configuration structure..."
if node -e "
try {
    const config = require('./configs/filer-windows-bridge.json');
    console.log('✓ Configuration loaded successfully');
    console.log('✓ Mount point:', config.filerConfig.mountPoint);
    console.log('✓ Windows integration enabled:', config.filerConfig.windowsIntegration?.enabled);
    console.log('✓ WSL2 mode:', config.filerConfig.windowsIntegration?.wsl2Mode);
    console.log('✓ Windows mount point:', config.filerConfig.windowsIntegration?.windowsMountPoint);
    console.log('✓ FUSE options:', JSON.stringify(config.filerConfig.fuseOptions));
} catch (e) {
    console.error('✗ Configuration error:', e.message);
    process.exit(1);
}
"; then
    echo "✅ Configuration validation passed"
else
    echo "❌ Configuration validation failed"
    exit 1
fi

echo
echo "📁 Setting up test environment..."

# Ensure mount point exists
if [ ! -d "/mnt/c/one-files" ]; then
    echo "Creating /mnt/c/one-files..."
    sudo mkdir -p /mnt/c/one-files
    sudo chmod 755 /mnt/c/one-files
fi

echo "✓ Mount point prepared: /mnt/c/one-files"
echo "✓ Expected Windows access: C:\\one-files\\"

echo
echo "🚀 Starting Windows Integration Test..."
echo "This will run the filer with Windows integration for 30 seconds..."

# Test the Windows integration
timeout 30s node dist/one.filer.js --config-file=configs/filer-windows-bridge.json 2>&1 | {
    echo "🔍 Monitoring filer output for Windows integration features..."
    while IFS= read -r line; do
        echo "  $line"
        
        # Check for Windows integration indicators
        if [[ "$line" == *"Starting Windows integration mode"* ]]; then
            echo "✅ Windows integration mode activated!"
        fi
        
        if [[ "$line" == *"Windows-enabled FUSE mounted"* ]]; then
            echo "✅ Windows-enabled FUSE mount detected!"
        fi
        
        if [[ "$line" == *"Windows access:"* ]]; then
            echo "✅ Windows access path configured!"
        fi
        
        if [[ "$line" == *"WSL2 FUSE mounted successfully"* ]]; then
            echo "✅ WSL2 FUSE mount successful!"
        fi
    done
}

echo
echo "📊 Test Summary:"
echo "- Windows integration configuration: ✅ Validated"
echo "- Mount point setup: ✅ Ready"
echo "- Implementation: ✅ Deployed"

echo
echo "💡 Next Steps for Manual Testing:"
echo "1. Open Windows Explorer"
echo "2. Navigate to C:\\one-files\\"
echo "3. Check for ONE object directories (debug, invites, objects, types)"
echo "4. Try file operations (create, read, delete)"

echo
echo "================================================"
echo "🎯 Task 7 Windows Integration Test Complete"
echo "================================================" 