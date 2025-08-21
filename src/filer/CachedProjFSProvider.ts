import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import FileSystemHelpers from '@refinio/one.models/lib/fileSystems/FileSystemHelpers.js';
import { createRequire } from 'module';
import { appendFileSync } from 'fs';
import { PersistentCache } from '../cache/PersistentCache.js';
import { SmartCacheManager } from '../cache/SmartCacheManager.js';
import { AsyncPrefetchManager } from './AsyncPrefetchManager.js';
import { contextManager, type RequestContext } from './RequestContextManager.js';
import { cacheStrategy } from '../cache/FileSystemCacheStrategy.js';
import { errorHandler } from './ErrorContextHandler.js';

// Create require for loading native modules in ESM
const require = createRequire(import.meta.url);

// Simple interface for the native ProjFS provider
interface INativeProjFSProvider {
    mount(virtualRoot: string): Promise<void>;
    unmount(): Promise<void>;
    isRunning(): boolean;
    getStats(): any;
}

interface ProjFSEntry {
    name: string;
    hash: string;
    size: number;
    isDirectory: boolean;
    isBlobOrClob: boolean;
    mode: number;
}

interface CacheEntry {
    entries: ProjFSEntry[];
    time: number;
}

export class CachedProjFSProvider {
    private nativeProvider: INativeProjFSProvider | null = null;
    private fileSystem: IFileSystem;
    private virtualRoot: string;
    private instancePath: string;
    private pathCache = new Map<string, CacheEntry>();
    private cacheTTL: number;
    private enumerationCount = 0;
    private logFile = 'C:\\Users\\juerg\\source\\one.filer\\projfs-operations.log';
    private persistentCache: PersistentCache;
    private cacheManager: SmartCacheManager | null = null;
    private options: any;
    private prefetchComplete: boolean = false;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(options: {
        instancePath: string;
        virtualRoot: string;
        fileSystem: IFileSystem;
        cacheTTL?: number;
        debug?: boolean;
        disableCowCache?: boolean;
        disableInMemoryCache?: boolean;
        verboseLogging?: boolean;
        traceAllOperations?: boolean;
        preMountNativeDirectoryCache?: boolean; // if true, allow pre-mount setCachedDirectory pushes
    }) {
        this.options = options;
        this.virtualRoot = options.virtualRoot || 'C:\\OneFiler';
        this.fileSystem = options.fileSystem;
        this.instancePath = options.instancePath;
        this.cacheTTL = (options.cacheTTL || 30) * 1000; // Convert to milliseconds
        
        // Initialize persistent cache
        this.persistentCache = new PersistentCache(this.instancePath);
        
        this.log('\\n========================================');
        this.log('CachedProjFSProvider Constructor Called');
        this.log(`Virtual Root: ${this.virtualRoot}`);
        this.log(`Instance Path: ${options.instancePath}`);
        this.log(`Cache TTL: ${this.cacheTTL}ms`);
        this.log('Persistent cache initialized');
        this.log('========================================');
    }

    async init(): Promise<void> {
        // CRITICAL FIX: Load the module and check exports
        const projfsModule = require('@refinio/one.ifsprojfs');
        this.log(`IFSProjFSProvider module loaded`);
        this.log(`Module exports: ${JSON.stringify(Object.keys(projfsModule))}`);
        this.log(`IFSProjFSProvider type: ${typeof projfsModule.IFSProjFSProvider}`);
        
        // Handle both named and default exports
        const IFSProjFSProvider = projfsModule.IFSProjFSProvider || projfsModule.default || projfsModule;
        
        if (typeof IFSProjFSProvider !== 'function') {
            throw new Error(`IFSProjFSProvider is not a constructor. Got: ${typeof IFSProjFSProvider}`);
        }
        
        // Create the provider with our fileSystem and COW configuration
        this.nativeProvider = new IFSProjFSProvider({
            instancePath: this.instancePath,
            virtualRoot: this.virtualRoot,
            fileSystem: this.fileSystem,
            debug: this.options.debug || false,
            disableCowCache: this.options.disableCowCache || false,
            disableInMemoryCache: this.options.disableInMemoryCache || false,
            verboseLogging: this.options.verboseLogging || false,
            traceAllOperations: this.options.traceAllOperations || false
        });
        this.log(`IFSProjFSProvider instance created`);
        
        this.log('Native provider created successfully');
        this.log(`Native provider methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.nativeProvider))}`);
        
        // Replace the native readDirectory method with our cached version
        this.log('About to call setupCallbacks()...');
        await this.setupCallbacks();
        this.log('init() completed successfully');
    }
    
