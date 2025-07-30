# ONE Filer Electron App

A comprehensive Electron application that serves as both a working implementation and **development template** for integrating ONE database content with native desktop applications. This app demonstrates the complete architecture for building virtual filesystem applications using the one.filer legacy codebase as a foundation.

## Architecture Overview

This Electron app showcases how to integrate the complete one.filer stack:

```
┌─────────────────────────────────────┐
│        Electron Main Process        │
│  ┌─────────────────────────────────┐ │
│  │     ServiceManager              │ │  ← Service orchestration
│  │  ┌─────────────┬─────────────┐  │ │
│  │  │ WSL Service │ Replicant   │  │ │  ← Process management
│  │  │             │ Service     │  │ │
│  │  └─────────────┴─────────────┘  │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
            │ IPC Communication
┌─────────────────────────────────────┐
│       Renderer Process (React)      │
│  ┌─────────────────────────────────┐ │
│  │   Dashboard & Monitoring UI     │ │  ← Real-time metrics
│  │  ┌─────────────┬─────────────┐  │ │
│  │  │ Drive Mgmt  │ System Stats│  │ │  ← Drive management
│  │  │             │             │  │ │
│  │  └─────────────┴─────────────┘  │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
            │ Spawns & Manages
┌─────────────────────────────────────┐
│     one.filer in WSL (Template)     │
│  ┌─────────────────────────────────┐ │
│  │           Replicant             │ │  ← Core ONE database
│  │  ┌─────────────┬─────────────┐  │ │
│  │  │   Models    │    Filer    │  │ │  ← Data models & FS
│  │  │  (Template) │ (Template)  │  │ │
│  │  └─────────────┴─────────────┘  │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
            │ Uses either
┌─────────────────────────────────────┐
│    Filesystem Implementation        │
│  ┌─────────────┬─────────────────┐  │
│  │  FUSE3 WSL  │ ProjFS Windows  │  │  ← Platform adapters
│  │             │ (projfs-fuse)   │  │
│  └─────────────┴─────────────────┘  │
└─────────────────────────────────────┘
```

## Template Components from one.filer

This app demonstrates how to integrate these key one.filer components:

### 1. **Replicant Core** (`src/Replicant.ts`)
- Central orchestrator for ONE database access
- Model initialization and lifecycle management
- Platform-aware FUSE/ProjFS selection

### 2. **Filer System** (`src/filer/`)
- `FilerWithProjFS.ts` - Enhanced filer supporting both FUSE and ProjFS
- `FuseApiToIFileSystemAdapter.ts` - FUSE operation translation layer
- Platform detection and dynamic module loading

### 3. **Service Management**
- Process orchestration for WSL and replicant services
- Health monitoring and automatic restart capabilities
- Inter-process communication patterns

### 4. **Configuration Management**
- JSON-based configuration with environment-specific defaults
- Secure credential handling patterns
- Dynamic path resolution for cross-platform support

## Features

- **System Tray Integration** - Background operation with quick access
- **Cross-platform Filesystem** - Uses FUSE3 (WSL) or ProjFS (Windows native)
- **Real-time Monitoring** - Live metrics from one.filer replicant
- **Service Orchestration** - Automated WSL and replicant management
- **Secure Credential Management** - Safe handling of ONE instance secrets
- **Single Instance Enforcement** - IPC-based instance coordination
- **Development Dashboard** - React-based monitoring and diagnostics UI

## Prerequisites

- Windows 10 version 1809+ or Windows 11
- Windows Projected File System (ProjFS) enabled
- Node.js 20+ for Windows
- Visual Studio Build Tools (for native modules)
- ONE Filer built and ready at `C:\Users\juerg\source\one.filer`

## Template Usage

### For New Projects

Use this Electron app as a template for building your own ONE-integrated applications:

1. **Study the Architecture**: Review the service management patterns in `src/main.ts`
2. **Adapt the Models**: Modify the one.filer integration to suit your data needs
3. **Customize the UI**: Replace the React dashboard with your application interface
4. **Configure Services**: Adjust `ServiceManager.ts` for your specific service requirements

### Development Setup

```bash
# Clone the repository
git clone https://github.com/refinio/one.filer.git
cd one.filer/electron-app

# Install dependencies
npm install

# Build TypeScript and CSS
npm run build

# Run in development mode
npm run dev

# Or just start normally
npm start
```

### Integration Patterns

The app demonstrates several key integration patterns you can reuse:

