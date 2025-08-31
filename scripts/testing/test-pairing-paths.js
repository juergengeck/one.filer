#!/usr/bin/env node
import '@refinio/one.core/lib/system/load-nodejs.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';
import TemporaryFileSystem from '@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';
import { ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import { ChannelManager } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-pairing-' + Date.now();
const SECRET = 'test-' + Date.now();

async function test() {
    try {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        await initOneCoreInstance(TEST_DIR, SECRET);
        
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
        const pairingFS = new PairingFileSystem(connections, iomManager, 'http://test.local', 'light');
        
        console.log('Testing PairingFileSystem paths:');
        console.log('================================\n');
        
        // Get root content
        const rootContent = await pairingFS.readDir('/');
        console.log('Root content:', rootContent.children);
        
        // Test each file with different path variations
        for (const filename of rootContent.children) {
            console.log(`\nTesting file: ${filename}`);
            console.log('-'.repeat(30));
            
            // Test different path variations
            const paths = [
                filename,           // no slash
                '/' + filename,     // leading slash
                './' + filename,    // relative
            ];
            
            for (const testPath of paths) {
                try {
                    const stat = await pairingFS.stat(testPath);
                    console.log(`  ✓ stat('${testPath}') worked:`, { size: stat.size, mode: stat.mode });
                } catch (e) {
                    console.log(`  ✗ stat('${testPath}') failed:`, e.message);
                }
            }
        }
        
        // Now test with TemporaryFileSystem mount
        console.log('\n\nTesting with TemporaryFileSystem mount:');
        console.log('========================================\n');
        
        const tempFS = new TemporaryFileSystem();
        await tempFS.mountFileSystem('/invites', pairingFS);
        
        // Check /invites directory
        const invitesContent = await tempFS.readDir('/invites');
        console.log('/invites content:', invitesContent.children);
        
        // Try to stat each file
        for (const filename of invitesContent.children) {
            const fullPath = '/invites/' + filename;
            try {
                const stat = await tempFS.stat(fullPath);
                console.log(`  ✓ stat('${fullPath}') worked:`, { size: stat.size, mode: stat.mode });
            } catch (e) {
                console.log(`  ✗ stat('${fullPath}') failed:`, e.message);
            }
        }
        
    } finally {
        await shutdownOneCoreInstance();
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    }
}

test().catch(console.error);