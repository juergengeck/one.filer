# ProjFS.ONE Deployment Guide

This guide covers how to deploy and use the ProjFS.ONE package in production environments.

## Prerequisites

### System Requirements
- Windows 10 version 1809 or later (with ProjectedFS support)
- Windows 11 (all versions)
- Node.js 20.0.0 or later
- Visual Studio 2019 or later (for building native modules)
- Windows SDK with ProjectedFS headers

### Enable ProjectedFS
ProjectedFS must be enabled on Windows before use:

```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
```

## Installation

### From NPM (when published)
```bash
npm install projfs.one
```

### From Source
```bash
git clone https://github.com/refinio/one.filer.git
cd one.filer/projfs.one
npm install
npm run build
```

## Basic Usage

### Quick Start
```typescript
import { ProjFSProvider } from 'projfs.one';
import { createFileSystem } from '@refinio/one.core';

// Create or get your IFileSystem implementation
const fileSystem = await createFileSystem();

// Create ProjFS provider
const provider = new ProjFSProvider(fileSystem, {
    logLevel: 'info',
    cacheSize: 100 * 1024 * 1024 // 100MB cache
});

// Start the virtual filesystem
await provider.start({
    virtualizationRootPath: 'C:\\MyVirtualDrive',
    poolThreadCount: 4,
    concurrentThreadCount: 0, // 0 = automatic
    enableNegativePathCache: true,
    notificationMappings: [] // Optional notification filters
});

console.log('Virtual filesystem is running at C:\\MyVirtualDrive');
```

### Integration with ONE.core
```typescript
import { ProjFSProvider } from 'projfs.one';
import { OneCore } from '@refinio/one.core';

// Initialize ONE.core
const oneCore = new OneCore({
    storageLocation: 'C:\\OneCore\\Storage'
});

// Create provider with ONE.core integration
const provider = await ProjFSProvider.createWithOneCore(oneCore, {
    virtualizationRoot: 'C:\\VirtualDrive',
    fileSystemType: 'persistent', // or 'objects'
    logLevel: 'info',
    cacheSize: 200 * 1024 * 1024 // 200MB
});

// Start the provider
await provider.start({
    virtualizationRootPath: 'C:\\VirtualDrive'
});
```

## Configuration Options

### Provider Options
```typescript
interface ProviderOptions {
    // Logging level: 'debug' | 'info' | 'warn' | 'error'
    logLevel?: string;
    
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
    
    // Optional notification filters
    notificationMappings?: Array<{
        notificationRoot: string;
        notificationTypes: NotificationType[];
    }>;
}
```

## Performance Tuning

### Cache Configuration
The cache is critical for ProjFS performance. Tune based on your workload:

```typescript
// For read-heavy workloads with many small files
const provider = new ProjFSProvider(fileSystem, {
    cacheSize: 500 * 1024 * 1024 // 500MB
});

// For large file streaming
const provider = new ProjFSProvider(fileSystem, {
    cacheSize: 50 * 1024 * 1024 // Smaller cache, rely on chunked reading
});
```

### Thread Pool Configuration
```typescript
// For high-concurrency scenarios
await provider.start({
    virtualizationRootPath: 'C:\\VirtualDrive',
    poolThreadCount: 8,
    concurrentThreadCount: 0 // Let Windows optimize
});

// For low-latency scenarios
await provider.start({
    virtualizationRootPath: 'C:\\VirtualDrive',
    poolThreadCount: 2,
    concurrentThreadCount: 4 // Fixed concurrency
});
```

## Monitoring and Diagnostics

### Provider Statistics
```typescript
// Get runtime statistics
const stats = provider.getStats();
console.log(`
    Placeholder requests: ${stats.placeholderInfoRequests}
    File data requests: ${stats.fileDataRequests}
    Directory enumerations: ${stats.directoryEnumerations}
    Cache hit rate: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses)}
    Uptime: ${stats.uptime} seconds
`);
```

### Logging
Configure logging for production:

```typescript
// Production logging setup
const provider = new ProjFSProvider(fileSystem, {
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
});

// Custom logger integration (future feature)
// provider.setLogger(customLogger);
```

## Production Deployment

### Windows Service
Create a Windows service for automatic startup:

