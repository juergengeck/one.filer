#!/usr/bin/env node
// Trace invites enumeration in detail
import '@refinio/one.core/lib/system/load-nodejs.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';
import { ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import { ChannelManager } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-pairing-' + Date.now();
const SECRET = 'test-' + Date.now();

console.log('🔍 Testing PairingFileSystem directly');
console.log('======================================\n');

async function testPairingFS() {
    try {
        // Setup
        console.log('1️⃣ Setting up test environment...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        console.log('2️⃣ Initializing ONE.core...');
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // Create minimal models
        console.log('3️⃣ Creating models...');
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, {});
        
        const ioMConfig = {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        };
        const iomManager = new IoMManager(channelManager, leuteModel, ioMConfig);
        
        // Create PairingFileSystem
        console.log('4️⃣ Creating PairingFileSystem...');
        const pairingFS = new PairingFileSystem(
            connections,
            iomManager,
            'http://test-pairing.local',  // pairing URL
            'light'  // IoM mode
        );
        
        console.log('5️⃣ Testing invites folder operations:\n');
        
        // Test stat
        console.log('   Testing stat("/")...');
        try {
            const rootStat = await pairingFS.stat('/');
            console.log('   Root stat:', {
                size: rootStat.size,
                mode: rootStat.mode,
                isDirectory: typeof rootStat.isDirectory === 'function' ? rootStat.isDirectory() : 'not a function'
            });
        } catch (err) {
            console.log('   Error:', err.message);
        }
        
        // Test readDir
        console.log('\n   Testing readDir("/")...');
        try {
            const rootContent = await pairingFS.readDir('/');
            console.log('   Root content:', rootContent);
            if (rootContent && rootContent.children) {
                console.log('   Number of children:', rootContent.children.length);
                rootContent.children.forEach(child => {
                    console.log('     - ' + child);
                });
            }
        } catch (err) {
            console.log('   Error:', err.message);
        }
        
        // Test specific files
        console.log('\n6️⃣ Testing expected files:');
        const expectedFiles = ['index.html', 'local.html', 'remote.html'];
        
        for (const file of expectedFiles) {
            console.log(`\n   Testing /${file}:`);
            
            // Stat
            try {
                const fileStat = await pairingFS.stat('/' + file);
                console.log('     stat result:', {
                    size: fileStat.size,
                    mode: fileStat.mode,
                    isDirectory: typeof fileStat.isDirectory === 'function' ? fileStat.isDirectory() : 'not a function'
                });
            } catch (err) {
                console.log('     stat error:', err.message);
            }
            
            // Read
            try {
                const content = await pairingFS.readFile('/' + file);
                console.log('     content length:', content ? content.length : 0);
                if (content && content.length > 0) {
                    console.log('     first 100 chars:', content.toString('utf8').substring(0, 100));
                }
            } catch (err) {
                console.log('     read error:', err.message);
            }
        }
        
        // Check if PairingFileSystem is correctly exposing files
        console.log('\n7️⃣ Checking PairingFileSystem internals:');
        console.log('   Type:', pairingFS.constructor.name);
        console.log('   Has stat method:', typeof pairingFS.stat === 'function');
        console.log('   Has readDir method:', typeof pairingFS.readDir === 'function');
        console.log('   Has readFile method:', typeof pairingFS.readFile === 'function');
        
        // Try to directly check what loadDirectoryContent returns
        if (pairingFS.loadDirectoryContent) {
            console.log('\n8️⃣ Testing loadDirectoryContent:');
            try {
                const content = await pairingFS.loadDirectoryContent('/');
                console.log('   loadDirectoryContent result:', content);
            } catch (err) {
                console.log('   loadDirectoryContent error:', err.message);
            }
        }
        
        console.log('\n✅ Test complete');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await shutdownOneCoreInstance();
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    }
}

// Run test
testPairingFS().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});