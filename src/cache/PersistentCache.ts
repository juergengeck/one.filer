import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

interface CacheEntry {
    path: string;
    isDirectory: boolean;
    size: number;
    mode: number;
    hash?: string;
    content?: Buffer;
    children?: string[];
    lastUpdated: number;
    lastAccessed: number;
}

interface CacheMetadata {
    version: string;
    lastSync: number;
    totalSize: number;
    entryCount: number;
    instanceId: string;
}

export class PersistentCache {
    private cacheDir: string;
    private metadataPath: string;
    private metadata: CacheMetadata;
    private memoryCache: Map<string, CacheEntry> = new Map();
    private isDirty: boolean = false;
    private saveInterval: NodeJS.Timeout | null = null;
    private maxMemoryCacheSize: number = 100 * 1024 * 1024; // 100MB in memory
    private currentMemorySize: number = 0;

    constructor(instancePath: string) {
        this.cacheDir = join(instancePath, 'projfs-cache');
        this.metadataPath = join(this.cacheDir, 'metadata.json');
        
        // Ensure cache directory exists
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
        }

        // Create subdirectories for organized storage
        const subdirs = ['files', 'directories', 'objects'];
        for (const subdir of subdirs) {
            const path = join(this.cacheDir, subdir);
            if (!existsSync(path)) {
                mkdirSync(path, { recursive: true });
            }
        }

        // Load or initialize metadata
        this.metadata = this.loadMetadata();
        
