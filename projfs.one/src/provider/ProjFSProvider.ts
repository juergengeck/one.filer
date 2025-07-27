import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import { IFileSystemToProjFSAdapter } from './IFileSystemToProjFSAdapter.js';
import type { IProjFSProvider, ProjFSOptions, ProjFSCallbacks, ProviderStats } from '../native/projfs-types.js';
import { Logger } from '../utils/Logger.js';

import { ProjFSWrapper } from '../native/index.js';

/**
 * Main entry point for projfs.one - Windows ProjectedFS provider for ONE.core.
 * 
 * This class manages the lifecycle of a projected filesystem, bridging between
 * Windows applications and ONE.core's content-addressed storage through the
 * IFileSystem abstraction.
 */
export class ProjFSProvider implements IProjFSProvider {
    private adapter: IFileSystemToProjFSAdapter | null = null;
    private nativeWrapper: any = null;
    private readonly logger: Logger;
    private startTime: Date | null = null;
    
    constructor(
        private readonly fileSystem: IFileSystem,
        private readonly options: {
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
            cacheSize?: number;
        } = {}
    ) {
        this.logger = new Logger('ProjFSProvider', options.logLevel);
    }
    
    /**
     * Start the projected filesystem.
     */
    async start(callbacks: ProjFSCallbacks, options: ProjFSOptions): Promise<void> {
        if (this.isRunning()) {
            throw new Error('Provider is already running');
        }
        
        this.logger.info(`Starting ProjFS provider at ${options.virtualizationRootPath}`);
        
        try {
            // Create adapter
            this.adapter = new IFileSystemToProjFSAdapter(
                this.fileSystem,
                options.virtualizationRootPath,
                {
                    cacheSize: this.options.cacheSize,
                    logLevel: this.options.logLevel
                }
            );
            
            // Create native wrapper
            this.nativeWrapper = new ProjFSWrapper(
                options.virtualizationRootPath
            );
            
            // Start native ProjFS
            await this.nativeWrapper.start(callbacks || this.adapter, options);
            
            this.startTime = new Date();
            this.logger.info('ProjFS provider started successfully');
            
        } catch (error) {
            this.logger.error('Failed to start ProjFS provider', error);
            
            // Clean up on failure
            if (this.adapter) {
                await this.adapter.shutdown();
                this.adapter = null;
            }
            this.nativeWrapper = null;
            
            throw error;
        }
    }
    
    /**
     * Stop the projected filesystem.
     */
    async stop(): Promise<void> {
        if (!this.isRunning()) {
            this.logger.warn('Provider is not running');
            return;
        }
        
        this.logger.info('Stopping ProjFS provider');
        
        try {
            // Stop native wrapper
            if (this.nativeWrapper) {
                await this.nativeWrapper.stop();
                this.nativeWrapper = null;
            }
            
            // Shutdown adapter
            if (this.adapter) {
                await this.adapter.shutdown();
                this.adapter = null;
            }
            
            this.startTime = null;
            this.logger.info('ProjFS provider stopped successfully');
            
        } catch (error) {
            this.logger.error('Error stopping ProjFS provider', error);
            throw error;
        }
    }
    
    /**
     * Check if the provider is running.
     */
    isRunning(): boolean {
        return this.nativeWrapper?.isRunning() || false;
    }
    
    /**
     * Get provider statistics.
     */
    getStats(): ProviderStats {
        const nativeStats = this.nativeWrapper?.getStats() || {};
        const cacheStats = (this.adapter as any)?.cache?.getStats() || {};
        
        return {
            placeholderInfoRequests: nativeStats.placeholderInfoRequests || 0,
            fileDataRequests: nativeStats.fileDataRequests || 0,
            directoryEnumerations: nativeStats.directoryEnumerations || 0,
            fileModifications: nativeStats.fileModifications || 0,
            cacheMisses: cacheStats.metadataEntries || 0,
            cacheHits: cacheStats.directoryEntries || 0,
            totalBytesRead: BigInt(nativeStats.totalBytesRead || 0),
            totalBytesWritten: BigInt(nativeStats.totalBytesWritten || 0),
            uptime: this.startTime ? 
                Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0
        };
    }
    
    /**
     * Create a ProjFS provider with ONE.core integration.
     */
    static async createWithOneCore(
        oneCore: any, // TODO: Type this properly when ONE.core types are available
        options?: {
            virtualizationRoot: string;
            fileSystemType?: string;
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
            cacheSize?: number;
        }
    ): Promise<ProjFSProvider> {
        // Get or create the appropriate IFileSystem
        let fileSystem: IFileSystem;
        
        const fsType = options?.fileSystemType || 'persistent';
        switch (fsType) {
            case 'persistent':
                // Use PersistentFileSystem
                fileSystem = await oneCore.getPersistentFileSystem();
                break;
            case 'objects':
                // Use ObjectsFileSystem for raw object access
                fileSystem = await oneCore.getObjectsFileSystem();
                break;
            default:
                throw new Error(`Unknown filesystem type: ${fsType}`);
        }
        
        return new ProjFSProvider(fileSystem, {
            logLevel: options?.logLevel,
            cacheSize: options?.cacheSize
        });
    }
}