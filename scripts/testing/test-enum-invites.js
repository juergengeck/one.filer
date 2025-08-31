#!/usr/bin/env node
// Direct test of invites enumeration
import '@refinio/one.core/lib/system/load-nodejs.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';
import TemporaryFileSystem from '@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';
import * as fs from 'fs';

const TEST_DIR = 'test-enum-' + Date.now();

async function test() {
    try {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(TEST_DIR + '/objects', { recursive: true });
        
        await initOneCoreInstance(TEST_DIR, 'test123');
        
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, {});
        const iomManager = new IoMManager(channelManager, leuteModel, {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        });
        
        // Create filesystems
        const pairingFS = new PairingFileSystem(connections, iomManager, 'http://test.local', 'light');
        const rootFS = new TemporaryFileSystem();
        await rootFS.mountFileSystem('/invites', pairingFS);
        
        console.log('\nTesting /invites enumeration:');
        
        // Test root
        const root = await rootFS.readDir('/');
        console.log('Root dirs:', root.children);
        
        // Test invites
        const invites = await rootFS.readDir('/invites');
        console.log('Invites files:', invites.children);
        
        // Test stat on each file
        for (const file of invites.children || []) {
            const path = '/invites/' + file;
            try {
                const stat = await rootFS.stat(path);
                console.log(`  ${file}: size=${stat.size}, mode=${stat.mode}`);
            } catch (e) {
                console.log(`  ${file}: ERROR - ${e.message}`);
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