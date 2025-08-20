# ONE Filer Windows

**Native Windows filesystem integration for ONE database using ProjectedFS (ProjFS)**

> ✨ **one.filer.windows** – Native Windows ProjectedFS (ProjFS) support for seamless Windows Explorer integration. For Linux support, see `one.filer.linux` in the `linux/` directory.

## 🎯 Project Overview

ONE Filer provides:

- **Native Windows Support** - Uses Windows ProjectedFS (ProjFS) for direct filesystem integration
- **Cross-Platform** - FUSE support for Linux/WSL2 environments
- **Windows Explorer Integration** - Access ONE data through standard Windows file operations
- **Virtual Filesystem** - Multiple filesystem types for different data views
- **High Performance** - Native filesystem operations with caching and optimization

## 🏗️ Architecture

### Package Structure

```
one.filer.windows/            # This project - Windows implementation
├── src/                      # Core implementation
│   ├── filer/               # Filesystem implementations
│   │   ├── Filer.ts        # Base/FUSE implementation
│   │   └── FilerWithProjFS.ts  # Windows ProjFS
│   └── Replicant.ts        # Orchestrator
├── linux/                   # Linux packages
│   ├── refinio-fuse3/      # Pure FUSE3 N-API bindings
│   └── one.filer.linux/    # Complete Linux implementation
└── one.leute.replicant/    # Standard orchestrator (updated)
```

### Core Components

1. **ONE Filer Core**
   - TypeScript/Node.js application
   - Manages ONE database connections and data access
   - Provides CLI: `one-filer` with commands:
     - `init` - Initialize new ONE instance
     - `start` - Start with filesystem mount
     - `configure` - Manage configuration
     - `delete` - Delete operations

2. **Filesystem Backends**
   - **Windows**: Native ProjectedFS (ProjFS) integration
   - **Linux/WSL2**: Modern FUSE3 via @refinio/fuse3
   - Automatic backend selection based on platform

3. **Virtual Filesystem Structure**
   - `/chats` - Chat conversations
   - `/objects` - ONE database objects  
   - `/types` - Type definitions
   - `/debug` - Debug information
   - `/invites` - Pairing/invitation system

### Related Packages

