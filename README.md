# ONE Filer

**Windows orchestrator for ONE Leute Replicant with native Windows ProjectedFS (ProjFS) support**

> ⚠️ **Important Update (July 2025)** – ONE Filer now ships with a *native* Windows ProjectedFS (ProjFS) virtual-filesystem layer that runs directly inside the Electron app. The previous *WSL + FUSE* path is retained only as a fallback. Sections of this README that still reference FUSE or WSL2 are in the process of being migrated.

## 🎯 Project Overview

ONE Filer provides:

- **Windows Orchestration** - Manages ONE Leute Replicant installation and execution in WSL2
- **ProjFS Virtual Filesystem** - Native Windows ProjectedFS implementation for ONE database access (no WSL required)
- **Windows Explorer Integration** - Access ONE data through standard Windows file operations
- **Electron GUI** - User-friendly Windows application for managing the replicant
- **Automated Installation** - PowerShell scripts for seamless WSL2 and Ubuntu setup

## 🏗️ Architecture

### Core Components

1. **ONE Leute Replicant** (This Project)
   - Complete replicant implementation with FUSE filesystem support
   - Runs in WSL2 Ubuntu environment
   - Provides CLI: `one-leute-replicant` with commands:
     - `init` - Initialize new ONE instance
     - `start` - Start replicant with FUSE filesystem
     - `configure` - Manage configuration
     - `delete` - Delete operations

2. **Windows Orchestration**
   - PowerShell installer scripts for WSL2 setup
   - Electron app for GUI management
   - Automatic Ubuntu and dependency installation

3. **ProjFS Integration**
   - Native Linux FUSE3 bindings via N-API
   - Multiple filesystem types:
     - `/chats` - Chat conversations
     - `/objects` - ONE database objects  
     - `/types` - Type definitions
     - `/debug` - Debug information
     - `/invites` - Pairing/invitation system

### How It Works

1. **Electron App (Primary Interface)**:
   - Detects and automatically installs WSL2/Ubuntu if needed
   - Manages ONE Leute Replicant lifecycle (install, init, start, stop)
   - Provides real-time status monitoring and error handling
   - Offers mount point management and file system access
   - Runs in Windows system tray for always-available access

2. **WSL2 Backend**:
   - ONE Leute Replicant runs with full Linux capabilities
   - FUSE filesystem provides native file operations
   - Automatic sync with ONE communication servers
   - Accessible from Windows via `\\wsl$\Ubuntu\path`

3. **User Experience**:
   ```
   User clicks → Electron App → Manages WSL2 → Runs Replicant → FUSE Mount → Windows Explorer
   ```

All complexity is hidden - users just see files in Windows Explorer.

## 🚀 Quick Start

### Prerequisites
- **Windows 10/11** with administrator privileges
- **WSL2** with Ubuntu installed
- **Node.js 20+** in WSL Ubuntu
- **Internet connection** for downloading dependencies
- **4GB+ RAM** recommended

### Installation

#### Option 1: From Source (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/refinio/one.filer.git
   cd one.filer
   ```

2. **Build ONE Filer in WSL**:
   ```bash
   # In WSL Ubuntu
   cd /mnt/c/path/to/one.filer
   npm install
   npm run build
   node fix-all-imports.js  # Fix ES module imports
   ```

3. **Build and run the Electron app**:
   ```bash
   # In Windows
   cd electron-app
   npm install
   npm run build
   npm start
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

## 📁 Project Structure

```
one.filer/
├── src/                    # TypeScript source code
│   ├── commands/          # CLI commands (init, start, configure)
│   ├── filer/            # FUSE filesystem implementation
│   ├── fuse/             # Native FUSE3 bindings
│   └── misc/             # Utilities and helpers
├── electron-app/          # Windows Electron GUI
├── windows-installer/     # PowerShell installation scripts
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
