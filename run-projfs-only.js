// Direct ProjFS runner - bypasses FUSE completely
import { getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { ChannelManager, ConnectionsModel, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import Notifications from '@refinio/one.models/lib/models/Notifications.js';
import { initOneCoreInstance, shutdownOneCoreInstance } from './lib/src/misc/OneCoreInit.js';
import { FilerWithProjFS } from './lib/src/filer/FilerWithProjFS.js';
import { readFileSync } from 'fs';

console.log('🚀 ONE.filer ProjFS Direct Runner');
console.log('==================================\n');

async function runProjFS() {
    try {
        // Load config
        const configPath = process.argv[2] || 'configs/windows-native.json';
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        
        // Get secret from args or env
        const secret = process.argv[3] || process.env.ONE_SECRET || 'test123';
        
        console.log('Configuration:');
        console.log(`- Config: ${configPath}`);
        console.log(`- Directory: ${config.directory}`);
        console.log(`- ProjFS Root: ${config.filerConfig.projfsRoot}`);
        console.log('');
        
        // Initialize ONE.core
        console.log('Initializing ONE.core...');
        await initOneCoreInstance(config.directory, secret);
        
        // Create models
        const channelManager = new ChannelManager();
        const connections = new ConnectionsModel(config.connectionsConfig);
        const leuteModel = new LeuteModel(channelManager);
        const iomManager = new IoMManager();
        const topicModel = new TopicModel(channelManager, leuteModel);
        const notifications = new Notifications(channelManager);
        
        // Create FilerWithProjFS directly
        console.log('Creating ProjFS filer...');
        const filer = new FilerWithProjFS(
            {
                channelManager,
                connections,
                leuteModel,
                notifications,
                topicModel,
                iomManager
            },
            config.filerConfig
        );
        
        // Initialize (this will use ProjFS)
        console.log('Initializing ProjFS...');
        await filer.init();
        
        console.log('\n✅ ProjFS filesystem mounted successfully!');
        console.log(`📁 Access your files at: ${config.filerConfig.projfsRoot}\n`);
        
        // Keep running
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await filer.shutdown();
            await shutdownOneCoreInstance();
            process.exit(0);
        });
        
        // Keep the process alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Failed to start ProjFS:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runProjFS();
}