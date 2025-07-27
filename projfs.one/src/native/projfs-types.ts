/**
 * TypeScript type definitions for Windows ProjectedFS
 * 
 * These types represent the interface between the Node.js layer
 * and the native C++ ProjFS wrapper.
 */

/**
 * File placeholder information returned by onGetPlaceholderInfo
 */
export interface PlaceholderInfo {
    fileSize: bigint;
    isDirectory: boolean;
    creationTime: Date;
    lastWriteTime: Date;
    lastAccessTime: Date;
    changeTime: Date;
    fileAttributes: number;
}

/**
 * Directory entry information for enumeration
 */
export interface DirectoryEntry {
    fileName: string;
    isDirectory: boolean;
    fileSize: bigint;
    creationTime: Date;
    lastWriteTime: Date;
    lastAccessTime: Date;
    changeTime: Date;
    fileAttributes: number;
}

/**
 * Notification types for file operations
 */
export enum NotificationType {
    FILE_OPENED = 0x00000001,
    NEW_FILE_CREATED = 0x00000002,
    FILE_OVERWRITTEN = 0x00000004,
    PRE_DELETE = 0x00000008,
    PRE_RENAME = 0x00000010,
    PRE_SET_HARDLINK = 0x00000020,
    FILE_RENAMED = 0x00000040,
    HARDLINK_CREATED = 0x00000080,
    FILE_HANDLE_CLOSED_NO_MODIFICATION = 0x00000100,
    FILE_HANDLE_CLOSED_FILE_MODIFIED = 0x00000200,
    FILE_HANDLE_CLOSED_FILE_DELETED = 0x00000400,
    FILE_PRE_CONVERT_TO_FULL = 0x00000800
}

/**
 * Windows file attributes
 */
export enum FileAttributes {
    READONLY = 0x00000001,
    HIDDEN = 0x00000002,
    SYSTEM = 0x00000004,
    DIRECTORY = 0x00000010,
    ARCHIVE = 0x00000020,
    DEVICE = 0x00000040,
    NORMAL = 0x00000080,
    TEMPORARY = 0x00000100,
    SPARSE_FILE = 0x00000200,
    REPARSE_POINT = 0x00000400,
    COMPRESSED = 0x00000800,
    OFFLINE = 0x00001000,
    NOT_CONTENT_INDEXED = 0x00002000,
    ENCRYPTED = 0x00004000
}

/**
 * ProjFS provider callbacks interface
 */
export interface ProjFSCallbacks {
    /**
     * Get metadata for a file or directory
     */
    onGetPlaceholderInfo(relativePath: string): Promise<PlaceholderInfo>;
    
    /**
     * Read file data
     */
    onGetFileData(
        relativePath: string,
        byteOffset: bigint,
        length: number
    ): Promise<Buffer>;
    
    /**
     * Enumerate directory contents
     */
    onGetDirectoryEnumeration(
        relativePath: string,
        searchPattern?: string
    ): Promise<DirectoryEntry[]>;
    
    /**
     * Handle file modifications
     */
    onNotifyFileHandleClosedFileModified(
        relativePath: string,
        isDirectory: boolean,
        isFileDeleted: boolean,
        notification: NotificationType
    ): Promise<void>;
}

/**
 * ProjFS provider options
 */
export interface ProjFSOptions {
    virtualizationRootPath: string;
    poolThreadCount?: number;
    concurrentThreadCount?: number;
    enableNegativePathCache?: boolean;
    initializeFlags?: number;
}

/**
 * Main ProjFS provider interface
 */
export interface IProjFSProvider {
    /**
     * Start the virtualization
     */
    start(callbacks: ProjFSCallbacks, options: ProjFSOptions): Promise<void>;
    
    /**
     * Stop the virtualization
     */
    stop(): Promise<void>;
    
    /**
     * Check if virtualization is running
     */
    isRunning(): boolean;
    
    /**
     * Get provider statistics
     */
    getStats(): ProviderStats;
}

/**
 * Provider statistics
 */
export interface ProviderStats {
    placeholderInfoRequests: number;
    fileDataRequests: number;
    directoryEnumerations: number;
    fileModifications: number;
    cacheMisses: number;
    cacheHits: number;
    totalBytesRead: bigint;
    totalBytesWritten: bigint;
    uptime: number;
}