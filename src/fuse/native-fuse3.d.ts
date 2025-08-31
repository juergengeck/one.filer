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
/// <reference types="node" />
import { EventEmitter } from 'events';
import type { FuseOperations } from './types.js';
export type { Stats, FuseOperations } from './types.js';
export declare const EPERM: any;
export declare const ENOENT: any;
export declare const EIO: any;
export declare const EACCES: any;
export declare const EEXIST: any;
export declare const ENOTDIR: any;
export declare const EISDIR: any;
export declare const EINVAL: any;
export declare const ENOSPC: any;
export declare const EROFS: any;
export declare const EBUSY: any;
export declare const ENOTEMPTY: any;
/**
 * Native Linux FUSE3 implementation using N-API
 * This runs exclusively in WSL2/Linux and exposes filesystems to Windows
 * through the WSL2 file bridge (\\wsl$\Ubuntu\path)
 */
export declare class Fuse extends EventEmitter {
    private fuseInstance;
    private mountPath;
    private operations;
    private options;
    private mounted;
    static EPERM: any;
    static ENOENT: any;
    static EIO: any;
    static EACCES: any;
    static EEXIST: any;
    static ENOTDIR: any;
    static EISDIR: any;
    static EINVAL: any;
    static ENOSPC: any;
    static EROFS: any;
    static EBUSY: any;
    static ENOTEMPTY: any;
    constructor(mountPath: string, operations: FuseOperations, options?: any);
    mount(callback: (err?: Error | null) => void): void;
    unmount(callback: (err?: Error | null) => void): void;
    get mnt(): string;
    static unmount(mountPath: string, callback: (err?: Error) => void): void;
    static isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void;
    static configure(callback: (err?: Error) => void): void;
}
export type OPERATIONS = Required<FuseOperations>;
//# sourceMappingURL=native-fuse3.d.ts.map