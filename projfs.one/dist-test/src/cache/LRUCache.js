"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
/**
 * Simple LRU (Least Recently Used) cache implementation with size tracking
 */
class LRUCache {
    cache = new Map();
    maxSize;
    _currentSize = 0;
    sizeCalculation;
    constructor(options) {
        this.maxSize = options.maxSize;
        this.sizeCalculation = options.sizeCalculation || (() => 1);
    }
    /**
     * Get a value from the cache
     */
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    /**
     * Set a value in the cache
     */
    set(key, value) {
        // Remove old value if exists
        if (this.cache.has(key)) {
            const oldValue = this.cache.get(key);
            this._currentSize -= this.sizeCalculation(oldValue);
            this.cache.delete(key);
        }
        // Calculate size of new value
        const size = this.sizeCalculation(value);
        // Evict oldest entries if needed
        while (this._currentSize + size > this.maxSize && this.cache.size > 0) {
            const firstKey = this.cache.keys().next().value;
            this.delete(firstKey);
        }
        // Add new value
        this.cache.set(key, value);
        this._currentSize += size;
    }
    /**
     * Delete a value from the cache
     */
    delete(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this._currentSize -= this.sizeCalculation(value);
            return this.cache.delete(key);
        }
        return false;
    }
    /**
     * Clear the cache
     */
    clear() {
        this.cache.clear();
        this._currentSize = 0;
    }
    /**
     * Get the number of entries in the cache
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Get the current size in bytes
     */
    get currentSize() {
        return this._currentSize;
    }
    /**
     * Check if a key exists in the cache
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Get all keys in the cache (oldest to newest)
     */
    keys() {
        return this.cache.keys();
    }
    /**
     * Get all values in the cache (oldest to newest)
     */
    values() {
        return this.cache.values();
    }
}
exports.LRUCache = LRUCache;