```javascript
// service.js
const { ProjFSProvider } = require('projfs.one');
const { Service } = require('node-windows');

// Create service
const svc = new Service({
    name: 'ONE.Filer ProjFS',
    description: 'ONE.core virtual filesystem provider',
    script: require('path').join(__dirname, 'server.js')
});

// Install service
svc.on('install', () => {
    svc.start();
});

svc.install();
```

### Error Recovery
Implement proper error handling and recovery:

```typescript
class ResilientProvider {
    private provider: ProjFSProvider;
    private restartAttempts = 0;
    
    async start() {
        try {
            await this.provider.start({
                virtualizationRootPath: 'C:\\VirtualDrive'
            });
            this.restartAttempts = 0;
        } catch (error) {
            console.error('Provider failed to start:', error);
            
            if (this.restartAttempts < 3) {
                this.restartAttempts++;
                console.log(`Retrying in 5 seconds... (attempt ${this.restartAttempts})`);
                setTimeout(() => this.start(), 5000);
            } else {
                console.error('Max restart attempts reached');
                process.exit(1);
            }
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **"Native module not loaded" error**
   - Ensure Visual Studio build tools are installed
   - Rebuild native module: `npm run build:native`
   - Check Node.js version compatibility

2. **"Access denied" when starting provider**
   - Run with administrator privileges
   - Ensure virtualization root directory exists
   - Check Windows Defender exclusions

3. **Poor performance**
   - Increase cache size
   - Enable negative path caching
   - Check disk I/O bottlenecks
   - Monitor cache hit rates

4. **Files not appearing in Explorer**
   - Refresh Explorer view (F5)
   - Check provider is running: `provider.isRunning()`
   - Verify IFileSystem is returning data
   - Check Windows Event Log for ProjFS errors

### Debug Mode
Enable detailed logging for troubleshooting:

```typescript
const provider = new ProjFSProvider(fileSystem, {
    logLevel: 'debug'
});

// Also enable Windows ProjFS tracing
// Event Viewer > Applications and Services > Microsoft > Windows > ProjFS
```

## Security Considerations

1. **Access Control**
   - ProjFS inherits Windows filesystem permissions
   - Implement additional access control in IFileSystem if needed
   - Consider running service with limited privileges

2. **Path Validation**
   - Provider validates paths to prevent directory traversal
   - Additional validation can be added in IFileSystem layer

3. **Content Verification**
   - ONE.core provides content-addressed storage with hash verification
   - Consider implementing additional integrity checks

## Best Practices

1. **Graceful Shutdown**
   ```typescript
   process.on('SIGINT', async () => {
       console.log('Shutting down provider...');
       await provider.stop();
       process.exit(0);
   });
   ```

2. **Health Checks**
   ```typescript
   setInterval(() => {
       if (!provider.isRunning()) {
           console.error('Provider stopped unexpectedly');
           // Implement recovery logic
       }
   }, 30000); // Check every 30 seconds
   ```

3. **Resource Cleanup**
   ```typescript
   // Always stop provider on exit
   process.on('exit', () => {
       if (provider.isRunning()) {
           provider.stop().catch(console.error);
       }
   });
   ```

## Integration Examples

### With Electron
```typescript
// main.js
import { app, BrowserWindow } from 'electron';
import { ProjFSProvider } from 'projfs.one';

let provider: ProjFSProvider;

app.on('ready', async () => {
    // Start virtual filesystem
    provider = new ProjFSProvider(fileSystem);
    await provider.start({
        virtualizationRootPath: 'C:\\AppData'
    });
    
    // Create window
    const win = new BrowserWindow({
        width: 800,
        height: 600
    });
    
    win.loadFile('index.html');
});

app.on('before-quit', async () => {
    await provider.stop();
});
```

### With Express API
```typescript
import express from 'express';
import { ProjFSProvider } from 'projfs.one';

const app = express();
let provider: ProjFSProvider;

app.post('/mount', async (req, res) => {
    try {
        provider = new ProjFSProvider(fileSystem);
        await provider.start({
            virtualizationRootPath: req.body.path
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/stats', (req, res) => {
    if (!provider?.isRunning()) {
        return res.status(503).json({ error: 'Provider not running' });
    }
    res.json(provider.getStats());
});
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/refinio/one.filer/issues
- Documentation: https://docs.refinio.com/projfs.one
- ONE.core Documentation: https://docs.refinio.com/one.core