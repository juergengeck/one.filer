/// <reference types="node" />
/// <reference types="node" />
/**
 * @author Sebastian Sandru <sebastian@refinio.com>
 * @copyright REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 * @version 0.0.1
 */
import type { Stats as FuseStats } from '../fuse/types.js';
import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
/**
 * This class implements the fuse api and forward those calls to {@link IFileSystem}.
 */
export default class FuseApiToIFileSystemAdapter {
    private onFilePersisted;
    private readonly constTimes;
    private readonly regularFileMode;
    /**
     * The file system class provided in the constructor. This class needs to implement
     * {@link IFileSystem}.
     * @private
     */
    private readonly fs;
    private readonly logCalls;
    /**
     * This class adds needed functionality to the fs like saving a temporary file in data/tmp /
     * saving a blob in one from a temporary file.
     * @private
     */
    private readonly tmpFilesMgr;
    /**
     * The key is the file descriptor of the temporary file, the value contains the final file
     * name of the temporary file and the path.
     * @private
     */
    private readonly temporaryFileDescriptorToFileMap;
    constructor(fs: IFileSystem, oneStoragePath: string, logCalls?: boolean);
    fuseInit(cb: (err: number) => void): void;
    fuseError(cb: (err: number) => void): void;
    private getUid;
    private getGid;
    fuseGetattr(path: string, cb: (err: number, stat?: FuseStats) => void): void;
    /**
     * Truncate only on the temporary files that are being written
     * @param _path
     * @param _fd
     * @param _size
     * @param cb
     */
    fuseFtruncate(_path: string, _fd: number, _size: number, cb: (err: number) => void): void;
    /**
     * Truncate only on the temporary files that are being written
     * @param _path
     * @param _size
     * @param cb
     */
    fuseTruncate(_path: string, _size: number, cb: (err: number) => void): void;
    /**
     *
     * @param path
     * @param cb
     */
    fuseReaddir(path: string, cb: (err: number, names?: string[], stats?: FuseStats[]) => void): void;
    /**
     *
     * @param _path
     * @param _flags
     * @param cb
     */
    fuseOpendir(_path: string, _flags: number, cb: (err: number, fd?: number) => void): void;
    /**
     *
     * @param _path
     * @param _flags
     * @param cb
     */
    fuseOpen(_path: string, _flags: number, cb: (err: number, fd?: number) => void): void;
    /**
     *
     * @param givenPath
     * @param _fd
     * @param buffer
     * @param length
     * @param position
     * @param cb
     */
    fuseRead(givenPath: string, _fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesRead?: number) => void): void;
    /**
     *
     * @param dirPath
     * @param _mode
     * @param cb
     */
    fuseMkdir(dirPath: string, _mode: number, cb: (err: number) => void): void;
    /**
     * Flush on temporary files
     * @param _path
     * @param fd
     * @param cb
     */
    fuseFlush(_path: string, fd: number, cb: (err: number) => void): void;
    /**
     * Release is called when a temporary file has finished writing. The File Descriptor of that
     * file is passed as
     * a parameter in fuseRelease.
     *
     * From FUSE docs:
     *
     * For every open() call there will be exactly one release() call with the same flags and
     * file handle. It is possible to have a file opened more than once, in which case only the
     * last release will mean, that no more reads/writes will happen on the file. The return
     * value of release is ignored.
     *
     * @see {@link https://libfuse.github.io/doxygen/structfuse__operations.html#a4a6f1b50c583774125b5003811ecebce}
     * @param path
     * @param fd
     * @param cb
     */
    fuseRelease(path: string, fd: number, cb: (err: number) => void): void;
    /**
     *
     * @param _path
     * @param _fd
     * @param cb
     */
    fuseReleasedir(_path: string, _fd: number, cb: (err: number) => void): void;
    /** Delete file. */
    fuseUnlink(path: string, cb: (err: number) => void): void;
    /** Rename file. */
    fuseRename(src: string, dest: string, cb: (err: number) => void): void;
    /** Remove directory. */
    fuseRmdir(path: string, cb: (err: number) => void): void;
    /** Change mode of file. */
    fuseChmod(path: string, mode: number, cb: (err: number) => void): void;
    fuseMknod(_path: string, _mode: number, _dev: number, cb: (err: number) => void): void;
    fuseSetxattr(_path: string, _name: string, _value: Buffer, _size: number, _flags: number, cb: (err: number) => void): void;
    fuseGetxattr(_path: string, _name: string, _size: number, cb: (err: number, xattr?: Buffer | null) => void): void;
    fuseListxattr(_path: string, cb: (err: number, list?: string[]) => void): void;
    fuseRemovexattr(_path: string, _name: string, cb: (err: number) => void): void;
    /**
     *
     * @param givenPath
     * @param mode
     * @param cb
     */
    fuseCreate(givenPath: string, mode: number, cb: (err: number, fd?: number, modePassedOn?: number) => void): void;
    /**
     *
     * @param givenPath
     * @param _fd
     * @param buffer
     * @param length
     * @param position
     * @param cb
     */
    fuseWrite(givenPath: string, _fd: number, buffer: Buffer, length: number, position: number, cb: (err: number, bytesWritten?: number) => void): void;
    /**
     * fuseAccess is called to check rights for an inode.
     * @param _path
     * @param _mode
     * @param cb
     */
    fuseAccess(_path: string, _mode: number, cb: (err: number) => void): void;
    fuseStatfs(_path: string, cb: (err: number, stats?: {
        bsize: number;
        frsize: number;
        blocks: number;
        bfree: number;
        bavail: number;
        files: number;
        ffree: number;
        favail: number;
        fsid: number;
        flag: number;
        namemax: number;
    }) => void): void;
    fuseFgetattr(_path: string, _fd: number, cb: (err: number, stat?: FuseStats) => void): void;
    /**
     * fuseChown is called to change the owner of an inode.
     * @param _path
     * @param _uid
     * @param _gid
     * @param cb
     */
    fuseChown(_path: string, _uid: number, _gid: number, cb: (err: number) => void): void;
    /**
     * Update the last access time of the given object.
     * @param _path
     * @param _atime
     * @param _mtime
     * @param cb
     */
    fuseUtimens(_path: string, _atime: Date, _mtime: Date, cb: (err: number) => void): void;
    fuseLink(_src: string, _dest: string, cb: (err: number) => void): void;
    fuseSymlink(src: string, dest: string, cb: (err: number) => void): void;
    fuseReadlink(path: string, cb: (err: number, linkName?: string) => void): void;
    fuseFsync(_path: string, _datasync: boolean, _fd: number, cb: (err: number) => void): void;
    fuseFsyncdir(_path: string, _datasync: boolean, _fd: number, cb: (err: number) => void): void;
}
//# sourceMappingURL=FuseApiToIFileSystemAdapter.d.ts.map