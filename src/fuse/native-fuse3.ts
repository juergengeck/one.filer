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
import type { FuseOperations } from './types.js';
export type { Stats, FuseOperations } from './types.js';

const require = createRequire(import.meta.url);

// Try to load the N-API addon
let fuseAddon: any;
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
        } catch (loadErr: any) {
            console.warn(`Failed to load from ${addonPath}:`, loadErr.message);
        }
    }
    
    if (!loaded) {
        throw new Error('Could not find FUSE3 N-API addon in any expected location');
    }
} catch (err: any) {
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
    private fuseInstance: any;
    private mountPath: string;
    private operations: FuseOperations;
    private options: any;
    private mounted = false;

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

    constructor(mountPath: string, operations: FuseOperations, options: any = {}) {
        super();
        
        if (process.platform !== 'linux') {
            throw new Error('This FUSE implementation only works on Linux/WSL2');
        }

        this.mountPath = mountPath;
        this.operations = operations;
        this.options = {
            ...options,
            force: true,  // Allow mounting over existing mount points
            local: true   // Mark as local filesystem for better Windows integration
        };

        // Create the FUSE instance using the N-API addon
        // The addon exports the Fuse class directly
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        this.fuseInstance = new FuseClass(mountPath, operations, this.options);
        
        // Forward events if supported by the addon
        // The C++ addon might not have EventEmitter support
        if (this.fuseInstance.on && typeof this.fuseInstance.on === 'function') {
            this.fuseInstance.on('mount', () => this.emit('mount'));
            this.fuseInstance.on('unmount', () => this.emit('unmount'));
        }
    }

    mount(callback: (err?: Error | null) => void): void {
        console.log(`🔧 Mounting Linux FUSE3 filesystem at ${this.mountPath}`);
        console.log(`📂 Available operations: ${Object.keys(this.operations).join(', ')}`);
        
        this.fuseInstance.mount((err?: Error | null) => {
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

    unmount(callback: (err?: Error | null) => void): void {
        if (!this.mounted) {
            callback(new Error('Filesystem not mounted'));
            return;
        }

        console.log(`🔧 Unmounting FUSE filesystem at ${this.mountPath}`);
        
        this.fuseInstance.unmount((err?: Error | null) => {
            if (err) {
                console.error(`❌ FUSE unmount failed:`, err);
                callback(err);
            } else {
                console.log(`✅ FUSE filesystem unmounted from ${this.mountPath}`);
                this.mounted = false;
                callback(null);
            }
        });
    }

    get mnt(): string {
        return this.mountPath;
    }

    static unmount(mountPath: string, callback: (err?: Error) => void): void {
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.unmount(mountPath, callback);
    }

    static isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void {
        // Check if we're on Linux and FUSE is available
        if (process.platform !== 'linux') {
            callback(new Error('Not running on Linux/WSL2'), false);
            return;
        }

        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.isConfigured(callback);
    }

    static configure(callback: (err?: Error) => void): void {
        // No configuration needed - FUSE3 should be installed at system level
        const FuseClass = fuseAddon.Fuse || fuseAddon;
        FuseClass.configure(callback);
    }
}

export type OPERATIONS = Required<FuseOperations>;