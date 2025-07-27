# IFileSystem to ProjectedFS Integration Mapping

## Overview

The ONE.models IFileSystem (IFS) abstraction provides a generic interface for implementing various file systems that can persist data in ONE.core's content-addressed storage. This document maps IFS concepts to Windows ProjectedFS requirements for native integration.

## IFileSystem Interface Analysis

### Core Interface Methods

```typescript
interface IFileSystem {
    // Directory operations
    createDir(directoryPath: string, dirMode: number): Promise<void>;
    readDir(dirPath: string): Promise<FileSystemDirectory>;
    rmdir(pathName: string): Promise<number>;
    
    // File operations  
    createFile(directoryPath: string, fileHash: SHA256Hash<BLOB>, fileName: string, fileMode: number): Promise<void>;
    readFile(filePath: string): Promise<FileSystemFile>;
    readFileInChunks(filePath: string, length: number, position: number): Promise<FileSystemFile>;
    unlink(pathName: string): Promise<number>;
    
    // Metadata operations
    stat(path: string): Promise<FileDescription>;
    chmod(pathName: string, mode: number): Promise<number>;
    
    // Link operations
    symlink(src: string, dest: string): Promise<void>;
    readlink(filePath: string): Promise<FileSystemFile>;
    rename(src: string, dest: string): Promise<number>;
    
    // Capabilities
    supportsChunkedReading(path?: string): boolean;
}
```

### Key Data Types

```typescript
interface FileSystemFile {
    content: Uint8Array;  // File content as bytes
}

interface FileSystemDirectory {
    children: string[];   // List of child names
}

interface FileDescription {
    mode: number;        // Unix-style permissions
    size: number;        // File size in bytes
}
```

## Mapping to ProjectedFS

### IFileSystem → ProjFS Callback Mapping

| IFileSystem Method | ProjFS Callback | Purpose |
|-------------------|-----------------|---------|
| `stat()` | `onGetPlaceholderInfo()` | Provide file/directory metadata |
| `readDir()` | `onGetDirectoryEnumeration()` | List directory contents |
| `readFileInChunks()` | `onGetFileData()` | Stream file content on demand |
| `createFile()` | `onNotifyFileHandleClosedFileModified()` | Handle file modifications |
| N/A | `onNotifyFileHandleClosedFileDeleted()` | Handle file deletions |

### Architecture Integration

```
Windows Application
        ↓
ProjectedFS Driver
        ↓
projfs.one (Native Wrapper)
        ↓
IFileSystemToProjFSAdapter
        ↓
IFileSystem Implementation (e.g., PersistentFileSystem)
        ↓
ONE.core Storage (Content-Addressed)
```

## Implementation Strategy

### 1. IFileSystemToProjFSAdapter

This adapter will bridge between ProjFS callbacks and IFileSystem methods:

```typescript
class IFileSystemToProjFSAdapter {
    constructor(
        private fileSystem: IFileSystem,
        private virtualRoot: string
    ) {}
    
    // ProjFS Callbacks
    async onGetPlaceholderInfo(relativePath: string): Promise<PlaceholderInfo> {
        const fullPath = this.toVirtualPath(relativePath);
        const stat = await this.fileSystem.stat(fullPath);
        
        return {
            fileSize: stat.size,
            isDirectory: this.isDirectory(stat.mode),
            creationTime: new Date(), // IFS doesn't track times
            lastWriteTime: new Date(),
            lastAccessTime: new Date(),
            fileAttributes: this.modeToWindowsAttributes(stat.mode)
        };
    }
    
    async onGetFileData(
        relativePath: string, 
        byteOffset: bigint, 
        length: number
    ): Promise<Buffer> {
        const fullPath = this.toVirtualPath(relativePath);
        
        // Use chunked reading if supported
        if (this.fileSystem.supportsChunkedReading(fullPath)) {
            const result = await this.fileSystem.readFileInChunks(
                fullPath, 
                length, 
                Number(byteOffset)
            );
            return Buffer.from(result.content);
        } else {
            // Fall back to full file read
            const file = await this.fileSystem.readFile(fullPath);
            return Buffer.from(file.content).slice(
                Number(byteOffset), 
                Number(byteOffset) + length
            );
        }
    }
    
    async onGetDirectoryEnumeration(
        relativePath: string
    ): Promise<DirectoryEntry[]> {
        const fullPath = this.toVirtualPath(relativePath);
        const dir = await this.fileSystem.readDir(fullPath);
        
        const entries: DirectoryEntry[] = [];
        for (const child of dir.children) {
            const childPath = `${fullPath}/${child}`;
            const stat = await this.fileSystem.stat(childPath);
            
            entries.push({
                fileName: child,
                isDirectory: this.isDirectory(stat.mode),
                fileSize: stat.size
            });
        }
        
        return entries;
    }
}
```

