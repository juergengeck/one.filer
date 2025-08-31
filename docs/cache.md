# ProjFS Directory Caching Strategy

## Problem Analysis

### Current Issue
PNG files in `/invites` directory are not showing up in Windows Explorer despite being present in the filesystem. The root cause is a conflict in the directory caching mechanism.

### Root Cause
There are **multiple competing caching mechanisms** that interfere with each other:

1. **IFSProjFSProvider.js** (JavaScript side)
   - Calls `setCachedDirectory()` directly when reading directories
   - Creates proper entry objects with `name`, `size`, `isDirectory` fields

2. **AsyncBridge** (C++ side)
   - Also fetches directory listings via callbacks
   - Parses the returned array and caches it separately
   - Expects the JavaScript callback to return raw data

3. **SmartCacheManager** (TypeScript)
   - Pre-populates cache with hardcoded entries
   - Calls `setCachedDirectory()` directly

4. **CachedProjFSProvider** (TypeScript)
   - Another layer that pre-populates cache during mount

## Current Data Flow (BROKEN)

```
Windows Explorer requests directory listing
    ↓
ProjFS GetDirectoryEnumerationCallback (C++)
    ↓
Checks ContentCache for entries
    ↓
If not cached:
    AsyncBridge::FetchDirectoryListing()
        ↓
    Calls JavaScript readDirectory callback
        ↓
    IFSProjFSProvider.readDirectory()
        - Creates entry objects
        - Calls setCachedDirectory() ← PROBLEM #1
        - Returns entries array
        ↓
    AsyncBridge receives array
        - Parses it again
        - Calls cache->SetDirectoryListing() ← PROBLEM #2
        ↓
    CONFLICT: Double caching with different data formats
```

## Why PNG Files Disappear

1. **First cache**: IFSProjFSProvider creates entries with proper names
2. **Second cache**: AsyncBridge overwrites with entries that have empty names
3. **Result**: Directory enumeration finds entries but with empty names
4. **Effect**: Files are skipped during enumeration, not shown in Explorer

## Evidence from Logs

```
[ProjFS] WARNING: Empty name in cached entry for /invites (size=5397, isDir=0)
[ProjFS] Loaded 4 entries from cache for /invites
[ProjFS] Starting enumeration return for /invites - nextIndex: 0, totalEntries: 4
[ProjFS] ENUM CALLBACK COMPLETE for /invites: returned 0 entries
```

The entries exist (totalEntries: 4) but have empty names, so 0 entries are returned.

## Solution Strategy

### Option 1: Single Source of Truth (RECOMMENDED)
Make IFSProjFSProvider the single source of truth for directory caching:

1. **Disable AsyncBridge caching**
   - AsyncBridge should NOT call SetDirectoryListing
   - It should only forward callbacks

2. **IFSProjFSProvider owns caching**
   - Continue calling setCachedDirectory() 
   - Ensure entries always have proper names

3. **Remove conflicting cache calls**
   - SmartCacheManager should not directly cache
   - CachedProjFSProvider should not directly cache

### Option 2: Pure AsyncBridge Caching
Make AsyncBridge the only caching mechanism:

1. **Remove all setCachedDirectory calls from JavaScript**
2. **AsyncBridge handles all caching**
3. **Ensure proper data format conversion**

### Option 3: Fix Data Format (Quick Fix)
Ensure consistent data format across all caching layers:

1. **Validate entry names before caching**
2. **Skip entries with empty names**
3. **Add defensive checks**

## Implementation Plan

### Phase 1: Immediate Fix
1. Prevent AsyncBridge from overwriting good cache data
2. Ensure entries always have names when cached

### Phase 2: Refactor
1. Remove duplicate caching mechanisms
2. Establish single source of truth
3. Add proper logging and validation

### Phase 3: Test
1. Verify PNG files appear in `/invites`
2. Test all directory listings work
3. Ensure no performance regression

## Code Changes Required

### 1. Fix AsyncBridge (async_bridge.cpp)
```cpp
// In FetchDirectoryListing callback
if (info.Length() > 0 && info[0].IsArray()) {
    // DON'T cache here - let JavaScript handle it
    // auto listing = ParseDirectoryListing(info[0].As<Napi::Array>());
    // cache_->SetDirectoryListing(path, listing);
}
```

### 2. Ensure Proper Names (IFSProjFSProvider.js)
```javascript
// Validate entries before caching
const validEntries = entries.filter(e => e.name && e.name.length > 0);
this.setCachedDirectory(normalizedPath, validEntries);
```

### 3. Remove Duplicate Caching (SmartCacheManager.ts)
```typescript
// Comment out direct cache calls
// this.nativeProvider.setCachedDirectory('/invites', invitesEntries);
```

## Testing Checklist

- [ ] PNG files appear in `/invites` directory
- [ ] Files can be opened from Explorer
- [ ] Directory enumeration returns correct count
- [ ] No empty name warnings in logs
- [ ] Cache hit/miss statistics are accurate
- [ ] Performance is acceptable

## Risk Assessment

- **Risk**: Removing AsyncBridge caching might affect performance
- **Mitigation**: Monitor cache hit rates and response times

- **Risk**: Other code might depend on AsyncBridge caching
- **Mitigation**: Search for all cache dependencies first

- **Risk**: Breaking other directory listings
- **Mitigation**: Test all directories, not just `/invites`