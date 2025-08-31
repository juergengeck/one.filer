# ProjFS Cache Implementation Guide

## Overview

This guide describes how to implement a robust caching system for ProjFS-based applications that can fallback to physical filesystem storage when the virtual filesystem becomes unavailable.

## Architecture

### Dual Filesystem Strategy

The solution maintains two parallel filesystem structures:
- **Primary**: ProjFS virtual filesystem (database-backed)
- **Fallback**: Physical filesystem cache

```
Application Root/
├── virtual/          # ProjFS mount point
├── cache/           # Physical filesystem fallback
├── .projfs/         # ProjFS metadata
└── config/          # Application configuration
```

## Implementation Components

### 1. Filesystem Abstraction Layer

```csharp
public interface IFileSystemProvider
{
    Task<Stream> OpenReadAsync(string path);
    Task<Stream> OpenWriteAsync(string path);
    Task<bool> ExistsAsync(string path);
    Task<IEnumerable<string>> ListDirectoryAsync(string path);
    Task DeleteAsync(string path);
    bool IsAvailable { get; }
}

public class HybridFileSystemProvider : IFileSystemProvider
{
    private readonly ProjFSProvider _projfsProvider;
    private readonly PhysicalFileSystemProvider _physicalProvider;
    private readonly ICacheManager _cacheManager;
    
    public async Task<Stream> OpenReadAsync(string path)
    {
        if (_projfsProvider.IsAvailable)
        {
            try
            {
                var stream = await _projfsProvider.OpenReadAsync(path);
                // Cache the file in background
                _ = Task.Run(() => _cacheManager.CacheFileAsync(path, stream));
                return stream;
            }
            catch (Exception ex)
            {
                // Log ProjFS failure and fallback
                _logger.LogWarning("ProjFS read failed for {Path}: {Error}", path, ex.Message);
            }
        }
        
        return await _physicalProvider.OpenReadAsync(path);
    }
}
```

### 2. ProjFS Provider Implementation

```csharp
public class ProjFSProvider : IFileSystemProvider
{
    private readonly IVirtualizationInstance _instance;
    private readonly IDatabaseService _database;
    private volatile bool _isAvailable = true;
    
    public bool IsAvailable => _isAvailable && _instance?.IsActive == true;
    
    protected override HResult OnEnumerateDirectory(
        int commandId,
        Guid enumerationId,
        string relativePath,
        uint triggeringProcessId,
        string triggeringProcessImageFileName)
    {
        try
        {
            var entries = await _database.GetDirectoryEntriesAsync(relativePath);
            
            using var enumeration = _instance.StartDirectoryEnumeration(enumerationId);
            
            foreach (var entry in entries)
            {
                var info = new ProjectedFileInfo(
                    entry.Name,
                    entry.Size,
                    entry.IsDirectory,
                    entry.CreationTime,
                    entry.LastAccessTime,
                    entry.LastWriteTime,
                    entry.ChangeTime,
                    entry.FileAttributes);
                    
                enumeration.WriteProjectedInfo(info);
            }
            
            return HResult.Ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enumerate directory: {Path}", relativePath);
            _isAvailable = false;
            return HResult.InternalError;
        }
    }
    
    protected override HResult OnGetFileData(
        int commandId,
        string relativePath,
        ulong byteOffset,
        uint length,
        Guid dataStreamId,
        byte[] contentId,
        byte[] providerId,
        uint triggeringProcessId,
        string triggeringProcessImageFileName)
    {
        try
        {
            var data = await _database.GetFileDataAsync(relativePath, byteOffset, length);
            
            using var writeBuffer = _instance.CreateWriteBuffer(dataStreamId, byteOffset, length);
            writeBuffer.Write(data);
            
            return HResult.Ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get file data: {Path}", relativePath);
            _isAvailable = false;
            return HResult.InternalError;
        }
    }
}
```

### 3. Cache Manager

```csharp
public class CacheManager : ICacheManager
{
    private readonly string _cacheDirectory;
    private readonly SemaphoreSlim _cacheSemaphore;
    private readonly LRUCache<string, CacheEntry> _metadataCache;
    
    public async Task CacheFileAsync(string relativePath, Stream sourceStream)
    {
        await _cacheSemaphore.WaitAsync();
        try
        {
            var cachePath = Path.Combine(_cacheDirectory, relativePath);
            var cacheDir = Path.GetDirectoryName(cachePath);
            
            if (!Directory.Exists(cacheDir))
                Directory.CreateDirectory(cacheDir);
            
            using var cacheStream = File.Create(cachePath);
            sourceStream.Position = 0;
            await sourceStream.CopyToAsync(cacheStream);
            
            _metadataCache.Set(relativePath, new CacheEntry
            {
                CachedAt = DateTime.UtcNow,
                Size = sourceStream.Length,
                LastModified = File.GetLastWriteTimeUtc(cachePath)
            });
        }
        finally
        {
            _cacheSemaphore.Release();
        }
    }
    
    public async Task<bool> IsCachedAsync(string relativePath)
    {
        var cachePath = Path.Combine(_cacheDirectory, relativePath);
        return File.Exists(cachePath);
    }
    
    public async Task InvalidateCacheAsync(string relativePath)
    {
        var cachePath = Path.Combine(_cacheDirectory, relativePath);
        if (File.Exists(cachePath))
        {
            File.Delete(cachePath);
            _metadataCache.Remove(relativePath);
        }
    }
}
```

### 4. Health Monitoring

