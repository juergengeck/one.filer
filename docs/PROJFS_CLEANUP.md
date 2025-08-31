# ProjFS Cleanup and Lock Prevention

## Problem
Windows Projected File System (ProjFS) virtualization contexts persist even after process termination, causing "file already exists" (0x800700b7) errors on restart.

## Root Cause
1. ProjFS creates kernel-level virtualization contexts
2. These contexts persist until explicitly stopped with `PrjStopVirtualizing`
3. Process crashes or kills leave contexts active
4. Subsequent starts fail because the directory is still virtualized

## Solutions

### 1. Graceful Shutdown Handler
```javascript
// Add to ProjFSProvider
process.on('SIGINT', () => this.stop());
process.on('SIGTERM', () => this.stop());
process.on('exit', () => this.stop());
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    this.stop();
    process.exit(1);
});
```

### 2. Pre-Start Cleanup
```cpp
// In native Start method, before PrjStartVirtualizing:
HRESULT hr = PrjStopVirtualizing(virtualizationRootPath_.c_str());
// Ignore errors - it might not be virtualized
```

### 3. Force Cleanup Utility
Create a cleanup utility that customers can run:
```cpp
HRESULT ForceCleanupProjFS(const std::wstring& path) {
    // Try to stop any existing virtualization
    PrjStopVirtualizing(path.c_str());
    
    // Remove reparse point if it exists
    DWORD attrs = GetFileAttributesW(path.c_str());
    if (attrs != INVALID_FILE_ATTRIBUTES && 
        (attrs & FILE_ATTRIBUTE_REPARSE_POINT)) {
        // Remove reparse point
        RemoveDirectoryW(path.c_str());
        CreateDirectoryW(path.c_str(), nullptr);
    }
    return S_OK;
}
```

### 4. Unique Directory Per Session
```javascript
const mountPoint = `${basePath}_${process.pid}_${Date.now()}`;
// Clean up old mount points on start
```

### 5. Windows Service Recovery
If running as a service, configure Windows Service Recovery to run cleanup on failure.

## Testing Lock Scenarios

1. **Normal shutdown**: Process exits cleanly
2. **Kill process**: `taskkill /F /PID <pid>`
3. **Crash simulation**: `process.abort()`
4. **Power loss**: VM shutdown during operation
5. **Multiple instances**: Start second instance while first is running

## Customer Deployment Recommendations

1. **Installation**:
   - Check for existing virtualizations
   - Offer to clean up abandoned contexts
   - Use unique directories per installation

2. **Runtime**:
   - Implement all signal handlers
   - Add pre-start cleanup
   - Log virtualization state

3. **Error Handling**:
   - Detect 0x800700b7 specifically
   - Provide clear error message
   - Offer automatic cleanup option

4. **Monitoring**:
   - Track ProjFS start/stop events
   - Monitor for abandoned contexts
   - Alert on repeated failures