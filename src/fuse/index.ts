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

// Export the appropriate Fuse implementation based on platform
export async function getFuse() {
    if (isLinux) {
        // Use native Linux FUSE3
        const { Fuse } = await import('./native-fuse3.js');
        return Fuse;
    } else if (isWindows) {
        // Use Windows FUSE3 (ProjFS-based)
        const { Fuse } = await import('./windows-fuse3.js');
        return Fuse;
    } else {
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

// For synchronous imports, we need to detect platform at module load time
let Fuse: any;

if (isLinux) {
    // Dynamic import for Linux
    import('./native-fuse3.js').then(module => {
        Fuse = module.Fuse;
    });
} else if (isWindows) {
    // Dynamic import for Windows
    import('./windows-fuse3.js').then(module => {
        Fuse = module.Fuse;
    });
}

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

// Re-export types and interfaces
export type { Stats, FuseOperations, FuseError, OPERATIONS } from './native-fuse3.js';

// Export platform detection utilities
export const platform = {
    isWindows,
    isLinux,
    isSupported: isWindows || isLinux
};