```csharp
public class ProjFSHealthMonitor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ProjFSHealthMonitor> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var provider = scope.ServiceProvider.GetRequiredService<HybridFileSystemProvider>();
                
                // Perform health check
                var isHealthy = await PerformHealthCheckAsync(provider);
                
                if (!isHealthy)
                {
                    _logger.LogWarning("ProjFS health check failed, initiating fallback procedures");
                    await InitiateFallbackAsync(provider);
                }
                
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ProjFS health monitoring");
            }
        }
    }
    
    private async Task<bool> PerformHealthCheckAsync(HybridFileSystemProvider provider)
    {
        try
        {
            // Test basic operations
            var testPath = ".projfs-health-check";
            return await provider.ExistsAsync(testPath);
        }
        catch
        {
            return false;
        }
    }
}
```

## Configuration

### appsettings.json

```json
{
  "ProjFS": {
    "VirtualizationRoot": "C:\\MyApp\\virtual",
    "CacheDirectory": "C:\\MyApp\\cache",
    "HealthCheckInterval": "00:00:30",
    "CacheSettings": {
      "MaxSizeGB": 10,
      "EvictionPolicy": "LRU",
      "PreloadCriticalFiles": true
    }
  },
  "Database": {
    "ConnectionString": "Server=localhost;Database=MyAppData;Trusted_Connection=true;",
    "CommandTimeout": 30
  }
}
```

## Deployment Considerations

### Prerequisites

1. **Windows Version**: Windows 10 version 1903 or later
2. **Developer Mode**: Must be enabled for ProjFS
3. **Permissions**: Application must run with appropriate privileges

### Installation Steps

```powershell
# Enable Developer Mode (requires admin)
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v "AllowDevelopmentWithoutDevLicense" /d "1"

# Install application
& .\setup.exe /VDIR="C:\MyApp\virtual" /CACHE="C:\MyApp\cache"

# Register ProjFS provider
& .\MyApp.exe --register-projfs
```

## Error Handling Strategies

### Graceful Degradation

```csharp
public class FileOperationStrategy
{
    public async Task<T> ExecuteWithFallback<T>(
        Func<Task<T>> primaryOperation,
        Func<Task<T>> fallbackOperation,
        string operationName)
    {
        try
        {
            return await primaryOperation();
        }
        catch (Exception ex) when (IsProjFSException(ex))
        {
            _logger.LogWarning("ProjFS operation {Operation} failed, using fallback: {Error}", 
                operationName, ex.Message);
            
            _metrics.IncrementCounter("projfs.fallback", new[] { 
                new KeyValuePair<string, object>("operation", operationName) 
            });
            
            return await fallbackOperation();
        }
    }
    
    private bool IsProjFSException(Exception ex)
    {
        return ex is VirtualizationException ||
               ex is DirectoryNotFoundException ||
               (ex is IOException ioEx && ioEx.HResult == -2147024637); // HRESULT_FROM_WIN32(ERROR_INVALID_REPARSE_DATA)
    }
}
```

## Performance Optimization

### Caching Strategies

1. **Eager Caching**: Pre-cache frequently accessed files
2. **Lazy Loading**: Cache files on first access
3. **Predictive Caching**: Cache related files based on access patterns
4. **Size-based Eviction**: Remove large, infrequently used files first

### Memory Management

```csharp
public class MemoryEfficientCache
{
    private readonly MemoryMappedFileCache _largeFileCache;
    private readonly MemoryCache _smallFileCache;
    private const long LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
    
    public async Task<Stream> GetFileStreamAsync(string path, long size)
    {
        if (size > LARGE_FILE_THRESHOLD)
        {
            return await _largeFileCache.GetStreamAsync(path);
        }
        else
        {
            var data = await _smallFileCache.GetAsync<byte[]>(path);
            return new MemoryStream(data);
        }
    }
}
```

## Monitoring and Diagnostics

### Key Metrics

- ProjFS availability percentage
- Cache hit/miss ratios
- Fallback operation frequency
- File access latency
- Cache storage utilization

### Logging Configuration

```csharp
services.AddLogging(builder =>
{
    builder.AddConsole();
    builder.AddFile("logs/myapp-{Date}.log");
    builder.AddEventLog(); // For Windows Event Log
});

// Add custom ProjFS event source
services.AddSingleton<IEventSource, ProjFSEventSource>();
```

## Troubleshooting

### Common Issues

1. **ProjFS Not Available**
   - Verify Developer Mode is enabled
   - Check Windows version compatibility
   - Ensure sufficient permissions

2. **Cache Corruption**
   - Implement cache validation
   - Provide cache rebuild functionality
   - Monitor disk space

3. **Performance Issues**
   - Adjust cache size limits
   - Optimize database queries
   - Consider SSD storage for cache

### Debug Commands

```bash
# Check ProjFS status
MyApp.exe --status

# Rebuild cache
MyApp.exe --rebuild-cache

# Validate cache integrity
MyApp.exe --validate-cache

# Export diagnostics
MyApp.exe --export-diagnostics
```

## Security Considerations

- Encrypt sensitive cached data
- Implement access control for cache directory
- Audit file access patterns
- Secure database connections
- Validate all file paths to prevent traversal attacks

## Best Practices

1. **Always implement graceful fallback**
2. **Monitor ProjFS health continuously**
3. **Cache critical files proactively**
4. **Implement proper error logging**
5. **Test fallback scenarios regularly**
6. **Document deployment requirements clearly**
7. **Provide clear user feedback during fallback mode**