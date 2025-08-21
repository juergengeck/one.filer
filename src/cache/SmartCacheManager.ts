import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import type { ChannelManager, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import { PersistentCache } from './PersistentCache.js';
import { EventEmitter } from 'events';

interface CacheStrategy {
    // How often to sync this path (ms)
    syncInterval: number;
    // Priority for caching (higher = more important)
    priority: number;
    // Max size to cache for files in this path
    maxFileSize: number;
    // Whether to cache content or just metadata
    cacheContent: boolean;
    // Whether to watch for changes
    watchChanges: boolean;
}

export class SmartCacheManager extends EventEmitter {
    private cache: PersistentCache;
    private fileSystem: IFileSystem;
    private nativeProvider?: any;
    private _models: {
        channelManager?: ChannelManager;
        leuteModel?: LeuteModel;
        topicModel?: TopicModel;
    };
    
    private strategies: Map<string, CacheStrategy> = new Map();
    private syncTimers: Map<string, NodeJS.Timeout> = new Map();
    private accessPatterns: Map<string, number[]> = new Map(); // Track access times
    private changeListeners: Map<string, any> = new Map();
    private discoveredFiles: Map<string, any[]> = new Map(); // Track files discovered per directory
    private isRunning: boolean = false;
    
    constructor(
        fileSystem: IFileSystem,
        cache: PersistentCache,
        models?: any,
        nativeProvider?: any
    ) {
        super();
        this.fileSystem = fileSystem;
        this.cache = cache;
        this.nativeProvider = nativeProvider;
        this._models = models || {};
        
        // Wrap fileSystem.readFile to track discovered files
        const originalReadFile = this.fileSystem.readFile.bind(this.fileSystem);
        this.fileSystem.readFile = async (path: string) => {
            const result = await originalReadFile(path);
            if (result && result.content) {
                // Track discovered file for its parent directory
                const parentDir = path.substring(0, path.lastIndexOf('/')) || '/';
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                
                if (!this.discoveredFiles.has(parentDir)) {
                    this.discoveredFiles.set(parentDir, []);
                }
                
                const files = this.discoveredFiles.get(parentDir)!;
                if (fileName && !files.some(f => f.name === fileName)) {
                    files.push({
                        name: fileName,
                        hash: '',
                        size: result.content.length,
                        isDirectory: false,
                        isBlobOrClob: false,
                        mode: 33188
                    });
                    
                    // Push directory listing to native cache
                    if (this.nativeProvider && typeof this.nativeProvider.setCachedDirectory === 'function') {
                        const valid = files.filter(e => e && typeof e.name === 'string' && e.name.length > 0);
                        if (valid.length > 0) {
                            this.nativeProvider.setCachedDirectory(parentDir, valid);
                            console.log(`[SmartCache] Updated directory listing for ${parentDir}: ${valid.length} files`);
                        }
                    }
                }
            }
            return result;
        };
        
        // Define caching strategies for different paths
        this.initializeStrategies();
    }
    
    private initializeStrategies(): void {
        // Root directory - always cached, high priority
        this.strategies.set('/', {
            syncInterval: 30000, // 30 seconds
            priority: 100,
            maxFileSize: 0,
            cacheContent: false,
            watchChanges: true
        });
        
        // Chats - frequently accessed, watch for changes
        this.strategies.set('/chats', {
            syncInterval: 60000, // 1 minute
            priority: 90,
            maxFileSize: 100 * 1024, // 100KB
            cacheContent: true,
            watchChanges: true
        });
        
        // Objects - large files, cache metadata only
        this.strategies.set('/objects', {
            syncInterval: 300000, // 5 minutes
            priority: 50,
            maxFileSize: 0, // Don't cache content
            cacheContent: false,
            watchChanges: false
        });
        
        // Debug - low priority
        this.strategies.set('/debug', {
            syncInterval: 600000, // 10 minutes
            priority: 20,
            maxFileSize: 10 * 1024, // 10KB
            cacheContent: false,
            watchChanges: false
        });
        
        // Invites - medium priority
        this.strategies.set('/invites', {
            syncInterval: 120000, // 2 minutes
            priority: 60,
            maxFileSize: 50 * 1024, // 50KB
            cacheContent: true,
            watchChanges: true
        });
    }
    
    public async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }
        
        this.isRunning = true;
        console.log('[SmartCache] Starting intelligent cache manager...');
        
        // Set up model event listeners if available
        this.setupModelListeners();
        
        // Initial cache population
        await this.performInitialCache();
        
        // Start sync timers for each strategy
        for (const [path, strategy] of this.strategies) {
            if (strategy.syncInterval > 0) {
                const timer = setInterval(() => {
                    this.syncPath(path).catch(error => {
                        console.error(`[SmartCache] Failed to sync ${path}:`, error);
                    });
                }, strategy.syncInterval);
                
                this.syncTimers.set(path, timer);
            }
        }
        
        console.log('[SmartCache] Started with intelligent caching strategies');
    }
    
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        // Clear all timers
        for (const timer of this.syncTimers.values()) {
            clearInterval(timer);
        }
        this.syncTimers.clear();
        
        // Remove model listeners
        this.removeModelListeners();
        
        // Save cache to disk
        this.cache.saveToDisk();
        
        console.log('[SmartCache] Stopped');
    }
    
    private setupModelListeners(): void {
        // TODO: ONE models don't currently expose event emitters
        // We'll need to implement polling or a different approach
        // For now, we'll rely on periodic sync and on-demand caching
        console.log('[SmartCache] Model listeners not implemented - using periodic sync');
    }
    
    private removeModelListeners(): void {
        // TODO: Remove listeners when event emitters are implemented
        this.changeListeners.clear();
    }
    
    private async performInitialCache(): Promise<void> {
        console.log('[SmartCache] Performing initial cache population...');
        
        // Sort strategies by priority
        const sortedPaths = Array.from(this.strategies.entries())
            .sort((a, b) => b[1].priority - a[1].priority)
            .map(([path]) => path);
        
        // Cache high-priority paths first
        for (const path of sortedPaths) {
            try {
                await this.syncPath(path);
            } catch (error) {
                console.error(`[SmartCache] Failed to cache ${path}:`, error);
            }
        }
        
        console.log('[SmartCache] Initial cache population complete');
        
        // REMOVED: Hardcoded directory entries
        // The cache should only contain real data from the filesystem
    }
    
    private async syncPath(path: string): Promise<void> {
        const strategy = this.strategies.get(path) || this.getDefaultStrategy();
        
        try {
            const dir = await this.fileSystem.readDir(path);
            if (!dir || !dir.children) {
                return;
            }
            
            const entries = [];
            
                for (const childName of dir.children) {
                const childPath = path === '/' ? `/${childName}` : `${path}/${childName}`;
                
                try {
                    const stat = await this.fileSystem.stat(childPath);
                    
                    // Determine if it's a directory
                        let isDirectory = (stat as any).isDirectory;
                        if (isDirectory === undefined && stat && stat.mode !== undefined) {
                            isDirectory = (stat.mode & 0xF000) === 0x4000;
                        }

                        // Heuristics: enforce directory classification for known virtual dirs
                        if (path === '/') {
                            isDirectory = true;
                        } else if (path === '/objects' && /^[0-9a-fA-F]{64}$/.test(childName)) {
                            // Object hashes are exposed as directories in the virtual FS
                            isDirectory = true;
                        }
                    
                    entries.push({
                        name: childName,
                        hash: (stat as any).hash || '',
                        size: stat.size || 0,
                            isDirectory: !!isDirectory,
                        isBlobOrClob: false,
                            mode: stat.mode || (isDirectory ? 16877 : 33188)
                    });
                    
                    // Cache file content based on strategy
                        if (!isDirectory && strategy.cacheContent && 
                        stat.size && stat.size <= strategy.maxFileSize) {
                        try {
                            const file = await this.fileSystem.readFile(childPath);
                            if (file && file.content) {
                                await this.cache.cacheFile(childPath, Buffer.from(file.content), stat);
                            }
                        } catch (error) {
                            // Ignore file read errors
                        }
                    }
                    
                } catch (error) {
                    // Skip entries that can't be stat'd
                }
            }
            
            // Cache the directory listing (validated inside PersistentCache)
            await this.cache.cacheDirectory(path, entries);
            
            // Also push directory listing to native cache
            if (this.nativeProvider && typeof this.nativeProvider.setCachedDirectory === 'function') {
                const nativeEntries = entries
                    .filter(entry => entry && typeof entry.name === 'string' && entry.name.length > 0)
                    .map(entry => ({
                        name: entry.name,
                        hash: entry.hash || '',
                        size: entry.size || 0,
                        isDirectory: path === '/'
                            ? (entry.name === 'objects' || entry.name === 'chats' || entry.name === 'invites' || entry.name === 'debug' || entry.name === 'types')
                            : !!entry.isDirectory,
                        isBlobOrClob: entry.isBlobOrClob || false,
                        mode: (path === '/' ? 16877 : (entry.mode || (entry.isDirectory ? 16877 : 33188)))
                    }));
                if (nativeEntries.length > 0) {
                    this.nativeProvider.setCachedDirectory(path, nativeEntries);
                    console.log(`[SmartCache] Pushed directory listing to native cache: ${path} (${nativeEntries.length} entries)`);
                }
            }
            
            // Emit cache update event
            this.emit('cacheUpdated', { path, entries: entries.length });
            
        } catch (error) {
            console.error(`[SmartCache] Error syncing ${path}:`, error);
        }
    }
    
    public invalidatePath(path: string): void {
        // Mark path as needing immediate resync
        console.log(`[SmartCache] Invalidating cache for ${path}`);
        
        // Sync immediately
        this.syncPath(path).catch(error => {
            console.error(`[SmartCache] Failed to resync ${path}:`, error);
        });
    }
    
    public recordAccess(path: string): void {
        // Track access patterns for adaptive caching
        if (!this.accessPatterns.has(path)) {
            this.accessPatterns.set(path, []);
        }
        
        const accesses = this.accessPatterns.get(path)!;
        const now = Date.now();
        accesses.push(now);
        
        // Keep only last 100 accesses
        if (accesses.length > 100) {
            accesses.shift();
        }
        
        // Adapt strategy based on access frequency
        this.adaptStrategy(path, accesses);
    }
    
    private adaptStrategy(path: string, accesses: number[]): void {
        if (accesses.length < 10) {
            return; // Not enough data
        }
        
        const now = Date.now();
        const recentAccesses = accesses.filter(t => now - t < 60000).length; // Last minute
        
        // If heavily accessed, reduce sync interval
        if (recentAccesses > 5) {
            const strategy = this.strategies.get(path);
            if (strategy && strategy.syncInterval > 10000) {
                console.log(`[SmartCache] Increasing cache frequency for ${path} due to high access`);
                strategy.syncInterval = Math.max(10000, strategy.syncInterval / 2);
                
                // Restart timer with new interval
                const timer = this.syncTimers.get(path);
                if (timer) {
                    clearInterval(timer);
                    const newTimer = setInterval(() => {
                        this.syncPath(path).catch(error => {
                            console.error(`[SmartCache] Failed to sync ${path}:`, error);
                        });
                    }, strategy.syncInterval);
                    this.syncTimers.set(path, newTimer);
                }
            }
        }
    }
    
    private getDefaultStrategy(): CacheStrategy {
        return {
            syncInterval: 300000, // 5 minutes
            priority: 30,
            maxFileSize: 10 * 1024, // 10KB
            cacheContent: false,
            watchChanges: false
        };
    }
    
    // Getter for models (in case we need it in the future)
    public get models() {
        return this._models;
    }
    
    public getStats(): any {
        const pathStats: any = {};
        
        for (const [path, accesses] of this.accessPatterns) {
            const now = Date.now();
            pathStats[path] = {
                totalAccesses: accesses.length,
                recentAccesses: accesses.filter(t => now - t < 60000).length,
                strategy: this.strategies.get(path)
            };
        }
        
        return {
            isRunning: this.isRunning,
            strategiesCount: this.strategies.size,
            activeTimers: this.syncTimers.size,
            pathStats,
            cacheStats: this.cache.getCacheStats()
        };
    }
}