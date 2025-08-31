"use strict";
/**
 * Native FUSE3 Bindings for Linux/WSL2
 *
 * This module provides direct bindings to the Linux FUSE3 library through
 * our N-API addon. It runs exclusively in WSL2/Linux environments
 * and exposes the filesystem to Windows through WSL2's native file bridge.
 *
 * @author ONE.filer Team
 * @copyright REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fuse = exports.ENOTEMPTY = exports.EBUSY = exports.EROFS = exports.ENOSPC = exports.EINVAL = exports.EISDIR = exports.ENOTDIR = exports.EEXIST = exports.EACCES = exports.EIO = exports.ENOENT = exports.EPERM = void 0;
const events_1 = require("events");
const module_1 = require("module");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const require = (0, module_1.createRequire)(import.meta.url);
// Try to load the N-API addon
let fuseAddon;
try {
    // Convert file URL to path properly
    const currentDir = path_1.default.dirname(new URL(import.meta.url).pathname);
    // Try multiple paths where the addon might be located
    const possiblePaths = [
        // Relative to current file location (src/fuse/)
        path_1.default.resolve(currentDir, '../../lib/fuse/n-api/index.cjs'),
        // Absolute path
        path_1.default.resolve(process.cwd(), 'lib/fuse/n-api/index.cjs'),
        // Fallback absolute path
        '/mnt/c/Users/juerg/source/one.filer/lib/fuse/n-api/index.cjs'
    ];
    let loaded = false;
    for (const addonPath of possiblePaths) {
        try {
            if (fs_1.default.existsSync(addonPath)) {
                fuseAddon = require(addonPath);
                console.log(`✅ Loaded FUSE3 N-API addon from: ${addonPath}`);
                loaded = true;
                break;
            }
        }
        catch (loadErr) {
            console.warn(`Failed to load from ${addonPath}:`, loadErr.message);
        }
    }
    if (!loaded) {
        throw new Error('Could not find FUSE3 N-API addon in any expected location');
    }
}
catch (err) {
    console.error('❌ FUSE3 N-API addon is required but not available:', err.message);
    console.error('Please ensure the N-API addon is built by running:');
    console.error('  cd lib/fuse/n-api && npm install && npm run build');
    throw new Error(`FUSE3 N-API addon not found: ${err.message}`);
}
// Re-export error constants
exports.EPERM = fuseAddon.EPERM;
exports.ENOENT = fuseAddon.ENOENT;
exports.EIO = fuseAddon.EIO;
exports.EACCES = fuseAddon.EACCES;
exports.EEXIST = fuseAddon.EEXIST;
exports.ENOTDIR = fuseAddon.ENOTDIR;
exports.EISDIR = fuseAddon.EISDIR;
exports.EINVAL = fuseAddon.EINVAL;
exports.ENOSPC = fuseAddon.ENOSPC;
exports.EROFS = fuseAddon.EROFS;
exports.EBUSY = fuseAddon.EBUSY;
exports.ENOTEMPTY = fuseAddon.ENOTEMPTY;
/**
 * Native Linux FUSE3 implementation using N-API
 * This runs exclusively in WSL2/Linux and exposes filesystems to Windows
 * through the WSL2 file bridge (\\wsl$\Ubuntu\path)
 */
class Fuse extends events_1.EventEmitter {
    fuseInstance;
    mountPath;
    operations;
    options;
    mounted = false;
    // Static error codes
    static EPERM = exports.EPERM;
    static ENOENT = exports.ENOENT;
    static EIO = exports.EIO;
    static EACCES = exports.EACCES;
    static EEXIST = exports.EEXIST;
    static ENOTDIR = exports.ENOTDIR;
    static EISDIR = exports.EISDIR;
    static EINVAL = exports.EINVAL;
    static ENOSPC = exports.ENOSPC;
    static EROFS = exports.EROFS;
    static EBUSY = exports.EBUSY;
    static ENOTEMPTY = exports.ENOTEMPTY;
    constructor(mountPath, operations, options = {}) {
        super();
        if (process.platform !== 'linux') {
            throw new Error('This FUSE implementation only works on Linux/WSL2');
        }
        this.mountPath = mountPath;
        this.operations = operations;
        this.options = {
            ...options,
            force: true,
            local: true // Mark as local filesystem for better Windows integration
        };
        // Create the FUSE instance using the N-API addon
        // The addon exports the Fuse class directly
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        this.fuseInstance = new FuseClass(mountPath, operations, this.options);
        // Forward events
        this.fuseInstance.on('mount', () => this.emit('mount'));
        this.fuseInstance.on('unmount', () => this.emit('unmount'));
    }
    mount(callback) {
        console.log(`🔧 Mounting Linux FUSE3 filesystem at ${this.mountPath}`);
        console.log(`📂 Available operations: ${Object.keys(this.operations).join(', ')}`);
        this.fuseInstance.mount((err) => {
            if (err) {
                console.error(`❌ FUSE mount failed:`, err);
                callback(err);
                return;
            }
            console.log(`✅ FUSE filesystem mounted successfully at ${this.mountPath}`);
            console.log(`🌐 Accessible from Windows at: \\\\wsl$\\Ubuntu${this.mountPath}`);
            this.mounted = true;
            callback(null);
        });
    }
    unmount(callback) {
        if (!this.mounted) {
            callback(new Error('Filesystem not mounted'));
            return;
        }
        console.log(`🔧 Unmounting FUSE filesystem at ${this.mountPath}`);
        this.fuseInstance.unmount((err) => {
            if (err) {
                console.error(`❌ FUSE unmount failed:`, err);
                callback(err);
            }
            else {
                console.log(`✅ FUSE filesystem unmounted from ${this.mountPath}`);
                this.mounted = false;
                callback(null);
            }
        });
    }
    get mnt() {
        return this.mountPath;
    }
    static unmount(mountPath, callback) {
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.unmount(mountPath, callback);
    }
    static isConfigured(callback) {
        // Check if we're on Linux and FUSE is available
        if (process.platform !== 'linux') {
            callback(new Error('Not running on Linux/WSL2'), false);
            return;
        }
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.isConfigured(callback);
    }
    static configure(callback) {
        // No configuration needed - FUSE3 should be installed at system level
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.configure(callback);
    }
}
exports.Fuse = Fuse;
//# sourceMappingURL=native-fuse3.js.map