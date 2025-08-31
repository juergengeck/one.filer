#!/usr/bin/env node
// ProjFS Explorer - Test navigating the virtual filesystem
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-projfs-explorer';
const MOUNT_POINT = 'C:\\OneFilerExplorer';
const SECRET = 'test-explorer-' + Date.now();

console.log('🔍 ProjFS Explorer Test');
console.log('======================\n');

async function exploreDirectory(dirPath, indent = '') {
    try {
        console.log(`${indent}📁 ${path.basename(dirPath) || '[ROOT]'}`);
        
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
                const stats = fs.statSync(itemPath);
                if (stats.isDirectory()) {
                    // Recursively explore subdirectories (limit depth)
                    if (indent.length < 8) {
                        await exploreDirectory(itemPath, indent + '  ');
                    } else {
                        console.log(`${indent}  📁 ${item}/...`);
                    }
                } else {
                    console.log(`${indent}  📄 ${item} (${stats.size} bytes)`);
                    
                    // Try to read small text files
                    if (stats.size < 1000 && item.endsWith('.txt')) {
                        try {
                            const content = fs.readFileSync(itemPath, 'utf8');
                            console.log(`${indent}     Content: "${content.substring(0, 50)}..."`);
                        } catch (e) {
                            console.log(`${indent}     (Cannot read: ${e.message})`);
                        }
                    }
                }
            } catch (e) {
                console.log(`${indent}  ❌ ${item} (Error: ${e.message})`);
            }
        }
    } catch (e) {
        console.log(`${indent}❌ Cannot read directory: ${e.message}`);
    }
}

async function runExplorer() {
    let filer = null;
    
    try {
        // Clean up any existing mount
        if (fs.existsSync(MOUNT_POINT)) {
            try {
                fs.rmSync(MOUNT_POINT, { recursive: true, force: true });
            } catch (e) {
                console.log('Mount point cleanup skipped (may be in use)');
            }
        }
        
        // Setup
        console.log('1️⃣ Setting up environment...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        console.log('2️⃣ Initializing ONE.core...');
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
        
        // Create ProjFS filer
        console.log('3️⃣ Creating ProjFS filer...');
        filer = new FilerWithProjFS(
            {
                channelManager,
                connections,
                leuteModel,
                notifications,
                topicModel,
                iomManager
            },
            {
                useProjFS: true,
                projfsRoot: MOUNT_POINT,
                logCalls: false,  // Less verbose
                iomMode: 'light'
            }
        );
        
        console.log('4️⃣ Mounting ProjFS...');
        await filer.init();
        
        console.log(`\n✅ Mounted at ${MOUNT_POINT}\n`);
        
        // Wait a moment for mount to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Explore the filesystem
        console.log('5️⃣ Exploring virtual filesystem:\n');
        await exploreDirectory(MOUNT_POINT);
        
        console.log('\n\n✅ Exploration complete!');
        console.log(`\nYou can now open File Explorer and navigate to: ${MOUNT_POINT}`);
        console.log('The virtual filesystem will remain mounted until you press Ctrl+C\n');
        
        // Keep running
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');
            if (filer) await filer.shutdown();
            await shutdownOneCoreInstance();
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
            console.log('Cleanup complete');
            process.exit(0);
        });
        
        // Keep alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        
        // Cleanup
        try {
            if (filer) await filer.shutdown();
            await shutdownOneCoreInstance();
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        } catch (e) {}
        
        process.exit(1);
    }
}

runExplorer().catch(console.error);