    public setModels(models: any): void {
        // Create smart cache manager with models
        if (this.persistentCache) {
            this.cacheManager = new SmartCacheManager(this.fileSystem, this.persistentCache, models, this.nativeProvider);
            this.log('SmartCacheManager initialized with models and native provider');
        }
    }

    public isPrefetchComplete(): boolean {
        return this.prefetchComplete === true;
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(message);
        
        try {
            appendFileSync(this.logFile, `[${timestamp}] ${message}\n`);
        } catch (e) {
            // Silent fail for logging
        }
    }

    private normalizePath(windowsPath: string): string {
        // Convert Windows path to internal path
        let path = windowsPath.replace(/\\/g, '/');
        
        // Remove virtual root prefix
        const rootPattern = this.virtualRoot.replace(/\\/g, '/');
        if (path.startsWith(rootPattern)) {
            path = path.substring(rootPattern.length);
        }
        
        // Ensure it starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Clean up double slashes
        path = path.replace(/\/+/g, '/');
        
        // Root case
        if (path === '/' || path === '') {
            return '/';
        }
        
        return path;
    }

    private async readDirectoryInternal(path: string, context?: RequestContext): Promise<ProjFSEntry[]> {
        // Create or use existing context
        const reqContext = context || contextManager.createContext('enumeration', path);
        contextManager.startTelemetry(reqContext, 'readDirectory');
        
        try {
            this.log(`[TRACE] About to call fileSystem.readDir('${path}')`);
            const dirInfo = await this.fileSystem.readDir(path);
            this.log(`[TRACE] readDir returned: ${JSON.stringify(dirInfo)}`);
            
            const entries: ProjFSEntry[] = [];
            
            // Determine source filesystem
            const sourceFS = this.getSourceFileSystem(path);
            
            if (dirInfo.children) {
                this.log(`[TRACE] Processing ${dirInfo.children.length} children: ${dirInfo.children.join(', ')}`);
                
                for (const childName of dirInfo.children) {
                    try {
                        const childPath = path === '/' ? `/${childName}` : `${path}/${childName}`;
                        this.log(`[TRACE] About to stat: ${childPath}`);
                        
                        const stat = await this.fileSystem.stat(childPath);
                        this.log(`[TRACE] stat returned for ${childPath}: ${JSON.stringify(stat)}`);
                        
                        const fileMode = FileSystemHelpers.retrieveFileMode(stat.mode);
                        const isDirectory = fileMode.type === 'dir';
                        const now = Date.now();
                        
                        this.log(`[TRACE] fileMode: ${JSON.stringify(fileMode)}, isDirectory: ${isDirectory}`);
                        
                        entries.push({
                            name: childName,
                            hash: '',
                            size: stat.size || 0,
                            isDirectory: isDirectory,
                            isBlobOrClob: false,
                            mode: stat.mode || (isDirectory ? 16877 : 33188),
                            // Extended fields
                            mtime: now,
                            atime: now,
                            ctime: now,
                            sourceFS: sourceFS,
                            virtualPath: path,
                            contentType: this.getContentType(childName, isDirectory),
                            metadata: {
                                requestId: reqContext.requestId,
                                depth: reqContext.depth.toString()
                            }
                        } as any);
                    } catch (childError) {
                        // For files that can't be stat'd, make intelligent defaults
                        // Top-level entries (chats, objects, invites, debug, types) should be directories
                        const isTopLevelDirectory = path === '/' && 
                            ['chats', 'objects', 'invites', 'debug', 'types'].includes(childName);
                        
                        const now = Date.now();
                        entries.push({
                            name: childName,
                            hash: '',
                            size: 0,
                            isDirectory: isTopLevelDirectory,
                            isBlobOrClob: false,
                            mode: isTopLevelDirectory ? 16877 : 33188,
                            // Extended fields with defaults
                            mtime: now,
                            atime: now,
                            ctime: now,
                            sourceFS: sourceFS,
                            virtualPath: path,
                            contentType: isTopLevelDirectory ? 'inode/directory' : 'application/octet-stream',
                            metadata: {
                                requestId: reqContext.requestId,
                                error: (childError as Error).message
                            }
                        } as any);
                        this.log(`Warning: Could not stat ${path}/${childName}, defaulting to ${isTopLevelDirectory ? 'directory' : 'file'}`);
                    }
                }
            }
            
            contextManager.endTelemetry(reqContext.requestId, 'success');
            return entries;
        } catch (error) {
            const contextualError = errorHandler.wrapError(
                error as Error,
                'readDirectory',
                path,
                {
                    requestId: reqContext.requestId,
                    sourceFS: this.getSourceFileSystem(path),
                    metadata: {
                        context: reqContext
                    }
                }
            );
            
            contextManager.endTelemetry(reqContext.requestId, 'error', contextualError.message);
            this.log(`Error reading directory: ${contextualError.message}`);
            return [];
        }
    }
    
