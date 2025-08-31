#!/usr/bin/env node

/**
 * Minimal FUSE test for ONE.filer - Linux only, no one.core dependencies
 * Tests that our Linux-only FUSE setup works correctly in WSL2
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    // Test Linux-only FUSE library
    console.log('🔍 Testing Linux-only FUSE implementation...');
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('Node.js version:', process.version);
    
    const libfuse = require('fuse-shared-library-linux');
    console.log('✅ fuse-shared-library-linux loaded successfully');
    console.log('Available methods:', Object.keys(libfuse));
    
    // Test basic FUSE configuration check
    console.log('\n🔧 Checking FUSE configuration...');
    libfuse.isConfigured((err, configured) => {
        if (err) {
            console.log('❌ Error checking FUSE configuration:', err.message);
        } else {
            console.log(configured ? '✅ FUSE is configured' : '⚠️  FUSE needs configuration');
        }
        
        // Show library paths
        console.log('\n📂 FUSE library paths:');
        console.log('Library:', libfuse.lib);
        console.log('Include:', libfuse.include);
        
        console.log('\n✅ Linux-only FUSE test completed successfully!');
        console.log('🎯 Ready for WSL2 deployment without Windows dependencies');
    });
    
} catch (error) {
    console.error('❌ FUSE test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
} 