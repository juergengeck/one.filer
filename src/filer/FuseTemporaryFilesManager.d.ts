/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type { Stats } from 'fs';
import type { SHA256Hash } from '../types/compatibility.js';
import type { BLOB } from '@refinio/one.core/lib/recipes.js';
/**
 * File system proxy that adds additional functionalities to be used in {@link FuseApiToIFileSystemAdapter}
 */
export default class FuseTemporaryFilesManager {
    private readonly oneStoragePath;
    /**
     * Operating System name
     */
    private readonly platform;
    /**
     * Maps the final file name to the temporary file name and his file descriptor
     * @private
     */
    private fileToTemporaryFileMap;
    constructor(storageName?: string);
    /**
     * Retrieves the path for the specific one folder
     * @param storage
     * @param folder
     */
    private static getOnePath;
    /**
     * Get stats for a temporary file
     * @param fileName
     */
    statTemporaryFile(fileName: string): Stats;
    /**
     * Saves the content of the temporary file created in tmp one folder as Blob
     * @param _directoryPath
     * @param fileName
     */
    releaseTemporaryFile(_directoryPath: string, fileName: string): Promise<SHA256Hash<BLOB>>;
    /**
     * Writes to the temporary file created in one tmp folder
     * @param filepath
     * @param buffer
     * @param length
     * @param position
     */
    writeToTemporaryFile(filepath: string, buffer: Buffer, length: number, position: number): Promise<number>;
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
    private persistTemporaryFileAsBlob;
    /**
     * Throws an error for hidden files on macOS
     */
    private throwErrorForMacOSHiddenFiles;
    /**
     * Retrieves the path for a temporary file
     * @param fileName
     */
    retrieveTemporaryFilePath(fileName: string): string;
    /**
     * Creates a temporary file in one tmp folder with a random name
     * @param fileName
     */
    createTemporaryFile(fileName: string): Promise<number>;
}
//# sourceMappingURL=FuseTemporaryFilesManager.d.ts.map