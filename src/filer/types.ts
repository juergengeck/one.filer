// Extended FileInfo type that matches the C++ structure
export interface FileInfo {
    name: string;
    hash: string;
    size: number;
    isDirectory: boolean;
    isBlobOrClob: boolean;
    mode: number;
    
    // Extended context fields
    mtime?: number;      // Modification time (milliseconds since epoch)
    atime?: number;      // Access time
    ctime?: number;      // Creation time
    contentType?: string; // MIME type or content type hint
    sourceFS?: string;    // Source filesystem (chat, objects, debug, invites)
    virtualPath?: string; // Original virtual path before normalization
    metadata?: Record<string, any>; // Extensible metadata
}

export interface DirectoryListing {
    entries: FileInfo[];
}

export interface FileContent {
    data: Uint8Array;
    hash?: string;
}

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hits?: number;
    sourceFS?: string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    entries: number;
    memoryUsage: number;
    hitRate?: number;
}