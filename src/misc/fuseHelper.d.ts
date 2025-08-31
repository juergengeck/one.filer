/**
 * @author Sebastian Sandru <sebastian@refinio.com>
 * @copyright REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 * @version 0.0.1
 */
import { FS_ERRORS } from '@refinio/one.models/lib/fileSystems/FileSystemErrors.js';
export declare function splitRoutePath(routePath: string): {
    prefix: string;
    rest: string;
};
type FSErrorCode = keyof typeof FS_ERRORS;
/**
 * Enhanced error logging for FUSE operations
 */
export declare function logFuseError(error: Error & {
    code?: string;
    path?: string;
}, operation: string, severity?: 'warn' | 'error'): void;
/**
 * Handles filesystem errors with enhanced logging and mapping
 * @param err - The error to handle
 * @param logCalls - Whether to log the error
 * @param operation - The operation that caused the error (for logging)
 */
export declare function handleError(err: Error & {
    code?: FSErrorCode;
    path?: string;
} | number, logCalls?: boolean, operation?: string): number;
export {};
//# sourceMappingURL=fuseHelper.d.ts.map