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

import {COMMIT_HASH} from '../commit-hash.js';
import {DefaultFilerConfig} from './FilerConfig.js';
import type {FilerConfig} from './FilerConfig.js';

import {FuseFrontend} from './FuseFrontend.js';
import {fillMissingWithDefaults} from '../misc/configHelper.js';

export interface FilerModels {
    channelManager: ChannelManager;
    connections: ConnectionsModel;
    leuteModel: LeuteModel;
    notifications: Notifications;
    topicModel: TopicModel;
    iomManager: IoMManager;
}

export interface FilerConfigWithProjFS extends FilerConfig {
    useProjFS?: boolean;
    projfsRoot?: string;
    projfsCacheSize?: number;
}

/**
 * Enhanced Filer class that supports both FUSE (WSL2) and ProjFS (Windows native)
 * 
 * This class extends the original Filer functionality to provide native Windows
 * filesystem integration through ProjectedFS when running on Windows.
 */
export class FilerWithProjFS {
    private readonly models: FilerModels;
    private readonly config: FilerConfigWithProjFS;
    private shutdownFunctions: Array<() => Promise<void>> = [];
    private rootFileSystem: IFileSystem | null = null;
    private projfsProvider: any = null;

    constructor(models: FilerModels, config: Partial<FilerConfigWithProjFS>) {
        this.config = fillMissingWithDefaults(config, DefaultFilerConfig) as FilerConfigWithProjFS;
        this.models = models;
    }

    /**
     * Init the filer by setting up file systems and mounting either FUSE or ProjFS.
     */
    async init(): Promise<void> {
        // Set up the root filesystem
        this.rootFileSystem = await this.setupRootFileSystem();

        // Check if we should use ProjFS (Windows native mode)
        if (this.config.useProjFS && process.platform === 'win32') {
            await this.initProjFS();
        } else {
            // Use standard FUSE mode (WSL2/Linux)
            await this.initFUSE();
        }
    }

    /**
     * Initialize using Windows ProjectedFS
     */
    private async initProjFS(): Promise<void> {
        console.log('🪟 Starting ProjFS (Windows native mode)...');
        
        try {
            // Dynamically import to avoid loading on non-Windows platforms
            const { ProjFSProvider } = await import('../../one.projfs/dist/src/index.js');
            
            // Create ProjFS provider
            this.projfsProvider = new ProjFSProvider(this.rootFileSystem!, {
                logLevel: 'info',
                cacheSize: this.config.projfsCacheSize || 100 * 1024 * 1024 // 100MB default
            });
            
            // Start ProjFS
            const projfsRoot = this.config.projfsRoot || 'C:\\OneFiler';
            await this.projfsProvider.start(null, {
                virtualizationRootPath: projfsRoot,
                poolThreadCount: 4,
                enableNegativePathCache: true
            });
            
            this.shutdownFunctions.push(async () => {
                if (this.projfsProvider) {
                    await this.projfsProvider.stop();
                }
            });
            
            console.log(`[info]: Filer file system was mounted at ${projfsRoot} using ProjFS`);
        } catch (error) {
            console.error('Failed to initialize ProjFS, falling back to FUSE:', error);
            await this.initFUSE();
        }
    }

    /**
     * Initialize using FUSE (original mode)
     */
    private async initFUSE(): Promise<void> {
        // Ensure we're running in Node.js environment (WSL2 Debian with Node.js)
        if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
            throw new Error('Fuse can only be mounted in Node.js environment');
        }

        console.log('🐧 Starting FUSE in WSL2...');
        const fuseFrontend = new FuseFrontend();
        await fuseFrontend.start(this.rootFileSystem!, this.config.mountPoint, this.config.logCalls, this.config.fuseOptions || {});
        this.shutdownFunctions.push(fuseFrontend.stop.bind(fuseFrontend));
        
        console.log(`[info]: Filer file system was mounted at ${this.config.mountPoint}`);
    }

    /**
     * Get the root filesystem (useful for external integrations)
     */
    getRootFileSystem(): IFileSystem | null {
        return this.rootFileSystem;
    }

    /**
     * Get the objects filesystem directly
     */
    getObjectsFileSystem(): IFileSystem {
        return new ObjectsFileSystem();
    }

    /**
     * Check if running in ProjFS mode
     */
    isProjFSMode(): boolean {
        return this.config.useProjFS === true && this.projfsProvider !== null;
    }

    /**
     * Get statistics (ProjFS mode only)
     */
    getStats(): any {
        if (this.projfsProvider && this.projfsProvider.getStats) {
            return this.projfsProvider.getStats();
        }
        return null;
    }

    /**
     * Shutdown filer.
     */
    async shutdown(): Promise<void> {
        for await (const fn of this.shutdownFunctions) {
            try {
                await fn();
            } catch (e) {
                console.error('Failed to execute shutdown routine', e);
            }
        }
        this.shutdownFunctions = [];
        this.rootFileSystem = null;
        this.projfsProvider = null;
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