#### 1. **Service Orchestration Pattern** (`ServiceManager.ts`)
```typescript
// Template for managing external services
const serviceManager = new ServiceManager();
serviceManager.registerService({
  name: 'your-service',
  healthCheck: async () => { /* check logic */ },
  startCommand: 'your-start-command',
  retryAttempts: 3
});
```

#### 2. **Cross-platform Filesystem Pattern** (`FilerWithProjFS.ts`)  
```typescript
// Template for platform-aware filesystem mounting
if (this.config.useProjFS) {
  await this.initProjFS();  // Windows native
} else {
  await this.initFUSE();   // WSL/Linux
}
```

#### 3. **IPC Communication Pattern** (`main.ts`)
```typescript
// Template for secure renderer-main communication
ipcMain.handle('your-action', async (event, data) => {
  // Your logic here using one.filer patterns
  return { success: true, data: result };
});
```

## Building for Distribution

```bash
# Build Windows installer (.exe)
npm run build-win

# Build portable version
npm run dist
```

Output files will be in `dist-app/` directory.

## Usage

### First Time Setup

1. **Build ONE Filer in WSL first**:
   ```bash
   # In WSL Ubuntu
   cd /mnt/c/Users/juerg/source/one.filer
   npm install
   npm run build
   node fix-all-imports.js  # Important: Fix ES module imports
   ```

2. **Launch the Electron app**:
   ```bash
   cd electron-app
   npm start
   ```

3. **Connect to ONE Leute Replicant**:
   - Enter your ONE instance secret (password)
   - Optionally specify a custom config file path
   - Click "Connect" to start ONE Filer
   - The app will show "Connected" when successful

### Daily Usage

1. Launch "ONE Filer Login" from Start Menu or desktop
2. App starts in system tray
3. Click tray icon to show/hide window
4. Enter credentials and connect
5. Access your files via the FUSE mount point

## Configuration

The app uses `config.json` for settings:

```json
{
  "startMinimized": false,
  "showInSystemTray": true,
  "autoConnect": false,
  "wslDistro": "Ubuntu",
  "replicantPath": "/mnt/c/Users/juerg/source/one.filer"
}
```

## Troubleshooting

### "Another instance is already running"
```bash
# Kill existing electron processes
powershell -Command "Get-Process electron | Stop-Process -Force"
```

### "Cannot find module" errors in WSL
```bash
# Fix ES module imports
cd /mnt/c/Users/juerg/source/one.filer
node fix-all-imports.js
```

### App won't start
1. Check if port 17890 is in use: `netstat -an | findstr 17890`
2. Ensure all dependencies are installed: `npm install`
3. Rebuild: `npm run build`

### ONE Filer won't start
- Verify ONE Filer is built in WSL: `ls -la lib/`
- Check WSL is running: `wsl --list --running`
- Ensure correct path in main.ts (should be `/mnt/c/Users/juerg/source/one.filer`)

## Template Architecture Analysis

### Core Components to Reuse

#### **Main Process** (`src/main.ts`)
- **Service orchestration**: Uses `ServiceManager` to coordinate WSL and replicant processes
- **Single instance enforcement**: IPC-based instance locking prevents conflicts  
- **System tray integration**: Background operation with contextual menu updates
- **Secure IPC handlers**: Structured request/response pattern for renderer communication

#### **Service Management** (`src/services/ServiceManager.ts`)
- **Health monitoring**: Automatic service health checks with configurable retry logic
- **Dependency management**: Services can depend on other services (e.g., replicant needs WSL)
- **Event-driven architecture**: Emits status changes for UI updates
- **Process lifecycle**: Proper cleanup and graceful shutdown handling

#### **React Dashboard** (`src/renderer/`)
- **Real-time metrics**: Live monitoring of one.filer replicant performance
- **Drive management**: UI for managing virtual filesystem mounts
- **System diagnostics**: Comprehensive system health reporting
- **Responsive design**: Professional dashboard using Tailwind CSS and Radix UI

#### **Integration Layer**
- **one.filer bridge**: Spawns and manages the complete one.filer stack in WSL
- **Configuration management**: Environment-aware config loading and validation
- **Cross-platform paths**: Dynamic path resolution for Windows/WSL integration
- **Error handling**: Comprehensive error reporting with user-friendly messages

### Key Design Patterns

1. **Process Orchestration**: ServiceManager coordinates multiple dependent services
2. **Event-Driven Updates**: Status changes propagate through EventEmitter patterns  
3. **Secure IPC**: All renderer-main communication uses `ipcMain.handle()` with typing
4. **Graceful Degradation**: UI adapts based on service availability and health
5. **Configuration-Driven**: Behavior controlled through JSON config files