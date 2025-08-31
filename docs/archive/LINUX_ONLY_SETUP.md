# ONE.filer Linux-Only Setup (No Windows Dependencies)

## Overview

ONE.filer has been refactored to use **Linux-only FUSE implementation** via WSL2, completely removing problematic Windows FUSE dependencies.

## Architecture

```
Windows Explorer ↔ WSL2 Bridge ↔ Linux FUSE ↔ ONE Filesystem
```

**Key Insight**: WSL2 provides the Windows integration - no Windows FUSE drivers needed!

## What Was Removed

### ❌ Windows Dependencies (Eliminated)
- `fuse-shared-library-win32` - Windows FUSE implementation
- WinFsp driver requirements
- Cross-platform FUSE complexity
- Windows-specific build tools

### ❌ Private Repository Dependencies (Temporarily Removed)
- `@refinio/one.core` - Requires GitHub access credentials
- `@refinio/one.models` - Requires GitHub access credentials
- Complex build system with excessive dependencies

## What Was Added

### ✅ Clean Linux-Only Dependencies
- `fuse-shared-library-linux` - Direct Linux FUSE support
- `commander` & `rimraf` - Essential utilities only
- `"os": ["linux"]` - Enforces Linux-only deployment

### ✅ Simplified Package Structure
```json
{
  "name": "one.filer",
  "version": "4.0.0-beta-1",
  "description": "ONE File System Bridge for Windows Explorer via WSL2",
  "os": ["linux"],
  "dependencies": {
    "fuse-shared-library-linux": "^1.0.4",
    "commander": "^10.0.0",
    "rimraf": "^4.1.2"
  }
}
```

## Testing Setup

### Minimal FUSE Test
Use `test-fuse-minimal.js` to verify Linux-only FUSE functionality:

```bash
# In Ubuntu WSL2
cd /home/gecko/one.filer
npm install
node test-fuse-minimal.js
```

### Expected Output
```
🔍 Testing Linux-only FUSE implementation...
Platform: linux
✅ fuse-shared-library-linux loaded successfully
✅ FUSE is configured
📂 FUSE library paths: /path/to/libfuse.so
✅ Linux-only FUSE test completed successfully!
```

## Deployment Process

### 1. Clean Installation
```bash
# Remove Windows dependencies
rm -rf node_modules package-lock.json

# Install Linux-only dependencies  
npm install

# Verify platform detection
node -e "console.log('Platform:', process.platform)"
```

### 2. Ubuntu WSL2 Setup
```bash
# Install FUSE libraries
sudo apt update
sudo apt install -y libfuse3-dev libfuse2 build-essential

# Test FUSE functionality
./test-fuse-minimal.js
```

### 3. Custom fuse-native (Optional)
If needed, use `fix-fuse-linux-only.sh` to create a minimal fuse-native wrapper:

```bash
# Run the fix script
bash fix-fuse-linux-only.sh

# This creates node_modules/fuse-native with Linux-only implementation
```

## Benefits

### 🎯 Simplified Architecture
- **Single platform focus**: Linux/WSL2 only
- **Reduced complexity**: No cross-platform FUSE handling
- **Better maintainability**: Fewer dependencies and edge cases

### 🚀 Performance
- **Faster installs**: No Windows driver compilation
- **Native Linux performance**: Direct FUSE implementation
- **WSL2 optimization**: Designed for WSL2 environment

### 🔧 Reliability
- **No WinFsp issues**: Eliminates Windows FUSE driver problems
- **Consistent environment**: Linux-only, predictable behavior
- **Easier debugging**: Single platform to support

## Next Steps

1. **Test Ubuntu deployment** with clean Linux-only setup
2. **Verify FUSE functionality** using test-fuse-minimal.js
3. **Add one.core integration** when GitHub access is available
4. **Create WSL2 installer** for end-user deployment

## Important Notes

- **Windows support**: Provided via WSL2 bridge, not native Windows FUSE
- **one.core dependency**: Temporarily removed due to private repository access
- **FUSE configuration**: May require `sudo` for initial FUSE setup in WSL2
- **Platform enforcement**: Package will only install on Linux systems

This approach eliminates the Windows FUSE complexity while maintaining full functionality through WSL2. 