/**
 * Intercepts async callbacks to automatically trigger invalidation
 * This provides a generic solution for any async data arrival
 */

import { DirectoryInvalidator } from './DirectoryInvalidator.js';

export class AsyncCallbackInterceptor {
    private invalidator: DirectoryInvalidator;
    private originalReadDirectory: any;
    private dataArrivedCallback?: (path: string, entries: any[]) => void;
    
    constructor(private fileSystem: any, provider: any) {
        this.invalidator = new DirectoryInvalidator(provider);
        this.setupInterceptors();
    }
    
    /**
     * Setup interceptors for filesystem methods
     */
    private setupInterceptors(): void {
        // Store original readDirectory
        this.originalReadDirectory = this.fileSystem.readDirectory?.bind(this.fileSystem);
        
        if (!this.originalReadDirectory) {
            console.warn('[Interceptor] No readDirectory method found on filesystem');
            return;
        }
        
        // Replace readDirectory with our interceptor
        this.fileSystem.readDirectory = this.createReadDirectoryInterceptor();
    }
    
    /**
     * Create an interceptor for readDirectory that triggers invalidation
     */
    private createReadDirectoryInterceptor() {
        return async (path: string): Promise<any[]> => {
            try {
                // Call original method
                const result = await this.originalReadDirectory(path);
                
                // If we got results, schedule invalidation
                if (result && result.length > 0) {
                    // Small delay to ensure data is in cache before invalidation
                    setTimeout(() => {
                        this.invalidator.scheduleInvalidation(path);
                        
                        // Notify callback if registered
                        if (this.dataArrivedCallback) {
                            this.dataArrivedCallback(path, result);
                        }
                    }, 50);
                }
                
                return result;
            } catch (error) {
                // On error, still try original behavior
                throw error;
            }
        };
    }
    
    /**
     * Register a callback for when data arrives
     */
    onDataArrived(callback: (path: string, entries: any[]) => void): void {
        this.dataArrivedCallback = callback;
    }
    
    /**
     * Force invalidation for a specific path
     */
    invalidatePath(path: string): void {
        this.invalidator.invalidateNow(path);
    }
    
    /**
     * Cleanup and restore original methods
     */
    cleanup(): void {
        if (this.originalReadDirectory) {
            this.fileSystem.readDirectory = this.originalReadDirectory;
        }
        this.invalidator.cancelAll();
    }
}