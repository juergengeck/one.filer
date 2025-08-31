#!/usr/bin/env node
// Test invites folder with async bridge fixes
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TEST_DIR = 'test-invites-async-' + Date.now();
const MOUNT_POINT = 'C:\\TestInvitesAsync_' + Date.now();
const SECRET = 'test-' + Date.now();

console.log('🔍 Testing Invites Folder with Async Bridge');
console.log('===========================================\n');

async function testInvitesAsync() {
    let filer = null;
    
    try {
        // Setup
        console.log('1️⃣ Setting up test environment...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        console.log('2️⃣ Initializing ONE.core...');
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // Create models
        console.log('3️⃣ Creating models...');
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
            logCalls: true
        };
        
        filer = new FilerWithProjFS(
            { channelManager, connections, leuteModel, notifications, topicModel, iomManager },
            filerConfig
        );
        
        console.log('4️⃣ Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ ProjFS mounted at:', MOUNT_POINT);
        
        // Wait a moment for mount to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n5️⃣ Testing invites folder enumeration:');
        
        // Try to list invites folder via Windows
        console.log('   Attempting to list invites folder...');
        try {
            const { stdout, stderr } = await execAsync(`cmd /c "dir ${MOUNT_POINT}\\invites /b"`);
            if (stderr) {
                console.log('   Error output:', stderr);
            }
            if (stdout) {
                const files = stdout.trim().split('\n').filter(f => f.trim());
                console.log(`   ✅ Found ${files.length} items in invites folder:`);
                files.forEach(file => {
                    console.log(`      - ${file.trim()}`);
                });
            } else {
                console.log('   ⚠️ Invites folder appears empty');
            }
        } catch (err) {
            console.log('   ❌ Failed to list invites folder:', err.message);
        }
        
        // Try accessing specific files
        console.log('\n6️⃣ Testing specific invite files:');
        const expectedFiles = ['iom_invite.png', 'iom_invite.txt', 'iop_invite.png', 'iop_invite.txt'];
        
        for (const file of expectedFiles) {
            const filePath = path.join(MOUNT_POINT, 'invites', file);
            try {
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    console.log(`   ✅ ${file}: ${stats.size} bytes`);
                } else {
                    console.log(`   ❌ ${file}: not found`);
                }
            } catch (err) {
                console.log(`   ❌ ${file}: ${err.message}`);
            }
        }
        
        console.log('\n✅ Test complete. Keeping mount active for 30 seconds...');
        console.log('   You can open Explorer and navigate to:', MOUNT_POINT);
        
        // Keep running for 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30000));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n🧹 Cleaning up...');
        if (filer) await filer.shutdown();
        await shutdownOneCoreInstance();
        
        // Cleanup
        try {
            if (fs.existsSync(TEST_DIR)) {
                fs.rmSync(TEST_DIR, { recursive: true, force: true });
            }
            if (fs.existsSync(MOUNT_POINT)) {
                fs.rmSync(MOUNT_POINT, { recursive: true, force: true });
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Run test
testInvitesAsync().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});