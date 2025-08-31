#!/usr/bin/env node
import '@refinio/one.core/lib/system/load-nodejs.js';
import { FilerWithProjFS } from './lib/filer/FilerWithProjFS.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/misc/OneCoreInit.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'test-simple-' + Date.now();
const MOUNT_POINT = 'C:\\TestSimple';
const SECRET = 'test-' + Date.now();

async function test() {
    let filer = null;
    
    try {
        console.log('Setting up...');
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'objects'), { recursive: true });
        
        await initOneCoreInstance(TEST_DIR, SECRET);
        
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
        
        const filerConfig = {
            useProjFS: true,
            projfsRoot: MOUNT_POINT,
            mountPoint: MOUNT_POINT,
            iomMode: 'light',
            pairingUrl: 'http://test-pairing.local',
            logCalls: false
        };
        
        filer = new FilerWithProjFS(
            { channelManager, connections, leuteModel, notifications, topicModel, iomManager },
            filerConfig
        );
        
        console.log('Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ Mounted at:', MOUNT_POINT);
        console.log('\nYou can now:');
        console.log('1. Open File Explorer and navigate to', MOUNT_POINT);
        console.log('2. Browse into the invites folder');
        console.log('3. Press Ctrl+C to exit\n');
        
        // Keep running
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (filer) await filer.shutdown();
        await shutdownOneCoreInstance();
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    }
}

test().catch(console.error);