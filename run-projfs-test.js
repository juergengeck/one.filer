#!/usr/bin/env node
// ProjFS Test Script
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-projfs-data';
const MOUNT_POINT = 'C:\\TestProjFS';
const SECRET = 'test-projfs-' + Date.now();

console.log('🧪 ProjFS Test Script');
console.log('====================\n');

async function cleanup() {
    console.log('🧹 Cleaning up...');
    try {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
        if (fs.existsSync(MOUNT_POINT)) {
            try {
                fs.rmSync(MOUNT_POINT, { recursive: true, force: true });
            } catch (e) {
                console.log('   Mount point cleanup skipped (may be in use)');
            }
        }
    } catch (e) {
        console.log('   Cleanup warning:', e.message);
    }
}

async function runProjFSTest() {
    let filer = null;
    
    try {
        // Clean up before starting
        await cleanup();
        
        // 1. Setup
        console.log('1️⃣ Setting up test environment...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        
        console.log('2️⃣ Initializing ONE.core...');
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // 3. Create models
        console.log('3️⃣ Creating models...');
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, {});
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        
        // IoMManager with minimal config
        const ioMConfig = {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        };
        const iomManager = new IoMManager(channelManager, leuteModel, ioMConfig);
        
        // 4. Create and initialize ProjFS filer
        console.log('4️⃣ Creating ProjFS filer...');
        const filerConfig = {
            useProjFS: true,
            projfsRoot: MOUNT_POINT,
            projfsCacheSize: 104857600,
            mountPoint: MOUNT_POINT,
            iomMode: 'light',
            logCalls: true
        };
        
        filer = new FilerWithProjFS(
            {
                channelManager,
                connections,
                leuteModel,
                notifications,
                topicModel,
                iomManager
            },
            filerConfig
        );
        
        console.log('5️⃣ Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ ProjFS initialized successfully!');
        console.log(`📁 Mount point: ${MOUNT_POINT}\n`);
        
        // 5. Test basic operations
        console.log('6️⃣ Testing basic operations...');
        
        // Check mount point
        if (fs.existsSync(MOUNT_POINT)) {
            console.log('   ✅ Mount point exists');
            
            // List contents
            try {
                const contents = fs.readdirSync(MOUNT_POINT);
                console.log(`   ✅ Directory listing: ${contents.length} items`);
                if (contents.length > 0) {
                    console.log(`      Contents: ${contents.join(', ')}`);
                }
            } catch (e) {
                console.log('   ❌ Failed to list directory:', e.message);
            }
            
            // Check stats
            try {
                const stats = fs.statSync(MOUNT_POINT);
                console.log(`   ✅ Mount point is ${stats.isDirectory() ? 'directory' : 'not a directory'}`);
            } catch (e) {
                console.log('   ❌ Failed to get stats:', e.message);
            }
        } else {
            console.log('   ❌ Mount point does not exist');
        }
        
        // Keep running for manual testing
        console.log('\n📌 ProjFS is now running. You can:');
        console.log(`   - Open File Explorer and navigate to ${MOUNT_POINT}`);
        console.log('   - Press Ctrl+C to stop and clean up\n');
        
        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n⏹️ Shutting down...');
            
            if (filer) {
                console.log('   Stopping filer...');
                await filer.shutdown();
            }
            
            console.log('   Stopping ONE.core...');
            await shutdownOneCoreInstance();
            
            await cleanup();
            
            console.log('\n✅ Shutdown complete');
            process.exit(0);
        });
        
        // Keep process alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        
        // Emergency cleanup
        try {
            if (filer) await filer.shutdown();
            await shutdownOneCoreInstance();
            await cleanup();
        } catch (e) {
            // Ignore cleanup errors
        }
        
        process.exit(1);
    }
}

// Run the test
runProjFSTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});