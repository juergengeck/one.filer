"use strict";
/// <reference types="node" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.logFuseError = exports.splitRoutePath = void 0;
/**
 * @author Sebastian Sandru <sebastian@refinio.com>
 * @copyright REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 * @version 0.0.1
 */
const FileSystemErrors_js_1 = require("@refinio/one.models/lib/fileSystems/FileSystemErrors.js");
const errors_js_1 = require("@refinio/one.core/lib/errors.js");
const types_js_1 = require("../fuse/types.js");
const logger_js_1 = require("@refinio/one.core/lib/logger.js");
function splitRoutePath(routePath) {
    // Assume a leading slash in this method
    const dirs = routePath.split('/');
    // calculate prefix
    let prefix = '';
    if (dirs.length > 1) {
        prefix = dirs[1];
    }
    // calculate rest
    let rest = '/';
    if (dirs.length > 2) {
        rest += dirs.slice(2).join('/');
    }
    return {
        prefix: prefix,
        rest: rest
    };
}
exports.splitRoutePath = splitRoutePath;
/**
 * Maps FUSE error codes to one.core filesystem error codes
 */
const FUSE_TO_FS_ERRORS = {
    [types_js_1.EPERM]: 'FSE-EPERM',
    [types_js_1.ENOENT]: 'FSE-ENOENT',
    [types_js_1.EIO]: 'FSE-EIO',
    [types_js_1.EACCES]: 'FSE-EACCES',
    [types_js_1.EEXIST]: 'FSE-EEXIST',
    [types_js_1.ENOTDIR]: 'FSE-ENOTDIR',
    [types_js_1.EISDIR]: 'FSE-EISDIR',
    [types_js_1.EINVAL]: 'FSE-EINVAL',
    [types_js_1.ENOSPC]: 'FSE-ENOSPC',
    [types_js_1.EROFS]: 'FSE-EROFS',
    [types_js_1.EBUSY]: 'FSE-EBUSY',
    [types_js_1.ENOTEMPTY]: 'FSE-ENOTEMPTY' // Directory not empty
};
/**
 * Maps a FUSE error code to a one.core filesystem error
 */
function mapFuseError(fuseCode, path) {
    const fsErrorCode = FUSE_TO_FS_ERRORS[fuseCode];
    if (fsErrorCode) {
        return (0, errors_js_1.createError)(fsErrorCode, {
            message: FileSystemErrors_js_1.FS_ERRORS[fsErrorCode].message,
            path
        });
    }
    return (0, errors_js_1.createError)('FSE-UNK', {
        message: FileSystemErrors_js_1.FS_ERRORS['FSE-UNK'].message,
        path
    });
}
/**
 * Enhanced error logging for FUSE operations
 */
function logFuseError(error, operation, severity = 'error') {
    const color = severity === 'error' ? logger_js_1.COLOR.FG_RED : logger_js_1.COLOR.FG_YELLOW;
    console.log(`${color}[${severity.toUpperCase()}]:${logger_js_1.COLOR.OFF}`, `Operation: ${operation}`, `Path: ${error.path || 'unknown'}`, `Error: ${error.message}`);
    if (error.stack) {
        console.log(error.stack);
    }
}
exports.logFuseError = logFuseError;
/**
 * Handles filesystem errors with enhanced logging and mapping
 * @param err - The error to handle
 * @param logCalls - Whether to log the error
 * @param operation - The operation that caused the error (for logging)
 */
function handleError(err, logCalls = false, operation = 'unknown') {
    // Handle raw FUSE error codes
    if (typeof err === 'number') {
        const mappedError = mapFuseError(err);
        if (logCalls) {
            logFuseError(mappedError, operation);
        }
        return err;
    }
    if (logCalls) {
        logFuseError(err, operation);
    }
    // If it's already a filesystem error, extract the code
    if (err.message && err.message.includes(':')) {
        const code = err.message.slice(0, err.message.indexOf(':'));
        if (FileSystemErrors_js_1.FS_ERRORS[code]) {
            if (FileSystemErrors_js_1.FS_ERRORS[code].linuxErrCode === FileSystemErrors_js_1.FS_INTERNAL_ERROR_CODE) {
                console.log(new Error().stack);
                console.error(err);
                return 0;
            }
            return FileSystemErrors_js_1.FS_ERRORS[code].linuxErrCode;
        }
    }
    // Handle one.core errors
    if (err.code && FileSystemErrors_js_1.FS_ERRORS[err.code]) {
        return FileSystemErrors_js_1.FS_ERRORS[err.code].linuxErrCode;
    }
    // Unknown error
    console.log(new Error().stack);
    console.error(err);
    return 0;
}
exports.handleError = handleError;
//# sourceMappingURL=fuseHelper.js.map