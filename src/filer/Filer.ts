import type {IFileSystem} from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import type {ConnectionsModel} from '@refinio/one.models/lib/models/index.js';
import type {ChannelManager, LeuteModel, TopicModel} from '@refinio/one.models/lib/models/index.js';
import type IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import type Notifications from '@refinio/one.models/lib/models/Notifications.js';

import TemporaryFileSystem from '@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';
import ObjectsFileSystem from '@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js';
import DebugFileSystem from '@refinio/one.models/lib/fileSystems/DebugFileSystem.js';
import TypesFileSystem from '@refinio/one.models/lib/fileSystems/TypesFileSystem.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';
import ChatFileSystem from '@refinio/one.models/lib/fileSystems/ChatFileSystem.js';

import {COMMIT_HASH} from '../commit-hash';
import {DefaultFilerConfig} from './FilerConfig';
import type {FilerConfig} from './FilerConfig';

import {FuseFrontend} from './FuseFrontend';
import {fillMissingWithDefaults} from '../misc/configHelper';

export interface FilerModels {
    channelManager: ChannelManager;
    connections: ConnectionsModel;
    leuteModel: LeuteModel;
    notifications: Notifications;
    topicModel: TopicModel;
    iomManager: IoMManager;
}

/**
 * This class represents the main starting point for `one.filer`
 *
 * It has a default composition of file systems. See setupRootFileSystem for details.
 */
export class Filer {
    private readonly models: FilerModels;
    private readonly config: FilerConfig;
    private shutdownFunctions: Array<() => Promise<void>> = [];

    constructor(models: FilerModels, config: Partial<FilerConfig>) {
        this.config = fillMissingWithDefaults(config, DefaultFilerConfig);
        this.models = models;
    }

    /**
     * Init the filer by setting up file systems and mounting fuse.
     */
    async init(): Promise<void> {
        // Ensure we're running in Node.js environment (WSL2 Debian with Node.js)
        if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
            throw new Error('Fuse can only be mounted in Node.js environment');
        }
        
        // Don't allow FUSE on Windows
        if (process.platform === 'win32') {
            throw new Error('FUSE not supported on Windows - use ProjFS mode instead');
        }

        const rootFileSystem = await this.setupRootFileSystem();

        // Always use standard FUSE in WSL2
        console.log('🐧 Starting FUSE in WSL2...');
        const fuseFrontend = new FuseFrontend();
        await fuseFrontend.start(rootFileSystem, this.config.mountPoint, this.config.logCalls, this.config.fuseOptions || {});
        this.shutdownFunctions.push(fuseFrontend.stop.bind(fuseFrontend));
        
        console.log(`[info]: Filer file system was mounted at ${this.config.mountPoint}`);
    }

    /**
     * Shutdown filer.
     */
    async shutdown(): Promise<void> {
        for await (const fn of this.shutdownFunctions) {
            try {
                await fn();
            } catch (e) {
                console.error('Failed to exscute shutdown routine', e);
            }
        }
        this.shutdownFunctions = [];
    }

    /**
     * Set up the root filesystem by mounting all wanted filesystems.
     */
    private async setupRootFileSystem(): Promise<IFileSystem> {
        const chatFileSystem = new ChatFileSystem(
            this.models.leuteModel,
            this.models.topicModel,
            this.models.channelManager,
            this.models.notifications,
            '/objects'
        );
        const debugFileSystem = new DebugFileSystem(
            this.models.leuteModel,
            this.models.topicModel,
            this.models.connections,
            this.models.channelManager
        );
        const pairingFileSystem = new PairingFileSystem(
            this.models.connections,
            this.models.iomManager,
            this.config.pairingUrl,
            this.config.iomMode
        );
        const objectsFileSystem = new ObjectsFileSystem();
        const typesFileSystem = new TypesFileSystem();

        debugFileSystem.commitHash = COMMIT_HASH;

        const rootFileSystem = new TemporaryFileSystem();
        await rootFileSystem.mountFileSystem('/chats', chatFileSystem);
        await rootFileSystem.mountFileSystem('/debug', debugFileSystem);
        await rootFileSystem.mountFileSystem('/invites', pairingFileSystem);
        await rootFileSystem.mountFileSystem('/objects', objectsFileSystem);
        await rootFileSystem.mountFileSystem('/types', typesFileSystem);

        return rootFileSystem as unknown as IFileSystem;
    }
}
