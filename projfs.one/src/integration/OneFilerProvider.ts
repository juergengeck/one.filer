import { ProjFSProvider } from '../provider/ProjFSProvider.js';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import type { ProjFSOptions } from '../native/projfs-types.js';
import { Logger } from '../utils/Logger.js';

// Import types from one.filer
interface ReplicantConfig {
    directory: string;
    filer?: {
        mountPoint?: string;
        projfsRoot?: string;
        useProjFS?: boolean;
    };
    communication?: {
        url?: string;
    };
    pairingUrl?: string;
}

interface Replicant {
    start(secret: string): Promise<void>;
    stop(): Promise<void>;
    filer: {
        getRootFileSystem(): IFileSystem;
        getObjectsFileSystem(): IFileSystem;
    };
}

/**
 * Integration provider that bridges one.filer with projfs.one
 * 
 * This class enables one.filer to use Windows ProjectedFS instead of FUSE,
 * providing native Windows performance and integration while maintaining
 * full compatibility with the ONE ecosystem.
 */
export class OneFilerProvider {
    private replicant: Replicant | null = null;
    private projfsProvider: ProjFSProvider | null = null;
    private readonly logger: Logger;
    
    constructor(
        private readonly config: ReplicantConfig,
        private readonly options: {
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
            cacheSize?: number;
            projfsOptions?: Partial<ProjFSOptions>;
        } = {}
    ) {
        this.logger = new Logger('OneFilerProvider', options.logLevel);
    }
    
    /**
     * Initialize one.filer with ProjFS backend
     */
    async initialize(secret: string): Promise<void> {
        try {
            this.logger.info('Initializing OneFiler with ProjFS backend');
            
            // Dynamically import one.filer Replicant
            // Note: This path assumes projfs.one is in a subdirectory of one.filer
            const { Replicant } = await import('../../../src/Replicant.js');
            
            // Create and start Replicant instance
            this.replicant = new Replicant(this.config) as Replicant;
            await this.replicant.start(secret);
            
            this.logger.info('Replicant started successfully');
            
            // Get the root filesystem from Filer
            const rootFileSystem = this.replicant!.filer.getRootFileSystem();
            
            if (!rootFileSystem) {
                throw new Error('Failed to get root filesystem from Filer');
            }
            
            // Determine virtualization root
            const virtualizationRoot = this.config.filer?.projfsRoot || 'C:\\OneFiler';
            
            this.logger.info(`Creating ProjFS provider at ${virtualizationRoot}`);
            
            // Create ProjFS provider with the IFileSystem
            this.projfsProvider = new ProjFSProvider(rootFileSystem, {
                logLevel: this.options.logLevel,
                cacheSize: this.options.cacheSize || 100 * 1024 * 1024 // 100MB default
            });
            
            // Start ProjFS with custom options
            const projfsOptions: ProjFSOptions = {
                virtualizationRootPath: virtualizationRoot,
                poolThreadCount: this.options.projfsOptions?.poolThreadCount || 4,
                concurrentThreadCount: this.options.projfsOptions?.concurrentThreadCount || 0,
                enableNegativePathCache: this.options.projfsOptions?.enableNegativePathCache ?? true,
                ...this.options.projfsOptions
            };
            
            await this.projfsProvider.start(null as any, projfsOptions);
            
            this.logger.info('ProjFS provider started successfully');
            this.logger.info(`Virtual filesystem available at: ${virtualizationRoot}`);
            
        } catch (error) {
            this.logger.error('Failed to initialize OneFiler with ProjFS', error);
            await this.shutdown();
            throw error;
        }
    }
    
    /**
     * Get statistics from both one.filer and ProjFS
     */
    getStats(): {
        projfs: any;
        oneFiler: {
            filesystemType: string;
            cacheSize: number;
        };
    } {
        return {
            projfs: this.projfsProvider?.getStats() || {},
            oneFiler: {
                filesystemType: 'projfs',
                cacheSize: this.options.cacheSize || 100 * 1024 * 1024
            }
        };
    }
    
    /**
     * Check if the provider is running
     */
    isRunning(): boolean {
        return this.projfsProvider?.isRunning() || false;
    }
    
    /**
     * Shutdown the integration cleanly
     */
    async shutdown(): Promise<void> {
        this.logger.info('Shutting down OneFiler ProjFS integration');
        
        try {
            // Stop ProjFS first
            if (this.projfsProvider) {
                await this.projfsProvider.stop();
                this.projfsProvider = null;
            }
            
            // Then stop Replicant
            if (this.replicant) {
                await this.replicant.stop();
                this.replicant = null;
            }
            
            this.logger.info('Shutdown complete');
        } catch (error) {
            this.logger.error('Error during shutdown', error);
            throw error;
        }
    }
    
    /**
     * Create a OneFiler provider with default configuration
     */
    static async createWithDefaults(
        directory: string,
        secret: string,
        options?: {
            virtualizationRoot?: string;
            communicationUrl?: string;
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
        }
    ): Promise<OneFilerProvider> {
        const config: ReplicantConfig = {
            directory,
            filer: {
                projfsRoot: options?.virtualizationRoot || 'C:\\OneFiler',
                useProjFS: true
            },
            communication: {
                url: options?.communicationUrl || 'https://comm.one-dragon.com'
            }
        };
        
        const provider = new OneFilerProvider(config, {
            logLevel: options?.logLevel
        });
        
        await provider.initialize(secret);
        return provider;
    }
}