"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjFSProvider = void 0;
const IFileSystemToProjFSAdapter_js_1 = require("./IFileSystemToProjFSAdapter.js");
const Logger_js_1 = require("../utils/Logger.js");
const index_js_1 = require("../native/index.js");
/**
 * Main entry point for projfs.one - Windows ProjectedFS provider for ONE.core.
 *
 * This class manages the lifecycle of a projected filesystem, bridging between
 * Windows applications and ONE.core's content-addressed storage through the
 * IFileSystem abstraction.
 */
class ProjFSProvider {
    fileSystem;
    options;
    adapter = null;
    nativeWrapper = null;
    logger;
    startTime = null;
    constructor(fileSystem, options = {}) {
        this.fileSystem = fileSystem;
        this.options = options;
        this.logger = new Logger_js_1.Logger('ProjFSProvider', options.logLevel);
    }
    /**
     * Start the projected filesystem.
     */
    async start(options) {
        if (this.isRunning()) {
            throw new Error('Provider is already running');
        }
        this.logger.info(`Starting ProjFS provider at ${options.virtualizationRootPath}`);
        try {
            // Create adapter
            this.adapter = new IFileSystemToProjFSAdapter_js_1.IFileSystemToProjFSAdapter(this.fileSystem, options.virtualizationRootPath, {
                cacheSize: this.options.cacheSize,
                logLevel: this.options.logLevel
            });
            // Create native wrapper
            this.nativeWrapper = new index_js_1.ProjFSWrapper(options.virtualizationRootPath);
            // Start native ProjFS
            await this.nativeWrapper.start(this.adapter, options);
            this.startTime = new Date();
            this.logger.info('ProjFS provider started successfully');
        }
        catch (error) {
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
    async stop() {
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
        }
        catch (error) {
            this.logger.error('Error stopping ProjFS provider', error);
            throw error;
        }
    }
    /**
     * Check if the provider is running.
     */
    isRunning() {
        return this.nativeWrapper?.isRunning() || false;
    }
    /**
     * Get provider statistics.
     */
    getStats() {
        const nativeStats = this.nativeWrapper?.getStats() || {};
        const cacheStats = this.adapter?.cache?.getStats() || {};
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
    static async createWithOneCore(oneCore, // TODO: Type this properly when ONE.core types are available
    options) {
        // Get or create the appropriate IFileSystem
        let fileSystem;
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
exports.ProjFSProvider = ProjFSProvider;
