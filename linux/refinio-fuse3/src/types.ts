/**
 * FUSE3 Type Definitions
 * Common types used across FUSE3 operations
 */

export interface Stats {
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
}

export interface FuseError {
    code: number;
    errno?: number;
}

export interface FuseOperations {
    init?: (cb: (err: number) => void) => void;
    error?: (cb: () => void) => void;
    getattr?: (path: string, cb: (err: number, stat?: Stats) => void) => void;
    readdir?: (path: string, cb: (err: number, files?: string[]) => void) => void;
    open?: (path: string, flags: number, cb: (err: number, fd?: number) => void) => void;
    read?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (bytesRead: number) => void) => void;
    write?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (bytesWritten: number) => void) => void;
    release?: (path: string, fd: number, cb: (err: number) => void) => void;
    create?: (path: string, mode: number, cb: (err: number, fd?: number) => void) => void;
    unlink?: (path: string, cb: (err: number) => void) => void;
    rename?: (src: string, dest: string, cb: (err: number) => void) => void;
    mkdir?: (path: string, mode: number, cb: (err: number) => void) => void;
    rmdir?: (path: string, cb: (err: number) => void) => void;
    truncate?: (path: string, size: number, cb: (err: number) => void) => void;
    chmod?: (path: string, mode: number, cb: (err: number) => void) => void;
    chown?: (path: string, uid: number, gid: number, cb: (err: number) => void) => void;
    utimens?: (path: string, atime: Date, mtime: Date, cb: (err: number) => void) => void;
    statfs?: (path: string, cb: (err: number, stat?: any) => void) => void;
    flush?: (path: string, fd: number, cb: (err: number) => void) => void;
    fsync?: (path: string, fd: number, datasync: boolean, cb: (err: number) => void) => void;
    readlink?: (path: string, cb: (err: number, linkString?: string) => void) => void;
    symlink?: (src: string, dest: string, cb: (err: number) => void) => void;
    link?: (src: string, dest: string, cb: (err: number) => void) => void;
}

export type OPERATIONS = Required<FuseOperations>;

// Error codes
export const EPERM = 1;
export const ENOENT = 2;
export const EIO = 5;
export const EACCES = 13;
export const EEXIST = 17;
export const ENOTDIR = 20;
export const EISDIR = 21;
export const EINVAL = 22;
export const ENOSPC = 28;
export const EROFS = 30;
export const EBUSY = 16;
export const ENOTEMPTY = 39;