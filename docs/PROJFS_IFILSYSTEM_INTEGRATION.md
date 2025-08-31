# ProjFS IFileSystem Integration

## Overview

The ProjFS implementation has been updated to use IFileSystem callbacks instead of direct disk storage for most operations. This provides a hybrid approach:

1. **IFileSystem Callbacks**: Used for metadata, directory listings, and non-BLOB/CLOB file content
2. **Direct Disk Access**: Still used for BLOB/CLOB objects in the `/objects` path for performance

## Architecture

### JavaScript Layer (IFSProjFSProvider.js)
- Registers callbacks with the native module
- Implements `getFileInfo`, `readFile`, `readDirectory` methods
- Routes requests to IFileSystem for non-/objects paths
- Returns null for /objects paths to let native code handle them

### Native C++ Layer
- Uses a content cache to store results from JavaScript callbacks
- Falls back to direct disk access for /objects paths
- Implements async bridge for non-blocking JavaScript calls

### Key Changes

1. **projfs_provider.cpp**:
   - Modified `GetPlaceholderInfoCallback` to check cache first
   - Updated `GetFileDataCallback` to use cached content
   - Enhanced `GetDirectoryEnumerationCallback` to use cached listings
   - Falls back to SyncStorage for /objects paths

2. **IFSProjFSProvider.js**:
   - Updated callbacks to properly route between IFileSystem and disk
   - Special handling for root directory listing
   - Detection of BLOB/CLOB paths for direct disk access

## Usage

```javascript
const { IFSProjFSProvider } = require('@refinio/one.ifsprojfs');
const fileSystem = /* your IFileSystem implementation */;

const provider = new IFSProjFSProvider({
    instancePath: '/path/to/one/instance',
    virtualRoot: 'C:\\OneFiler',
    fileSystem: fileSystem,
    cacheTTL: 30  // Cache TTL in seconds
});

await provider.mount();
```

## Testing

Run the test script to verify the implementation:

```bash
node test-ifsprojfs-callbacks.js
```

This will:
1. Create a mock IFileSystem
2. Mount it at C:\OneFilerTest
3. Log all IFileSystem method calls
4. Allow you to test file access through Windows Explorer

## Performance Considerations

- The cache helps reduce round-trips to JavaScript
- BLOB/CLOB objects still use direct disk access for performance
- Async callbacks allow non-blocking operation
- Cache TTL can be configured based on your needs