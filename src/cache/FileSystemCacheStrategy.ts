import type { FileInfo } from '../filer/types.js';

export interface CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean;
    getCacheTTL(path: string, info: FileInfo): number; // milliseconds
    getPriority(path: string): 'high' | 'normal' | 'low';
    getMaxSize(path: string): number; // bytes
    shouldPrefetch(path: string): boolean;
}

export class FileSystemCacheStrategy implements CacheStrategy {
    private strategies: Map<string, CacheStrategy> = new Map();
    
    constructor() {
        // Initialize filesystem-specific strategies
        this.strategies.set('chat', new ChatCacheStrategy());
        this.strategies.set('objects', new ObjectsCacheStrategy());
        this.strategies.set('debug', new DebugCacheStrategy());
        this.strategies.set('invites', new InvitesCacheStrategy());
        this.strategies.set('types', new TypesCacheStrategy());
        this.strategies.set('root', new RootCacheStrategy());
    }
    
    private getSourceFS(path: string): string {
        if (path.startsWith('/chats')) return 'chat';
        if (path.startsWith('/objects')) return 'objects';
        if (path.startsWith('/debug')) return 'debug';
        if (path.startsWith('/invites')) return 'invites';
        if (path.startsWith('/types')) return 'types';
        return 'root';
    }
    
    shouldCache(path: string, info: FileInfo): boolean {
        const sourceFS = info.sourceFS || this.getSourceFS(path);
        const strategy = this.strategies.get(sourceFS);
        return strategy ? strategy.shouldCache(path, info) : true;
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        const sourceFS = info.sourceFS || this.getSourceFS(path);
        const strategy = this.strategies.get(sourceFS);
        return strategy ? strategy.getCacheTTL(path, info) : 30000; // 30 seconds default
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        const sourceFS = this.getSourceFS(path);
        const strategy = this.strategies.get(sourceFS);
        return strategy ? strategy.getPriority(path) : 'normal';
    }
    
    getMaxSize(path: string): number {
        const sourceFS = this.getSourceFS(path);
        const strategy = this.strategies.get(sourceFS);
        return strategy ? strategy.getMaxSize(path) : 10 * 1024 * 1024; // 10MB default
    }
    
    shouldPrefetch(path: string): boolean {
        const sourceFS = this.getSourceFS(path);
        const strategy = this.strategies.get(sourceFS);
        return strategy ? strategy.shouldPrefetch(path) : false;
    }
}

// Chat filesystem: Cache aggressively for recent conversations
class ChatCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        // Always cache directories and metadata
        if (info.isDirectory) return true;
        
        // Cache recent messages (modified in last 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (info.mtime && info.mtime > sevenDaysAgo) return true;
        
        // Cache small files (messages are typically small)
        return info.size < 1024 * 1024; // 1MB
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        // Recent messages: cache for 5 minutes
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (info.mtime && info.mtime > oneHourAgo) {
            return 5 * 60 * 1000; // 5 minutes
        }
        
        // Older messages: cache for 1 minute
        return 60 * 1000; // 1 minute
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        // Chat is user-facing, high priority
        return 'high';
    }
    
    getMaxSize(path: string): number {
        // Messages with attachments can be larger
        return 50 * 1024 * 1024; // 50MB
    }
    
    shouldPrefetch(path: string): boolean {
        // Prefetch active conversations
        return path.includes('/channels/') || path.includes('/groups/');
    }
}

// Objects filesystem: Smart caching based on content type
class ObjectsCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        if (info.isDirectory) return true;
        
        // Cache based on content type
        const cacheableTypes = ['image/', 'text/', 'application/json', 'application/xml'];
        if (info.contentType && cacheableTypes.some(t => info.contentType!.startsWith(t))) {
            // Cache if under size limit
            return info.size < this.getMaxSize(path);
        }
        
        // Don't cache large binary files
        return false;
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        // Objects are immutable, cache for longer
        return 30 * 60 * 1000; // 30 minutes
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        return 'normal';
    }
    
    getMaxSize(path: string): number {
        // Limit caching of large objects
        return 5 * 1024 * 1024; // 5MB
    }
    
    shouldPrefetch(path: string): boolean {
        // Don't prefetch objects, load on demand
        return false;
    }
}

// Debug filesystem: Minimal caching for fresh data
class DebugCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        // Only cache directory structure, not content
        return info.isDirectory;
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        // Very short TTL for debug info
        return 5 * 1000; // 5 seconds
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        return 'low';
    }
    
    getMaxSize(path: string): number {
        return 1024 * 1024; // 1MB
    }
    
    shouldPrefetch(path: string): boolean {
        return false;
    }
}

// Invites filesystem: Moderate caching
class InvitesCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        return true; // Cache all invite data
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        // Invites change infrequently
        return 5 * 60 * 1000; // 5 minutes
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        return 'normal';
    }
    
    getMaxSize(path: string): number {
        return 1024 * 1024; // 1MB (invites are small)
    }
    
    shouldPrefetch(path: string): boolean {
        // Prefetch invite list
        return path === '/invites' || path === '/invites/';
    }
}

// Types filesystem: Long-term caching for schema definitions
class TypesCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        return true; // Always cache type definitions
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        // Type definitions rarely change
        return 60 * 60 * 1000; // 1 hour
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        return 'low';
    }
    
    getMaxSize(path: string): number {
        return 10 * 1024 * 1024; // 10MB
    }
    
    shouldPrefetch(path: string): boolean {
        // Prefetch common type definitions
        return true;
    }
}

// Root filesystem: Moderate caching
class RootCacheStrategy implements CacheStrategy {
    shouldCache(path: string, info: FileInfo): boolean {
        return info.isDirectory; // Only cache directory structure
    }
    
    getCacheTTL(path: string, info: FileInfo): number {
        return 60 * 1000; // 1 minute
    }
    
    getPriority(path: string): 'high' | 'normal' | 'low' {
        return 'high'; // Root is accessed frequently
    }
    
    getMaxSize(path: string): number {
        return 0; // Root doesn't have files
    }
    
    shouldPrefetch(path: string): boolean {
        return path === '/' || path === '';
    }
}

// Export singleton instance
export const cacheStrategy = new FileSystemCacheStrategy();