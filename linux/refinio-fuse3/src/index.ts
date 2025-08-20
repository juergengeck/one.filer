/**
 * @refinio/fuse3 - Native FUSE3 N-API bindings for Linux
 * 
 * This package provides low-level FUSE3 bindings through N-API for Node.js on Linux.
 * It does NOT include any filesystem abstractions - just the raw FUSE3 API.
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

export { Fuse } from './native-fuse3.js';
export type { 
    Stats, 
    FuseOperations, 
    FuseError,
    OPERATIONS 
} from './types.js';

export {
    EPERM,
    ENOENT,
    EIO,
    EACCES,
    EEXIST,
    ENOTDIR,
    EISDIR,
    EINVAL,
    ENOSPC,
    EROFS,
    EBUSY,
    ENOTEMPTY
} from './types.js';

/**
 * Platform detection utilities
 */
export const platform = {
    isLinux: process.platform === 'linux',
    isSupported: process.platform === 'linux'
};

/**
 * Check if FUSE3 is available on the system
 */
export async function checkFuse3Available(): Promise<boolean> {
    if (!platform.isLinux) return false;
    
    return new Promise((resolve) => {
        const { Fuse } = require('./native-fuse3.js');
        Fuse.isConfigured((err: Error | null, isConfigured: boolean) => {
            resolve(!err && isConfigured);
        });
    });
}