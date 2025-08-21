import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import { PersistentCache } from './PersistentCache.js';

export class CacheSynchronizer {
    private fileSystem: IFileSystem;
    private cache: PersistentCache;
    private syncInterval: NodeJS.Timeout | null = null;
    private isSyncing: boolean = false;
    private lastSyncTime: number = 0;
    private syncIntervalMs: number = 60000; // 1 minute default
    private directoriesTracked: Set<string> = new Set();

    constructor(fileSystem: IFileSystem, cache: PersistentCache, syncIntervalMs: number = 60000) {
        this.fileSystem = fileSystem;
        this.cache = cache;
        this.syncIntervalMs = syncIntervalMs;
        
        // Start with root directories
        this.directoriesTracked.add('/');
        this.directoriesTracked.add('/chats');
        this.directoriesTracked.add('/objects');
        this.directoriesTracked.add('/debug');
        this.directoriesTracked.add('/invites');
        this.directoriesTracked.add('/types');
    }

    public start(): void {
        if (this.syncInterval) {
            return; // Already started
        }

        // Do initial sync
        this.performSync().catch(error => {
            console.error('[CacheSync] Initial sync failed:', error);
        });

        // Start periodic sync
        this.syncInterval = setInterval(() => {
            this.performSync().catch(error => {
                console.error('[CacheSync] Periodic sync failed:', error);
            });
        }, this.syncIntervalMs);

        console.log(`[CacheSync] Started with ${this.syncIntervalMs}ms interval`);
    }

    public stop(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        console.log('[CacheSync] Stopped');
    }

    private async performSync(): Promise<void> {
        if (this.isSyncing) {
            console.log('[CacheSync] Sync already in progress, skipping');
            return;
        }

        this.isSyncing = true;
        const startTime = Date.now();
        let syncedDirs = 0;
        let syncedFiles = 0;
        let errors = 0;

        try {
            console.log('[CacheSync] Starting sync...');

            // Sync each tracked directory
            for (const dirPath of this.directoriesTracked) {
                try {
                    await this.syncDirectory(dirPath);
                    syncedDirs++;
                } catch (error) {
                    console.error(`[CacheSync] Failed to sync directory ${dirPath}:`, error);
                    errors++;
                }
            }

            // Save cache to disk
            this.cache.saveToDisk();

            const duration = Date.now() - startTime;
            this.lastSyncTime = Date.now();
            
            console.log(`[CacheSync] Sync completed in ${duration}ms - Dirs: ${syncedDirs}, Files: ${syncedFiles}, Errors: ${errors}`);
            
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncDirectory(path: string): Promise<void> {
        try {
            // Read directory from filesystem
            const dir = await this.fileSystem.readDir(path);
            
            if (!dir || !dir.children) {
                return;
            }

            const entries = [];
            
            // Process each child
            for (const childName of dir.children) {
                const childPath = path === '/' ? `/${childName}` : `${path}/${childName}`;
                
                try {
                    const stat = await this.fileSystem.stat(childPath);
                    
                    // Determine if it's a directory from mode
                    let isDirectory = (stat as any).isDirectory;
                    if (isDirectory === undefined && stat.mode) {
                        isDirectory = (stat.mode & 0xF000) === 0x4000;
                    }
                    
                    entries.push({
                        name: childName,
                        hash: (stat as any).hash || '',
                        size: stat.size || 0,
                        isDirectory: isDirectory || false,
                        isBlobOrClob: false,
                        mode: stat.mode || (isDirectory ? 16877 : 33188)
                    });
                    
                    // Track subdirectories for future syncing
                    if (isDirectory && path === '/') {
                        this.directoriesTracked.add(childPath);
                    }
                    
                    // Cache file content if it's small enough
                    if (!isDirectory && stat.size && stat.size < 1024 * 1024) { // Less than 1MB
                        try {
                            const file = await this.fileSystem.readFile(childPath);
                            if (file && file.content) {
                                await this.cache.cacheFile(childPath, Buffer.from(file.content), stat);
                            }
                        } catch (error) {
                            // Ignore file read errors during sync
                        }
                    }
                    
                } catch (error) {
                    // Skip entries that can't be stat'd
                    console.debug(`[CacheSync] Skipping ${childPath}: ${error}`);
                }
            }
            
            // Cache the directory listing
            await this.cache.cacheDirectory(path, entries);
            
        } catch (error) {
            throw new Error(`Failed to sync directory ${path}: ${error}`);
        }
    }

    public async syncPath(path: string): Promise<void> {
        // Sync a specific path on-demand
        if (path.endsWith('/')) {
            await this.syncDirectory(path);
        } else {
            // It's a file, sync its parent directory
            const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
            await this.syncDirectory(parentPath);
        }
        
        this.cache.saveToDisk();
    }

    public getStats(): any {
        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            directoriesTracked: this.directoriesTracked.size,
            syncIntervalMs: this.syncIntervalMs
        };
    }
}