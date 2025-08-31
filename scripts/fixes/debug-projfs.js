// Debug script to test the filesystem
import { readFileSync } from 'fs';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/src/misc/OneCoreInit.js';
import { ChannelManager, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import { FilerWithProjFS } from './lib/src/filer/FilerWithProjFS.js';
import ChatFileSystem from '@refinio/one.models/lib/fileSystems/ChatFileSystem.js';
import DebugFileSystem from '@refinio/one.models/lib/fileSystems/DebugFileSystem.js';
import ObjectsFileSystem from '@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js';
import RootFileSystem from '@refinio/one.models/lib/fileSystems/RootFileSystem.js';

async function debugFileSystem() {
    try {
        // Load config
        const config = JSON.parse(readFileSync('configs/windows-native.json', 'utf8'));
        
        console.log('Initializing ONE.core...');
        await initOneCoreInstance(config.directory, 'test123');
        
        // Create models
        const channelManager = new ChannelManager();
        const leuteModel = new LeuteModel();
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        const iomManager = new IoMManager();
        
        await leuteModel.init();
        await channelManager.init();
        await topicModel.init();
        
        // Create root filesystem
        console.log('\nCreating root filesystem...');
        const chatFS = new ChatFileSystem(leuteModel, topicModel, channelManager, notifications, '/objects');
        const debugFS = new DebugFileSystem(leuteModel, topicModel, null, channelManager);
        const objectsFS = new ObjectsFileSystem();
        
        const rootFS = new RootFileSystem([
            { path: 'chats', fileSystem: chatFS },
            { path: 'debug', fileSystem: debugFS },
            { path: 'objects', fileSystem: objectsFS }
        ]);
        
        // Test root directory
        console.log('\nTesting root directory enumeration:');
        const rootDir = await rootFS.readDir('/');
        console.log('Root contents:', rootDir);
        
        // Test subdirectories
        for (const child of rootDir.children || []) {
            console.log(`\nChecking /${child}:`);
            try {
                const stat = await rootFS.stat(`/${child}`);
                console.log(`  Stat:`, stat);
                
                if (stat.mode & 0o040000) { // Is directory
                    const subDir = await rootFS.readDir(`/${child}`);
                    console.log(`  Contents (${subDir.children?.length || 0} items):`, 
                        subDir.children?.slice(0, 5) || []);
                }
            } catch (err) {
                console.log(`  Error:`, err.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        shutdownOneCoreInstance();
    }
}

debugFileSystem();