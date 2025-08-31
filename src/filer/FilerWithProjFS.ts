import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import TemporaryFileSystem from '@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';
import ObjectsFileSystem from '@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js';
import DebugFileSystem from '@refinio/one.models/lib/fileSystems/DebugFileSystem.js';
import TypesFileSystem from '@refinio/one.models/lib/fileSystems/TypesFileSystem.js';
import ChatFileSystem from '@refinio/one.models/lib/fileSystems/ChatFileSystem.js';
import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';

// Import IFSProjFSProvider directly from the one.ifsprojfs package
import { createRequire } from 'module';
// Fix for cross-platform builds: ensure Windows paths on Windows
const moduleUrl = typeof process !== 'undefined' && process.platform === 'win32' && import.meta.url.startsWith('file:///mnt/c/')
    ? 'file:///' + import.meta.url.slice(14).replace(/\//g, '\\')
    : import.meta.url;
const require = createRequire(moduleUrl);

import {COMMIT_HASH} from '../commit-hash.js';
import {DefaultFilerConfig} from './FilerConfig.js';
import type {FilerConfig} from './FilerConfig.js';
import {fillMissingWithDefaults} from '../misc/configHelper.js';
import { join } from 'path';
import {TestDataFileSystem} from '../fileSystems/TestDataFileSystem.js';

// Extend FilerConfig to support ProjFS-specific settings
export interface FilerConfigWithProjFS extends FilerConfig {
    useProjFS?: boolean;
    projfsRoot?: string;
    cacheTTL?: number;  // Cache TTL in seconds
    disableCowCache?: boolean;  // Disable COW cache for debugging
    disableInMemoryCache?: boolean;  // Disable in-memory cache
    verboseLogging?: boolean;  // Enable verbose logging
    traceAllOperations?: boolean;  // Trace all operations
}

// Models interface for dependency injection
export interface FilerModels {
    leuteModel: any;
    topicModel: any;
    channelManager: any;
    notifications: any;
    connections: any;
    iomManager: any;
}

/**
 * Filer implementation that uses Windows Projected File System (ProjFS)
 * instead of FUSE for better Windows integration
 */
export class FilerWithProjFS {
    private readonly models: FilerModels;
    private readonly config: FilerConfigWithProjFS;
    private shutdownFunctions: Array<() => Promise<void>> = [];
    private rootFileSystem: IFileSystem | null = null;
    private projfsProvider: any | null = null;  // IFSProjFSProvider instance
    private instanceDirectory: string = '';

    constructor(models: FilerModels, config: Partial<FilerConfigWithProjFS>) {
        this.config = fillMissingWithDefaults(config, DefaultFilerConfig) as FilerConfigWithProjFS;
        this.models = models;
    }

    async init(): Promise<void> {
        console.log('[FilerWithProjFS] Starting initialization...');
        console.log('[FilerWithProjFS] Config useProjFS:', this.config.useProjFS);
        
        // Setup the root file system first - MUST be complete before mounting
        console.log('[FilerWithProjFS] Setting up root filesystem with all subsystems...');
        this.rootFileSystem = await this.setupRootFileSystem();
        
        // Verify the filesystem is ready by checking root entries
        console.log('[FilerWithProjFS] Verifying filesystem is ready...');
        const rootCheck = await this.rootFileSystem.readDir('/');
        if (!rootCheck || !rootCheck.children || rootCheck.children.length === 0) {
            throw new Error('Root filesystem not properly initialized - no mount points found');
        }
        console.log(`[FilerWithProjFS] Root filesystem ready with ${rootCheck.children.length} mount points: ${rootCheck.children.join(', ')}`);
        
        if (this.config.useProjFS) {
            console.log('[FilerWithProjFS] Initializing ProjFS...');
            await this.initProjFS();
            console.log('[FilerWithProjFS] ProjFS initialization completed');
        } else {
            console.log('[FilerWithProjFS] Initializing FUSE...');
            await this.initFUSE();
            console.log('[FilerWithProjFS] FUSE initialization completed');
        }
        
        console.log('[FilerWithProjFS] Init method completed successfully');
    }

    /**
     * Initialize using Windows ProjectedFS with COW cache
     */
    private async initProjFS(): Promise<void> {
        console.log('🪟 Starting ProjFS with COW cache provider...');
        
        try {
            // Get instance directory from ONE core
            const instanceModule = await import('@refinio/one.core/lib/instance.js');
            this.instanceDirectory = (instanceModule as any).getInstanceDirectory();
            console.log('[ProjFS] Instance directory:', this.instanceDirectory);
            
            // Load IFSProjFSProvider from one.ifsprojfs package
            const IFSProjFSProvider = require('../../one.ifsprojfs/IFSProjFSProvider.js');
            
            // Create IFSProjFSProvider instance
            console.log('[ProjFS] Creating IFSProjFSProvider instance...');
            this.projfsProvider = new IFSProjFSProvider({
                instancePath: this.instanceDirectory,
                virtualRoot: this.config.mountPoint || this.config.projfsRoot || 'C:\\OneFiler',
                fileSystem: this.rootFileSystem!,
                debug: this.config.verboseLogging || false,
                disableCowCache: this.config.disableCowCache || false,
                disableInMemoryCache: this.config.disableInMemoryCache || false,
                verboseLogging: this.config.verboseLogging || false,
                traceAllOperations: this.config.traceAllOperations || false,
                skipObjectsPreCache: true  // Skip objects pre-caching to avoid hangs
            });
            
            // Mount the provider
            console.log('[ProjFS] Mounting with performance optimizations...');
            await this.projfsProvider.mount();
            
            // Objects enumeration will be automatically unrestricted after first call
            console.log('[ProjFS] Objects enumeration limit will be removed after first access');
            
            // Note: IFSProjFSProvider doesn't have setModels method
            // Models integration would need to be handled differently if needed
            
            // Log configuration
            if (this.config.verboseLogging) {
                console.log('[ProjFS] Debug configuration:', {
                    disableCowCache: this.config.disableCowCache || false,
                    disableInMemoryCache: this.config.disableInMemoryCache || false,
                    verboseLogging: this.config.verboseLogging || false,
                    traceAllOperations: this.config.traceAllOperations || false
                });
            }
            
            // Listen for debug messages (if supported by provider)
            if (this.projfsProvider && typeof (this.projfsProvider as any).on === 'function') {
                (this.projfsProvider as any).on('debug', (msg: string) => {
                    console.log('[ProjFS Debug]', msg);
                });
            }
            
            // Check if another instance is already using ProjFS
            const lockFile = join(this.instanceDirectory, 'projfs.lock');
            try {
                // Try to create an exclusive lock file
                const fs = await import('fs');
                const lockFd = fs.openSync(lockFile, 'wx');
                console.log('[ProjFS] Acquired exclusive lock for ProjFS mount');
                
                // Register cleanup to remove lock file
                this.shutdownFunctions.push(async () => {
                    try {
                        fs.closeSync(lockFd);
                        fs.unlinkSync(lockFile);
                        console.log('[ProjFS] Released ProjFS lock');
                    } catch (e) {
                        console.error('[ProjFS] Error releasing lock:', e);
                    }
                });
            } catch (error: any) {
                if (error.code === 'EEXIST') {
                    // Lock file exists - check if it's stale
                    console.log('[ProjFS] Lock file exists, checking if it is stale...');
                    try {
                        const fs = await import('fs');
                        const stats = fs.statSync(lockFile);
                        const lockAge = Date.now() - stats.mtime.getTime();
                        const lockAgeMinutes = Math.floor(lockAge / (1000 * 60));
                        
                        console.log(`[ProjFS] Lock file age: ${lockAgeMinutes} minutes`);
                        
                        // If lock file is older than 5 minutes, consider it stale
                        if (lockAge > 5 * 60 * 1000) { // 5 minutes
                            console.log('[ProjFS] Lock file appears stale (>5min old), removing...');
                            fs.unlinkSync(lockFile);
                            console.log('[ProjFS] Stale lock file removed, retrying lock acquisition...');
                            
                            // Retry creating the lock file
                            const lockFd = fs.openSync(lockFile, 'wx');
                            console.log('[ProjFS] Acquired exclusive lock after removing stale lock');
                            
                            // Register cleanup to remove lock file
                            this.shutdownFunctions.push(async () => {
                                try {
                                    fs.closeSync(lockFd);
                                    fs.unlinkSync(lockFile);
                                    console.log('[ProjFS] Released ProjFS lock');
                                } catch (e) {
                                    console.error('[ProjFS] Error releasing lock:', e);
                                }
                            });
                        } else {
                            throw new Error(`Another instance of ONE Filer is running with ProjFS (lock created ${lockAgeMinutes} minutes ago). Only one instance can mount ProjFS at a time.`);
                        }
                    } catch (retryError: any) {
                        if (retryError.code === 'EEXIST') {
                            throw new Error('Another instance of ONE Filer started while cleaning up stale lock. Only one instance can mount ProjFS at a time.');
                        }
                        throw retryError;
                    }
                } else {
                    throw error;
                }
            }
            
            // Mount already happened above, so just log success
            console.log('[ProjFS] Provider mounted successfully at', this.config.mountPoint || this.config.projfsRoot || 'C:\\OneFiler');
            
            // Add shutdown function
            this.shutdownFunctions.push(async () => {
                if (this.projfsProvider) {
                    await this.projfsProvider.unmount();
                }
            });
            
            console.log(`[info]: ONE content mounted at ${this.config.projfsRoot || 'C\\OneFiler'} using ProjFS with COW cache`);
            console.log(`[info]: Direct BLOB/CLOB access enabled from ${this.instanceDirectory}`);
            
            if (this.config.disableCowCache) {
                console.log('[info]: ⚠️ COW cache is DISABLED for debugging');
            }
            if (this.config.disableInMemoryCache) {
                console.log('[info]: ⚠️ In-memory cache is DISABLED for debugging');
            }
            
        } catch (error) {
            console.error('Failed to initialize ProjFS provider with COW cache:', error);
            console.error('Error stack:', (error as Error).stack);
            
            const errorMessage = (error as Error).message || '';
            if (errorMessage.includes('Cannot find module')) {
                throw new Error('ProjFS native module not found. Make sure one.ifsprojfs is built properly');
            } else if (errorMessage.includes('not enabled') || errorMessage.includes('not available')) {
                // Only throw ProjFS not enabled error for specific messages
                throw new Error('Windows Projected File System (ProjFS) error: ' + errorMessage);
            }
            
            throw error;
        }
    }

    /**
     * Initialize using FUSE for WSL2
     */
    private async initFUSE(): Promise<void> {
        if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
            throw new Error('Fuse can only be mounted in Node.js environment');
        }

        console.log('🐧 Starting FUSE in WSL2...');
        
        const { FuseFrontend } = await import('./FuseFrontend.js');
        const fuseFrontend = new FuseFrontend();
        await fuseFrontend.start(
            this.rootFileSystem!,
            this.config.mountPoint!,
            this.config.logCalls!,
            this.config.fuseOptions || {}
        );

        this.shutdownFunctions.push(fuseFrontend.stop.bind(fuseFrontend));
        console.log(`[info]: Filer file system was mounted at ${this.config.mountPoint}`);
    }

    getRootFileSystem(): IFileSystem | null {
        return this.rootFileSystem;
    }

    getObjectsFileSystem(): ObjectsFileSystem {
        return new ObjectsFileSystem();
    }

    isProjFSMode(): boolean {
        return this.config.useProjFS === true && this.projfsProvider !== null;
    }

    getStats(): any {
        if (this.projfsProvider && this.projfsProvider.getStats) {
            return this.projfsProvider.getStats();
        }
        return null;
    }

    async shutdown(): Promise<void> {
        console.log('[FilerWithProjFS] Shutdown called - unmounting ProjFS...');
        for await (const fn of this.shutdownFunctions) {
            try {
                console.log('[FilerWithProjFS] Calling shutdown function...');
                await fn();
                console.log('[FilerWithProjFS] Shutdown function completed');
            } catch (e) {
                console.error('[FilerWithProjFS] Failed to execute shutdown routine', e);
            }
        }

        this.shutdownFunctions = [];
        this.rootFileSystem = null;
        this.projfsProvider = null;
        console.log('[FilerWithProjFS] Shutdown complete');
    }

    private async setupRootFileSystem(): Promise<IFileSystem> {
        // Create specialized file systems
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
            this.config.pairingUrl!,
            this.config.iomMode! as 'full' | 'light'
        );

        // Create ObjectsFileSystem with performance patch
        const baseObjectsFileSystem = new ObjectsFileSystem();
        
        // Patch the readDir method to limit objects enumeration during initial ProjFS pre-caching
        const originalReadDir = baseObjectsFileSystem.readDir.bind(baseObjectsFileSystem);
        let hasBeenEnumerated = false;
        
        baseObjectsFileSystem.readDir = async function(path: string) {
            console.log(`[ObjectsFS-PATCH] readDir called with path: ${path}`);
            
            if (path === '/' && !hasBeenEnumerated) {
                console.log('[ObjectsFS-PATCH] First enumeration - limiting to 50 objects for performance');
                const result = await originalReadDir(path);
                if (result?.children && result.children.length > 50) {
                    console.log(`[ObjectsFS-PATCH] Limiting objects: ${result.children.length} -> 50`);
                    hasBeenEnumerated = true;
                    return {
                        children: result.children.slice(0, 50)
                    };
                }
                hasBeenEnumerated = true;
                return result;
            }
            
            // For subsequent calls, return full results
            return originalReadDir(path);
        };
        
        const typesFileSystem = new TypesFileSystem();

        // Set commit hash for debug filesystem
        (debugFileSystem as any).commitHash = COMMIT_HASH;

        // Create root filesystem and mount all subsystems
        const rootFileSystem = new TemporaryFileSystem();
        await rootFileSystem.mountFileSystem('/chats', chatFileSystem);
        await rootFileSystem.mountFileSystem('/debug', debugFileSystem);
        await rootFileSystem.mountFileSystem('/invites', pairingFileSystem);
        await rootFileSystem.mountFileSystem('/objects', baseObjectsFileSystem);
        await rootFileSystem.mountFileSystem('/types', typesFileSystem);
        
        // Mount test data filesystem
        const testDataFileSystem = new TestDataFileSystem();
        await rootFileSystem.mountFileSystem('/test-data', testDataFileSystem);
        
        // Initialize test-data immediately to ensure it's ready for ProjFS cache
        await testDataFileSystem.initialize();

        return rootFileSystem;
    }
}