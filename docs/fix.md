# ProjFS architecture review and cache/invalidation fixes

This documents the systemic issues behind folders appearing but caches not being filled/used/invalidated, and prescribes concrete changes.

### Relevant components
- `package/src/projfs_provider.cpp`: ProjFS callbacks; reads native `ContentCache` first, falls back to `storage_` for `/objects`, otherwise triggers async fetch.
- `package/src/async_bridge.cpp`: Bridges JS async callbacks; on resolve, writes into native `ContentCache`.
- `package/src/ifsprojfs_bridge.cpp`: Exposes `IFSProjFSProvider` to JS with `registerCallbacks`, `start/stop`, `getStats`, `setCachedDirectory`.
- `package/IFSProjFSProvider.js`: JS wrapper that registers callbacks and maintains its own 5s `enumerationCache` (separate from native cache).
- `src/filer/CachedProjFSProvider.ts`: Higher-level wrapper; performs prefetch and pushes into native cache via `setCachedDirectory` when available.
- `src/filer/DirectoryInvalidator.ts`: Generic invalidator, expects provider methods that are not implemented yet.

### Observed issues
- Async enumeration never completes:
  - On cache miss, `GetDirectoryEnumerationCallback` triggers `FetchDirectoryListing` then returns immediately without `ERROR_IO_PENDING` and without a later `PrjCompleteCommand`, so Explorer sees empty results and is not nudged to retry.
- Pre-population fills the wrong cache:
  - `IFSProjFSProvider.prepopulateCache()` populates only its local JS `enumerationCache`, not the native `ContentCache` used by ProjFS.
- Enumeration filters out virtual entries:
  - For non-`/objects` paths, code checks `storage_->GetVirtualPathMetadata` and skips entries that do not exist on disk, dropping valid virtual items discovered from listing.
- No invalidation/completion API surface:
  - The bridge/provider do not expose `invalidateDirectory`/`onDirectoryDataReady`, and the provider does not track `CommandId` to complete pending commands.
- Fragmented caches:
  - JS `enumerationCache`, native `ContentCache`, `PersistentCache`, and in-memory `pathCache` exist independently. Only the native `ContentCache` is used by ProjFS callbacks.

### Changes to implement now (low risk)
1) Pre-populate the native cache:
   - In `package/IFSProjFSProvider.js` `prepopulateCache()`, after computing `entries`, also call `this.provider.setCachedDirectory(path, entries)` so ProjFS callbacks see data immediately.

2) Use cached listing info during enumeration (avoid storage for virtual items):
   - In `GetDirectoryEnumerationCallback`, when a cached `DirectoryListing` is present or after names are assembled, derive `PRJ_FILE_BASIC_INFO` directly from those `FileInfo` values for non-`/objects` paths. Only consult `storage_` for `/objects` paths.

3) Order of prefetch vs mount visibility:
   - In `src/filer/CachedProjFSProvider.ts` `mount()`, ensure prefetch + `setCachedDirectory` for standard paths is executed immediately around mount (before Explorer queries or immediately after), so first enumeration hits the native cache.

4) Unify/mirror caches:
   - Either remove the JS `enumerationCache` or mirror anything placed there to native via `setCachedDirectory` to keep Explorer-visible cache authoritative.

### Medium-term (correct ProjFS async flow)
5) Implement IO_PENDING + completion for directory enumeration:
   - On cache miss in `GetDirectoryEnumerationCallback`, return `HRESULT_FROM_WIN32(ERROR_IO_PENDING)`, store the `CommandId` keyed by `path/enumId`, and after `AsyncBridge` fills the cache, call `PrjCompleteCommand(virtualizationContext_, commandId, S_OK)` to resume enumeration.

6) Add explicit invalidation/ready hooks to the bridge:
   - Expose `onDirectoryDataReady(path)` (or `invalidateDirectory(path)`) in `ifsprojfs_bridge.cpp` that calls a native method to complete pending enumeration(s) or force re-enumeration for that `path`.
   - Wire `src/filer/DirectoryInvalidator.ts` to call this method when async data arrives or after `SmartCacheManager.syncPath()` updates cache.

7) Optional content cache push:
   - If desired, add `setCachedContent(path, Buffer)` in the bridge to hydrate small files into native `ContentCache` for `GetFileDataCallback` fast-path.

### Validation
- Build and mount with ProjFS enabled.
- Confirm `setCachedDirectory` is invoked for `/`, `/invites`, `/chats`, `/debug`, `/objects`, `/types` before or immediately after mount.
- Open `C:\OneFiler` in Explorer: root entries should appear immediately; navigating into folders should show items without requiring manual refresh.
- With IO_PENDING/completion in place, verify that initial empty enumerations are followed by completed listings without user refresh.
