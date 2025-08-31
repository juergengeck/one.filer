# Context Flow Analysis: one.filer to ProjFS

## Executive Summary
After analyzing the architecture and code flow from one.filer to ProjFS, I've identified several areas where context is being lost or not properly propagated between layers.

## Current Data Flow

### Layer Stack
1. **ONE Core Models** (LeuteModel, ChannelManager, etc.)
   ↓
2. **Virtual FileSystems** (ChatFileSystem, ObjectsFileSystem, etc.)
   ↓
3. **TemporaryFileSystem** (Router/Mounter)
   ↓
4. **CachedProjFSProvider** (TypeScript caching layer)
   ↓
5. **IFSProjFSProvider** (JavaScript wrapper)
   ↓
6. **Native C++ Module** (ifsprojfs_bridge.cpp, async_bridge.cpp)
   ↓
7. **Windows ProjFS**

## Missing Context Fields

### 1. FileInfo Structure Limitations
The current FileInfo structure passed from JavaScript to C++ only contains:
```cpp
struct FileInfo {
    std::string name;
    std::string hash;
    size_t size;
    bool isDirectory;
    bool isBlobOrClob;
    uint32_t mode;
};
```

**Missing fields that could improve context:**
- `mtime`, `atime`, `ctime` - File timestamps
- `uid`, `gid` - User/group ownership
- `permissions` - More granular permissions beyond mode
- `fileType` - Content type/MIME type for better handling
- `virtualPath` - Original virtual path before normalization
- `sourceFileSystem` - Which filesystem (chat, objects, etc.) owns this entry
- `metadata` - Extensible metadata object for filesystem-specific data

### 2. Directory Enumeration Context Loss

**Current Issue:** When enumerating directories, the context about which virtual filesystem is being accessed is lost after path normalization.

**Example:**
- Request: `C:\OneFiler\chats\channel-123`
- Normalized: `/chats/channel-123`
- Lost: Which specific ChatFileSystem instance and channel context

**Impact:** Cannot optimize caching or prefetching based on filesystem type.

### 3. Async to Sync Bridge Issues

**Problem Areas:**
1. **Pre-caching timing:** Cache population happens AFTER mount in some cases, causing empty directories
2. **Callback registration:** File content callbacks are set up but not always invoked with full context
3. **Error context:** Errors lose stack traces and original context when crossing the native boundary

### 4. Missing Model Context in Native Layer

The native C++ layer has no awareness of:
- Current user context (from LeuteModel)
- Active channels (from ChannelManager)
- Connection status (from ConnectionsModel)
- Topic subscriptions (from TopicModel)

This prevents intelligent caching decisions at the native level.

## Specific Context Propagation Issues

### Issue 1: File Content Request Context
**Location:** `CachedProjFSProvider.ts:294-310`
- File content is requested with only a path
- No context about why it's being requested (preview, full read, metadata check)
- No user context or permissions check

### Issue 2: Directory Listing Context
**Location:** `IFSProjFSProvider.js:172-219`
- `fetchDirectoryEntries()` doesn't pass:
  - Enumeration depth requested
  - Filter criteria
  - Sort order preference
  - Whether this is initial enumeration or refresh

### Issue 3: Cache Invalidation Context
**Location:** `CachedProjFSProvider.ts:241-249`
- Cache invalidation doesn't include:
  - Reason for invalidation
  - Scope of invalidation (single file vs directory tree)
  - Whether to cascade to child directories

### Issue 4: Mount Configuration Context
**Location:** `FilerWithProjFS.ts:96-105`
- Mount configuration doesn't propagate:
  - User preferences for caching
  - Filesystem-specific settings
  - Performance tuning parameters

## Recommendations

### 1. Extend FileInfo Structure
Add optional fields for richer context:
```typescript
interface ExtendedFileInfo {
    // Existing fields
    name: string;
    hash: string;
    size: number;
    isDirectory: boolean;
    mode: number;
    
    // New context fields
    timestamps?: {
        mtime: number;
        atime: number;
        ctime: number;
    };
    metadata?: {
        sourceFS: string;  // 'chat' | 'objects' | 'debug' | 'invites'
        contentType?: string;
        owner?: string;
        permissions?: string[];
        virtualPath?: string;
    };
}
```

### 2. Add Request Context Objects
Pass context through the layers:
```typescript
interface RequestContext {
    userId?: string;
    sessionId?: string;
    requestType: 'enumeration' | 'stat' | 'read' | 'write';
    depth?: number;
    filters?: string[];
    priority?: 'high' | 'normal' | 'low';
}
```

### 3. Implement Filesystem-Aware Caching
- Cache strategies per filesystem type
- ChatFileSystem: Cache recent conversations aggressively
- ObjectsFileSystem: Cache small files, stream large ones
- DebugFileSystem: No caching (always fresh)

### 4. Add Telemetry Context
Track request patterns for optimization:
```typescript
interface TelemetryContext {
    requestId: string;
    parentRequestId?: string;
    startTime: number;
    path: string;
    operation: string;
    result: 'success' | 'error' | 'cached';
}
```

## Implementation Priority

1. **High Priority** - Fix async/sync timing issues in cache population
2. **High Priority** - Add filesystem type context to all requests
3. **Medium Priority** - Extend FileInfo with timestamps and metadata
4. **Medium Priority** - Implement request context propagation
5. **Low Priority** - Add telemetry and performance monitoring

## Testing Recommendations

1. **Unit Tests**: Test context propagation at each layer boundary
2. **Integration Tests**: Verify context flows end-to-end
3. **Performance Tests**: Measure impact of context enrichment
4. **Stress Tests**: Ensure context doesn't leak memory under load

## Conclusion

The main issue is that context about the request origin, purpose, and user is progressively lost as requests move through the layers from ONE Core to ProjFS. By enriching the data structures and adding explicit context objects, we can make better caching decisions, provide more intelligent prefetching, and improve overall performance.