/**
 * Filer class - Using current project's implementation with @refinio/fuse3
 * 
 * This is the main entry point that matches the current project's Filer
 * but uses @refinio/fuse3 instead of the custom fuse implementation
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

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

import {FuseFrontend} from './FuseFrontend.js';
import {fillMissingWithDefaults} from './misc/configHelper.js';
import {DefaultFilerConfig} from './FilerConfig.js';
import type {FilerConfig} from './FilerConfig.js';

// Generate a commit hash or use a placeholder
const COMMIT_HASH = process.env.COMMIT_HASH || 'development';

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
 * Matches the current project's implementation
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
        // Ensure we're running in Node.js environment
        if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
            throw new Error('Fuse can only be mounted in Node.js environment');
        }
        
        // Don't allow FUSE on Windows
        if (process.platform === 'win32') {
            throw new Error('FUSE not supported on Windows - use ProjFS mode instead');
        }

        const rootFileSystem = await this.setupRootFileSystem();

        // Use our FuseFrontend with @refinio/fuse3
        console.log('🐧 Starting FUSE3 with @refinio/fuse3...');
        const fuseFrontend = new FuseFrontend();
        await fuseFrontend.start(
            rootFileSystem, 
            this.config.mountPoint, 
            this.config.logFuseCalls || false,
            this.config.fuseOptions || {}
        );
        this.shutdownFunctions.push(fuseFrontend.stop.bind(fuseFrontend));
        
        console.log(`✅ Filer file system was mounted at ${this.config.mountPoint}`);
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
    }

    /**
     * Set up the root filesystem by mounting all wanted filesystems.
     * This matches the current project's structure exactly
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
            this.config.pairingUrl || 'https://app.leute.io',
            this.config.iomMode || 'light'
        );
        const objectsFileSystem = new ObjectsFileSystem();
        const typesFileSystem = new TypesFileSystem();

        // Set commit hash on debug filesystem
        (debugFileSystem as any).commitHash = COMMIT_HASH;

        // Create root filesystem and mount all subsystems
        // Matching current project's structure exactly
        const rootFileSystem = new TemporaryFileSystem(this.config.tmpDir);
        await rootFileSystem.mountFileSystem('/chats', chatFileSystem);
        await rootFileSystem.mountFileSystem('/debug', debugFileSystem);
        await rootFileSystem.mountFileSystem('/invites', pairingFileSystem);
        await rootFileSystem.mountFileSystem('/objects', objectsFileSystem);
        await rootFileSystem.mountFileSystem('/types', typesFileSystem);

        return rootFileSystem as unknown as IFileSystem;
    }

    /**
     * Get the FUSE frontend instance
     */
    getFuseFrontend(): FuseFrontend | undefined {
        // Return the frontend if we have one
        return undefined; // Will be tracked differently
    }

    /**
     * Check if mounted
     */
    isMounted(): boolean {
        return this.shutdownFunctions.length > 0;
    }

    /**
     * Get mount point
     */
    getMountPoint(): string {
        return this.config.mountPoint;
    }
}