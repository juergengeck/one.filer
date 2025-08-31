# ONE.Filer Architecture

## Overview

ONE.Filer provides Windows filesystem access to ONE distributed content through Windows Projected File System (ProjFS). This document describes the complete architecture, component interactions, and data flow.

## System Architecture Layers

### Windows Native (ProjFS) Mode - Primary Architecture

```
┌─────────────────────────────────────┐
│     Windows Explorer / Apps         │  User Space
├─────────────────────────────────────┤
│    Windows File System APIs         │  Win32 API Layer
├─────────────────────────────────────┤
│  Windows Projected FS (ProjFS)      │  Kernel Driver
├─────────────────────────────────────┤
│   IFSProjFSProvider (Native C++)    │  Native Module
├─────────────────────────────────────┤
│   CachedProjFSProvider (ESM)        │  Caching Layer ⭐ NEW
├─────────────────────────────────────┤
│      TemporaryFileSystem            │  Router/Mounter
├─────────────────────────────────────┤
│   Specialized FileSystems           │  Domain Handlers
│  (Chat, Objects, Debug, etc.)       │
├─────────────────────────────────────┤
│        ONE Core Models              │  Business Logic
├─────────────────────────────────────┤
│     ONE Storage (CRDT/BLOBs)        │  Data Layer
└─────────────────────────────────────┘
```

## Critical Implementation Details

### ⚠️ ProjFS Callback Architecture - MUST READ

#### The Async Problem
ProjFS callbacks are **SYNCHRONOUS** - Windows expects immediate responses during enumeration. However, our filesystem backends are **ASYNCHRONOUS** (Promise-based). This creates a fundamental timing issue that MUST be handled correctly.

#### Solution: Pre-caching
1. **Before mounting**, pre-populate the cache with root directory entries
2. Use `setCachedDirectory` method in the native module to store directory listings
3. During enumeration, serve from cache instead of waiting for async operations
4. The IFSProjFSProvider.mount() method handles this automatically

#### Directory vs File Attributes - CRITICAL
**For entries to show as folders in Windows Explorer:**
1. `isDirectory` MUST be explicitly set to `true` in the FileInfo structure
2. If `isDirectory` is undefined, derive it from the mode: `(mode & 0xF000) === 0x4000`
3. Directory mode should be `16877` (0040755 octal) 
4. File mode should be `33188` (0100644 octal)
5. The filesystem.stat() may return mode without isDirectory - handle this!

### Common Pitfalls and Solutions

#### Issue: Folders appear as files in Windows Explorer
**Root Cause**: `isDirectory` property is undefined or false
**Where it happens**: filesystem.stat() returns {mode: 16877} but NOT {isDirectory: true}
**Solution**: 
```javascript
// In IFSProjFSProvider.js
let isDir = info.isDirectory;
if (isDir === undefined && info.mode) {
    isDir = (info.mode & 0xF000) === 0x4000;  // Check file type bits
}
```

#### Issue: Empty directory listings
**Root Cause**: Async callbacks not completing before ProjFS needs data
**Where it happens**: readDirectory returns Promise, but ProjFS can't wait
**Solution**: Pre-cache using setCachedDirectory before mount:
```javascript
async mount(mountPath) {
    const rootEntries = await this.readDirectory('/');
    this.provider.setCachedDirectory('/', rootEntries);
    return this.provider.start(mountPath);
}
```

#### Issue: Mount fails
**Common Causes**: 
- ProjFS not enabled in Windows Features
- Another instance already mounted at same path
- Permissions issue (needs admin for some operations)
**Solutions**: 
- Enable "Windows Projected File System" in Windows Features
- Kill existing processes: `wmic process where "name='electron.exe'" delete`
- Check mount path exists and is empty

## Component Responsibilities

### 1. Electron Application Layer

**main-native.ts**
- Entry point for Electron main process
- Manages application lifecycle
- Handles IPC communication with renderer
- Creates and manages Replicant instance
- System tray integration

**Replicant.js**
- Central orchestration component
- Initializes ONE Core with user secret
- Creates all ONE models (LeuteModel, ChannelManager, etc.)
- Conditionally starts FilerWithProjFS based on configuration
- Manages component lifecycle

### 2. ProjFS Integration Layer

**FilerWithProjFS.ts**
- Main integration point for Windows ProjFS
- Creates and manages CachedProjFSProvider
- Sets up root filesystem with mount points
- Handles initialization and shutdown

**CachedProjFSProvider.ts**
- Bridge between TypeScript and native module
- Manages path normalization (Windows → Unix style)
- Implements caching strategies
- Logs operations for debugging

### 3. Native Module Layer (one.ifsprojfs)

**IFSProjFSProvider.js (JavaScript Wrapper)**
- Provides JavaScript API for native module
- Handles async → sync conversion
- Pre-caches directory entries
- Normalizes paths and file info structures

