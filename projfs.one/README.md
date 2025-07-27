# projfs.one

Windows ProjectedFS provider for ONE.core content-addressed storage.

## Overview

ProjFS.ONE enables Windows applications to transparently access content stored in ONE.core's content-addressed storage system through Windows Explorer and any Windows application. It uses Windows ProjectedFS (ProjFS) to create a virtual filesystem that maps to ONE.core's IFileSystem abstraction.

This package is designed to integrate seamlessly with the ONE ecosystem, including:
- **one.core** - Content-addressed storage engine
- **one.models** - Filesystem abstractions and models
- **one.filer** - Complete filesystem implementation
- **one.leute.replicant** - Multi-device synchronization

### Key Features

- **Native Windows Integration**: Access ONE.core content through Windows Explorer
- **Transparent Access**: Any Windows application can read/write files without modification
- **High Performance**: Intelligent caching and chunked reading for large files
- **Content-Addressed Storage**: All content is stored with SHA256 hash verification
- **CRDT-based Versioning**: Built on ONE.core's conflict-free replicated data types
- **No WSL/FUSE Required**: Direct Windows kernel integration via ProjectedFS
- **Full ONE Stack Support**: Integrates with one.filer for complete functionality

## Architecture

### Standalone Mode
```
Windows Application (Explorer, Office, etc.)
              ↓
      ProjFS Driver (Windows Kernel)
              ↓
      projfs.one (Node-API)
              ↓
         IFileSystem
              ↓
   Content-Addressed Storage
```

### Full Stack Integration
```
Windows Application (Explorer, Office, etc.)
              ↓
      ProjFS Driver (Windows Kernel)
              ↓
        projfs.one
              ↓
        one.filer
              ↓
       one.models
              ↓
        one.core
              ↓
   Content-Addressed Storage
```

## Features

- **Native Windows Integration**: Direct integration with Windows filesystem
- **On-Demand Hydration**: Files are fetched only when accessed
- **Content-Addressed Storage**: Deduplication via SHA256 hashing
- **CRDT Synchronization**: Conflict-free replicated data types for multi-device sync
- **High Performance**: Optimized caching and direct I/O
- **Application Compatibility**: Works with all Windows applications

## Requirements

- Windows 10 version 1809 or later (with ProjFS support)
- Node.js 20.0.0 or later
- Visual Studio 2019 or later (for native module compilation)
- Windows SDK with ProjectedFS headers

## Installation

```bash
# Install dependencies
npm install

# Build native module and TypeScript
npm run build

# Run tests
npm test
```

## Quick Start

### Basic Usage

```typescript
import { ProjFSProvider } from 'projfs.one';
import { createFileSystem } from '@refinio/one.core';

// Create your IFileSystem implementation
const fileSystem = await createFileSystem();

// Create and start the provider
const provider = new ProjFSProvider(fileSystem, {
    logLevel: 'info',
    cacheSize: 100 * 1024 * 1024 // 100MB
});

await provider.start(null, {
    virtualizationRootPath: 'C:\\MyVirtualDrive'
});

console.log('Virtual filesystem running at C:\\MyVirtualDrive');

// Access stats
const stats = provider.getStats();
console.log(`Files accessed: ${stats.fileDataRequests}`);

// Stop when done
await provider.stop();
```

### Full Stack Integration with one.filer

```typescript
import { OneFilerProvider } from 'projfs.one';

// Create provider with complete ONE stack
const provider = await OneFilerProvider.createWithDefaults(
    './one-data',                    // Data directory
    process.env.ONE_SECRET,          // Encryption secret
    {
        virtualizationRoot: 'C:\\OneFiler',
        communicationUrl: 'https://comm.one-dragon.com',
        logLevel: 'info'
    }
);

// Virtual drive is now available at C:\OneFiler with full ONE features:
// - /chats     - Encrypted chat conversations
// - /debug     - System diagnostics
// - /invites   - Pairing invitations  
// - /objects   - Raw content-addressed objects
// - /types     - Type definitions
```

### Windows Quick Launch

For Windows users, use the provided launcher scripts:

```cmd
# Command Prompt
start-one-filer.cmd

# PowerShell
.\start-one-filer.ps1
```

## Configuration

### Provider Options

```typescript
interface ProviderOptions {
    // Logging level
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    
    // Cache size in bytes (default: 100MB)
    cacheSize?: number;
}
```

### ProjFS Start Options

```typescript
interface ProjFSOptions {
    // Required: Path where virtual filesystem will be mounted
    virtualizationRootPath: string;
    
    // Number of threads in the pool (default: 4)
    poolThreadCount?: number;
    
    // Max concurrent threads (0 = automatic)
    concurrentThreadCount?: number;
    
    // Enable negative path caching for performance
    enableNegativePathCache?: boolean;
}
```

## Development

### Building from Source

```bash
# Clean previous builds
npm run clean

# Build native module
npm run build:native

# Build TypeScript
npm run build:ts

# Watch mode for development
npm run dev
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# All tests
npm test
```

### Project Structure

