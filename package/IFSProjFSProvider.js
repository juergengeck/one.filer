const EventEmitter = require('events');
const NativeProvider = require('./build/Release/ifsprojfs.node').IFSProjFSProvider;

// Global state for caching and concurrency control
const activeEnumerations = new Set();
const enumerationCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds

class IFSProjFSProvider extends EventEmitter {
    constructor(options) {
        super();
        
        this.instancePath = options.instancePath;
        this.virtualRoot = options.virtualRoot || 'C:\\OneFiler';
        this.fileSystem = options.fileSystem;
        this.debug = options.debug || false;
        
        // Create native provider
        this.provider = new NativeProvider(this.instancePath);
        
        // Register callbacks
        this.provider.registerCallbacks({
            getFileInfo: this.getFileInfo.bind(this),
            readFile: this.readFile.bind(this),
            readDirectory: this.readDirectory.bind(this),
            createFile: this.createFile.bind(this),
            onDebugMessage: this.onDebugMessage.bind(this)
        });
        
        console.log('[ProjFS] Provider initialized');
    }
    
    onDebugMessage(message) {
        if (this.debug) {
            console.log('[Native]', message);
            this.emit('debug', message);
        }
    }
    
    normalizePath(inputPath) {
        if (!inputPath || typeof inputPath !== 'string') return '/';
        
        let normalized = inputPath;
        
        // Step 1: Convert all backslashes to forward slashes
        normalized = normalized.replace(/\\/g, '/');
        
        // Step 2: Remove drive letter (case insensitive)
        normalized = normalized.replace(/^[A-Z]:/i, '');
        
        // Step 3: Remove mount point variations (case insensitive)
        // This handles /OneFiler, OneFiler, etc.
        normalized = normalized.replace(/^\/*OneFiler/i, '');
        
        // Step 4: Collapse multiple slashes
        normalized = normalized.replace(/\/+/g, '/');
        
        // Step 5: Ensure leading slash
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        
        // Step 6: Remove trailing slash except for root
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        
        // Step 7: Handle empty result
        if (normalized === '') {
            normalized = '/';
        }
        
        return normalized;
    }
    
    async getFileInfo(path) {
        try {
            const normalizedPath = this.normalizePath(path);
            
            // Extract just the filename from the original path
            const name = path.split(/[\\\/]/).filter(p => p).pop() || '';
            
            // Special handling for root
            if (normalizedPath === '/') {
                return {
                    name: '',
                    hash: '',
                    size: 0,
                    isDirectory: true,
                    isBlobOrClob: false,
                    mode: 16877
                };
            }
            
            
            // Special handling for /objects files
            const objectMatch = normalizedPath.match(/^\/objects\/([0-9a-f]{2})\/([0-9a-f]{62})\/(.+)$/);
            if (objectMatch) {
                const [, prefix, hash, filename] = objectMatch;
                return {
                    name: filename,
                    hash: prefix + hash,
                    size: 0,
                    isDirectory: false,
                    isBlobOrClob: true,
                    mode: 33188
                };
            }
            
            const info = await this.fileSystem.stat(normalizedPath);
            return {
                name: name,
                hash: info.hash || '',
                size: info.size || 0,
                isDirectory: info.isDirectory || false,
                isBlobOrClob: false,
                mode: info.mode || (info.isDirectory ? 16877 : 33188)
            };
        } catch (error) {
            if (this.debug) {
                console.error('[getFileInfo] Error:', error.message);
            }
            return null;
        }
    }
    
    async readFile(path) {
        const normalizedPath = this.normalizePath(path);
        
        // Let native layer handle /objects files
        if (normalizedPath.startsWith('/objects/')) {
            return null;
        }
        
        try {
            const file = await this.fileSystem.readFile(normalizedPath);
            return file?.content || null;
        } catch (error) {
            if (this.debug) {
                console.error('[readFile] Error:', error.message);
            }
            return null;
        }
    }
    
    async readDirectory(path) {
        const normalizedPath = this.normalizePath(path);
        const cacheKey = normalizedPath;
        
        console.log(`[readDirectory] ${path} -> ${normalizedPath}`);
        
        // Check if we're already enumerating this path
        if (activeEnumerations.has(cacheKey)) {
            console.log('[readDirectory] Already enumerating, waiting for result...');
            // Wait a short time for the active enumeration to complete
            let waitAttempts = 0;
            while (activeEnumerations.has(cacheKey) && waitAttempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 10));
                waitAttempts++;
            }
            
            // Check cache again after waiting
            const cachedAfterWait = enumerationCache.get(cacheKey);
            if (cachedAfterWait && (Date.now() - cachedAfterWait.timestamp < CACHE_DURATION)) {
                console.log(`[readDirectory] Returning cached result after wait with ${cachedAfterWait.entries.length} entries`);
                return cachedAfterWait.entries;
            }
            
            // If still no result, continue with normal enumeration
            console.log('[readDirectory] Wait timeout or no cached result, proceeding with enumeration');
        }
        
        // Check cache - return immediately if we have cached data
        const cached = enumerationCache.get(cacheKey);
        const now = Date.now();
        if (cached && (now - cached.timestamp < CACHE_DURATION)) {
            console.log(`[readDirectory] Returning cached result with ${cached.entries.length} entries`);
            return cached.entries;
        }
        
        // Mark as active
        activeEnumerations.add(cacheKey);
        
        try {
            console.log(`[readDirectory] Calling fileSystem.readDir(${normalizedPath})...`);
            const dir = await this.fileSystem.readDir(normalizedPath);
            if (!dir?.children || !Array.isArray(dir.children)) {
                return [];
            }
            
            const entries = [];
            const seenNames = new Set();
            
            for (const child of dir.children) {
                // Extract just the name
                let name = child;
                
                if (typeof child === 'string') {
                    // Remove any path components
                    const parts = child.split(/[\/\\/]/).filter(p => p);
                    name = parts[parts.length - 1] || child;
                } else if (child && typeof child === 'object') {
                    name = child.name || '';
                }
                
                // Clean and validate
                name = String(name).trim();
                
                // Skip invalid entries
                if (!name) continue;
                
                // Skip entries with path separators
                if (name.includes('/') || name.includes('\\')) {
                    console.warn('[readDirectory] Skipping name with path separator:', name);
                    continue;
                }
                
                // Skip duplicates
                if (seenNames.has(name)) {
                    continue;
                }
                
                seenNames.add(name);
                
                // Get file info
                const childPath = normalizedPath === '/' ? '/' + name : normalizedPath + '/' + name;
                
                try {
                    const info = await this.fileSystem.stat(childPath);
                    entries.push({
                        name: name,
                        hash: info.hash || '',
                        size: info.size || 0,
                        isDirectory: info.isDirectory || false,
                        isBlobOrClob: false,
                        mode: info.mode || (info.isDirectory ? 16877 : 33188)
                    });
                } catch (e) {
                    // Skip files that can't be stat'd - no hardcoded assumptions
                    console.warn(`[readDirectory] Could not stat ${childPath}:`, e.message);
                }
            }
            
            // Cache the result
            enumerationCache.set(cacheKey, {
                entries: entries,
                timestamp: Date.now()
            });
            
            // Cleanup old cache entries
            if (enumerationCache.size > 100) {
                for (const [key, value] of enumerationCache.entries()) {
                    if (now - value.timestamp > CACHE_DURATION * 2) {
                        enumerationCache.delete(key);
                    }
                }
            }
            
            console.log(`[readDirectory] fileSystem.readDir returned: { children: [${dir.children.join(', ')}] }`);
            console.log(`[readDirectory] Returning ${entries.length} entries: ${entries.map(e => e.name).join(', ')}`);
            return entries;
            
        } catch (error) {
            console.error('[readDirectory] Error:', error.message);
            return [];
        } finally {
            // Always remove from active set
            activeEnumerations.delete(cacheKey);
        }
    }
    
    async createFile(path, content) {
        const normalizedPath = this.normalizePath(path);
        await this.fileSystem.writeFile(normalizedPath, content);
    }
    
    async mount() {
        console.log('[IFSProjFSProvider] Mounting at', this.virtualRoot);
        // Ensure mount directory exists from JS side as well (belt-and-suspenders)
        try {
            const fs = require('fs');
            if (!fs.existsSync(this.virtualRoot)) {
                fs.mkdirSync(this.virtualRoot, { recursive: true });
            }
        } catch (e) {
            console.warn('[IFSProjFSProvider] Could not ensure mount dir:', e.message);
        }
        // The native provider uses start/stop methods
        await this.provider.start(this.virtualRoot);
        
        // Pre-populate cache for critical directories after mount
        console.log('[IFSProjFSProvider] Pre-populating cache...');
        await this.prepopulateCache();
    }
    
    async prepopulateCache() {
        const criticalPaths = ['/', '/invites', '/chats', '/debug', '/objects', '/types'];
        
        // Clear active enumerations to ensure we can fetch fresh data
        activeEnumerations.clear();
        
        for (const path of criticalPaths) {
            try {
                console.log(`[IFSProjFSProvider] Pre-populating ${path}...`);
                
                // Force refresh by clearing any existing cache for this path
                enumerationCache.delete(path);
                
                // Call readDirectory to populate the cache
                // This will call fileSystem.readDir and cache the results
                const entries = await this.readDirectory(path);
                
                if (entries && entries.length > 0) {
                    console.log(`[IFSProjFSProvider] Pre-populated ${path} with ${entries.length} entries: ${entries.map(e => e.name).join(', ')}`);
                    
                    // Ensure cache is set with a long TTL for pre-populated entries
                    enumerationCache.set(path, {
                        entries: entries,
                        timestamp: Date.now()
                    });
                } else {
                    console.log(`[IFSProjFSProvider] ${path} has no entries or failed`);
                }
            } catch (error) {
                console.error(`[IFSProjFSProvider] Failed to pre-populate ${path}:`, error.message);
            }
        }
        
        console.log('[IFSProjFSProvider] Cache pre-population complete');
        console.log(`[IFSProjFSProvider] Cache now contains ${enumerationCache.size} entries`);
    }
    
    async unmount() {
        // The native provider uses start/stop methods
        await this.provider.stop();
        activeEnumerations.clear();
        enumerationCache.clear();
    }
}

module.exports = { IFSProjFSProvider };