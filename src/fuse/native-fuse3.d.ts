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
export interface Stats {
    mtime: Date;
    atime: Date;
    ctime: Date;
    size: number;
    mode: number;
    uid: number;
    gid: number;
    nlink?: number;
}
export interface FuseError extends Error {
    code: string;
    path?: string;
}
export interface FuseOperations {
    init?: (cb: (err: number) => void) => void;
    error?: (err: Error) => void;
    access?: (path: string, mode: number, cb: (err: number) => void) => void;
    statfs?: (path: string, cb: (err: number, stat?: any) => void) => void;
    getattr?: (path: string, cb: (err: number, stat?: Stats) => void) => void;
    fgetattr?: (path: string, fd: number, cb: (err: number, stat?: Stats) => void) => void;
    flush?: (path: string, fd: number, cb: (err: number) => void) => void;
    fsync?: (path: string, datasync: boolean, fd: number, cb: (err: number) => void) => void;
    fsyncdir?: (path: string, datasync: boolean, fd: number, cb: (err: number) => void) => void;
    readdir?: (path: string, cb: (err: number, files?: string[], stats?: Stats[]) => void) => void;
    truncate?: (path: string, size: number, cb: (err: number) => void) => void;
    ftruncate?: (path: string, fd: number, size: number, cb: (err: number) => void) => void;
    readlink?: (path: string, cb: (err: number, linkString?: string) => void) => void;
    chown?: (path: string, uid: number, gid: number, cb: (err: number) => void) => void;
    chmod?: (path: string, mode: number, cb: (err: number) => void) => void;
    mknod?: (path: string, mode: number, dev: number, cb: (err: number) => void) => void;
    setxattr?: (path: string, name: string, value: Buffer, size: number, flags: number, cb: (err: number) => void) => void;
    getxattr?: (path: string, name: string, cb: (err: number, value?: Buffer) => void) => void;
    listxattr?: (path: string, cb: (err: number, list?: string[]) => void) => void;
    removexattr?: (path: string, name: string, cb: (err: number) => void) => void;
    open?: (path: string, flags: number, cb: (err: number, fd?: number) => void) => void;
    opendir?: (path: string, flags: number, cb: (err: number, fd?: number) => void) => void;
    read?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesRead?: number) => void) => void;
    write?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesWritten?: number) => void) => void;
    release?: (path: string, fd: number, cb: (err: number) => void) => void;
    releasedir?: (path: string, fd: number, cb: (err: number) => void) => void;
    create?: (path: string, mode: number, cb: (err: number, fd?: number) => void) => void;
    utimens?: (path: string, atime: number, mtime: number, cb: (err: number) => void) => void;
    unlink?: (path: string, cb: (err: number) => void) => void;
    rename?: (src: string, dest: string, cb: (err: number) => void) => void;
    link?: (src: string, dest: string, cb: (err: number) => void) => void;
    symlink?: (src: string, dest: string, cb: (err: number) => void) => void;
    mkdir?: (path: string, mode: number, cb: (err: number) => void) => void;
    rmdir?: (path: string, cb: (err: number) => void) => void;
}
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