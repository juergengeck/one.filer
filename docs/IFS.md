# IFileSystem ProjFS N-API Bridge Design

## Overview

Create a native N-API module (`one.ifsprojfs`) that implements a ProjFS provider with built-in caching, designed to replace the complex 7-layer stack in one.filer and provide direct Windows filesystem integration for ONE content.

## Problem Statement

- ProjFS callbacks require synchronous responses
- IFileSystem operations are asynchronous
- Current one.filer implementation has 7 layers of abstraction due to historical evolution
- Need a clean, efficient bridge with minimal layers
- Must provide the same end-user experience: ONE content accessible via Windows Explorer

## Solution: Direct N-API Integration for one.filer

Create a native module that:
1. Implements ProjFS callbacks with synchronous responses
2. Maintains an intelligent cache for IFileSystem data
3. Integrates directly into one.filer's FilerWithProjFS
4. Handles async IFileSystem operations in the background
5. Provides direct disk access for BLOB/CLOB content

## Architecture in one.filer Context

### Current (7-layer stack):
```
Windows Explorer → ProjFS → projfs-fuse.one → FilerWithProjFS 
    → FuseApiToIFileSystemAdapter → IFileSystemToProjFSAdapter 
    → IFileSystem → ONE Models
```

### New (2-layer clean architecture):
```
┌─────────────────────────────────────────────────┐
│            Windows Explorer/Apps                 │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           Windows ProjFS API                     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│         one.filer (FilerWithProjFS)             │
│  ┌───────────────────────────────────────────┐  │
│  │   Uses one.ifsprojfs for ProjFS mode      │  │
│  │   - Direct integration                     │  │
│  │   - No FUSE emulation needed              │  │
│  └─────────────────┬─────────────────────────┘  │
└────────────────────┼────────────────────────────┘
                     │ Direct import
┌────────────────────▼────────────────────────────┐
│          one.ifsprojfs (N-API Module)           │
│  ┌─────────────────────────────────────────┐   │
│  │   Hybrid Approach:                       │   │
│  │   - Direct disk access for BLOBs/CLOBs  │   │
│  │   - JS callbacks for metadata           │   │
│  │   - Intelligent caching                 │   │
│  └─────────────────┬───────────────────────┘   │
└────────────────────┼────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│     IFileSystem Implementations                  │
│  (ChatFS, ObjectsFS, DebugFS, TypesFS, etc.)   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            ONE Models & Core                     │
└─────────────────────────────────────────────────┘
```

## Implementation in one.filer

```typescript
// one.filer/src/filer/FilerWithProjFS.ts

import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import { IFSProjFSProvider } from '@refinio/one.ifsprojfs';
import { CombinedFileSystem } from '@refinio/one.models/lib/fileSystems/CombinedFileSystem.js';

export class FilerWithProjFS {
    private projfsProvider: IFSProjFSProvider | null = null;
    private rootFileSystem: IFileSystem | null = null;
    
    async initProjFS(): Promise<void> {
        // Create combined filesystem with all components
        const fileSystems: IFileSystem[] = [
            new ChatFileSystem(this.models.leuteModel, this.models.topicModel, this.models.channelManager),
            new ObjectsFileSystem(),
            new DebugFileSystem(/* instance */),
            new TypesFileSystem(),
            new PairingFileSystem(this.models.iomManager)
        ];
        
        this.rootFileSystem = new CombinedFileSystem(fileSystems);
        
        // Create ProjFS provider with our clean architecture
        this.projfsProvider = new IFSProjFSProvider({
            instancePath: this.instanceDirectory,
            virtualRoot: this.config.projfsRoot || 'C:\\OneFiler',
            fileSystem: this.rootFileSystem,
            cacheTTL: 30
        });
        
        // Mount the filesystem
        await this.projfsProvider.mount();
        console.log(`ProjFS mounted at ${this.config.projfsRoot}`);
    }
    
    async shutdown(): Promise<void> {
        if (this.projfsProvider) {
            await this.projfsProvider.unmount();
            this.projfsProvider = null;
        }
    }
    
    getStats(): any {
        return this.projfsProvider?.getStats();
    }
}
```

## Native Module Design

### Core Components

