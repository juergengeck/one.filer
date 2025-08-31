"use strict";
/// <reference types="node" />
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @author Sebastian Sandru <sebastian@refinio.com>
 * @copyright REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 * @version 0.0.1
 */
const errors_js_1 = require("@refinio/one.core/lib/errors.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const promises_1 = require("fs/promises");
const instance_js_1 = require("@refinio/one.core/lib/instance.js");
const crypto_1 = require("crypto");
const FileSystemErrors_js_1 = require("@refinio/one.models/lib/fileSystems/FileSystemErrors.js");
const storage_base_common_js_1 = require("@refinio/one.core/lib/storage-base-common.js");
const fuseHelper_1 = require("../misc/fuseHelper");
/**
 * File system proxy that adds additional functionalities to be used in {@link FuseApiToIFileSystemAdapter}
 */
class FuseTemporaryFilesManager {
    oneStoragePath;
    /**
     * Operating System name
     */
    platform = process.platform;
    /**
     * Maps the final file name to the temporary file name and his file descriptor
     * @private
     */
    fileToTemporaryFileMap = new Map();
    constructor(storageName = 'data') {
        this.oneStoragePath = path.join(storageName);
    }
    /**
     * Retrieves the path for the specific one folder
     * @param storage
     * @param folder
     */
    static getOnePath(storage, folder) {
        const instanceIdHash = (0, instance_js_1.getInstanceIdHash)();
        if (instanceIdHash === undefined) {
            throw (0, errors_js_1.createError)('FSE-EINVAL', {
                message: 'Instance ID hash is not set'
            });
        }
        return path.resolve(process.cwd(), storage) + path.sep + instanceIdHash + path.sep + folder;
    }
    /**
     * Get stats for a temporary file
     * @param fileName
     */
    statTemporaryFile(fileName) {
        const tmpFilePath = this.retrieveTemporaryFilePath(fileName);
        try {
            return fs.statSync(tmpFilePath);
        }
        catch (err) {
            (0, fuseHelper_1.logFuseError)(err, 'statTemporaryFile');
            throw (0, errors_js_1.createError)('FSE-ENOENT', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                path: fileName
            });
        }
    }
    /**
     * Saves the content of the temporary file created in tmp one folder as Blob
     * @param _directoryPath
     * @param fileName
     */
    async releaseTemporaryFile(_directoryPath, fileName) {
        this.throwErrorForMacOSHiddenFiles(fileName);
        const readStream = fs.createReadStream(this.retrieveTemporaryFilePath(fileName));
        return new Promise((resolve, reject) => {
            const cryptoHashObj = (0, crypto_1.createHash)('sha256');
            readStream.once('error', err => {
                (0, fuseHelper_1.logFuseError)(err, 'releaseTemporaryFile');
                reject((0, errors_js_1.createError)('FSE-ENOENT', {
                    message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                    path: fileName
                }));
            });
            readStream.on('readable', () => {
                let chunk;
                while (null !== (chunk = readStream.read())) {
                    cryptoHashObj.update(chunk);
                }
            });
            readStream.once('end', () => {
                const hash = cryptoHashObj.digest('hex');
                this.persistTemporaryFileAsBlob(fileName, hash)
                    .then(_ => resolve(hash))
                    .catch(err => {
                    (0, fuseHelper_1.logFuseError)(err, 'releaseTemporaryFile');
                    reject((0, errors_js_1.createError)('FSE-ENOENT', {
                        message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                        path: fileName
                    }));
                });
            });
        });
    }
    /**
     * Writes to the temporary file created in one tmp folder
     * @param filepath
     * @param buffer
     * @param length
     * @param position
     */
    async writeToTemporaryFile(filepath, buffer, length, position) {
        const fileName = filepath.substring(filepath.lastIndexOf('/') + 1);
        this.throwErrorForMacOSHiddenFiles(fileName);
        const temporaryFile = this.fileToTemporaryFileMap.get(fileName);
        if (temporaryFile) {
            return new Promise((resolve, reject) => {
                fs.write(temporaryFile.temporaryFileDescriptor, buffer, 0, length, position, (err, written) => {
                    if (err) {
                        (0, fuseHelper_1.logFuseError)(err, 'writeToTemporaryFile');
                        reject((0, errors_js_1.createError)('FSE-EIO', {
                            message: FileSystemErrors_js_1.FS_ERRORS['FSE-EIO'].message,
                            path: fileName
                        }));
                    }
                    else {
                        resolve(written);
                    }
                });
            });
        }
        throw (0, errors_js_1.createError)('FSE-ENOENT', {
            message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
            path: fileName
        });
    }
    /**
     * This function copied behaviour of moveFromTempToObjectSpace from
     * one.core/system-nodejs/storage-streams.ts
     *
     * Low-level functions for file-access don't throw standard Javascript errors, they throw
     * node.js SYSTEM errors. Ref.: https://nodejs.org/api/errors.html#errors_system_errors
     * When calling node.js fs methods we use .catch() instead of try/catch because
     *
     * 1. Only the former manages to enable async. stack trace creation (a feature available in
     *    recent node.js/V8)
     * 2. We also need to throw a createError(err) to get the stack trace. The one we get from
     * node.js does not have it. Our createError() method always creates a createError.
     *
     * @param temporaryFileName
     * @param persistedFileName
     */
    async persistTemporaryFileAsBlob(temporaryFileName, persistedFileName) {
        const temporaryFile = this.fileToTemporaryFileMap.get(temporaryFileName);
        if (!temporaryFile) {
            throw (0, errors_js_1.createError)('FSE-ENOENT', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                path: temporaryFileName
            });
        }
        const persistedFilePath = path.join(FuseTemporaryFilesManager.getOnePath(this.oneStoragePath, 'objects'), persistedFileName);
        return (0, promises_1.stat)(persistedFilePath)
            .then(stats => {
            if (stats.size === 0) {
                // The file exists but is empty. This is a remnant of a failed write.
                // Delete it and try again.
                return (0, promises_1.unlink)(persistedFilePath)
                    .then(() => (0, promises_1.rename)(temporaryFile.temporaryFilePath, persistedFilePath).then(() => {
                    return new Promise((resolve, reject) => fs.close(temporaryFile.temporaryFileDescriptor, closeErr => {
                        if (closeErr) {
                            (0, fuseHelper_1.logFuseError)(closeErr, 'persistTemporaryFileAsBlob');
                            reject((0, errors_js_1.createError)('SST-MV3', {
                                message: `File not found: ${temporaryFileName}`,
                                path: temporaryFileName
                            }));
                        }
                        else {
                            this.fileToTemporaryFileMap.delete(temporaryFileName);
                            resolve(storage_base_common_js_1.CREATION_STATUS.NEW);
                        }
                    }));
                }))
                    .catch(unlinkErr => {
                    if (unlinkErr.code === 'ENOENT') {
                        // The file we were supposed to rename no longer exists.
                        // While this is seemingly okay since the target already
                        // exists so that it seems we've got what we wanted the
                        // disappearance of the file is unexpected.
                        throw (0, errors_js_1.createError)('SST-MV2', {
                            message: `File not found: ${temporaryFileName}`,
                            path: temporaryFileName
                        });
                    }
                    throw (0, errors_js_1.createError)('SST-MV6', unlinkErr);
                });
            }
            // This is an "impossible" error, but you never know
            throw (0, errors_js_1.createError)('SST-MV7', {
                message: `Move operation failed from ${temporaryFile.temporaryFilePath} to ${persistedFilePath}`,
                path: temporaryFile.temporaryFilePath
            });
        })
            .catch((err) => {
            if (err.code === 'ENOENT') {
                // "No such file or directory" - perfect, go ahead and move the file to one
                // objects space.
                return (0, promises_1.rename)(temporaryFile.temporaryFilePath, persistedFilePath)
                    .then(() => {
                    return new Promise((resolve, reject) => fs.close(temporaryFile.temporaryFileDescriptor, closeErr => {
                        if (closeErr) {
                            (0, fuseHelper_1.logFuseError)(closeErr, 'persistTemporaryFileAsBlob');
                            reject((0, errors_js_1.createError)('SST-MV3', {
                                message: `File not found: ${temporaryFileName}`,
                                path: temporaryFileName
                            }));
                        }
                        else {
                            this.fileToTemporaryFileMap.delete(temporaryFileName);
                            resolve(storage_base_common_js_1.CREATION_STATUS.NEW);
                        }
                    }));
                })
                    .catch((renameErr) => {
                    if (renameErr.code === 'ENOENT') {
                        throw (0, errors_js_1.createError)('SST-MV3', {
                            message: `File not found: ${temporaryFileName}`,
                            path: temporaryFileName
                        });
                    }
                    throw (0, errors_js_1.createError)('SST-MV4', renameErr);
                });
            }
            throw (0, errors_js_1.createError)('SST-MV5', err);
        });
    }
    /**
     * Throws an error for hidden files on macOS
     */
    throwErrorForMacOSHiddenFiles(fileName) {
        if (this.platform === 'darwin' && fileName.startsWith('.')) {
            (0, fuseHelper_1.logFuseError)((0, errors_js_1.createError)('FSE-MACH', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-MACH'].message,
                path: fileName
            }), 'throwErrorForMacOSHiddenFiles');
            throw (0, errors_js_1.createError)('FSE-MACH', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-MACH'].message,
                path: fileName
            });
        }
    }
    /**
     * Retrieves the path for a temporary file
     * @param fileName
     */
    retrieveTemporaryFilePath(fileName) {
        this.throwErrorForMacOSHiddenFiles(fileName);
        const existingFile = this.fileToTemporaryFileMap.get(fileName);
        if (!existingFile) {
            throw (0, errors_js_1.createError)('FSE-ENOENT', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                path: fileName
            });
        }
        return existingFile.temporaryFilePath;
    }
    /**
     * Creates a temporary file in one tmp folder with a random name
     * @param fileName
     */
    async createTemporaryFile(fileName) {
        this.throwErrorForMacOSHiddenFiles(fileName);
        const tmpFilePath = path.join(FuseTemporaryFilesManager.getOnePath(this.oneStoragePath, 'tmp'), (0, storage_base_common_js_1.createTempFileName)());
        try {
            const fd = fs.openSync(tmpFilePath, 'a');
            this.fileToTemporaryFileMap.set(fileName, {
                temporaryFilePath: tmpFilePath,
                temporaryFileDescriptor: fd
            });
            return fd;
        }
        catch (err) {
            (0, fuseHelper_1.logFuseError)(err, 'createTemporaryFile');
            throw (0, errors_js_1.createError)('FSE-ENOENT', {
                message: FileSystemErrors_js_1.FS_ERRORS['FSE-ENOENT'].message,
                path: fileName
            });
        }
    }
}
exports.default = FuseTemporaryFilesManager;
//# sourceMappingURL=FuseTemporaryFilesManager.js.map