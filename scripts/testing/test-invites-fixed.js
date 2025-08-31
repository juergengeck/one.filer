#!/usr/bin/env node
// Quick test for invites folder fix
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-fix-' + Date.now();
const MOUNT_POINT = 'C:\\TestFix_' + Date.now();
const SECRET = 'test-' + Date.now();

console.log('🔧 Testing Fixed Invites Folder');
console.log('================================\n');

async function testFixed() {
    let filer = null;
    
    try {
        // Setup
        console.log('Setting up...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // Create models
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, {});
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        
        const ioMConfig = {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        };
        const iomManager = new IoMManager(channelManager, leuteModel, ioMConfig);
        
        // Create filer
        const filerConfig = {
            useProjFS: true,
            projfsRoot: MOUNT_POINT,
            mountPoint: MOUNT_POINT,
            iomMode: 'light',
            pairingUrl: 'http://test-pairing.local',
            logCalls: false // Less verbose
        };
        
        filer = new FilerWithProjFS(
            { channelManager, connections, leuteModel, notifications, topicModel, iomManager },
            filerConfig
        );
        
        console.log('Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ ProjFS mounted at:', MOUNT_POINT);
        
        // Wait for mount
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check invites folder
        console.log('\n📁 Checking invites folder:');
        const invitesPath = path.join(MOUNT_POINT, 'invites');
        
        if (fs.existsSync(invitesPath)) {
            const stats = fs.statSync(invitesPath);
            console.log('   ✅ Invites folder exists');
            console.log('   Is directory:', stats.isDirectory());
            
            if (stats.isDirectory()) {
                try {
                    const files = fs.readdirSync(invitesPath);
                    console.log(`   Contents (${files.length} items):`);
                    files.forEach(file => {
                        const filePath = path.join(invitesPath, file);
                        try {
                            const fileStats = fs.statSync(filePath);
                            console.log(`     - ${file} (${fileStats.size} bytes)`);
                        } catch (e) {
                            console.log(`     - ${file} (error: ${e.message})`);
                        }
                    });
                    
                    if (files.length === 0) {
                        console.log('   ⚠️ Folder is empty');
                    }
                } catch (err) {
                    console.log('   ❌ Error reading directory:', err.message);
                }
            }
        } else {
            console.log('   ❌ Invites folder does not exist');
        }
        
        console.log('\n✅ Test complete. Mount active at:', MOUNT_POINT);
        console.log('Press Ctrl+C to exit.\n');
        
        // Keep running
        await new Promise(() => {});
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        if (filer) await filer.shutdown();
        await shutdownOneCoreInstance();
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    }
}

testFixed().catch(console.error);