- **[one.leute.replicant](https://github.com/juergengeck/one.leute.replicant)** - Standard orchestrator with Filer support, now using @refinio/fuse3
- **one.filer.linux** (in `linux/` directory) - Complete Linux implementation using FUSE3
- **@refinio/fuse3** (in `linux/refinio-fuse3/`) - Modern FUSE3 N-API bindings replacing fuse-native

### Platform-Specific Packages

| Platform | Package | Technology | Location |
|----------|---------|------------|----------|
| Windows | `one.filer.windows` | ProjectedFS (ProjFS) | This project |
| Linux | `one.filer.linux` | FUSE3 via @refinio/fuse3 | `linux/one.filer.linux/` |
| Cross-platform | `one.leute.replicant` | Both ProjFS and FUSE3 | Separate repo |

### How It Works

#### Windows (ProjFS Mode)
1. **Application Start**: ONE Filer detects Windows platform
2. **ProjFS Provider**: Initializes Windows ProjectedFS provider
3. **Virtual Directory**: Creates virtual directory (e.g., `C:\OneFiler`)
4. **On-Demand Loading**: Files are loaded from ONE database as accessed
5. **Windows Explorer**: Native integration with all Windows applications

#### Linux/WSL2 (FUSE Mode)
1. **Application Start**: ONE Filer detects Linux environment
2. **FUSE Mount**: Creates FUSE filesystem mount point
3. **File Access**: Provides POSIX-compliant file operations
4. **Cross-Platform**: Accessible from Windows via `\\wsl$\` path

### Technical Details

- **ProjFS**: Windows Projected File System API for virtual filesystems
- **Performance**: Lazy loading with intelligent caching
- **Compatibility**: Works with all Windows applications
- **Security**: Respects ONE database access permissions

### ProjFS Integration & Caching Architecture

This project uses a layered architecture where JavaScript is the single source of truth (SoT) for directory listings, with native components focused on fast delivery and TTL-based memory caching.

Components
- **Native (C++)**
  - `ContentCache` (`package/src/content_cache.cpp`): In-memory TTL caches for file info, directory listings, and small file content; provides hit/miss stats and invalidation.
  - `AsyncBridge` (`package/src/async_bridge.cpp`): Bridges async JS callbacks (getFileInfo, readDirectory, readFile). Directory caching in the native layer is disabled to avoid double-caching conflicts; JS owns directory caching.
- **JavaScript/TypeScript**
  - `CachedProjFSProvider` (`src/filer/CachedProjFSProvider.ts`): Wires the native ProjFS provider to ONE’s `IFileSystem`, normalizes paths, sets up file-content callbacks, boot-time persistent cache preload, and optional pre-mount directory prefetch.
  - `PersistentCache` (`src/cache/PersistentCache.ts`): Hybrid cache with in-memory LRU for file content and on-disk JSON metadata/`.bin` blobs. Validates entries (non-empty `name`) and persists/restores directory listings and files.
  - `SmartCacheManager` (`src/cache/SmartCacheManager.ts`): Strategy-driven sync that reads directories, validates entries, writes to `PersistentCache`, and is the sole component that publishes directory listings to the native provider via `setCachedDirectory`.

Caching Policy (Directory Listings)
- **Single SoT: JavaScript**
  - Directory listings are discovered and validated in JS.
  - `AsyncBridge::FetchDirectoryListing` no longer writes to the native `ContentCache` to prevent conflicting formats or empty-name items.
  - All `setCachedDirectory` calls are validated (skip entries without a `name`).

File Content Path
- Native file-content callbacks route to `fileSystem.readFile`.
- On successful reads, content can be pushed to the native cache (`setCachedContent`) to fulfill pending requests quickly.
- `PersistentCache` optionally stores small file content on disk to improve future access latency.

Startup/Prefetch
- On mount, `CachedProjFSProvider` preloads persisted directory listings to warm in-memory structures.
- Optional: pre-mount directory prefetch and native cache population is controlled by `preMountNativeDirectoryCache` (default: disabled) to avoid competing with runtime sync.

High-level Flow (Directory Enumeration)
```text
Windows Explorer
  → ProjFS Provider (native)
    → JS IFileSystem.readDir/stat (via provider)
      → Build validated entries (ensure non-empty names)
      → PersistentCache.cacheDirectory(entries)
      → SmartCacheManager may publish to native via setCachedDirectory(entries)
      → ProjFS returns entries to Explorer
```

Operational Notes
- Validation prevents the “empty name” issue that caused missing files (e.g., PNGs in `/invites`).
- Only one component should publish directory listings to native cache to avoid conflicts.
- Persistent cache is append-friendly and validated at write time; stale entries are refreshed by periodic/scheduled syncs.

## 🚀 Quick Start

### Prerequisites

#### For Windows (ProjFS)
- **Windows 10 version 1809+** or **Windows 11**
- **Visual Studio 2022** or Build Tools with C++ support
- **Windows SDK** (10.0.19041.0 or later)
- **Node.js 20+**
- **Python 3.x** (for node-gyp)

#### For Linux/WSL2 (FUSE)
- **WSL2** with Ubuntu 20.04+
- **Node.js 20+**
- **FUSE3** development libraries
- **Build essentials** (gcc, make, etc.)

### Installation

#### Option 1: From Source (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/refinio/one.filer.git
   cd one.filer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build ProjFS native module (Windows only)**:
   ```bash
   cd one.projfs
   npm install
   npm run build
   cd ..
   ```

4. **Build ONE Filer**:
   ```bash
   npm run build
   ```

5. **Run ONE Filer**:
   ```bash
   # Windows (uses ProjFS automatically)
   node lib/src/index.js start --config configs/windows-native.json --secret YOUR_SECRET
   
   # Linux/WSL2 (uses FUSE)
   node lib/src/index.js start --config configs/demo-config.json --secret YOUR_SECRET
   ```

#### Option 2: Pre-built Release

1. **Download** the latest release from [Releases](https://github.com/refinio/one.filer/releases)
2. **Run** `ONE Filer Login Setup 1.0.0.exe` as Administrator
3. **Follow** the installation wizard

### Using ONE Filer

#### Electron App (Primary Interface)

Launch **ONE Filer Login** from your desktop or start menu, or run `npm start` in the electron-app directory.

**Main Features:**
- **Login Screen** - Enter your ONE instance secret/password
- **Status Monitoring** - Real-time connection status to ONE Leute Replicant
- **System Tray** - Minimizes to system tray for background operation
- **Auto-start** - Can be configured to start with Windows
- **Mount Management** - Automatically mounts FUSE filesystem when connected

**First Run:**
1. Launch the ONE Filer Login app
2. Enter your ONE instance secret (password)
3. Click "Connect" to start ONE Filer in WSL
4. The app will show "Connected" when successfully running
5. Access your files via the mount point (typically `./mnt` in the one.filer directory)

**Typical Workflow:**
1. Launch ONE Filer
2. Click **"Setup WSL2"** if prompted (first time only)
3. Click **"Initialize Instance"** to create your ONE database
4. Enter your secret passphrase
5. Click **"Start Replicant"** 
6. Access your files at the mount point shown

#### Admin Scripts (Secondary - For Advanced Users)

For administrators who need command-line access:

```powershell
# PowerShell installer
windows-installer\install-one-filer-standalone.ps1

# Batch scripts
windows-installer\init-one-filer.bat    # Initialize instance
windows-installer\start-one-filer.bat   # Start replicant

# Direct WSL2 command
wsl -d Ubuntu -- one-leute-replicant start --secret "your-secret"

```

## ⚙️ Configuration

### ProjFS Configuration (Windows)

```json
{
  "filerConfig": {
    "useProjFS": true,              // Enable ProjFS mode
    "projfsRoot": "C:\\OneFiler",   // Virtual directory location
    "projfsCacheSize": 104857600,   // Cache size in bytes (100MB)
    "mountPoint": "C:\\OneFiler",   // Same as projfsRoot for compatibility
    "logCalls": true                // Enable debug logging
  }
}
```

### FUSE Configuration (Linux/WSL2)

```json
{
  "filerConfig": {
    "mountPoint": "/home/user/one-files",
    "fuseOptions": {
      "force": true,    // Force mount even if directory exists
      "mkdir": true     // Create mount directory if missing
    }
  }
}
```

## 📁 Project Structure

```
one.filer/
├── src/                    # TypeScript source code
│   ├── commands/          # CLI commands (init, start, configure)
│   ├── filer/            # Filesystem implementations
│   │   ├── Filer.ts      # FUSE implementation
│   │   └── FilerWithProjFS.ts  # ProjFS implementation
│   └── misc/             # Utilities and helpers
├── one.projfs/           # ProjFS native module
│   ├── src/native/       # C++ native bindings
│   ├── src/provider/     # ProjFS provider implementation
│   └── binding.gyp       # Native build configuration
├── configs/              # Configuration examples
├── vendor/               # Packaged dependencies
└── lib/                  # Built JavaScript (generated)
```

## 🔧 Development

### Primary Focus: Electron App Enhancement

The Electron app is the primary user interface and should handle all user operations:

**Core Capabilities to Implement:**
- **WSL2 Detection & Installation** - Automatically detect and install WSL2/Ubuntu
- **Replicant Management** - Install, initialize, start, stop ONE Leute Replicant in WSL2
- **Mount Point Management** - Configure and manage FUSE mount locations
- **Real-time Monitoring** - Show replicant status, sync progress, error states
- **Configuration GUI** - User-friendly interface for all settings
- **System Integration** - Windows notifications, system tray, file associations

### Building the Project

```bash
# Build the replicant backend (in WSL2)
cd ~/one.filer
npm install && npm run build

# Build the Electron app (from Windows)
cd electron-app
npm install && npm run build
```

### Electron App Architecture

```
electron-app/
├── src/main.ts          # Main process - WSL2 management
├── src/renderer/        # UI components
├── src/preload.js       # Security bridge
└── assets/              # Icons, resources
```

**Key Integration Points:**
- Execute WSL2 commands via `child_process.spawn`
- Monitor replicant status through WSL2 communication
- Provide mount point access via Windows file explorer
- Handle all error states with user-friendly messages

### Creating Distribution Package

```bash
# Package replicant for WSL2 deployment
npm pack  # Creates vendor/refinio-one.leute.replicant-latest.tgz

# Build Electron installer
cd electron-app
npm run dist  # Creates OneFiler-Setup.exe
```

## ⚙️ Configuration

### Replicant Configuration (`configs/replicant.json`)
```json
{
  "commServerUrl": "wss://comm.example.com",
  "useFiler": true,
  "filerConfig": {
    "mountPoint": "/home/user/one-files",
    "windowsIntegration": {
      "enabled": true,
      "wsl2Mode": true
    }
  }
}
```

### Key Options
- `commServerUrl` - Communication server for syncing
- `useFiler` - Enable FUSE filesystem
- `mountPoint` - Where to mount the filesystem
- `windowsIntegration` - Enable Windows-specific features

## 🐛 Troubleshooting

### Common Issues

#### "Another instance is already running"
```bash
# Kill all electron processes
powershell -Command "Get-Process electron | Stop-Process -Force"

# Or find process on port 17890
netstat -an | findstr 17890
```

#### ES Module Import Errors
```bash
# In WSL, run the import fix script
cd /mnt/c/path/to/one.filer
node fix-all-imports.js
# Or
node scripts/fix-all-imports.js
```

#### "Cannot find module" errors
1. Ensure you've built the project: `npm run build`
2. Fix ES module imports: `node fix-all-imports.js`
3. Check that `lib/` directory exists with compiled JS files

#### WSL/Ubuntu Issues
- Ensure WSL2 is installed: `wsl --install`
- Check WSL is running: `wsl --list --running`
- Install Ubuntu: `wsl --install -d Ubuntu`
- Update WSL: `wsl --update`

#### Electron App Won't Start
1. Check Node.js version: `node --version` (should be 20+)
2. Reinstall dependencies:
   ```bash
   cd electron-app
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

#### ONE Filer Won't Connect
- Verify your secret/password is correct
- Check the config file path is valid
- Ensure ONE Leute Replicant service is accessible
- Check firewall settings for WSL2

### ProjFS Issues (Windows)

1. **ProjFS Native Module Build Fails**
   - Install Visual Studio 2022 with "Desktop development with C++"
   - Install Windows SDK 10.0.19041.0 or later
   - Run from "Developer Command Prompt for VS 2022"
   - Check Python is installed: `python --version`

2. **"ProjectedFSLib.lib not found"**
   - Ensure Windows SDK is properly installed
   - ProjFS requires Windows 10 version 1809 or later
   - Check if ProjFS is enabled: `Get-WindowsOptionalFeature -Online -FeatureName Client-ProjFS`

3. **Virtual Directory Not Accessible**
   - Run as Administrator for first-time setup
   - Check if directory exists: `dir C:\OneFiler`
   - Ensure no antivirus is blocking virtual filesystem

### Development Issues

1. **Permission Denied on FUSE Mount**
   ```bash
   sudo usermod -a -G fuse $USER
   # Log out and back in
   ```

2. **TypeScript Build Errors**
   - Version mismatch between one.core and one.models
   - Solution: Use the vendor packages provided

3. **WSL2 Not Found**
   - Enable WSL2 in Windows Features
   - Install Ubuntu from Microsoft Store

4. **FUSE Not Working**
   ```bash
   # Check FUSE is installed
   fusermount3 --version
   
   # Install if missing
   sudo apt install fuse3 libfuse3-dev
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes in WSL2 environment
4. Test with `npm test`
5. Submit a pull request

## 📚 Additional Resources

- [FUSE Documentation](https://www.kernel.org/doc/html/latest/filesystems/fuse.html)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [ONE Core Documentation](https://github.com/refinio/one.core)
- [Electron Documentation](https://www.electronjs.org/)

## 📄 License

See [LICENSE.md](LICENSE.md) for details.
