# ONE.filer + ProjFS.ONE Integration Guide

This guide explains how to integrate the complete ONE ecosystem stack with native Windows support using ProjectedFS.

## Architecture Overview

```
Windows Explorer
    ↓
ProjectedFS (Windows Native API)
    ↓
projfs.one (ProjFS Provider)
    ↓
one.filer (Filesystem Implementation)
    ↓
one.models (Filesystem Abstractions)
    ↓
one.core (Content-Addressed Storage)
```

## Benefits of ProjFS Integration

- **Native Windows Performance**: No WSL2/FUSE overhead
- **Seamless Integration**: Appears as a regular Windows drive
- **Lazy Loading**: Files loaded on-demand
- **Intelligent Caching**: LRU cache for frequently accessed content
- **Full ONE Features**: All ONE.core capabilities available

## Quick Start

### 1. Install Dependencies

```bash
# In the projfs.one directory
npm install

# Build the native module (Windows only)
npm run build:native

# Build TypeScript
npm run build:ts
```

### 2. Run with Default Configuration

```cmd
# Simple startup (Windows)
start-one-filer.cmd

# Or with PowerShell
.\start-one-filer.ps1
```

### 3. Environment Configuration

Set these environment variables for custom configuration:

```powershell
# ONE.core data directory
$env:ONE_DIRECTORY = "C:\Users\YourName\.one-data"

# Secret for encryption (use a secure value in production)
$env:ONE_SECRET = "your-secure-secret-here"

# Virtual drive location
$env:PROJFS_ROOT = "C:\OneFiler"

# Communication server
$env:ONE_COMM_URL = "https://comm.one-dragon.com"

# Log level (debug, info, warn, error)
$env:LOG_LEVEL = "info"
```

## Integration Modes

### Mode 1: Direct ProjFS Provider

Use when you have an existing IFileSystem implementation:

```typescript
import { ProjFSProvider } from 'projfs.one';

const fileSystem = /* your IFileSystem */;
const provider = new ProjFSProvider(fileSystem, {
    logLevel: 'info',
    cacheSize: 100 * 1024 * 1024 // 100MB
});

await provider.start(null, {
    virtualizationRootPath: 'C:\\MyVirtualDrive',
    poolThreadCount: 4,
    enableNegativePathCache: true
});
```

### Mode 2: OneFiler Integration

Complete ONE stack integration:

```typescript
import { OneFilerProvider } from 'projfs.one';

const provider = await OneFilerProvider.createWithDefaults(
    './one-data',           // Data directory
    'my-secret',           // Encryption secret
    {
        virtualizationRoot: 'C:\\OneFiler',
        communicationUrl: 'https://comm.one-dragon.com',
        logLevel: 'info'
    }
);

// Virtual drive is now available at C:\OneFiler
```

### Mode 3: Enhanced Filer with ProjFS

Use the enhanced Filer class that supports both FUSE and ProjFS:

```typescript
import { FilerWithProjFS } from '../src/filer/FilerWithProjFS.js';

const filer = new FilerWithProjFS(models, {
    mountPoint: '/mnt/one-files',     // For FUSE mode
    useProjFS: true,                  // Enable ProjFS on Windows
    projfsRoot: 'C:\\OneFiler',       // Windows virtual drive
    projfsCacheSize: 100 * 1024 * 1024
});

await filer.init();
```

## File System Structure

Once running, the virtual drive provides access to:

```
C:\OneFiler\
├── chats\        # Chat conversations and shared files
├── debug\        # System diagnostics and logs
├── invites\      # Pairing invitations
├── objects\      # Raw content-addressed objects
└── types\        # ONE type definitions
```

## Configuration File

Create a `filer-projfs.json` configuration:

```json
{
    "mountPoint": "/home/user/one-files",
    "pairingUrl": "https://leute.refinio.net",
    "communication": {
        "url": "https://comm.one-dragon.com"
    },
    "iomMode": "online",
    "logCalls": false,
    "useProjFS": true,
    "projfsRoot": "C:\\OneFiler",
    "projfsCacheSize": 104857600
}
```

## Troubleshooting

### "Native module not loaded"
- Ensure you're running on Windows
- Build the native module: `npm run build:native`
- Check that Visual Studio Build Tools are installed

### "Access Denied" 
- First-time setup requires Administrator privileges
- Right-click and "Run as Administrator"

### "Path already exists"
- The ProjFS root directory should not exist or be empty
- Delete or choose a different path

### Performance Issues
- Increase cache size in configuration
- Check network connectivity to communication server
- Enable debug logging to identify bottlenecks

## Advanced Features

### Custom Cache Size
```typescript
const provider = new ProjFSProvider(fileSystem, {
    cacheSize: 500 * 1024 * 1024  // 500MB cache
});
```

### Thread Pool Configuration
```typescript
await provider.start(null, {
    virtualizationRootPath: 'C:\\OneFiler',
    poolThreadCount: 8,           // More threads for heavy workloads
    concurrentThreadCount: 4      // Concurrent operations
});
```

### Statistics Monitoring
```typescript
const stats = provider.getStats();
console.log(`Cache hits: ${stats.cacheHits}`);
console.log(`File requests: ${stats.fileDataRequests}`);
console.log(`Uptime: ${stats.uptime}s`);
```

## Development Tips

1. **Use Mock Mode**: When developing on non-Windows systems, the native module falls back to mock mode automatically

2. **Enable Debug Logging**: Set `LOG_LEVEL=debug` for detailed operation logs

3. **Test with Small Cache**: Use a small cache size during development to test eviction logic

4. **Monitor Performance**: Use the built-in statistics to identify optimization opportunities

## Security Considerations

1. **Encryption**: All content is encrypted using the provided secret
2. **Access Control**: Windows file permissions apply to the virtual drive
3. **Network Security**: Communication with servers uses HTTPS
4. **Local Storage**: Encrypted content stored in the data directory

## Migration from FUSE

Existing FUSE users can migrate to ProjFS by:

1. Setting `useProjFS: true` in configuration
2. Specifying `projfsRoot` for the Windows drive location
3. Running the same application - it auto-detects the platform

## Contributing

See the main project README for contribution guidelines. Key areas:

- Native module improvements (C++)
- Cache optimization algorithms
- Additional IFileSystem implementations
- Performance benchmarking tools