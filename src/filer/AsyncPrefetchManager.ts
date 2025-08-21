/**
 * Generic async prefetch manager for ProjFS
 * Handles pre-fetching directory contents to avoid empty initial enumerations
 */

export interface PrefetchConfig {
    paths: string[];
    maxDepth?: number;
    parallelLimit?: number;
    timeoutMs?: number;
}

export class AsyncPrefetchManager {
    private readonly fileSystem: any;
    private readonly cache: Map<string, any> = new Map();
    private prefetchQueue: string[] = [];
    private activeFetches = 0;
    
    constructor(fileSystem: any) {
        this.fileSystem = fileSystem;
    }
    
    /**
     * Prefetch directory listings for specified paths
     * This is a generic solution that works for any path
     */
    async prefetchDirectories(config: PrefetchConfig): Promise<void> {
        const { 
            paths, 
            maxDepth = 1, 
            parallelLimit = 5,
            timeoutMs = 5000 
        } = config;
        
        // Add initial paths to queue
        this.prefetchQueue = [...paths];
        const results: Promise<void>[] = [];
        
        while (this.prefetchQueue.length > 0 || this.activeFetches > 0) {
            // Start new fetches up to parallel limit
            while (this.prefetchQueue.length > 0 && this.activeFetches < parallelLimit) {
                const path = this.prefetchQueue.shift()!;
                results.push(this.fetchDirectoryWithTimeout(path, timeoutMs, maxDepth));
            }
            
            // Wait for at least one to complete if we're at limit
            if (this.activeFetches >= parallelLimit && results.length > 0) {
                await Promise.race(results);
            }
            
            // Brief pause to prevent CPU spinning
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Wait for all remaining fetches
        await Promise.allSettled(results);
    }
    
    private async fetchDirectoryWithTimeout(
        path: string, 
        timeoutMs: number,
        remainingDepth: number
    ): Promise<void> {
        this.activeFetches++;
        
        try {
            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout fetching ${path}`)), timeoutMs)
            );
            
            // Race between actual fetch and timeout
            // Use the ONE file system interface: readDir + stat
            const dirInfo = await Promise.race([
                this.fileSystem.readDir(path),
                timeoutPromise
            ]);

            let entries: any[] = [];
            if (dirInfo && Array.isArray(dirInfo.children)) {
                const children: string[] = dirInfo.children;
                // Build entry objects using stat
                const perChild = children.map(async (name) => {
                    const childPath = path === '/' ? `/${name}` : `${path}/${name}`;
                    try {
                        const stat = await this.fileSystem.stat(childPath);
                        // Determine if directory from mode if needed
                        let isDirectory = (stat as any).isDirectory;
                        if (isDirectory === undefined && stat && stat.mode !== undefined) {
                            isDirectory = (stat.mode & 0xF000) === 0x4000;
                        }
                        return {
                            name,
                            hash: (stat as any).hash || '',
                            size: stat.size || 0,
                            isDirectory: !!isDirectory,
                            isBlobOrClob: false,
                            mode: stat.mode || (isDirectory ? 16877 : 33188)
                        };
                    } catch {
                        // Fallback minimal entry if stat fails
                        return {
                            name,
                            hash: '',
                            size: 0,
                            isDirectory: false,
                            isBlobOrClob: false,
                            mode: 33188
                        };
                    }
                });
                entries = await Promise.all(perChild);
            }

            // Cache the result (entries array)
            this.cache.set(path, entries);

            // Prefetch file content for non-directory entries
            if (Array.isArray(entries)) {
                const fileReadPromises: Promise<void>[] = [];
                
                for (const entry of entries) {
                    if (entry.isDirectory) {
                        // Queue directories for depth traversal
                        if (remainingDepth > 1) {
                            const childPath = path === '/' 
                                ? `/${entry.name}`
                                : `${path}/${entry.name}`;
                            
                            // Only queue if not already cached
                            if (!this.cache.has(childPath)) {
                                this.prefetchQueue.push(childPath);
                            }
                        }
                    } else {
                        // Prefetch file content for immediate files
                        const filePath = path === '/' 
                            ? `/${entry.name}`
                            : `${path}/${entry.name}`;
                        
                        // Read file content asynchronously (this will trigger content caching)
                        fileReadPromises.push(
                            this.fileSystem.readFile(filePath)
                                .then(() => {
                                    console.log(`[Prefetch] Cached content for file: ${filePath}`);
                                })
                                .catch((error: Error) => {
                                    console.log(`[Prefetch] Failed to cache ${filePath}: ${error.message}`);
                                })
                        );
                    }
                }
                
                // Wait for file content prefetching to complete (with limit to avoid overwhelming)
                if (fileReadPromises.length > 0) {
                    // Limit concurrent file reads to avoid overwhelming the system
                    const maxConcurrentReads = Math.min(fileReadPromises.length, 10);
                    for (let i = 0; i < fileReadPromises.length; i += maxConcurrentReads) {
                        const batch = fileReadPromises.slice(i, i + maxConcurrentReads);
                        await Promise.allSettled(batch);
                    }
                }
            }
            
        } catch (error) {
            // Silently ignore errors - this is best-effort prefetching
            console.log(`[Prefetch] Failed to fetch ${path}: ${error}`);
        } finally {
            this.activeFetches--;
        }
    }
    
    /**
     * Get cached entries for a path
     */
    getCachedEntries(path: string): any[] | undefined {
        return this.cache.get(path);
    }
    
    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
    }
    
    /**
     * Get standard paths that should always be prefetched
     * This can be extended based on common access patterns
     */
    static getStandardPrefetchPaths(): string[] {
        return [
            '/',           // Root - always needed
            '/invites',    // Invites - frequently accessed
            '/chats',      // Chats - user data
            '/debug',      // Debug info
            '/objects',    // Object storage
            '/types'       // Type definitions
        ];
    }
    
    /**
     * Smart prefetch based on access patterns
     * This learns from actual usage and prioritizes commonly accessed paths
     */
    async smartPrefetch(accessLog?: string[]): Promise<void> {
        // Start with standard paths
        const paths = AsyncPrefetchManager.getStandardPrefetchPaths();
        
        // Add frequently accessed paths from log if provided
        if (accessLog && accessLog.length > 0) {
            const frequency = new Map<string, number>();
            
            for (const path of accessLog) {
                frequency.set(path, (frequency.get(path) || 0) + 1);
            }
            
            // Sort by frequency and add top paths
            const sorted = Array.from(frequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)  // Top 10 most accessed
                .map(([path]) => path);
            
            paths.push(...sorted.filter(p => !paths.includes(p)));
        }
        
        // Prefetch with intelligent configuration
        await this.prefetchDirectories({
            paths,
            maxDepth: 2,  // Go 2 levels deep for important paths
            parallelLimit: 5,
            timeoutMs: 3000
        });
    }
}