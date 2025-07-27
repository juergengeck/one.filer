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
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
// Try to load the N-API addon
let fuseAddon;
try {
    // Convert file URL to path properly
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    // Try multiple paths where the addon might be located
    const possiblePaths = [
        // Relative to current file location (src/fuse/)
        path.resolve(currentDir, '../../lib/fuse/n-api/index.cjs'),
        // Absolute path
        path.resolve(process.cwd(), 'lib/fuse/n-api/index.cjs'),
        // Fallback absolute path
        '/mnt/c/Users/juerg/source/one.filer/lib/fuse/n-api/index.cjs'
    ];
    let loaded = false;
    for (const addonPath of possiblePaths) {
        try {
            if (fs.existsSync(addonPath)) {
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
export const EPERM = fuseAddon.EPERM;
export const ENOENT = fuseAddon.ENOENT;
export const EIO = fuseAddon.EIO;
export const EACCES = fuseAddon.EACCES;
export const EEXIST = fuseAddon.EEXIST;
export const ENOTDIR = fuseAddon.ENOTDIR;
export const EISDIR = fuseAddon.EISDIR;
export const EINVAL = fuseAddon.EINVAL;
export const ENOSPC = fuseAddon.ENOSPC;
export const EROFS = fuseAddon.EROFS;
export const EBUSY = fuseAddon.EBUSY;
export const ENOTEMPTY = fuseAddon.ENOTEMPTY;
/**
 * Native Linux FUSE3 implementation using N-API
 * This runs exclusively in WSL2/Linux and exposes filesystems to Windows
 * through the WSL2 file bridge (\\wsl$\Ubuntu\path)
 */
export class Fuse extends EventEmitter {
    fuseInstance;
    mountPath;
    operations;
    options;
    mounted = false;
    // Static error codes
    static EPERM = EPERM;
    static ENOENT = ENOENT;
    static EIO = EIO;
    static EACCES = EACCES;
    static EEXIST = EEXIST;
    static ENOTDIR = ENOTDIR;
    static EISDIR = EISDIR;
    static EINVAL = EINVAL;
    static ENOSPC = ENOSPC;
    static EROFS = EROFS;
    static EBUSY = EBUSY;
    static ENOTEMPTY = ENOTEMPTY;
    constructor(mountPath, operations, options = {}) {
        super();
        if (process.platform !== 'linux') {
            throw new Error('This FUSE implementation only works on Linux/WSL2');
        }
        this.mountPath = mountPath;
        this.operations = operations;
        this.options = {
            ...options,
            force: true, // Allow mounting over existing mount points
            local: true // Mark as local filesystem for better Windows integration
        };
        // Create the FUSE instance using the N-API addon
        this.fuseInstance = new fuseAddon.Fuse(mountPath, operations, this.options);
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
        fuseAddon.Fuse.unmount(mountPath, callback);
    }
    static isConfigured(callback) {
        // Check if we're on Linux and FUSE is available
        if (process.platform !== 'linux') {
            callback(new Error('Not running on Linux/WSL2'), false);
            return;
        }
        fuseAddon.Fuse.isConfigured(callback);
    }
    static configure(callback) {
        // No configuration needed - FUSE3 should be installed at system level
        fuseAddon.Fuse.configure(callback);
    }
}
//# sourceMappingURL=native-fuse3.js.map