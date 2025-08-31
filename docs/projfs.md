# ProjFS Implementation Analysis and Documentation

## Overview
Windows Projected File System (ProjFS) allows user-mode applications to project hierarchical data into the file system, making remote or virtual data appear as local files and directories.

## Prerequisites

### Enabling ProjFS on Windows
ProjFS is an optional Windows component that must be enabled:

1. **Open elevated PowerShell** (Run as Administrator)
2. **Enable the feature**:
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
   ```
3. **Reboot if required** (check if RestartNeeded: True)

### Verify ProjFS is Enabled
```powershell
Get-WindowsOptionalFeature -Online -FeatureName Client-ProjFS
```

## Core ProjFS Concepts

### 1. Virtualization Root
- The mount point where virtual files appear (e.g., `C:\OneFiler`)
- Initially empty - items only materialize when accessed
- ProjFS merges provider data with local file system data

### 2. Callback Model
ProjFS uses callbacks to request data from the provider:
- **Placeholder Info**: Metadata about files/directories
- **File Data**: Actual file contents
- **Directory Enumeration**: Listing directory contents

### 3. Synchronous Requirements
- ProjFS callbacks MUST return synchronously
- Cannot use async/await or promises directly
- Must have data ready when callback is invoked

## Directory Enumeration Deep Dive

### Callback Sequence (Per Microsoft Documentation)
1. **PRJ_START_DIRECTORY_ENUMERATION_CB**
   - Called once when enumeration begins
   - Receives unique GUID for the enumeration session
   - Provider should:
     - Prepare for enumeration
     - Allocate necessary memory
     - Identify directory path relative to virtualization root
     - Prepare to enumerate backing data store

2. **PRJ_GET_DIRECTORY_ENUMERATION_CB**
   - Called one or more times to fill directory entries
   - MUST return entries in sorted order (use PrjFileNameCompare)
   - Handle search expressions (wildcards) using PrjFileNameMatch
   - Return values:
     - `S_OK`: Successfully processed (even if no entries added)
     - `HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER)`: First entry too large
     - `HRESULT_FROM_WIN32(ERROR_IO_PENDING)`: Will complete asynchronously (advanced)

3. **PRJ_END_DIRECTORY_ENUMERATION_CB**
   - Called when enumeration completes
   - Provider should:
     - Perform cleanup
     - Deallocate memory from enumeration session

### Critical Implementation Requirements

#### 1. State Management
```cpp
struct EnumerationState {
    std::vector<std::string> entries;  // All entries for this directory
    size_t nextIndex = 0;              // Next entry to return
    bool isComplete = false;           // All entries returned
    bool isLoading = false;            // Async load in progress
};
```

#### 2. Buffer Handling (Critical!)
- Use `PrjFillDirEntryBuffer` to add entries
- When buffer fills:
  - `PrjFillDirEntryBuffer` returns `HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER)`
  - **CRITICAL**: Do NOT increment nextIndex for the entry that didn't fit
  - Return `S_OK` from the callback (not the error)
  - ProjFS will call the callback again with the same parameters
  - Continue from the same entry that didn't fit

#### 3. Search Expression Handling
- `searchExpression` may be NULL (return all entries)
- Use `PrjDoesNameContainWildCards` to check for wildcards
- Use `PrjFileNameMatch` for pattern matching
- Capture search expression on first call, reuse in subsequent calls
```cpp
// Correct implementation
if (searchExpression != nullptr) {
    if (!PrjFileNameMatch(entry.c_str(), searchExpression)) {
        continue; // Skip non-matching entries
    }
}
```

#### 4. Restart Scan Flag
- Check `callbackData->Flags & PRJ_CB_DATA_FLAG_ENUM_RESTART_SCAN`
- When set:
  - Reset enumeration to beginning
  - Re-capture search expression
  - Clear any cached state

#### 4. Path Normalization
- ProjFS provides paths relative to virtualization root
- Empty string = root directory
- Paths use backslashes on Windows
- Must convert to forward slashes for POSIX-style APIs

## Our Implementation Analysis

### Current Implementation Review

#### ✅ What We're Doing Correctly:
1. **Proper GUID-based state management** - Using std::map with enumerationId
2. **Buffer handling** - Correctly NOT incrementing nextIndex when buffer is full
3. **Restart scan handling** - Properly resetting state on PRJ_CB_DATA_FLAG_ENUM_RESTART_SCAN
4. **Search expression support** - Using PrjFileNameMatch for filtering
5. **Cleanup in EndDirectoryEnumerationCallback** - Removing state when done

#### ❌ Critical Issues Found:

### 1. The "Russian Doll" Problem
**Symptom**: Every directory shows the same 5 root folders repeatedly

**Root Causes**:

#### A. IFileSystem's isRootPath() Logic (THE MAIN ISSUE)
The TemporaryFileSystem class has a problematic `isRootPath()` implementation:
```javascript
isRootPath(checkPath) {
    return !Array.from(this.fstab.keys()).some(storagePath => checkPath.includes(storagePath));
}
```
This returns `true` for any path that doesn't contain a mounted path. Since paths without leading "/" don't match the mounted paths (e.g., "/chats", "/debug"), they're incorrectly identified as root paths.

When `isRootPath()` returns true, `readDir()` returns root contents:
```javascript
async readDir(checkPath) {
    if (this.isRootPath(checkPath)) {
        return this.getRootDirContents(); // Returns the 5 root folders!
    }
    // ... normal directory reading
}
```

#### B. Path Format Mismatch
1. **ProjFS gives us Windows paths** (e.g., "chats", "objects\subfolder")
2. **IFileSystem expects POSIX paths** (e.g., "/chats", "/objects/subfolder")
3. **Missing leading slash causes isRootPath() to return true**

#### C. Our Current Fix (Partial)
We're normalizing paths in multiple places:
```cpp
// C++ side
std::string virtualPath = relativePath.empty() ? "/" : "/" + relativePath;
```
```javascript
// JavaScript side
const normalizedPath = path === '' ? '/' : (path.startsWith('/') ? path : '/' + path);
```

However, this doesn't fix the underlying IFileSystem issue.

### 2. Enumeration State Issues
- Windows Explorer may create multiple enumeration sessions for the same directory
- Each session gets its own GUID but may be enumerating the same path
- Not properly handling `PRJ_CB_DATA_FLAG_ENUM_RESTART_SCAN`

### 3. Async/Sync Mismatch
- ProjFS requires synchronous responses
- IFileSystem operations are asynchronous
- Current workaround: pre-cache directories before mounting

## Correct Implementation Pattern

### Path Handling
```cpp
// In GetDirectoryEnumerationCallback
std::string relativePath = provider->ToUtf8(callbackData->FilePathName);
std::replace(relativePath.begin(), relativePath.end(), '\\', '/');
std::string virtualPath = relativePath.empty() ? "/" : "/" + relativePath;
```

### JavaScript Side
```javascript
// Ensure all paths start with /
const normalizedPath = path === '' ? '/' : (path.startsWith('/') ? path : '/' + path);
```

### Enumeration Flow
1. Check enumeration state for this GUID
2. If first call, populate entries (from cache or async)
3. Return entries starting from nextIndex
4. Handle buffer full condition correctly
5. Track completion state

## Common Pitfalls

1. **Not handling empty paths correctly** - Empty string should map to "/"
2. **Path format inconsistency** - Mixing Windows and POSIX paths
3. **Incorrect buffer handling** - Incrementing index when buffer is full
4. **Cache key mismatches** - Using different path formats for cache
5. **Not handling search expressions** - Returning all entries regardless of filter
6. **Async timing issues** - Returning empty when data not ready

## Best Practices

1. **Always normalize paths** at entry points
2. **Use consistent path format** throughout the system
3. **Pre-cache directory listings** to avoid async issues
4. **Track enumeration state** per GUID
5. **Handle buffer limitations** gracefully
6. **Log extensively** during development
7. **Test with Windows Explorer** - it behaves differently than command line

## Debugging Tips

1. Enable console output in C++:
   ```cpp
   std::cout << "[ProjFS] Debug message" << std::endl;
   ```

2. Use Chrome DevTools in Electron for JavaScript debugging

3. Check Windows Event Viewer for ProjFS system messages

4. Use Process Monitor to trace file system calls

5. Test edge cases:
   - Empty directories
   - Deep nesting
   - Large directories
   - Concurrent access

## Proposed Solutions

### 1. Fix IFileSystem's isRootPath() (Root Cause)
The TemporaryFileSystem's `isRootPath()` logic needs to be fixed to handle paths correctly:
```javascript
// Current (BROKEN)
isRootPath(checkPath) {
    return !Array.from(this.fstab.keys()).some(storagePath => checkPath.includes(storagePath));
}