**ifsprojfs_bridge.cpp**
- Node.js N-API bindings
- Marshals data between JavaScript and C++
- Manages callback registration
- Thread-safe operations

**projfs_provider.cpp**
- Direct ProjFS API implementation
- Handles Windows virtualization callbacks
- Manages enumeration state
- File metadata provisioning

**async_bridge.cpp**
- Converts async JavaScript callbacks to sync C++ operations
- Manages cross-thread communication
- Implements caching for directory listings

### 4. Virtual Filesystem Layer

**TemporaryFileSystem**
- Root filesystem that mounts other filesystems
- Routes requests to appropriate sub-filesystem
- Manages mount points (/chats, /objects, /debug, /invites)

**Specialized FileSystems**
- ChatFileSystem: Chat messages and channels
- ObjectsFileSystem: Binary object storage
- DebugFileSystem: System diagnostics
- PairingFileSystem: Invitation handling

### 5. ONE Core Layer

**Models**
- LeuteModel: User and group management
- ChannelManager: Communication channels
- ConnectionsModel: P2P connections
- TopicModel: Topic-based messaging

**Storage**
- CRDT-based distributed storage
- Content-addressed object store
- Cryptographic verification
- P2P synchronization

## Data Flow

### Mount Sequence
1. User logs in via Electron UI
2. Replicant.start() initializes ONE Core
3. FilerWithProjFS.init() called if useProjFS=true
4. CachedProjFSProvider created with filesystem reference
5. IFSProjFSProvider native module loaded
6. Root directory pre-cached via setCachedDirectory
7. ProjFS mount initiated at C:\OneFiler
8. Windows recognizes virtual filesystem

### File Access Flow
1. Windows Explorer accesses C:\OneFiler\chats
2. ProjFS calls GetFileInfo callback
3. Native module checks cache or calls JavaScript
4. CachedProjFSProvider normalizes path
5. Request routed to ChatFileSystem
6. Data retrieved from ONE Core models
7. FileInfo returned to ProjFS
8. Windows displays folder/file

## Build and Deployment

### Package Structure
```
one.filer/
├── package.json                    # Main project
├── vendor/                         # Prebuilt packages
│   └── refinio-one.ifsprojfs-X.Y.Z.tgz
├── one.ifsprojfs/                  # Native module source
│   ├── src/                        # C++ source
│   ├── package.json               # Module package
│   └── binding.gyp                # Build configuration
└── electron-app/
    ├── package.json               # Electron app
    └── webpack.config.native.js   # Build config
```

### Build Process
1. Build native module:
   ```bash
   cd one.ifsprojfs
   npm install && npm run build
   npm pack  # Creates versioned .tgz
   mv *.tgz ../vendor/
   ```

2. Update package references:
   ```json
   "@refinio/one.ifsprojfs": "file:./vendor/refinio-one.ifsprojfs-X.Y.Z.tgz"
   ```

3. Build main project:
   ```bash
   npm install
   npm run build
   ```

4. Build Electron app:
   ```bash
   cd electron-app
   npm install
   npm run build:native
   ```

### Version Management
- Use semantic versioning (1.0.0, 1.0.1, 1.0.2)
- Never use suffixes like -fixed, -complete
- Store all versions in vendor/ for rollback
- Update both package.json files when upgrading

## Testing Strategy

### Unit Testing Sequence
1. **Native Module Loading**
   - Verify module exports IFSProjFSProvider
   - Check method availability

2. **Callback Registration**
   - Register all required callbacks
   - Verify callback invocation

3. **Mount Operation**
   - Create test mount point
   - Start provider
   - Verify mount success

4. **Directory Enumeration**
   - List root directory
   - Verify entries returned
   - Check isDirectory flags

5. **File vs Directory Display**
   - Use fs.statSync to verify types
   - Check Windows Explorer display

### Debug Techniques
- Enable debug logging in all components
- Check projfs-operations.log for native operations
- Use Process Monitor to trace Windows filesystem calls
- Test with minimal reproducible examples

## Security Considerations

- ProjFS runs in kernel mode - bugs can cause BSOD
- Validate all paths to prevent directory traversal
- Never expose user secrets in virtual files
- Implement proper access controls
- Sanitize filenames for Windows compatibility

## Performance Optimizations

- Pre-cache frequently accessed directories
- Implement TTL-based cache invalidation
- Batch directory enumeration requests
- Use synchronous operations where possible
- Minimize cross-thread communication

## Known Limitations

- ProjFS requires Windows 10 1809 or later
- Cannot handle symbolic links
- File locks not fully supported
- Maximum path length restrictions apply
- Some applications may not work with virtual files

## Future Improvements

- Implement write support for virtual files
- Add file watching and change notifications
- Support for extended attributes
- Better error handling and recovery
- Performance metrics and monitoring