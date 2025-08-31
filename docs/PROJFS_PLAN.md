# ProjectedFS Integration Plan for ONE.filer

## Overview

We're pivoting from the WSL/FUSE approach to a native Windows solution using ProjectedFS (ProjFS). This will provide better performance, native Windows integration, and eliminate WSL dependencies.

## Architecture

### Current State (WSL/FUSE)
```
Windows Explorer → WSL$ share → WSL2 → FUSE → ONE.core
```

### Target State (ProjectedFS)
```
Windows Explorer → ProjFS Driver → projfs.one → ONE.core
```

## Package Structure: projfs.one

```
projfs.one/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Main entry point
│   ├── native/                     # Node-API wrapper
│   │   ├── binding.gyp
│   │   ├── projfs_wrapper.cpp
│   │   ├── projfs_wrapper.h
│   │   └── callbacks.cpp
│   ├── provider/                   # TypeScript ProjFS provider
│   │   ├── ProjFSProvider.ts
│   │   ├── ContentAddressedFS.ts
│   │   └── FileSystemMapper.ts
│   ├── integration/                # ONE.core integration
│   │   ├── OneCoreBridge.ts
│   │   ├── ContentStore.ts
│   │   └── MetadataStore.ts
│   ├── cache/                      # Performance optimization
│   │   ├── PathCache.ts
│   │   ├── ContentCache.ts
│   │   └── CacheManager.ts
│   └── utils/
│       ├── PathUtils.ts
│       ├── HashUtils.ts
│       └── Logger.ts
├── test/
│   ├── unit/
│   ├── integration/
│   └── performance/
└── examples/
    └── basic-mount.ts
```

## Implementation Phases

### Phase 1: Native Wrapper Foundation (Week 1)
1. Set up projfs.one package structure
2. Create Node-API wrapper for ProjectedFSLib.dll
3. Implement basic ProjFS callbacks in C++
4. Thread-safe callback marshaling to JavaScript
5. Basic TypeScript bindings

### Phase 2: ONE.core Integration (Week 2)
1. Design interface between ProjFS and ONE.core
2. Map ONE.core objects to virtual filesystem paths
3. Implement content-addressed file retrieval
4. Handle file modifications and new content storage
5. Metadata synchronization

### Phase 3: Core Provider Implementation (Week 3)
1. Implement ProjFSProvider interface
2. Directory enumeration from ONE.core
3. File placeholder creation
4. On-demand content hydration
5. File modification handling

### Phase 4: Performance Optimization (Week 4)
1. Implement caching layers
2. Optimize callback response times
3. Memory-mapped file support for large files
4. Batch operations for efficiency
5. Performance benchmarking

### Phase 5: Migration & Testing (Week 5)
1. Migration path from FUSE/WSL
2. Comprehensive test suite
3. Windows Explorer integration testing
4. Application compatibility testing
5. Documentation and examples

## Key Design Decisions

### 1. Content Addressing
- Use ONE.core's existing SHA256 content addressing
- Map virtual paths to content hashes via CRDT
- Store file blocks in ONE.core's object store

### 2. Path Mapping Strategy
```
Virtual Path: C:\MyOneDrive\documents\report.pdf
→ ONE.core Path: /files/documents/report.pdf
→ Content Hash: sha256:abc123...
→ Object Store: data/objects/ab/c123...
```

### 3. Callback Implementation
- All ProjFS callbacks implemented in C++
- Thread-safe marshaling to JavaScript
- Async/await support in TypeScript layer
- Error handling and recovery

### 4. Caching Strategy
- LRU cache for path→hash mappings
- Content block cache for frequently accessed files
- Directory enumeration cache
- Write-through cache for modifications

### 5. File Modification Handling
- Detect modifications via ProjFS notifications
- Compute new content hash
- Store in ONE.core object store
- Update CRDT with new mapping
- Trigger sync to other devices

## Integration Points

### ONE.core Integration
```typescript
interface OneCoreBridge {
  // Get file metadata and content hash
  getFileInfo(path: string): Promise<FileInfo>;
  
  // Read file content by hash
  readContent(hash: string, offset: number, length: number): Promise<Buffer>;
  
  // Store modified file content
  storeContent(path: string, content: Buffer): Promise<string>;
  
  // Enumerate directory contents
  listDirectory(path: string): Promise<DirectoryEntry[]>;
}
```

### ProjFS Provider Interface
```typescript
class OneFilerProjFSProvider implements IProjFSProvider {
  constructor(
    private oneCore: OneCoreBridge,
    private virtualRoot: string,
    private cache: CacheManager
  ) {}
  
  async onGetPlaceholderInfo(relativePath: string): Promise<PlaceholderInfo> {
    const fileInfo = await this.oneCore.getFileInfo(relativePath);
    return {
      fileSize: fileInfo.size,
      creationTime: fileInfo.createdAt,
      lastWriteTime: fileInfo.modifiedAt,
      fileAttributes: this.mapAttributes(fileInfo.attributes)
    };
  }
  
  async onGetFileData(
    relativePath: string,
    byteOffset: bigint,
    length: number
  ): Promise<Buffer> {
    const fileInfo = await this.cache.getFileInfo(relativePath);
    return await this.oneCore.readContent(
      fileInfo.contentHash,
      Number(byteOffset),
      length
    );
  }
}
```

## Performance Requirements

### Target Metrics
- Callback response time: < 50ms (p95)
- Directory enumeration: < 100ms for 1000 entries
- File open latency: < 20ms
- Sequential read: > 100MB/s
- Random read: > 50MB/s

### Optimization Strategies
1. **Aggressive Caching**: Cache everything possible
2. **Prefetching**: Predict and preload likely accesses
3. **Batch Operations**: Group related operations
4. **Direct I/O**: Bypass unnecessary copies
5. **Worker Threads**: Offload heavy operations

## Migration Strategy

### From FUSE/WSL to ProjFS
1. **Parallel Operation**: Run both systems initially
2. **Data Migration**: Ensure all data accessible via both
3. **Gradual Cutover**: Switch users progressively
4. **Fallback Plan**: Keep WSL/FUSE as backup option

### Configuration Changes
```json
{
  "filer": {
    "type": "projfs",  // was: "fuse"
    "projfs": {
      "virtualRoot": "C:\\OneFiler",
      "cacheSize": "1GB",
      "prefetchStrategy": "adaptive"
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Native wrapper functionality
- Provider callback implementations
- Cache behavior
- Path mapping logic

### Integration Tests
- ONE.core integration
- File operations (CRUD)
- Directory operations
- Large file handling
- Concurrent access

### System Tests
- Windows Explorer integration
- Office application compatibility
- Performance benchmarks
- Stress testing

## Security Considerations

1. **Path Validation**: Prevent directory traversal attacks
2. **Content Verification**: Verify hashes before serving
3. **Access Control**: Respect ONE.core permissions
4. **Process Isolation**: Run with minimal privileges
5. **Audit Logging**: Track all file operations

## Development Timeline

- **Week 1**: Native wrapper and basic callbacks
- **Week 2**: ONE.core integration layer
- **Week 3**: Full provider implementation
- **Week 4**: Performance optimization
- **Week 5**: Testing and migration tools
- **Week 6**: Documentation and deployment

## Next Steps

1. Create projfs.one package structure
2. Set up development environment for native modules
3. Implement basic Node-API wrapper
4. Create simple proof-of-concept
5. Begin ONE.core integration design