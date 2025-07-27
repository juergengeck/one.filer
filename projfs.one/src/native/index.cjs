// CommonJS version of native binding loader
const path = require('path');

// Native binding interface
let binding;

try {
    // Try using bindings module first
    binding = require('bindings')('projfs_native');
} catch (error) {
    console.warn('Failed to load native module with bindings, trying node-gyp-build...');
    try {
        // Fallback to node-gyp-build
        const nodeGypBuild = require('node-gyp-build');
        binding = nodeGypBuild(path.dirname(path.dirname(__dirname)));
    } catch (error2) {
        console.error('Failed to load native module:', error2);
        // Export a mock for development
        binding = {
            ProjFSWrapper: class {
                constructor(virtualizationRootPath) {
                    console.warn('Using mock ProjFSWrapper - native module not loaded');
                    console.warn(`Would virtualize: ${virtualizationRootPath}`);
                }
                async start(callbacks, options) { 
                    throw new Error('Native module not loaded'); 
                }
                async stop() { 
                    throw new Error('Native module not loaded'); 
                }
                isRunning() { 
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
module.exports = binding;