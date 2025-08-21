/**
 * Generic directory invalidation system for ProjFS
 * Ensures directories are refreshed when async data arrives
 */

export class DirectoryInvalidator {
    private provider: any;
    private pendingInvalidations = new Map<string, NodeJS.Timeout>();
    private invalidationDelay = 100; // ms to batch invalidations
    
    constructor(provider: any) {
        this.provider = provider;
    }
    
    /**
     * Schedule a directory for invalidation
     * Batches multiple invalidation requests to avoid overwhelming the system
     */
    scheduleInvalidation(path: string): void {
        // Cancel any pending invalidation for this path
        const existing = this.pendingInvalidations.get(path);
        if (existing) {
            clearTimeout(existing);
        }
        
        // Schedule new invalidation
        const timeout = setTimeout(() => {
            this.performInvalidation(path);
            this.pendingInvalidations.delete(path);
        }, this.invalidationDelay);
        
        this.pendingInvalidations.set(path, timeout);
    }
    
    /**
     * Perform the actual invalidation
     */
    private performInvalidation(path: string): void {
        try {
            // Check if provider has invalidation support
            if (typeof this.provider.invalidateDirectory === 'function') {
                this.provider.invalidateDirectory(path);
                console.log(`[Invalidator] Invalidated directory: ${path}`);
            } else if (typeof this.provider.onDirectoryDataReady === 'function') {
                // Fallback to onDirectoryDataReady if available
                this.provider.onDirectoryDataReady(path);
                console.log(`[Invalidator] Notified data ready for: ${path}`);
            } else {
                // No invalidation support - log for debugging
                console.log(`[Invalidator] No invalidation method available for: ${path}`);
            }
        } catch (error) {
            console.error(`[Invalidator] Failed to invalidate ${path}:`, error);
        }
    }
    
    /**
     * Force immediate invalidation without batching
     */
    invalidateNow(path: string): void {
        // Cancel any pending invalidation
        const existing = this.pendingInvalidations.get(path);
        if (existing) {
            clearTimeout(existing);
            this.pendingInvalidations.delete(path);
        }
        
        // Perform immediate invalidation
        this.performInvalidation(path);
    }
    
    /**
     * Cancel all pending invalidations
     */
    cancelAll(): void {
        for (const timeout of this.pendingInvalidations.values()) {
            clearTimeout(timeout);
        }
        this.pendingInvalidations.clear();
    }
    
    /**
     * Set the batching delay
     */
    setDelay(ms: number): void {
        this.invalidationDelay = Math.max(0, ms);
    }
}