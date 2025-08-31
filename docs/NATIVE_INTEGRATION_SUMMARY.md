# Native ONE Filer Service Integration

## Summary of Changes

We have successfully created a native Windows integration that eliminates the WSL dependency by embedding one.filer components directly into the Electron app.

### Key Files Created/Modified

1. **`electron-app/src/main-native.ts`**
   - Direct integration of one.filer Replicant without WSL
   - Native imports of `@refinio/one.core` and `@refinio/one.models`
   - Uses `projfs-fuse.one` for Windows filesystem integration
   - Simplified service management without external processes

2. **`electron-app/webpack.config.native.js`**
   - Custom webpack configuration for ES module support
   - Proper handling of one.filer imports
   - Electron main process targeting with native module support

3. **`electron-app/config-native.json`**
   - Configuration for native mode operation
   - ProjFS settings for Windows virtual filesystem
   - Direct paths without WSL translation

4. **`electron-app/package.json`**
   - Added dependencies for one.core, one.models, and projfs-fuse.one
   - New scripts: `start:native`, `dev:native`, `build:native`
   - Direct file references to local packages

### Architecture Changes

**Before (WSL-based):**
```
Electron → spawn WSL → one.filer in WSL → FUSE mount
```

**After (Native):**
```
Electron → embedded one.filer → projfs-fuse.one → Windows ProjFS
```

### Benefits

1. **No WSL Required** - Runs entirely on Windows native
2. **Better Performance** - No inter-process communication overhead
3. **Simpler Deployment** - Single executable with all dependencies
4. **Direct Integration** - Full access to one.filer APIs from Electron
5. **Native File System** - Uses Windows ProjFS for seamless Explorer integration

### Usage

To run the native version:

```bash
cd electron-app
npm install
npm run start:native
```

For development:
```bash
npm run dev:native
```

To build installer:
```bash
npm run build-win:native
```

### Next Steps

1. Test the native integration thoroughly
2. Update tests to work with native mode
3. Create deployment scripts for the service version
4. Document API differences between WSL and native modes

## Repository Structure

The service-oriented fork should be pushed to:
- Repository: `https://github.com/juergengeck/one.filer.service`
- Purpose: Native Windows service implementation of one.filer
- Main difference: Embedded execution instead of WSL subprocess