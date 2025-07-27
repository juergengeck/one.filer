"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjFSWrapper = void 0;
const module_1 = require("module");
const path_1 = require("path");
const url_1 = require("url");
// Get __dirname equivalent in ES modules
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_1.dirname)(__filename);
// Create require function for loading native module
const require = (0, module_1.createRequire)(import.meta.url);
// Try to load the native binding
let binding;
try {
    // Try using bindings module first
    binding = require('bindings')('projfs_native');
}
catch (error) {
    console.warn('Failed to load native module with bindings, trying node-gyp-build...');
    try {
        // Fallback to node-gyp-build
        const nodeGypBuild = require('node-gyp-build');
        binding = nodeGypBuild((0, path_1.dirname)((0, path_1.dirname)(__dirname)));
    }
    catch (error2) {
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
exports.ProjFSWrapper = binding.ProjFSWrapper;