        // Start periodic save
        this.saveInterval = setInterval(() => {
            this.saveToDisk();
        }, 30000); // Save every 30 seconds
    }

    private loadMetadata(): CacheMetadata {
        if (existsSync(this.metadataPath)) {
            try {
                const data = readFileSync(this.metadataPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error('Failed to load cache metadata:', error);
            }
        }

        // Initialize new metadata
        return {
            version: '1.0.0',
            lastSync: Date.now(),
            totalSize: 0,
            entryCount: 0,
            instanceId: crypto.randomBytes(16).toString('hex')
        };
    }

    private saveMetadata(): void {
        try {
            writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
        } catch (error) {
            console.error('Failed to save cache metadata:', error);
        }
    }

    private getCachePath(virtualPath: string, isDirectory: boolean): string {
        // Normalize the path
        const normalized = virtualPath.replace(/\\/g, '/').replace(/^\/+/, '');
        
        // Hash the path for filesystem safety
        const hash = crypto.createHash('md5').update(normalized).digest('hex');
        
        // Determine subdirectory
        const subdir = isDirectory ? 'directories' : 'files';
        
        // Create a safe filename
        const filename = `${hash}.json`;
        
        return join(this.cacheDir, subdir, filename);
    }

    public async cacheDirectory(path: string, entries: any[]): Promise<void> {
        // Validate entries: ensure each entry has a non-empty name
        const validEntries = (entries || []).filter(e => e && typeof e.name === 'string' && e.name.length > 0);
        if (validEntries.length !== (entries || []).length) {
            console.warn(`[Cache] Filtered ${((entries || []).length - validEntries.length)} invalid entries (missing names) for ${path}`);
        }
        const entry: CacheEntry = {
            path,
            isDirectory: true,
            size: 0,
            mode: 16877, // Directory mode
            children: validEntries.map(e => e.name),
            lastUpdated: Date.now(),
            lastAccessed: Date.now()
        };

        // Store in memory cache
        this.memoryCache.set(path, entry);
        
        // Store children entries
        for (const child of validEntries) {
            const childPath = path === '/' ? `/${child.name}` : `${path}/${child.name}`;
            const childEntry: CacheEntry = {
                path: childPath,
                isDirectory: child.isDirectory || false,
                size: child.size || 0,
                mode: child.mode || (child.isDirectory ? 16877 : 33188),
                hash: child.hash,
                lastUpdated: Date.now(),
                lastAccessed: Date.now()
            };
            
            this.memoryCache.set(childPath, childEntry);
            
            // Save to disk immediately for directories
            if (child.isDirectory) {
                this.saveCacheEntry(childEntry);
            }
        }

        // Save directory entry to disk
        this.saveCacheEntry(entry);
        
        // Update metadata
        this.metadata.entryCount = this.memoryCache.size;
        this.metadata.lastSync = Date.now();
        this.isDirty = true;
    }

    public async cacheFile(path: string, content: Buffer, metadata?: any): Promise<void> {
        const entry: CacheEntry = {
            path,
            isDirectory: false,
            size: content.length,
            mode: metadata?.mode || 33188,
            hash: crypto.createHash('sha256').update(content).digest('hex'),
            content: content,
            lastUpdated: Date.now(),
            lastAccessed: Date.now()
        };

        // Check memory limit
        if (this.currentMemorySize + content.length > this.maxMemoryCacheSize) {
            // Evict least recently used entries
            this.evictLRU(content.length);
        }

        // Store in memory cache
        this.memoryCache.set(path, entry);
        this.currentMemorySize += content.length;

        // Save to disk
        this.saveCacheEntry(entry);

        // Update metadata
        this.metadata.totalSize += content.length;
        this.metadata.entryCount = this.memoryCache.size;
        this.metadata.lastSync = Date.now();
        this.isDirty = true;
    }

    private evictLRU(neededSpace: number): void {
        const entries = Array.from(this.memoryCache.entries());
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

        let freedSpace = 0;
        for (const [, entry] of entries) {
            if (entry.content) {
                freedSpace += entry.content.length;
                this.currentMemorySize -= entry.content.length;
                entry.content = undefined; // Remove content from memory but keep metadata
            }
            
            if (freedSpace >= neededSpace) {
                break;
            }
        }
    }

    private saveCacheEntry(entry: CacheEntry): void {
        const cachePath = this.getCachePath(entry.path, entry.isDirectory);
        
        try {
            // Create entry without content for JSON serialization
            const jsonEntry = { ...entry };
            
            // If there's content, save it separately
            if (entry.content) {
                const contentPath = cachePath.replace('.json', '.bin');
                writeFileSync(contentPath, entry.content);
                delete jsonEntry.content;
            }
            
            // Save metadata
            writeFileSync(cachePath, JSON.stringify(jsonEntry, null, 2));
        } catch (error) {
            console.error(`Failed to save cache entry for ${entry.path}:`, error);
        }
    }

    public async getDirectory(path: string): Promise<CacheEntry | null> {
        // Check memory cache first
        if (this.memoryCache.has(path)) {
            const entry = this.memoryCache.get(path)!;
            entry.lastAccessed = Date.now();
            return entry;
        }

        // Load from disk
        const cachePath = this.getCachePath(path, true);
        if (existsSync(cachePath)) {
            try {
                const data = readFileSync(cachePath, 'utf8');
                const entry: CacheEntry = JSON.parse(data);
                entry.lastAccessed = Date.now();
                
                // Store in memory cache
                this.memoryCache.set(path, entry);
                
                return entry;
            } catch (error) {
                console.error(`Failed to load cache entry for ${path}:`, error);
            }
        }

        return null;
    }

    public async getFile(path: string): Promise<CacheEntry | null> {
        // Check memory cache first
        if (this.memoryCache.has(path)) {
            const entry = this.memoryCache.get(path)!;
            entry.lastAccessed = Date.now();
            
            // Load content if not in memory
            if (!entry.content) {
                const contentPath = this.getCachePath(path, false).replace('.json', '.bin');
                if (existsSync(contentPath)) {
                    entry.content = readFileSync(contentPath);
                    this.currentMemorySize += entry.content.length;
                }
            }
            
            return entry;
        }

        // Load from disk
        const cachePath = this.getCachePath(path, false);
        if (existsSync(cachePath)) {
            try {
                const data = readFileSync(cachePath, 'utf8');
                const entry: CacheEntry = JSON.parse(data);
                entry.lastAccessed = Date.now();
                
                // Load content
                const contentPath = cachePath.replace('.json', '.bin');
                if (existsSync(contentPath)) {
                    entry.content = readFileSync(contentPath);
                }
                
                // Store in memory cache
                this.memoryCache.set(path, entry);
                if (entry.content) {
                    this.currentMemorySize += entry.content.length;
                }
                
                return entry;
            } catch (error) {
                console.error(`Failed to load cache entry for ${path}:`, error);
            }
        }

        return null;
    }

    public async preloadRootDirectories(): Promise<Map<string, any[]>> {
        const rootDirs = new Map<string, any[]>();
        
        // Load all directory entries from disk
        const dirPath = join(this.cacheDir, 'directories');
        if (existsSync(dirPath)) {
            const files = readdirSync(dirPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const data = readFileSync(join(dirPath, file), 'utf8');
                        const entry: CacheEntry = JSON.parse(data);
                        
                        // Build directory listing from children
                        if (entry.children) {
                            const children = [];
                            for (const childName of entry.children) {
                                const childPath = entry.path === '/' ? `/${childName}` : `${entry.path}/${childName}`;
                                const childEntry = await this.getDirectory(childPath) || await this.getFile(childPath);
                                
                                if (childEntry) {
                                    children.push({
                                        name: childName,
                                        hash: childEntry.hash || '',
                                        size: childEntry.size,
                                        isDirectory: childEntry.isDirectory,
                                        isBlobOrClob: false,
                                        mode: childEntry.mode
                                    });
                                }
                            }
                            
                            if (children.length > 0) {
                                rootDirs.set(entry.path, children);
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to load directory cache: ${file}`, error);
                    }
                }
            }
        }
        
        return rootDirs;
    }

    public saveToDisk(): void {
        if (!this.isDirty) {
            return;
        }

        // Save metadata
        this.saveMetadata();
        
        // Save any dirty memory cache entries
        for (const entry of this.memoryCache.values()) {
            if (Date.now() - entry.lastUpdated < 60000) { // Recently updated
                this.saveCacheEntry(entry);
            }
        }
        
        this.isDirty = false;
        console.log(`[Cache] Saved ${this.memoryCache.size} entries to disk`);
    }

    public getCacheStats(): any {
        return {
            ...this.metadata,
            memoryCacheSize: this.memoryCache.size,
            memoryUsage: this.currentMemorySize,
            cacheDirectory: this.cacheDir
        };
    }

    public clearCache(): void {
        // Clear memory cache
        this.memoryCache.clear();
        this.currentMemorySize = 0;
        
        // Clear disk cache
        if (existsSync(this.cacheDir)) {
            rmSync(this.cacheDir, { recursive: true, force: true });
            mkdirSync(this.cacheDir, { recursive: true });
        }
        
        // Reset metadata
        this.metadata = this.loadMetadata();
        this.isDirty = false;
        
        console.log('[Cache] Cache cleared');
    }

    public shutdown(): void {
        // Save any pending changes
        this.saveToDisk();
        
        // Clear interval
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        
        // Clear memory cache
        this.memoryCache.clear();
        this.currentMemorySize = 0;
    }
}