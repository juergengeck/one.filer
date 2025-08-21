// FUSE error codes (POSIX-compliant)
export const EPERM = 1;    // Operation not permitted
export const ENOENT = 2;   // No such file or directory
export const EIO = 5;      // I/O error
export const EACCES = 13;  // Permission denied
export const EEXIST = 17;  // File exists
export const ENOTDIR = 20; // Not a directory
export const EISDIR = 21;  // Is a directory
export const EINVAL = 22;  // Invalid argument
export const ENOSPC = 28;  // No space left on device
export const EROFS = 30;   // Read-only file system
export const EBUSY = 16;   // Device or resource busy
export const ENOTEMPTY = 39; // Directory not empty

// FUSE file stats interface
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

// FUSE error interface
export interface FuseError extends Error {
    code: string;
    path?: string;
}

// FUSE operations interface - all callbacks are async
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

// Type for all operations (required version)
export type OPERATIONS = Required<FuseOperations>;