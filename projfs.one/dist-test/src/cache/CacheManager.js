"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const LRUCache_js_1 = require("./LRUCache.js");
/**
 * Manages caching for IFileSystem operations to improve ProjFS performance.
 *
 * This cache is critical for performance as ProjFS callbacks must respond quickly.
 * We cache:
 * - File metadata (stat results)
 * - Directory listings
 * - File content chunks
 */
class CacheManager {
    // Metadata cache (path -> PlaceholderInfo)
    metadataCache;
    // Directory listing cache (path -> DirectoryEntry[])
    directoryCache;
    // Content cache (path -> content chunks)
    contentCache;
    // Cache configuration
    maxContentChunkSize = 64 * 1024; // 64KB chunks
    contentCacheTTL = 60 * 1000; // 1 minute
    constructor(maxSizeBytes = 100 * 1024 * 1024) {
        // Allocate cache space
        const metadataSize = Math.floor(maxSizeBytes * 0.1); // 10% for metadata
        const directorySize = Math.floor(maxSizeBytes * 0.2); // 20% for directories
        const contentSize = Math.floor(maxSizeBytes * 0.7); // 70% for content
        this.metadataCache = new LRUCache_js_1.LRUCache({
            maxSize: metadataSize,
            sizeCalculation: () => 256 // Approximate size per entry
        });
        this.directoryCache = new LRUCache_js_1.LRUCache({
            maxSize: directorySize,
            sizeCalculation: (entries) => entries.length * 512 // Approximate size per entry
        });
        this.contentCache = new LRUCache_js_1.LRUCache({
            maxSize: contentSize,
            sizeCalculation: (entries) => entries.reduce((sum, entry) => sum + entry.data.length, 0)
        });
    }
    /**
     * Get cached file metadata
     */
    async getFileInfo(path) {
        return this.metadataCache.get(path);
    }
    /**
     * Cache file metadata
     */
    async putFileInfo(path, info) {
        this.metadataCache.set(path, info);
    }
    /**
     * Get cached directory listing
     */
    async getDirectoryListing(path) {
        return this.directoryCache.get(path);
    }
    /**
     * Cache directory listing
     */
    async putDirectoryListing(path, entries) {
        this.directoryCache.set(path, entries);
    }
    /**
     * Get cached file content for a specific range
     */
    async getFileContent(path, offset, length) {
        const entries = this.contentCache.get(path);
        if (!entries)
            return undefined;
        // Check if we have the requested range cached
        const now = Date.now();
        const relevantChunks = [];
        let currentOffset = offset;
        const endOffset = offset + length;
        for (const entry of entries) {
            // Skip expired entries
            if (now - entry.timestamp > this.contentCacheTTL) {
                continue;
            }
            const entryEnd = entry.offset + entry.data.length;
            // Check if this chunk overlaps with requested range
            if (entry.offset <= currentOffset && entryEnd > currentOffset) {
                const startInChunk = currentOffset - entry.offset;
                const endInChunk = Math.min(entryEnd, endOffset) - entry.offset;
                const chunk = entry.data.slice(startInChunk, endInChunk);
                relevantChunks.push(chunk);
                currentOffset += chunk.length;
                if (currentOffset >= endOffset) {
                    break;
                }
            }
        }
        // Only return if we have the complete range
        if (currentOffset >= endOffset) {
            return Buffer.concat(relevantChunks);
        }
        return undefined;
    }
    /**
     * Cache file content chunk
     */
    async putFileContent(path, offset, data) {
        // Don't cache large chunks
        if (data.length > this.maxContentChunkSize) {
            return;
        }
        let entries = this.contentCache.get(path) || [];
        // Add new entry
        entries.push({
            offset,
            data,
            timestamp: Date.now()
        });
        // Sort by offset for efficient retrieval
        entries.sort((a, b) => a.offset - b.offset);
        // Merge adjacent chunks if possible
        entries = this.mergeAdjacentChunks(entries);
        // Remove expired entries
        const now = Date.now();
        entries = entries.filter(e => now - e.timestamp <= this.contentCacheTTL);
        this.contentCache.set(path, entries);
    }
    /**
     * Invalidate all caches for a path
     */
    async invalidatePath(path) {
        this.metadataCache.delete(path);
        this.directoryCache.delete(path);
        this.contentCache.delete(path);
        // Also invalidate parent directory listing
        const parentPath = this.getParentPath(path);
        if (parentPath) {
            this.directoryCache.delete(parentPath);
        }
    }
    /**
     * Clear all caches
     */
    async clear() {
        this.metadataCache.clear();
        this.directoryCache.clear();
        this.contentCache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            metadataEntries: this.metadataCache.size,
            directoryEntries: this.directoryCache.size,
            contentEntries: this.contentCache.size,
            metadataSize: this.metadataCache.currentSize,
            directorySize: this.directoryCache.currentSize,
            contentSize: this.contentCache.currentSize
        };
    }
    /**
     * Merge adjacent content chunks to reduce fragmentation
     */
    mergeAdjacentChunks(entries) {
        if (entries.length < 2)
            return entries;
        const merged = [];
        let current = entries[0];
        for (let i = 1; i < entries.length; i++) {
            const next = entries[i];
            // Check if chunks are adjacent and not too large when combined
            if (current.offset + current.data.length === next.offset &&
                current.data.length + next.data.length <= this.maxContentChunkSize) {
                // Merge chunks
                current = {
                    offset: current.offset,
                    data: Buffer.concat([current.data, next.data]),
                    timestamp: Math.max(current.timestamp, next.timestamp)
                };
            }
            else {
                // Save current and start new
                merged.push(current);
                current = next;
            }
        }
        merged.push(current);
        return merged;
    }
    /**
     * Get parent path
     */
    getParentPath(path) {
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash <= 0)
            return null;
        return path.substring(0, lastSlash);
    }
}
exports.CacheManager = CacheManager;