    private getSourceFileSystem(path: string): string {
        if (path.startsWith('/chats')) return 'chat';
        if (path.startsWith('/objects')) return 'objects';
        if (path.startsWith('/debug')) return 'debug';
        if (path.startsWith('/invites')) return 'invites';
        if (path.startsWith('/types')) return 'types';
        return 'root';
    }
    
    private getContentType(filename: string, isDirectory: boolean): string {
        if (isDirectory) return 'inode/directory';
        
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'ts': 'application/typescript',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'zip': 'application/zip'
        };
        
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }

    // Currently unused but kept for future caching implementation
    // @ts-ignore
    private async readDirectoryWithCache(windowsPath: string): Promise<ProjFSEntry[]> {
        this.enumerationCount++;
        const normalizedPath = this.normalizePath(windowsPath);
        
        this.log(`\nreadDirectory #${this.enumerationCount}: "${windowsPath}" -> "${normalizedPath}"`);
        
        // Check cache with filesystem-aware strategy
        const cached = this.pathCache.get(normalizedPath);
        if (cached) {
            // Use filesystem-specific cache TTL
            const ttl = cacheStrategy.getCacheTTL(normalizedPath, cached.entries[0] as any);
            if ((Date.now() - cached.time) < ttl) {
                this.log(`  CACHED: Returning ${cached.entries.length} entries (TTL: ${ttl}ms)`);
                return cached.entries;
            }
        }
        
        // Handle root path specially to prevent recursion
        if (normalizedPath === '/') {
            const rootEntries: ProjFSEntry[] = [
                { name: 'chats', hash: '', size: 0, isDirectory: true, isBlobOrClob: false, mode: 16877 },
                { name: 'debug', hash: '', size: 0, isDirectory: true, isBlobOrClob: false, mode: 16877 },
                { name: 'objects', hash: '', size: 0, isDirectory: true, isBlobOrClob: false, mode: 16877 },
                { name: 'invites', hash: '', size: 0, isDirectory: true, isBlobOrClob: false, mode: 16877 }
            ];
            
            this.pathCache.set(normalizedPath, {
                entries: rootEntries,
                time: Date.now()
            });
            
            this.log(`  ROOT: Returning ${rootEntries.length} hardcoded entries`);
            return rootEntries;
        }
        
        try {
            // Use filesystem for non-root paths
            const dirInfo = await this.fileSystem.readDir(normalizedPath);
            const entries: ProjFSEntry[] = [];
            
            if (dirInfo.children) {
                for (const childName of dirInfo.children) {
                    try {
                        const childPath = normalizedPath === '/' ? `/${childName}` : `${normalizedPath}/${childName}`;
                        const stat = await this.fileSystem.stat(childPath);
                        const fileMode = FileSystemHelpers.retrieveFileMode(stat.mode);
                        const isDirectory = fileMode.type === 'dir';
                        
                        entries.push({
                            name: childName,
                            hash: '',
                            size: stat.size || 0,
                            isDirectory: isDirectory,
                            isBlobOrClob: false,
                            mode: stat.mode || (isDirectory ? 16877 : 33188)
                        });
                    } catch (childError) {
                        // Skip files that can't be stat'd
                    }
                }
            }
            
            // Cache the result
            this.pathCache.set(normalizedPath, {
                entries: entries,
                time: Date.now()
            });
            
            this.log(`  FS: Returning ${entries.length} entries`);
            return entries;
            
        } catch (error) {
            this.log(`  ERROR: ${(error as Error).message}`);
            return [];
        }
    }

    private async setupCallbacks(): Promise<void> {
        const provider = this.nativeProvider as any;
        
        // Log all available methods on the provider
        this.log('Available provider methods: ' + Object.getOwnPropertyNames(provider));
        this.log('Available provider prototype methods: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(provider)));
        
        // Check if the native provider has callback registration methods
        if (typeof provider.onFileContentRequest === 'function') {
            this.log('Setting up file content callback...');
            provider.onFileContentRequest(async (filePath: string) => {
                this.log(`File content requested for: ${filePath}`);
                try {
                    const normalizedPath = this.normalizePath(filePath);
                    this.log(`Normalized path: ${normalizedPath}`);
                    
                    const file = await this.fileSystem.readFile(normalizedPath);
                    if (file && file.content) {
                        this.log(`Returning file content, size: ${file.content.length} bytes`);
                        return Buffer.from(file.content);
                    } else {
                        this.log('File content is empty or null');
                        return Buffer.alloc(0);
                    }
                } catch (error) {
                    this.log(`Error reading file content: ${(error as Error).message}`);
                    return Buffer.alloc(0);
                }
            });
        } else if (provider.on && typeof provider.on === 'function') {
            this.log('Setting up event-based file content handler...');
            provider.on('fileContentRequest', async (filePath: string, callback: any) => {
                this.log(`File content event received for: ${filePath}`);
                try {
                    const normalizedPath = this.normalizePath(filePath);
                    this.log(`Normalized path: ${normalizedPath}`);
                    
                    const file = await this.fileSystem.readFile(normalizedPath);
                    if (file && file.content) {
                        this.log(`Returning file content via callback, size: ${file.content.length} bytes`);
                        callback(null, Buffer.from(file.content));
                    } else {
                        this.log('File content is empty or null');
                        callback(null, Buffer.alloc(0));
                    }
                } catch (error) {
                    this.log(`Error reading file content: ${(error as Error).message}`);
                    callback(error, null);
                }
            });
            
            // Also try other event names that might be used
            provider.on('getFileData', (filePath: string, callback: any) => {
                this.log(`GetFileData event received for: ${filePath}`);
                // Same handler logic
            });
            
            provider.on('readFile', (filePath: string, callback: any) => {
                this.log(`ReadFile event received for: ${filePath}`);
                // Same handler logic  
            });
        } else {
            // The IFSProjFSProvider JavaScript wrapper already has callbacks set up
            // It directly uses this.fileSystem that we passed in the constructor
            this.log('IFSProjFSProvider already configured with our fileSystem');
            this.log('Provider should use the fileSystem object directly for file content');
        }
        
        // Add logging wrapper to our fileSystem to see what's being called
        const originalReadFile = this.fileSystem.readFile;
        const self = this;
        this.fileSystem.readFile = async (path: string) => {
            self.log(`FileSystem.readFile called for: ${path}`);
            try {
                const result = await originalReadFile.call(self.fileSystem, path);
                if (result && result.content) {
                    self.log(`FileSystem.readFile returning content, size: ${result.content.length} bytes`);
                    
                    // Push content to native cache immediately
                    if (self.nativeProvider && typeof (self.nativeProvider as any).setCachedContent === 'function') {
                        const content = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
                        (self.nativeProvider as any).setCachedContent(path, content);
                        self.log(`Pushed ${content.length} bytes to native cache for ${path}`);
                        
                        // Complete any pending file requests for this path
                        if (typeof (self.nativeProvider as any).completePendingFileRequests === 'function') {
                            (self.nativeProvider as any).completePendingFileRequests(path);
                            self.log(`Completed pending file requests for ${path}`);
                        }
                    }
                } else {
                    self.log(`FileSystem.readFile returning empty content for: ${path}`);
                }
                return result;
            } catch (error) {
                self.log(`FileSystem.readFile error for ${path}: ${(error as Error).message}`);
                throw error;
            }
        };
    }

    async mount(): Promise<void> {
        if (!this.nativeProvider) {
            throw new Error('Native provider not initialized. Call init() first.');
        }
        
        this.log('\n=== MOUNT CALLED ===');
        this.log(`Mounting at: ${this.virtualRoot}`);
        
        // CRITICAL: Verify filesystem is ready before mounting
        this.log('Verifying filesystem is ready...');
        const rootTest = await this.fileSystem.readDir('/');
        if (!rootTest || !rootTest.children || rootTest.children.length === 0) {
            throw new Error('Cannot mount ProjFS: Filesystem is not ready (no root entries)');
        }
        this.log(`Filesystem ready with ${rootTest.children.length} mount points: ${rootTest.children.join(', ')}`);
        
        // Load cached directories from persistent storage
        this.log('Loading persistent cache...');
        const cachedDirs = await this.persistentCache.preloadRootDirectories();
        this.log(`Loaded ${cachedDirs.size} cached directories from disk`);
        
        // Populate memory cache from persistent cache
        for (const [path, entries] of cachedDirs) {
            this.pathCache.set(path, {
                entries: entries as ProjFSEntry[],
                time: Date.now()
            });
        }
        
        // Pre-populate root directory entries
        this.log('Pre-populating root directory...');
        try {
            const rootEntries = await this.readDirectoryInternal('/');
            if (rootEntries && rootEntries.length > 0) {
                this.pathCache.set('/', {
                    entries: rootEntries,
                    time: Date.now()
                });
                this.log(`Pre-populated root with ${rootEntries.length} entries: ${rootEntries.map(e => e.name).join(', ')}`);
            } else {
                throw new Error('Failed to get root entries from filesystem');
            }
        } catch (error) {
            this.log(`ERROR: Could not pre-populate root directory: ${(error as Error).message}`);
            throw new Error(`Cannot mount ProjFS: ${(error as Error).message}`);
        }
        
        // Pre-population is now handled by the JavaScript IFSProjFSProvider
        // which will populate its cache after mount
        
        // Create the virtual root directory if it doesn't exist
        try {
            const fs = require('fs');
            if (!fs.existsSync(this.virtualRoot)) {
                this.log(`Creating virtual root directory: ${this.virtualRoot}`);
                fs.mkdirSync(this.virtualRoot, { recursive: true });
                this.log(`Virtual root directory created successfully`);
            } else {
                this.log(`Virtual root directory already exists: ${this.virtualRoot}`);
            }
        } catch (error) {
            const err = error as Error & { code?: string };
            // Fail fast so the app doesn't "start" without a mount point
            this.log(`ERROR: Failed to create virtual root directory ${this.virtualRoot}: ${err.message}${err.code ? ` (code: ${err.code})` : ''}`);
            throw new Error(`Failed to create ProjFS mount directory at ${this.virtualRoot}. ${err.message}`);
        }
        
        this.enumerationCount = 0;
        
        const provider = this.nativeProvider as any;
        
        try {
            // Check which method the provider has (mount or start)
            if (typeof provider.mount === 'function') {
                // IMPORTANT: Prefetch BEFORE mount so cache is ready when Explorer queries
                // This is critical for ProjFS to work properly
                try {
                    this.log('Starting pre-mount directory prefetch...');
                    const prefetchManager = new AsyncPrefetchManager(this.fileSystem);
                    
                    // Use smart prefetch which handles standard paths and learns from usage
                    await prefetchManager.smartPrefetch();
                    
                    // Re-enable pre-mount cache with forced directory fix
                    if (this.options.preMountNativeDirectoryCache !== false && typeof (provider as any).setCachedDirectory === 'function') {
                        const standardPaths = AsyncPrefetchManager.getStandardPrefetchPaths();
                        
                        for (const path of standardPaths) {
                            const cachedEntries = prefetchManager.getCachedEntries(path);
                            if (cachedEntries && cachedEntries.length > 0) {
                                // Convert to native format expected by setCachedDirectory
                                const nativeEntries = cachedEntries
                                    .filter((entry: any) => entry && typeof entry.name === 'string' && entry.name.length > 0)
                                    .map((entry: any) => {
                                        // Virtual directories at root level are always directories
                                        const isVirtualDirectory = path === '/' && 
                                            ['chats', 'debug', 'invites', 'objects', 'types'].includes(entry.name);
                                        
                                        const isDirectory = isVirtualDirectory || entry.isDirectory || false;
                                        
                                        return {
                                            name: entry.name,
                                            hash: entry.hash || '',
                                            size: entry.size || 0,
                                            isDirectory: isDirectory,
                                            isBlobOrClob: entry.isBlobOrClob || false,
                                            mode: entry.mode || (isDirectory ? 16877 : 33188)
                                        };
                                    });
                                
                                if (nativeEntries.length > 0) {
                                    (provider as any).setCachedDirectory(path, nativeEntries);
                                    this.log(`Pre-mount: Cached ${nativeEntries.length} entries for ${path}`);
                                }
                            }
                        }
                    } else if (typeof (provider as any).setCachedDirectory !== 'function') {
                        this.log('WARNING: setCachedDirectory method not found on provider');
                    } else {
                        this.log('Pre-mount native directory cache push disabled by configuration');
                    }
                    
                    this.prefetchComplete = true;
                    this.log('Pre-mount prefetch completed successfully');
                } catch (e) {
                    this.log(`Warning: Pre-mount prefetch failed (non-critical): ${(e as Error).message}`);
                    // This is non-critical - the system will still work with async fetching
                }
                
                this.log('Calling provider.mount()...');
                
                // Pass the virtual root to mount method
                const result = await provider.mount(this.virtualRoot);
                this.log(`provider.mount() returned: ${JSON.stringify(result)}`);
                
                this.log('Mount completed successfully via mount() method');

                // Sanity check: ensure mount directory exists after mounting
                try {
                    const fs = require('fs');
                    if (!fs.existsSync(this.virtualRoot)) {
                        throw new Error('Mount directory is missing after provider.mount()');
                    }
                } catch (e) {
                    const em = e as Error;
                    this.log(`ERROR: ProjFS mount point not present after mount: ${em.message}`);
                    throw new Error(`ProjFS mount point was not created at ${this.virtualRoot}. ${em.message}`);
                }
                
                // The file system callbacks are already configured during construction
                this.log('IFSProjFSProvider mounted - file system callbacks are active');
                
                // Start the smart cache manager if available
                if (this.cacheManager) {
                    await this.cacheManager.start();
                    this.log('SmartCacheManager started');
                    // Consider smart cache start as readiness, too
                    this.prefetchComplete = true;
                }
                
                // Start periodic cleanup to prevent memory leaks
                this.startPeriodicCleanup();
            } else {
                this.log('ERROR: Native provider does not have mount() or start() method');
                this.log(`Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(provider))}`);
                throw new Error('Native provider does not have mount() or start() method');
            }
        } catch (error) {
            this.log(`Mount error: ${(error as Error).message}`);
            this.log(`Mount error stack: ${(error as Error).stack}`);
            throw error;
        }
    }

    private startPeriodicCleanup(): void {
        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 5 * 60 * 1000);
        
        this.log('Started periodic cleanup (every 5 minutes)');
    }
    
    private performCleanup(): void {
        try {
            // Clean up old telemetry data (older than 1 hour)
            contextManager.cleanup(60 * 60 * 1000);
            
            // Clean up old error logs (older than 1 hour)
            errorHandler.clearOldErrors(60 * 60 * 1000);
            
            // Clean expired cache entries
            const expiredCount = this.cleanExpiredCache();
            
            this.log(`Periodic cleanup: removed ${expiredCount} expired cache entries`);
        } catch (error) {
            this.log(`Error during periodic cleanup: ${(error as Error).message}`);
        }
    }
    
    private cleanExpiredCache(): number {
        let removed = 0;
        const now = Date.now();
        
        // Clean memory cache
        for (const [path, entry] of this.pathCache) {
            const sourceFS = this.getSourceFileSystem(path);
            const ttl = cacheStrategy.getCacheTTL(path, { sourceFS } as any);
            
            if (now - entry.time > ttl) {
                this.pathCache.delete(path);
                removed++;
            }
        }
        
        return removed;
    }

    async unmount(): Promise<void> {
        if (!this.nativeProvider) {
            return;
        }
        
        this.log('\n=== UNMOUNT CALLED ===');
        this.log(`Total enumerations: ${this.enumerationCount}`);
        
        // Stop periodic cleanup
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.log('Stopped periodic cleanup');
        }
        
        // Stop the smart cache manager
        if (this.cacheManager) {
            await this.cacheManager.stop();
            this.log('SmartCacheManager stopped');
        }
        
        // Save persistent cache to disk
        if (this.persistentCache) {
            this.persistentCache.saveToDisk();
            this.persistentCache.shutdown();
            this.log('Persistent cache saved and shutdown');
        }
        
        // Final cleanup
        this.performCleanup();
        
        // Check which method the provider has
        if (typeof (this.nativeProvider as any).unmount === 'function') {
            await (this.nativeProvider as any).unmount();
            this.log('Provider unmounted');
        } else if (typeof (this.nativeProvider as any).stop === 'function') {
            await (this.nativeProvider as any).stop();
            this.log('Provider stopped');
        }
    }

    isRunning(): boolean {
        return this.nativeProvider?.isRunning() ?? false;
    }

    getStats(): any {
        let nativeStats = {};
        try {
            // Some providers may not have getStats method
            if (this.nativeProvider && typeof (this.nativeProvider as any).getStats === 'function') {
                nativeStats = (this.nativeProvider as any).getStats();
            }
        } catch (error) {
            this.log(`Warning: Failed to get native provider stats: ${(error as Error).message}`);
        }

        // Get telemetry and error stats
        const telemetryStats = contextManager.getStats();
        const errorStats = errorHandler.getErrorStats();

        return {
            // Basic stats
            enumerations: this.enumerationCount,
            memoryCacheSize: this.pathCache.size,
            
            // Cache stats
            persistentCacheStats: this.persistentCache?.getCacheStats(),
            smartCacheStats: this.cacheManager?.getStats(),
            
            // Telemetry stats
            telemetry: telemetryStats,
            
            // Error tracking
            errors: errorStats,
            
            // Native provider info
            nativeProviderType: this.nativeProvider?.constructor?.name || 'unknown',
            ...nativeStats,
            
            // Performance indicators
            performance: {
                cacheHitRate: telemetryStats.cacheHitRate,
                averageRequestDuration: telemetryStats.averageDuration,
                errorRate: telemetryStats.errorRate,
                activeRequests: telemetryStats.activeRequests
            }
        };
    }
    
    // Add method to get detailed telemetry for diagnostics
    getTelemetry(requestId?: string): any {
        if (requestId) {
            return {
                context: contextManager.getContext(requestId),
                telemetry: contextManager.getTelemetry(requestId),
                tree: Array.from(contextManager.getRequestTree(requestId).values())
            };
        }
        
        return {
            stats: contextManager.getStats(),
            errors: errorHandler.getRecentErrors()
        };
    }
}