### 2. Content-Addressed Storage Integration

IFileSystem stores files as SHA256-addressed BLOBs:

```typescript
// File creation in IFileSystem
createFile(
    directoryPath: string, 
    fileHash: SHA256Hash<BLOB>,  // Content hash
    fileName: string,
    fileMode: number
): Promise<void>
```

This maps perfectly to ProjFS's on-demand hydration model:
- Files appear as placeholders until accessed
- Content is fetched from ONE.core storage when needed
- Modifications create new content hashes

### 3. Metadata Handling

#### Unix Mode → Windows Attributes

```typescript
function modeToWindowsAttributes(mode: number): number {
    let attributes = 0;
    
    // Directory
    if (mode & 0o040000) {
        attributes |= FILE_ATTRIBUTE_DIRECTORY;
    }
    
    // Read-only (no write permission)
    if (!(mode & 0o200)) {
        attributes |= FILE_ATTRIBUTE_READONLY;
    }
    
    // Hidden (dot files)
    // Symlink
    // etc...
    
    return attributes;
}
```

### 4. Write Operations

ProjFS notifies about modifications after file handles are closed:

```typescript
async onNotifyFileHandleClosedFileModified(
    relativePath: string,
    isDirectory: boolean,
    notification: PRJ_NOTIFICATION
): Promise<void> {
    if (!isDirectory) {
        // Read modified content from ProjFS scratch
        const content = await this.readScratchFile(relativePath);
        
        // Store as new BLOB in ONE.core
        const newHash = await storeBlobFromBuffer(content);
        
        // Update IFileSystem with new content
        const dir = path.dirname(relativePath);
        const fileName = path.basename(relativePath);
        
        await this.fileSystem.createFile(
            this.toVirtualPath(dir),
            newHash,
            fileName,
            0o0100666  // Default file mode
        );
    }
}
```

## Key Differences to Handle

### 1. Timestamps
- IFileSystem doesn't track creation/modification times
- ProjFS requires these for Windows compatibility
- Solution: Use current time or track separately

### 2. File Attributes
- IFileSystem uses Unix-style modes
- Windows uses different attribute flags
- Solution: Mode conversion functions

### 3. Chunked Reading
- IFileSystem has optional chunked reading support
- ProjFS always requests specific byte ranges
- Solution: Adapter handles both cases

### 4. Content Addressing
- IFileSystem uses SHA256 hashes for content
- ProjFS expects traditional file paths
- Solution: Path mapping and caching layer

### 5. Atomic Operations
- IFileSystem operations are atomic at the object level
- ProjFS expects file system semantics
- Solution: Transaction management in adapter

## Performance Considerations

### Caching Strategy

```typescript
class CachedIFileSystemAdapter {
    private statCache = new LRU<string, FileDescription>(1000);
    private dirCache = new LRU<string, FileSystemDirectory>(100);
    private contentCache = new LRU<string, Buffer>(50);
    
    async stat(path: string): Promise<FileDescription> {
        const cached = this.statCache.get(path);
        if (cached) return cached;
        
        const stat = await this.fileSystem.stat(path);
        this.statCache.set(path, stat);
        return stat;
    }
}
```

### Prefetching
- Predict likely file accesses
- Preload directory entries
- Cache recent file content blocks

## Implementation Phases

### Phase 1: Basic Read-Only
- Implement core ProjFS callbacks
- Map IFileSystem reads to ProjFS
- Basic caching layer

### Phase 2: Write Support
- Handle file modifications
- Content hash updates
- Directory structure changes

### Phase 3: Advanced Features
- Symbolic links
- Extended attributes
- Performance optimizations

### Phase 4: Full Integration
- Multiple IFileSystem support
- Dynamic file system switching
- Advanced caching strategies

## Benefits of This Approach

1. **Reuse Existing Code**: Leverage all existing IFileSystem implementations
2. **Content Deduplication**: Automatic via SHA256 addressing
3. **Versioning**: Built into ONE.core's content-addressed model
4. **Multiple Views**: Different IFileSystem implementations can provide different views of the same data
5. **Cross-Platform**: IFileSystem works on all platforms, ProjFS provides native Windows experience

## Next Steps

1. Implement `IFileSystemToProjFSAdapter` class
2. Create caching layer for performance
3. Build path mapping system
4. Handle write operations and content updates
5. Test with existing IFileSystem implementations