```
projfs.one/
├── src/
│   ├── native/          # C++ Node-API wrapper
│   ├── provider/        # TypeScript ProjFS provider
│   ├── integration/     # ONE.filer integration
│   ├── cache/          # Caching layer
│   └── utils/          # Utilities
├── test/               # Test suites
├── examples/           # Example usage
├── binding.gyp         # Native module build config
└── dist/              # Compiled output
```

## API Reference

### ProjFSProvider

Main class for managing the projected filesystem.

```typescript
class ProjFSProvider {
    constructor(
        fileSystem: IFileSystem,
        options?: {
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
            cacheSize?: number; // bytes, default 100MB
        }
    );
    
    // Start the virtual filesystem
    async start(callbacks: ProjFSCallbacks | null, options: ProjFSOptions): Promise<void>;
    
    // Stop the virtual filesystem
    async stop(): Promise<void>;
    
    // Check if running
    isRunning(): boolean;
    
    // Get statistics
    getStats(): ProviderStats;
    
    // Create with ONE.core integration
    static async createWithOneCore(
        oneCore: any,
        options?: {
            virtualizationRoot: string;
            fileSystemType?: string;
            logLevel?: string;
            cacheSize?: number;
        }
    ): Promise<ProjFSProvider>;
}
```

### OneFilerProvider

Integration class for using projfs.one with the complete ONE stack.

```typescript
class OneFilerProvider {
    // Create with default configuration
    static async createWithDefaults(
        directory: string,
        secret: string,
        options?: {
            virtualizationRoot?: string;
            communicationUrl?: string;
            logLevel?: 'debug' | 'info' | 'warn' | 'error';
        }
    ): Promise<OneFilerProvider>;
    
    // Initialize the stack
    async initialize(secret: string): Promise<void>;
    
    // Get statistics
    getStats(): {
        projfs: ProviderStats;
        oneFiler: { filesystemType: string; cacheSize: number; };
    };
    
    // Check if running
    isRunning(): boolean;
    
    // Shutdown
    async shutdown(): Promise<void>;
}
```

### Callbacks

ProjFS callbacks implemented by the provider:

- `onGetPlaceholderInfo`: Provides file/directory metadata
- `onGetFileData`: Streams file content on demand
- `onNotifyFileHandleClosedFileModified`: Handles file modifications
- `onGetDirectoryEnumeration`: Lists directory contents

## Performance

Optimized for:
- Fast directory enumeration (< 100ms for 1000 entries)
- Low-latency file access (< 20ms open time)
- High throughput (> 100MB/s sequential read)
- Efficient caching with LRU eviction

## Integration with ONE Ecosystem

ProjFS.ONE is designed to work seamlessly with the entire ONE ecosystem:

### Using with one.filer

```javascript
// In your one.filer configuration
{
    "mountPoint": "/mnt/one-files",     // For FUSE mode (Linux/WSL)
    "useProjFS": true,                  // Enable ProjFS on Windows
    "projfsRoot": "C:\\OneFiler",       // Windows virtual drive location
    "projfsCacheSize": 104857600        // 100MB cache
}
```

### Migration from FUSE

For existing one.filer users on Windows:

1. **Before (WSL2 + FUSE)**:
   ```
   Windows Explorer → \\wsl$\Ubuntu\home\user\one-files → FUSE → one.filer
   ```

2. **After (Native ProjFS)**:
   ```
   Windows Explorer → C:\OneFiler → ProjFS → projfs.one → one.filer
   ```

Benefits:
- 10x faster file access
- No WSL2 memory overhead
- Native Windows file operations
- Better application compatibility

## Troubleshooting

### Common Issues

1. **"ProjFS not available"**
   - Ensure Windows 10 1809+ or Windows 11
   - Enable optional Windows feature: "Windows Projected File System"
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
   ```

2. **"Failed to start virtualization"**
   - Check if virtual root path is valid
   - Ensure no other application is using the path
   - Run with administrator privileges if needed

3. **"Build errors with native module"**
   - Install Visual Studio with C++ workload
   - Install Windows SDK
   - Run `npm run build:native` separately

4. **"Native module not loaded"**
   - This is normal when running on non-Windows platforms
   - The module includes a mock fallback for development
   - Full functionality requires Windows

## Examples

The `examples/` directory contains several demonstrations:

- **basic-mount.ts** - Simple virtual filesystem with mock data
- **one-core-integration.ts** - Integration with ONE.core
- **integration-demo.ts** - Architecture demonstration
- **full-stack-integration.ts** - Complete ONE ecosystem integration
- **dev-demo.ts** - Development mode without native dependencies

Run examples:
```bash
npm run build:ts
node dist/examples/integration-demo.js
```

## Related Projects

- [one.core](https://github.com/refinio/one.core) - Content-addressed storage engine
- [one.models](https://github.com/refinio/one.models) - Filesystem abstractions
- [one.filer](https://github.com/refinio/one.filer) - Complete filesystem implementation
- [one.leute.replicant](https://github.com/refinio/one.leute.replicant) - Multi-device sync

## License

MIT License - see LICENSE file for details.

## Contributing

See CONTRIBUTING.md for guidelines on contributing to this project.

## Support

For issues and feature requests, please use the GitHub issue tracker.

For ONE ecosystem support, visit [refinio.com](https://refinio.com).