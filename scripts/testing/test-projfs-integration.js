#!/usr/bin/env node

/**
 * Test script for one.ifsprojfs integration
 * 
 * This script tests the new clean 2-layer architecture
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load Node.js platform modules for one.core
await import('@refinio/one.core/lib/system/load-nodejs.js');

// Import the start command logic
import Replicant from './lib/Replicant.js';
import { fillMissingWithDefaults } from './lib/misc/configHelper.js';
import { DefaultReplicantConfig } from './lib/ReplicantConfig.js';

async function testProjFS() {
    console.log('🧪 Testing one.ifsprojfs integration...\n');
    
    // Load test configuration
    const configPath = join(process.cwd(), 'configs', 'test-clean-architecture.json');
    console.log(`📄 Loading config from: ${configPath}`);
    
    let config;
    try {
        const configData = readFileSync(configPath, 'utf8');
        config = JSON.parse(configData);
        console.log('✅ Config loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load config:', error.message);
        process.exit(1);
    }
    
    // Get secret from command line
    const secret = process.argv[2];
    if (!secret) {
        console.error('❌ Please provide secret as command line argument');
        console.log('Usage: node test-projfs-integration.js <secret>');
        process.exit(1);
    }
    
    // Create and start replicant
    console.log('\n🚀 Starting Replicant with one.ifsprojfs...');
    const replicantConfig = fillMissingWithDefaults(config, DefaultReplicantConfig);
    const replicant = new Replicant(replicantConfig);
    
    try {
        await replicant.start(secret);
        console.log('✅ Replicant started successfully');
        
        // Check if ProjFS mode is active
        if (replicant.filer && replicant.filer.isProjFSMode) {
            console.log('✅ ProjFS mode is active');
            
            // Get stats if available
            const stats = replicant.filer.getStats();
            if (stats) {
                console.log('\n📊 ProjFS Statistics:');
                console.log(`   File requests: ${stats.fileDataRequests}`);
                console.log(`   Directory enumerations: ${stats.directoryEnumerations}`);
                console.log(`   Cache hits: ${stats.cacheHits}`);
                console.log(`   Cache misses: ${stats.cacheMisses}`);
            }
        } else {
            console.log('⚠️  Running in FUSE mode (ProjFS not available)');
        }
        
        console.log(`\n✅ ONE content is now accessible at: ${config.filerConfig.projfsRoot || 'C:\\OneFilerClean'}`);
        console.log('📁 You can browse the virtual drive in Windows Explorer');
        console.log('\nPress Ctrl+C to stop...');
        
        // Keep alive
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down...');
            try {
                await replicant.stop();
                console.log('✅ Shutdown complete');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start replicant:', error);
        process.exit(1);
    }
}

// Run the test
testProjFS().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});