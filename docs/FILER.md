# OneFiler System Architecture & Deployment Guide

## System Overview

**OneFiler** is a Windows-WSL2 bridge system that provides seamless ONE database access through Windows Explorer. It consists of two main components:

### 1. Core Replicant System (WSL2/Ubuntu)
- **Location**: `/home/gecko/one.filer/` (WSL2 Ubuntu filesystem)
- **Purpose**: FUSE-based virtual filesystem that maps ONE database objects to files/folders
- **Runtime**: Node.js 20+ with native Linux FUSE3 bindings
- **Access**: Creates mountpoint accessible via Windows Explorer through WSL2 bridge

### 2. Windows Control Application (Electron)
- **Location**: `C:\Users\juerg\source\one.filer\electron-app\`
- **Purpose**: Desktop control panel for managing the WSL2 replicant process
- **Features**: Start/stop control, status monitoring, configuration management
- **Deployment**: Windows installer (.exe) and portable executable

## Architecture Flow

```
Windows Explorer
       ↓
WSL2 Filesystem Bridge  
       ↓
FUSE Mount (/mnt/onefiler)
       ↓
OneFiler Replicant (Ubuntu WSL2)
       ↓
ONE Database Instance
```

## Windows Control App - Electron Application

### Purpose
The Electron app serves as the **mission control** for the entire OneFiler system:

1. **Process Management**: Start/stop the WSL2 replicant process
2. **Status Monitoring**: Real-time monitoring of WSL2 and replicant health
3. **Configuration**: Manage ONE instance credentials and config files
4. **User Interface**: Windows-native GUI for non-technical users

### Key Features
- **Direct WSL Integration**: Spawns and manages processes in Ubuntu WSL2
- **Real-time Monitoring**: Periodic status checks and process health monitoring  
- **Secure Credential Handling**: Manages ONE instance secrets securely
- **Enterprise Ready**: Proper Windows installer with configurable installation directory

### Technical Implementation

#### Core Components
- **main.ts**: Main Electron process, handles WSL communication and process spawning
- **preload.ts**: Secure IPC bridge between renderer and main process
- **renderer.ts**: UI logic, status display, user interaction handling
- **MonitoringDashboard.tsx**: React-based real-time status dashboard

#### WSL Integration
```javascript
// Spawns replicant in WSL2 Ubuntu
const wslProcess = spawn('wsl', [
  '-d', 'Ubuntu',
  'bash', '-c', 
  `cd /home/gecko/one.filer && node lib/index.js start --secret ${secret}`
]);
```

#### Build & Packaging System

**Fixed Packaging Issues:**
- **Problem**: Windows permission restrictions prevented code signing tool extraction
- **Solution**: Disabled code signing (`signAndEditExecutable: false`) while maintaining installer functionality
- **Output**: Both NSIS installer and portable executable for maximum deployment flexibility

```json
"win": {
  "target": [
    {"target": "nsis", "arch": ["x64"]},     // Standard installer
    {"target": "portable", "arch": ["x64"]}  // Portable executable
  ],
  "signAndEditExecutable": false,            // Bypass signing issues
  "requestedExecutionLevel": "highestAvailable"
}
```

## Deployment Strategy

### For End Users
1. **Install WSL2**: Enable Windows Subsystem for Linux
2. **Setup Ubuntu**: Install Ubuntu distribution in WSL2
3. **Install OneFiler Core**: Deploy replicant code to `/home/gecko/one.filer/`
4. **Install Control App**: Run `ONE Filer Login Setup 1.0.0.exe`
5. **Launch**: Start the Electron app, enter ONE credentials, click "Start Replicant"

### For Developers
```bash
# Electron app development
cd electron-app
npm install
npm run dev                    # Development mode
npm run build                  # Build TypeScript
npm run dist                   # Create Windows installer

# Core replicant development (in WSL2)
cd /home/gecko/one.filer
npm install
npm run build
npm run start-filer
```

## Current Status & Achievements

### ✅ Completed
- **WSL2 Integration**: Ubuntu environment with Node.js 20.18.0
- **FUSE Filesystem**: Native Linux FUSE3 implementation working
- **TypeScript Build**: All compilation errors resolved, ESM/CommonJS compatibility
- **Electron Packaging**: Windows installer generation fixed, code signing issues resolved
- **Control Interface**: React-based monitoring dashboard with real-time status

### 🔄 In Progress  
- **Windows Explorer Access**: FUSE mount permissions under investigation (Task 15)
- **Two-Tier Data Pipeline**: Structured/unstructured data classification (Task 8)

### ⏳ Next Phase
- **Performance Optimization**: Cross-boundary WSL2↔Windows optimization
- **Enterprise Features**: Advanced configuration, logging, error handling
- **User Experience**: Simplified setup wizard, automatic WSL2 configuration

## Why This Architecture?

### Technical Benefits
1. **Native Performance**: Linux FUSE runs at native speed in WSL2
2. **Windows Integration**: Seamless Explorer access via WSL2 filesystem bridge  
3. **Separation of Concerns**: Control app handles UI, replicant handles filesystem
4. **Enterprise Deployment**: Standard Windows installer with familiar UI

### User Experience Benefits
1. **Zero Learning Curve**: Files appear as regular Windows folders
2. **Native Tools**: Use any Windows application with ONE data
3. **Point-and-Click Control**: No command-line knowledge required
4. **Status Visibility**: Real-time feedback on system health

## File Locations & Structure

```
Windows Side:
C:\Users\juerg\source\one.filer\electron-app\    # Control app source
C:\Program Files\ONE Filer Login\                # Installed control app
C:\Users\[user]\AppData\Local\one-filer-login\   # App data & logs

WSL2 Ubuntu Side:  
/home/gecko/one.filer/                            # Core replicant system
/mnt/onefiler/                                    # FUSE mountpoint
\\wsl$\Ubuntu\mnt\onefiler\                       # Windows Explorer path
```

## Build Artifacts

After successful build (`npm run dist`):
- `dist-app/ONE Filer Login Setup 1.0.0.exe` - Windows installer (NSIS)
- `dist-app/ONE Filer Login 1.0.0.exe` - Portable executable
- `dist-app/win-unpacked/` - Unpacked application directory

## The Big Picture

OneFiler transforms the ONE database from a specialized backend system into a **Windows-native file system experience**. Users can:

- Drag and drop files into ONE database via Windows Explorer
- Open ONE objects with any Windows application  
- Use familiar file operations (copy, paste, rename, delete)
- Access ONE data from any software that works with files
- Manage the entire system through a simple Windows desktop app

This bridges the gap between enterprise database systems and everyday user workflows, making ONE database as accessible as a shared network drive.