// Proposed fix
isRootPath(checkPath) {
    // Normalize the path first
    const normalized = checkPath === '' || checkPath === '/' ? '/' : 
                      (checkPath.startsWith('/') ? checkPath : '/' + checkPath);
    
    // Root is exactly '/'
    if (normalized === '/') return true;
    
    // Check if it matches any mounted path
    return !Array.from(this.fstab.keys()).some(storagePath => 
        normalized === storagePath || normalized.startsWith(storagePath + '/')
    );
}
```

### 2. Alternative: Override in IFSProjFSProvider
If we can't modify the IFileSystem, we can work around it:
```javascript
async readDirectory(path) {
    // Always ensure leading slash before calling IFileSystem
    const normalizedPath = path === '' ? '/' : (path.startsWith('/') ? path : '/' + path);
    
    // Special handling for known mount points
    if (normalizedPath === '/') {
        return [
            { name: 'chats', isDirectory: true, ... },
            { name: 'debug', isDirectory: true, ... },
            { name: 'invites', isDirectory: true, ... },
            { name: 'objects', isDirectory: true, ... },
            { name: 'types', isDirectory: true, ... }
        ];
    }
    
    // For all other paths, use the IFileSystem
    const result = await this.fileSystem.readDir(normalizedPath);
    // ... rest of implementation
}
```

### 3. Path Validation in C++
Add defensive checks in the C++ layer:
```cpp
// In GetDirectoryEnumerationCallback
if (virtualPath != "/" && enumState.entries.size() == 5) {
    // Check if we got root contents for non-root path
    bool isRootContent = true;
    std::set<std::string> rootDirs = {"chats", "debug", "invites", "objects", "types"};
    for (const auto& entry : enumState.entries) {
        if (rootDirs.find(entry) == rootDirs.end()) {
            isRootContent = false;
            break;
        }
    }
    
    if (isRootContent) {
        // Log error and return empty to prevent infinite recursion
        EmitDebugMessage("ERROR: Got root contents for non-root path: " + virtualPath);
        enumState.entries.clear();
    }
}
```

## References
- [Microsoft ProjFS Documentation](https://learn.microsoft.com/en-us/windows/win32/projfs/projected-file-system)
- [Enumerating Files and Directories](https://learn.microsoft.com/en-us/windows/win32/projfs/enumerating-files-and-directories)
- [PRJ_GET_DIRECTORY_ENUMERATION_CB](https://learn.microsoft.com/en-us/windows/win32/api/projectedfslib/nc-projectedfslib-prj_get_directory_enumeration_cb)