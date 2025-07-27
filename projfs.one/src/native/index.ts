import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create require function for loading native module
const require = createRequire(import.meta.url);

// Native binding interface
interface NativeBinding {
    ProjFSWrapper: new (virtualizationRootPath: string) => {
        start(callbacks: any, options: any): Promise<boolean>;
        stop(): Promise<boolean>;
        isRunning(): boolean;
        getStats(): {
            placeholderInfoRequests: number;
            fileDataRequests: number;
            directoryEnumerations: number;
            fileModifications: number;
            totalBytesRead: number;
            totalBytesWritten: number;
            uptime: number;
        };
    };
}

// Try to load the native binding
let binding: NativeBinding;

try {
    // Try using bindings module first
    binding = require('bindings')('projfs_native') as NativeBinding;
} catch (error) {
    console.warn('Failed to load native module with bindings, trying node-gyp-build...');
    try {
        // Fallback to node-gyp-build
        const nodeGypBuild = require('node-gyp-build');
        binding = nodeGypBuild(dirname(dirname(__dirname))) as NativeBinding;
    } catch (error2) {
        console.error('Failed to load native module:', error2);
        // Export a mock for development
        binding = {
            ProjFSWrapper: class {
                constructor(virtualizationRootPath: string) {
                    console.warn('Using mock ProjFSWrapper - native module not loaded');
                    console.warn(`Would virtualize: ${virtualizationRootPath}`);
                }
                async start(_callbacks: any, _options: any): Promise<boolean> { 
                    throw new Error('Native module not loaded'); 
                }
                async stop(): Promise<boolean> { 
                    throw new Error('Native module not loaded'); 
                }
                isRunning(): boolean { 
                    return false; 
                }
                getStats() { 
                    return {
                        placeholderInfoRequests: 0,
                        fileDataRequests: 0,
                        directoryEnumerations: 0,
                        fileModifications: 0,
                        totalBytesRead: 0,
                        totalBytesWritten: 0,
                        uptime: 0
                    }; 
                }
            }
        };
    }
}

// Export the native wrapper
export const { ProjFSWrapper } = binding;
export type { NativeBinding };