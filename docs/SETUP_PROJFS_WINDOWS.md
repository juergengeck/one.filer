# Setting up ProjFS on Windows

## Prerequisites

1. **Node.js for Windows** (not WSL)
   - Download from https://nodejs.org/
   - Install the Windows version (not WSL)

2. **Visual Studio Build Tools** (for native modules)
   - Download from https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++" workload
   - Or install Visual Studio Community with C++ support

3. **Administrator privileges** (for first-time setup)

## Setup Steps

1. **Open PowerShell or Command Prompt as Administrator**

2. **Navigate to the one.filer directory:**
   ```
   cd C:\Users\juerg\source\one.filer
   ```

3. **Run the setup script:**
   ```
   setup-projfs.cmd
   ```
   
   This will:
   - Install npm dependencies
   - Build the native ProjFS module
   - Configure the environment

4. **Run ONE.filer with ProjFS:**
   ```
   start-projfs.cmd
   ```

## If Setup Fails

### Missing node-gyp-build
```
npm install -g node-gyp
npm install -g node-gyp-build
```

### Missing Visual Studio Build Tools
1. Download Visual Studio Installer
2. Install "Desktop development with C++" workload
3. Restart your computer

### Manual Installation
```
cd one.projfs
npm install
npm run build
```

## Architecture

The ProjFS integration runs entirely on Windows (not WSL):
- Uses Windows ProjectedFS API
- Creates a native virtual filesystem
- Direct access from all Windows applications
- No WSL/FUSE translation overhead

## Troubleshooting

1. **"Cannot find module 'node-gyp-build'"**
   - Install it globally: `npm install -g node-gyp-build`
   - Or run setup-projfs.cmd

2. **"Platform not supported"**
   - Make sure you're running from Windows, not WSL
   - Use Windows PowerShell or Command Prompt

3. **Build errors**
   - Install Visual Studio Build Tools
   - Ensure Python is installed (comes with node-gyp)

4. **"Not running as Administrator"**
   - Right-click PowerShell/CMD and select "Run as Administrator"
   - Required only for first-time ProjFS registration