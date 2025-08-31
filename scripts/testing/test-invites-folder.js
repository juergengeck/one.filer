#!/usr/bin/env node
// Test script to trace invites folder enumeration
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-invites-' + Date.now();
const MOUNT_POINT = 'C:\\TestInvites_' + Date.now();
const SECRET = 'test-invites-' + Date.now();

console.log('🔍 Invites Folder Trace Test');
console.log('============================\n');

async function testInvitesFolder() {
    let filer = null;
    
    try {
        // Setup
        console.log('1️⃣ Setting up test environment...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        const objectsDir = path.join(TEST_DIR, 'objects');
        fs.mkdirSync(objectsDir, { recursive: true });
        
        console.log('2️⃣ Initializing ONE.core...');
        await initOneCoreInstance(TEST_DIR, SECRET);
        
        // Create models with IoM configuration
        console.log('3️⃣ Creating models with pairing configuration...');
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel(channelManager);
        const connections = new ConnectionsModel(leuteModel, {});
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        
        // IoMManager with pairing URL
        const ioMConfig = {
            trust: { isActive: false },
            services: [],
            storage: { quota: { enabled: false } }
        };
        const iomManager = new IoMManager(channelManager, leuteModel, ioMConfig);
        
        // Filer config with pairing URL
        const filerConfig = {
            useProjFS: true,
            projfsRoot: MOUNT_POINT,
            mountPoint: MOUNT_POINT,
            iomMode: 'light',
            pairingUrl: 'http://test-pairing.local',  // Add pairing URL
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
        
        console.log('4️⃣ Getting root filesystem before mounting...');
        await filer.init();
        
        const rootFS = filer.getRootFileSystem();
        if (rootFS) {
            console.log('✅ Root filesystem obtained');
            
            // Test invites folder directly through filesystem
            console.log('\n5️⃣ Testing invites folder through filesystem:');
            try {
                const invitesContent = await rootFS.readDir('/invites');
                console.log('   Invites folder content:', invitesContent);
                
                if (invitesContent && invitesContent.children) {
                    console.log('   Number of items:', invitesContent.children.length);
                    invitesContent.children.forEach(item => {
                        console.log('   - ' + item);
                    });
                } else {
                    console.log('   ⚠️ Invites folder returned no children');
                }
            } catch (err) {
                console.log('   ❌ Error reading invites folder:', err.message);
            }
            
            // Try to read specific invites files
            console.log('\n6️⃣ Checking for expected invite files:');
            const expectedFiles = ['index.html', 'local.html', 'remote.html'];
            for (const file of expectedFiles) {
                try {
                    const stat = await rootFS.stat('/invites/' + file);
                    console.log(`   ✅ ${file} exists - size: ${stat.size}`);
                } catch (err) {
                    console.log(`   ❌ ${file} not found: ${err.message}`);
                }
            }
            
            // Check PairingFileSystem directly
            console.log('\n7️⃣ Checking PairingFileSystem initialization:');
            try {
                // Try reading root to trigger initialization
                const rootContent = await rootFS.readDir('/');
                console.log('   Root folders:', rootContent.children);
                
                // Check invites metadata
                const invitesStat = await rootFS.stat('/invites');
                console.log('   Invites folder stat:', {
                    size: invitesStat.size,
                    mode: invitesStat.mode,
                    isDirectory: invitesStat.isDirectory()
                });
            } catch (err) {
                console.log('   Error:', err.message);
            }
        }
        
        console.log('\n8️⃣ Checking mount point through Windows:');
        if (fs.existsSync(MOUNT_POINT)) {
            console.log('   Mount point exists');
            
            // List root
            const rootItems = fs.readdirSync(MOUNT_POINT);
            console.log('   Root items:', rootItems);
            
            // Check invites folder
            const invitesPath = path.join(MOUNT_POINT, 'invites');
            if (fs.existsSync(invitesPath)) {
                console.log('   Invites folder exists');
                try {
                    const invitesItems = fs.readdirSync(invitesPath);
                    console.log('   Invites folder items:', invitesItems);
                    if (invitesItems.length === 0) {
                        console.log('   ⚠️ Invites folder is empty in Windows');
                    }
                } catch (err) {
                    console.log('   ❌ Error reading invites folder:', err.message);
                }
            } else {
                console.log('   ❌ Invites folder does not exist');
            }
        }
        
        console.log('\n✅ Test complete. Press Ctrl+C to exit.\n');
        
        // Keep running
        await new Promise(() => {});
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (filer) await filer.shutdown();
        await shutdownOneCoreInstance();
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
        if (fs.existsSync(MOUNT_POINT)) {
            try {
                fs.rmSync(MOUNT_POINT, { recursive: true, force: true });
            } catch (e) {
                // Ignore
            }
        }
    }
}

// Run test
testInvitesFolder().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});