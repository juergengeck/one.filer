/// <reference types="node" />
import { Fuse } from '../fuse/native-fuse3.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { FS_ERRORS } from '@refinio/one.models/lib/fileSystems/FileSystemErrors.js';
import { createError } from '@refinio/one.core/lib/errors.js';
import { handleError } from '../misc/fuseHelper';
import FuseTemporaryFilesManager from './FuseTemporaryFilesManager';
let fuseFd = 10;
/**
 * This class implements the fuse api and forward those calls to {@link IFileSystem}.
 */
export default class FuseApiToIFileSystemAdapter {
    onFilePersisted = new OEvent();
    constTimes = new Date();
    regularFileMode = 0o0100666;
    // 0o0040000 octal number for directory type concatenated with the desired mode private
    // readonly directoryMode = 0o0040000;
    /**
     * The file system class provided in the constructor. This class needs to implement
     * {@link IFileSystem}.
     * @private
     */
    fs;
    logCalls;
    /**
     * This class adds needed functionality to the fs like saving a temporary file in data/tmp /
     * saving a blob in one from a temporary file.
     * @private
     */
    tmpFilesMgr;
    /**
     * The key is the file descriptor of the temporary file, the value contains the final file
     * name of the temporary file and the path.
     * @private
     */
    temporaryFileDescriptorToFileMap = new Map();
    constructor(fs, oneStoragePath, logCalls = false) {
        this.fs = fs;
        this.logCalls = logCalls;
        this.tmpFilesMgr = new FuseTemporaryFilesManager(oneStoragePath);
    }
    fuseInit(cb) {
        cb(0);
    }
    fuseError(cb) {
        cb(0);
    }
    getUid() {
        return typeof process.getuid === 'function' ? process.getuid() : 0;
    }
    getGid() {
        return typeof process.getgid === 'function' ? process.getgid() : 0;
    }
    fuseGetattr(path, cb) {
        // see if the getAttr was called on a tmp file that it's in the process of writing
        const tmpFile = Array.from(this.temporaryFileDescriptorToFileMap.values()).find(description => description.path === path);
        // if the path points to that file...
        if (tmpFile) {
            try {
                // get the tmp file size
                const fileStat = this.tmpFilesMgr.statTemporaryFile(tmpFile.fileName);
                cb(0, {
                    mtime: this.constTimes,
                    atime: this.constTimes,
                    ctime: this.constTimes,
                    size: fileStat.size,
                    mode: fileStat.mode,
                    uid: this.getUid(),
                    gid: this.getGid()
                });
            }
            catch (_e) {
                new Promise((resolve, reject) => {
                    // we create a promise and wait for the event to happen (e.g. saving in one)
                    let disconnect = null;
                    const handler = (state) => {
                        // if the path matches, resolve the promise
                        if (state.path === path) {
                            if (disconnect) {
                                disconnect();
                            }
                            this.fs
                                .stat(path)
                                .then((res) => {
                                resolve({
                                    mtime: this.constTimes,
                                    atime: this.constTimes,
                                    ctime: this.constTimes,
                                    size: res.size,
                                    mode: res.mode,
                                    uid: this.getUid(),
                                    gid: this.getGid()
                                });
                            })
                                .catch((err) => reject(err));
                        }
                    };
                    disconnect = this.onFilePersisted.listen(handler);
                    // don't let a floating promise, reject it if it doesn't arrive in 10 seconds (increased for Windows compatibility)
                    setTimeout(() => {
                        if (disconnect) {
                            disconnect();
                        }
                        reject(createError('FSE-ENOENT', {
                            message: FS_ERRORS['FSE-ENOENT'].message,
                            path
                        }));
                    }, 10000);
                })
                    .then(res => cb(0, res))
                    .catch(err => cb(handleError(err, this.logCalls, 'getattr')));
            }
        }
        else {
            // if getAttr was called on a persisted file
            this.fs
                .stat(path)
                .then((res) => {
                cb(0, {
                    mtime: this.constTimes,
                    atime: this.constTimes,
                    ctime: this.constTimes,
                    size: res.size,
                    mode: res.mode,
                    uid: this.getUid(),
                    gid: this.getGid()
                });
            })
                .catch((err) => cb(handleError(err, this.logCalls, 'getattr')));
        }
    }
    /**
     * Truncate only on the temporary files that are being written
     * @param _path
     * @param _fd
     * @param _size
     * @param cb
     */
    fuseFtruncate(_path, _fd, _size, cb) {
        cb(0);
    }
    /**
     * Truncate only on the temporary files that are being written
     * @param _path
     * @param _size
     * @param cb
     */
    fuseTruncate(_path, _size, cb) {
        cb(0);
    }
    /**
     *
     * @param path
     * @param cb
     */
    fuseReaddir(path, cb) {
        this.fs
            .readDir(path)
            .then((res) => cb(0, res.children))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    /**
     *
     * @param _path
     * @param _flags
     * @param cb
     */
    fuseOpendir(_path, _flags, cb) {
        cb(0, fuseFd++);
    }
    /**
     *
     * @param _path
     * @param _flags
     * @param cb
     */
    fuseOpen(_path, _flags, cb) {
        cb(0, fuseFd++);
    }
    /**
     *
     * @param givenPath
     * @param _fd
     * @param buffer
     * @param length
     * @param position
     * @param cb
     */
    fuseRead(givenPath, _fd, buffer, length, position, cb) {
        if (this.fs.supportsChunkedReading(givenPath)) {
            this.fs
                .readFileInChunks(givenPath, length, position)
                .then((res) => {
                const bufferR = Buffer.from(res.content);
                bufferR.copy(buffer);
                cb(0, bufferR.length);
            })
                .catch((err) => cb(handleError(err, this.logCalls), 0));
        }
    }
    /**
     *
     * @param dirPath
     * @param _mode
     * @param cb
     */
    fuseMkdir(dirPath, _mode, cb) {
        this.fs
            .createDir(dirPath, 0o0040777)
            .then(() => cb(0))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    /**
     * Flush on temporary files
     * @param _path
     * @param fd
     * @param cb
     */
    fuseFlush(_path, fd, cb) {
        const fileName = this.temporaryFileDescriptorToFileMap.get(fd);
        if (fileName) {
            cb(0);
        }
        else {
            // TODO Why not use the given fd?
            cb(0);
        }
    }
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
    fuseRelease(path, fd, cb) {
        let fileDescription = this.temporaryFileDescriptorToFileMap.get(fd);
        // If the file was not found, also check the tmpFilesMgr cache for tmp files because this
        // particular file might be in the process of edit
        if (fileDescription === undefined) {
            try {
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                this.tmpFilesMgr.retrieveTemporaryFilePath(fileName);
                fileDescription = { fileName: fileName, path: path };
            }
            catch (_e) {
                fileDescription = undefined;
            }
        }
        if (fileDescription) {
            const fileName = fileDescription.fileName;
            this.tmpFilesMgr
                .releaseTemporaryFile(path.substring(0, path.lastIndexOf('/')), fileDescription.fileName)
                .then(blobHash => this.fs.createFile(path.substring(0, path.lastIndexOf('/')), blobHash, fileName, this.regularFileMode))
                .then(() => {
                this.temporaryFileDescriptorToFileMap.delete(fd);
                this.onFilePersisted.emit({ path: path });
                cb(0);
            })
                .catch(err => cb(handleError(err, this.logCalls)));
        }
        else {
            cb(Fuse.ENOENT);
        }
    }
    /**
     *
     * @param _path
     * @param _fd
     * @param cb
     */
    fuseReleasedir(_path, _fd, cb) {
        cb(0);
    }
    /** Delete file. */
    fuseUnlink(path, cb) {
        this.fs
            .unlink(path)
            .then((result) => cb(result))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    /** Rename file. */
    fuseRename(src, dest, cb) {
        this.fs
            .rename(src, dest)
            .then((result) => cb(result))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    /** Remove directory. */
    fuseRmdir(path, cb) {
        this.fs
            .rmdir(path)
            .then((result) => cb(result))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    /** Change mode of file. */
    fuseChmod(path, mode, cb) {
        this.fs
            .chmod(path, mode)
            .then((result) => cb(result))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    fuseMknod(_path, _mode, _dev, cb) {
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'mknod'));
    }
    fuseSetxattr(_path, _name, _value, _size, _flags, cb) {
        // If we want to store it, we need to store the value Buffer somewhere
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'setxattr'));
    }
    fuseGetxattr(_path, _name, _size, cb) {
        cb(0, null);
    }
    fuseListxattr(_path, cb) {
        // Empty list: We don't support any extended attributes, for this or any path
        cb(0, []);
    }
    fuseRemovexattr(_path, _name, cb) {
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'removexattr'));
    }
    /**
     *
     * @param givenPath
     * @param mode
     * @param cb
     */
    fuseCreate(givenPath, mode, cb) {
        const fileName = givenPath.substring(givenPath.lastIndexOf('/') + 1);
        this.tmpFilesMgr
            .createTemporaryFile(fileName)
            .then(fd => {
            this.temporaryFileDescriptorToFileMap.set(fd, {
                fileName: fileName,
                path: givenPath
            });
            cb(0, fd, mode);
        })
            .catch(err => cb(handleError(err, this.logCalls)));
    }
    /**
     *
     * @param givenPath
     * @param _fd
     * @param buffer
     * @param length
     * @param position
     * @param cb
     */
    fuseWrite(givenPath, _fd, buffer, length, position, cb) {
        this.tmpFilesMgr
            .writeToTemporaryFile(givenPath, buffer, length, position)
            .then(bytesWritten => cb(0, bytesWritten))
            .catch(err => cb(handleError(err, this.logCalls), 0));
    }
    /**
     * fuseAccess is called to check rights for an inode.
     * @param _path
     * @param _mode
     * @param cb
     */
    fuseAccess(_path, _mode, cb) {
        cb(0);
    }
    fuseStatfs(_path, cb) {
        cb(0, {
            bsize: 1000000,
            frsize: 1000000,
            blocks: 1000000,
            bfree: 1000000,
            bavail: 1000000,
            files: 1000000,
            ffree: 1000000,
            favail: 1000000,
            fsid: 1000000,
            flag: 1000000,
            namemax: 1000000
        });
    }
    fuseFgetattr(_path, _fd, cb) {
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'fgetattr'));
    }
    /**
     * fuseChown is called to change the owner of an inode.
     * @param _path
     * @param _uid
     * @param _gid
     * @param cb
     */
    fuseChown(_path, _uid, _gid, cb) {
        cb(0);
    }
    /**
     * Update the last access time of the given object.
     * @param _path
     * @param _atime
     * @param _mtime
     * @param cb
     */
    fuseUtimens(_path, _atime, _mtime, cb) {
        cb(0);
    }
    fuseLink(_src, _dest, cb) {
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'link'));
    }
    fuseSymlink(src, dest, cb) {
        this.fs
            .symlink(src, dest)
            .then(() => cb(0))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    fuseReadlink(path, cb) {
        this.fs
            .readlink(path)
            .then((res) => cb(0, Buffer.from(res.content).toString()))
            .catch((err) => cb(handleError(err, this.logCalls)));
    }
    fuseFsync(_path, _datasync, _fd, cb) {
        cb(0);
    }
    fuseFsyncdir(_path, _datasync, _fd, cb) {
        cb(handleError(createError('FSE-ENOSYS', {
            message: FS_ERRORS['FSE-ENOSYS'].message
        }), this.logCalls, 'fsyncdir'));
    }
}
//# sourceMappingURL=FuseApiToIFileSystemAdapter.js.map