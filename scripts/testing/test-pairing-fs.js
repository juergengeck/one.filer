#!/usr/bin/env node
// Test PairingFileSystem directly
import '@refinio/one.core/lib/system/load-nodejs.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from '../lib/misc/OneCoreInit.js';
import { ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';

const TEST_DIR = 'test-pairing-fs';
const SECRET = 'test-pairing-' + Date.now();

async function testPairingFS() {
    try {
        // Setup
        console.log('Setting up test environment...');
        const fs = await import('fs');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(`${TEST_DIR}/objects`, { recursive: true });
        
        console.log('Initializing ONE.core...');
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // Create models
        const leuteModel = new LeuteModel();
        const connections = new ConnectionsModel(leuteModel, {});
        const ioMConfig = {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        };
        const iomManager = new IoMManager(leuteModel, ioMConfig);
        
        await leuteModel.init();
        await iomManager.init();
        await connections.init();
        
        // Create PairingFileSystem
        console.log('\nCreating PairingFileSystem...');
        const pairingFS = new PairingFileSystem(
            connections,
            iomManager,
            'https://refin.io/',  // Default pairing URL
            'light'               // IoM mode
        );
        
        // Test stat on root
        console.log('\nTesting stat("/invites")...');
        try {
            const stat = await pairingFS.stat('/');
            console.log('✅ Root stat:', stat);
        } catch (e) {
            console.log('❌ Root stat error:', e.message);
        }
        
        // Test readDir
        console.log('\nTesting readDir("/invites")...');
        try {
            const dir = await pairingFS.readDir('/');
            console.log('✅ Directory contents:', dir);
        } catch (e) {
            console.log('❌ ReadDir error:', e.message);
        }
        
        // Test specific files
        console.log('\nTesting specific files...');
        const testFiles = ['/', '/README.txt', '/invite.txt'];
        
        for (const file of testFiles) {
            try {
                const stat = await pairingFS.stat(file);
                console.log(`✅ ${file} stat:`, stat);
                
                if ((stat.mode & 0o040000) === 0) { // Not a directory
                    const content = await pairingFS.readFile(file);
                    console.log(`   Content preview: "${content.content.substring(0, 50)}..."`);
                }
            } catch (e) {
                console.log(`❌ ${file} error:`, e.message);
            }
        }
        
        // Cleanup
        await shutdownOneCoreInstance();
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testPairingFS();