```cpp
class ProjFSProvider {
private:
    // Cache for synchronous responses
    ContentCache cache_;
    
    // JavaScript callbacks (ThreadSafeFunction)
    Napi::ThreadSafeFunction getFileInfo_;
    Napi::ThreadSafeFunction readFile_;
    Napi::ThreadSafeFunction readDirectory_;
    
    // ProjFS context
    PRJ_NAMESPACE_VIRTUALIZATION_CONTEXT context_;
    
public:
    // Called from JavaScript
    void RegisterCallbacks(const Napi::Object& callbacks);
    void Start(const std::string& mountPoint);
    
    // ProjFS callbacks (must be synchronous)
    static HRESULT GetPlaceholderInfo(callbackData) {
        auto provider = static_cast<ProjFSProvider*>(callbackData->InstanceContext);
        
        // Try cache first
        auto cached = provider->cache_.GetFileInfo(path);
        if (cached) {
            return provider->ReturnPlaceholderInfo(cached);
        }
        
        // Cache miss - trigger async fetch
        provider->FetchFileInfoAsync(path);
        
        // Return "pending" for now
        return ERROR_IO_PENDING;
    }
};
```

### Caching Strategy

```cpp
class ContentCache {
private:
    struct CacheEntry {
        std::variant<FileInfo, DirectoryListing, FileContent> data;
        std::chrono::steady_clock::time_point timestamp;
        bool isValid() const {
            auto age = std::chrono::steady_clock::now() - timestamp;
            return age < std::chrono::seconds(30); // 30 second TTL
        }
    };
    
    std::unordered_map<std::string, CacheEntry> cache_;
    std::shared_mutex mutex_;
    
public:
    // Fast synchronous lookups
    std::optional<FileInfo> GetFileInfo(const std::string& path);
    std::optional<FileContent> GetFileContent(const std::string& path);
    
    // Background updates
    void UpdateFileInfo(const std::string& path, const FileInfo& info);
    void InvalidatePath(const std::string& path);
};
```

### Async Bridge

```cpp
void ProjFSProvider::FetchFileInfoAsync(const std::string& path) {
    // Call JavaScript async function
    getFileInfo_.NonBlockingCall([path](Napi::Env env, Napi::Function callback) {
        auto result = callback.Call({Napi::String::New(env, path)});
        
        // Result is a Promise - handle async
        auto promise = result.As<Napi::Promise>();
        promise.Then([this, path](const Napi::Value& value) {
            // Update cache with result
            auto info = ParseFileInfo(value);
            cache_.UpdateFileInfo(path, info);
            
            // Notify ProjFS that data is ready
            PrjFileNameCompare(context_, path.c_str());
        });
    });
}
```

## Usage in one.filer

```bash
# Start one.filer with ProjFS mode enabled
node lib/index.js start --secret "your-secret" --config config.json

# config.json:
{
  "useFiler": true,
  "filerConfig": {
    "useProjFS": true,
    "projfsRoot": "C:\\OneFiler",
    "projfsCacheSize": 104857600
  }
}
```

Users can then access ONE content directly through Windows Explorer at `C:\OneFiler`:
- `C:\OneFiler\chats\person@example.com\general\message1.txt`
- `C:\OneFiler\debug\connections.json`
- `C:\OneFiler\objects\[hash]\content`

## Benefits of This Approach

1. **Clean Architecture** - Only 2 layers instead of 7
2. **Reusable** - Any IFileSystem can be exposed via ProjFS
3. **Maintainable** - Clear separation between TypeScript and native code
4. **Performant** - Intelligent caching with background updates
5. **Type-safe** - Full TypeScript support in one.models

## Package Structure

```
one.ifsprojfs/
├── binding.gyp
├── package.json
├── src/
│   ├── projfs_provider.cpp      # Main provider implementation
│   ├── content_cache.cpp        # Caching layer
│   ├── async_bridge.cpp         # JavaScript callback handling
│   └── main.cpp                 # N-API exports
├── lib/
│   ├── index.d.ts              # TypeScript definitions
│   └── index.js                # JavaScript entry point
└── test/
    └── integration.test.ts
```

## Migration Path for one.filer

1. ✅ Implement one.ifsprojfs as standalone N-API module
2. Update FilerWithProjFS to use one.ifsprojfs instead of projfs-fuse.one
3. Test with all existing IFileSystem implementations
4. Update Electron app to use the simplified architecture
5. Deprecate and remove:
   - projfs-fuse.one (FUSE emulation layer)
   - FuseApiToIFileSystemAdapter
   - IFileSystemToProjFSAdapter
   - Complex adapter chains
6. Update documentation and examples

This design provides a clean, efficient bridge between IFileSystem and ProjFS without the historical baggage of the current implementation.