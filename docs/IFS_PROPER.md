# IFileSystem to ProjFS Bridge - Proper Design

## Correct Understanding

The goal is to expose ONE's **logical content** (chats, files, topics) through ProjFS, not the raw object storage. Users should see:
- `/chats/person@example.com/general/message1.txt`
- `/files/documents/report.pdf`
- `/debug/connections.json`

NOT:
- `/objects/2187a73204a12a130375be7a7ee5c2d95bab46ecdd7f272d80436c816bc084e1`

## The Challenge

1. **ProjFS requires synchronous callbacks** - Must return data immediately
2. **ONE's APIs are all async** - Database queries, CRDT merging, permission checks
3. **Content is dynamic** - Chat messages arrive, files are added/modified
4. **Write operations** - Must go through ONE's proper APIs for CRDT updates

## Solution: Hybrid Sync/Async Bridge

```
┌─────────────────────────────────────────────────┐
│            Windows Applications                  │
│         (Explorer, VS Code, etc.)                │
└────────────────────┬────────────────────────────┘
                     │ File I/O
┌────────────────────▼────────────────────────────┐
│              Windows ProjFS                      │
│         (Requires sync callbacks)                │
└────────────────────┬────────────────────────────┘
                     │ Sync callbacks
┌────────────────────▼────────────────────────────┐
│          one.ifsprojfs (N-API)                  │
│  ┌─────────────────────────────────────────┐   │
│  │   Sync Cache Layer (C++)                │   │
│  │   - In-memory content cache             │   │
│  │   - Metadata cache                      │   │
│  │   - Directory structure cache           │   │
│  └─────────────────┬───────────────────────┘   │
│                    │                            │
│  ┌─────────────────▼───────────────────────┐   │
│  │   Async Bridge (C++ with libuv)         │   │
│  │   - Background content fetching         │   │
│  │   - Write queue processing              │   │
│  │   - Change notifications               │   │
│  └─────────────────┬───────────────────────┘   │
└────────────────────┼────────────────────────────┘
                     │ Async calls
┌────────────────────▼────────────────────────────┐
│            IFileSystem (TypeScript)             │
│      ChatFileSystem, TopicFileSystem, etc.      │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               ONE.models                         │
│    ChannelManager, LeuteModel, TopicModel       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               ONE.core                           │
│        CRDT, Storage, Permissions                │
└─────────────────────────────────────────────────┘
```

## Implementation Strategy

### 1. Proactive Cache Population

```cpp
class ContentCache {
    // Pre-fetch common paths
    void Initialize(Napi::Env env) {
        // Call IFileSystem.readDir("/chats") asynchronously
        // Cache results for immediate sync access
        PreFetchDirectory("/chats");
        PreFetchDirectory("/debug");
        PreFetchDirectory("/types");
    }
    
    // Background refresh
    void StartBackgroundRefresh() {
        // Refresh cache every N seconds
        // Listen for ONE change events
    }
};
```

### 2. Sync Callbacks with Cached Data

```cpp
HRESULT GetFileDataCallback(callbackData) {
    std::string path = ToUtf8(callbackData->FilePathName);
    
    // Try cache first (immediate return)
    auto cached = cache.GetContent(path);
    if (cached) {
        return WriteDataToProjFS(cached);
    }
    
    // Cache miss - return empty/placeholder
    // Trigger async fetch for next time
    TriggerAsyncFetch(path);
    return ERROR_FILE_NOT_FOUND;
}
```

### 3. Async Bridge to IFileSystem

```cpp
class AsyncBridge {
    Napi::ThreadSafeFunction readFileAsync;
    Napi::ThreadSafeFunction readDirAsync;
    
    void FetchContent(std::string path) {
        // Call IFileSystem.readFile() asynchronously
        readFileAsync.BlockingCall([path](Napi::Env env, Napi::Function callback) {
            // This runs in JS thread
            auto result = callback.Call({Napi::String::New(env, path)});
            // Store result in cache
        });
    }
};
```

### 4. Write Operations Queue

