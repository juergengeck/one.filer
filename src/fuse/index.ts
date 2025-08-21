/**
 * Unified FUSE3 Module
 * 
 * Automatically selects the appropriate FUSE3 implementation:
 * - Linux/WSL: Native kernel FUSE3
 * - Windows: FUSE3 API implemented via ProjectedFS
 */

// Platform detection
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// Define interface for static methods
interface FuseConstructor {
    new (mountPath: string, operations: any, options?: any): any;
    isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void;
    configure(callback: (err?: Error) => void): void;
    unmount(mountPath: string, callback: (err?: Error) => void): void;
}

// Export the appropriate Fuse implementation based on platform
export async function getFuse(): Promise<FuseConstructor> {
    console.log(`🔧 Loading FUSE implementation for platform: ${process.platform}`);
    
    if (isWindows) {
        // Windows now uses ProjFS directly, not FUSE
        throw new Error('FUSE not supported on Windows - use ProjFS mode instead');
        /*
        console.log('🪟 Loading REAL Windows FUSE3 via projfs-fuse.one...');
        // Use the REAL projfs-fuse.one implementation!
        // const { ProjFSFuse } = await import('projfs-fuse.one');
        throw new Error('projfs-fuse.one disabled - use ProjFS mode instead');
        
        // Create a wrapper class that matches our FUSE3 API
        // class Fuse extends ProjFSFuse {
            constructor(mountPath: string, operations: any, options: any = {}) {
                // ProjFSFuse expects Windows paths, so convert if needed
                const winPath = mountPath.startsWith('/') 
                    ? `C:\\OneFiler${mountPath.replace(/\//g, '\\')}`
                    : mountPath;
                super(winPath, operations, options);
            }
            
            // Add any API compatibility methods if needed
            get mnt(): string {
                return this.getMountPath();
            }
            
            // Static methods required by FuseConstructor interface
            static isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void {
                // On Windows with projfs-fuse.one, assume configured if module loads
                callback(null, true);
            }
            
            static configure(callback: (err?: Error) => void): void {
                // No configuration needed for projfs-fuse.one
                callback();
            }
            
            static unmount(mountPath: string, callback: (err?: Error) => void): void {
                // For now, no static unmount support
                callback(new Error('Static unmount not supported for projfs-fuse.one'));
            }
        }
        
        return Fuse as FuseConstructor;
        */
    } else {
        console.log('🐧 Loading Linux FUSE3...');
        // On Linux, use native FUSE3 (when available)
        const { Fuse } = await import('./native-fuse3.js');
        return Fuse as FuseConstructor;
    }
}

// For synchronous imports, we need to detect platform at module load time
let Fuse: any;

// IMPORTANT: Do NOT eagerly load FUSE implementations
// This allows ProjFS to be used on Windows without loading FUSE
// Only load when explicitly requested via getFuse()

// Export a proxy that will use the correct implementation
export default new Proxy({}, {
    get(target, prop) {
        if (!Fuse) {
            throw new Error('FUSE implementation not loaded yet. Use getFuse() for async loading.');
        }
        return Fuse[prop];
    },
    construct(target, args) {
        if (!Fuse) {
            throw new Error('FUSE implementation not loaded yet. Use getFuse() for async loading.');
        }
        return new Fuse(...args);
    }
});

// Re-export shared types for all platforms
export type { Stats, FuseOperations, FuseError, OPERATIONS } from './types.js';

// Export platform detection utilities
export const platform = {
    isWindows,
    isLinux,
    isSupported: isWindows || isLinux
};