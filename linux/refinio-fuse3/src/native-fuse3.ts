/**
 * Native FUSE3 Bindings for Linux/Debian
 * 
 * This module provides direct bindings to the Linux FUSE3 library through
 * an N-API addon. It runs exclusively in Linux environments.
 * 
 * @author REFINIO GmbH
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
    // Try multiple paths where the addon might be located
    const possiblePaths = [
        // In production package
        path.resolve(process.cwd(), 'node_modules/@refinio/fuse3/lib/binding/fuse3.node'),
        // Development path
        path.resolve(process.cwd(), 'lib/binding/fuse3.node'),
        // Fallback to system-wide installation
        '/usr/lib/node_modules/@refinio/fuse3/lib/binding/fuse3.node'
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
    console.error('  npm install && npm run build:addon');
    throw new Error(`FUSE3 N-API addon not found: ${err.message}`);
}

// Re-export error constants
export const EPERM = fuseAddon.EPERM || 1;
export const ENOENT = fuseAddon.ENOENT || 2;
export const EIO = fuseAddon.EIO || 5;
export const EACCES = fuseAddon.EACCES || 13;
export const EEXIST = fuseAddon.EEXIST || 17;
export const ENOTDIR = fuseAddon.ENOTDIR || 20;
export const EISDIR = fuseAddon.EISDIR || 21;
export const EINVAL = fuseAddon.EINVAL || 22;
export const ENOSPC = fuseAddon.ENOSPC || 28;
export const EROFS = fuseAddon.EROFS || 30;
export const EBUSY = fuseAddon.EBUSY || 16;
export const ENOTEMPTY = fuseAddon.ENOTEMPTY || 39;

/**
 * Native Linux FUSE3 implementation using N-API
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
            throw new Error('This FUSE implementation only works on Linux');
        }

        this.mountPath = mountPath;
        this.operations = operations;
        this.options = {
            ...options,
            force: true,  // Allow mounting over existing mount points
            local: true   // Mark as local filesystem
        };

        // Create the FUSE instance using the N-API addon
        this.fuseInstance = new fuseAddon.Fuse(mountPath, operations, this.options);
        
        // Forward events
        this.fuseInstance.on('mount', () => this.emit('mount'));
        this.fuseInstance.on('unmount', () => this.emit('unmount'));
    }

    mount(callback: (err?: Error | null) => void): void {
        console.log(`🔧 Mounting Linux FUSE3 filesystem at ${this.mountPath}`);
        
        this.fuseInstance.mount((err?: Error | null) => {
            if (err) {
                console.error(`❌ FUSE mount failed:`, err);
                callback(err);
                return;
            }
            
            console.log(`✅ FUSE filesystem mounted successfully at ${this.mountPath}`);
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
        fuseAddon.Fuse.unmount(mountPath, callback);
    }

    static isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void {
        if (process.platform !== 'linux') {
            callback(new Error('Not running on Linux'), false);
            return;
        }

        fuseAddon.Fuse.isConfigured(callback);
    }

    static configure(callback: (err?: Error) => void): void {
        fuseAddon.Fuse.configure(callback);
    }
}

export type OPERATIONS = Required<FuseOperations>;