```cpp
class WriteQueue {
    std::queue<WriteOperation> pending;
    
    void QueueWrite(std::string path, std::vector<uint8_t> data) {
        // ProjFS callback returns immediately
        pending.push({path, data});
        
        // Process asynchronously
        ProcessWriteAsync();
    }
    
    void ProcessWriteAsync() {
        // Call IFileSystem.createFile() or updateFile()
        // Handle CRDT updates properly
    }
};
```

## Key Components

### Native Module Structure

```
one.ifsprojfs/
├── src/
│   ├── content_cache.h          # In-memory cache
│   ├── content_cache.cpp        
│   ├── async_bridge.h           # JS callback bridge
│   ├── async_bridge.cpp
│   ├── write_queue.h            # Async write handling
│   ├── write_queue.cpp
│   ├── projfs_provider.h        # ProjFS integration
│   ├── projfs_provider.cpp
│   └── main.cpp                 # N-API exports
```

### TypeScript Interface

```typescript
export class IFSProjFS {
    constructor(
        private ifs: IFileSystem,
        private options: {
            cacheSize?: number;
            refreshInterval?: number;
            prefetchPaths?: string[];
        }
    ) {}
    
    async start(mountPoint: string): Promise<void> {
        // Initialize native module with IFileSystem callbacks
        this.native = new NativeProjFS({
            readFile: this.ifs.readFile.bind(this.ifs),
            readDir: this.ifs.readDir.bind(this.ifs),
            createFile: this.ifs.createFile.bind(this.ifs),
            // ... other operations
        });
        
        // Pre-populate cache
        await this.preFetchCommonPaths();
        
        // Start ProjFS
        await this.native.start(mountPoint);
    }
}
```

## Cache Strategy

### What to Cache

1. **Directory Structure** - Full tree of directories
2. **File Metadata** - Size, type, permissions
3. **Recent File Content** - LRU cache of file data
4. **Hot Paths** - Frequently accessed content

### Cache Invalidation

1. **Time-based** - Refresh every N seconds
2. **Event-based** - Listen to ONE change events
3. **Write-through** - Update cache on writes
4. **Size-limited** - LRU eviction

## Write Handling

Since ProjFS callbacks must return synchronously but ONE writes are async:

1. **Accept writes immediately** - Return success to ProjFS
2. **Queue for processing** - Store in write queue
3. **Process asynchronously** - Call IFileSystem.createFile()
4. **Handle conflicts** - CRDT merge if needed
5. **Update cache** - Reflect new content

## Example Usage

```typescript
import { IFSProjFS } from '@refinio/one.ifsprojfs';
import { ChatFileSystem } from '@refinio/one.models/lib/fileSystems/ChatFileSystem.js';

// Create filesystem
const chatFS = new ChatFileSystem(leuteModel, topicModel, channelManager);

// Create ProjFS bridge
const projfs = new IFSProjFS(chatFS, {
    cacheSize: 100 * 1024 * 1024, // 100MB
    refreshInterval: 5000, // 5 seconds
    prefetchPaths: ['/chats', '/debug']
});

// Start projection
await projfs.start('C:\\OneFiler');

// Now C:\OneFiler shows chat content, not raw objects!
```

## Benefits

1. **Proper ONE Integration** - Uses IFileSystem, respects permissions
2. **Dynamic Content** - Shows live chat messages, updated files
3. **Write Support** - Can create/modify content through ONE
4. **Performance** - Cache provides fast sync responses
5. **Compatibility** - Works with existing IFileSystem implementations

## Challenges & Solutions

### Challenge: Initial Cache Miss
**Solution**: Pre-fetch common directories on startup

### Challenge: Large Files  
**Solution**: Stream in chunks, cache only active portions

### Challenge: Write Latency
**Solution**: Optimistic updates in cache, queue for actual write

### Challenge: Change Notifications
**Solution**: Subscribe to ONE events, update cache proactively

This is the correct approach - bridging between ONE's async content APIs and ProjFS's sync requirements while maintaining proper data flow through ONE's systems.