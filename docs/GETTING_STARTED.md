# Getting Started with ONE.filer

This guide will help you set up ONE.filer to run natively on Windows using ProjFS (Projected File System).

## 🎯 Project Overview

**Goal**: Make ONE objects accessible through Windows Explorer using native Windows filesystem APIs.

**Architecture**:
- **Windows Native**: Runs directly on Windows using Node.js
- **ProjFS**: Windows Projected File System provides virtual filesystem functionality
- **Windows Explorer**: Direct integration at `C:\OneFiler` (configurable)
- **Data Ingestion**: Two-tier approach for structured vs unstructured data

## 🚀 Quick Start

### Step 1: Enable ProjFS on Windows

Run PowerShell as Administrator:
```powershell
# Enable Windows Projected File System feature
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart

# Restart your computer after enabling
```

### Step 2: Install Prerequisites

1. **Node.js** (Windows version 20.0.0+):
   ```powershell
   # Using winget
   winget install OpenJS.NodeJS.LTS
   ```

2. **Visual Studio Build Tools** (for native modules):
   ```powershell
   # Install build tools
   winget install Microsoft.VisualStudio.2022.BuildTools
   # Select "Desktop development with C++" workload during installation
   ```

### Step 3: Install Dependencies

```cmd
# Clone the repository if needed
git clone https://github.com/refinio/one.filer.git
cd one.filer

# Install dependencies
npm install

# Build the project (including native modules)
npm run build
```

### Step 4: Configure ONE.filer

Create or modify a configuration file (`configs/my-config.json`):
```json
{
    "directory": "data",
    "commServerUrl": "wss://comm10.dev.refinio.one",
    "createEveryoneGroup": true,
    "useFiler": true,
    "filerConfig": {
        "useProjFS": true,
        "projfsRoot": "C:\\OneFiler",
        "projfsCacheSize": 104857600,
        "pairingUrl": "https://edda.dev.refinio.one/invites/invitePartner/?invited=true/",
        "iomMode": "light",
        "logCalls": true
    }
}
```

### Step 5: Start ONE.filer

```cmd
# Using command prompt
npm start -- start -s YOUR_SECRET -c configs/my-config.json

# Or use the provided PowerShell script
.\start-projfs.ps1
```

## 🏗️ Architecture Details

### Data Flow
```
Windows Explorer → C:\OneFiler → ProjFS Driver → one.filer → one.projfs → ONE Objects
```

### Two-Tier Data Ingestion

1. **Structured Data** (JSON, XML, CSV, YAML)
   - Parsed and converted directly to ONE objects using existing recipes
   - No BLOB storage needed

2. **Unstructured Data** (Images, PDFs, Binaries)
   - Stored as BLOBs with metadata
   - Uses PersistentFileSystemFile objects with BlobDescriptor references

### Key Components

- **one.core**: Core ONE database functionality
- **one.models**: File system models and recipes
- **one.projfs**: Windows Projected File System integration
- **one.filer**: Main filesystem implementation with ProjFS support

## 📋 Current Task Status

Check current progress:
```powershell
task-master list
```

Get next task:
```powershell
task-master next
```

## 🔧 Development Workflow

1. **Enable ProjFS on Windows**
2. **Install build dependencies**
3. **Configure ONE.filer with ProjFS**
4. **Start the virtual filesystem**
5. **Access via Windows Explorer**

## 🐛 Troubleshooting

### ProjFS Issues
- **"ProjFS not available"**: Enable the Windows feature (see Step 1)
- **Virtual drive not appearing**: Check if path exists and is empty
- **Access denied**: Run as administrator or check folder permissions

### Build Issues
- **node-gyp errors**: Install Visual Studio with C++ workload
- **Module not found**: Run `npm run build` to compile native modules
- **TypeScript errors**: Ensure TypeScript 4.9+ is installed

### Runtime Issues
- **"Secret required"**: Provide the -s parameter when starting
- **Configuration not found**: Use absolute path or check working directory
- **Memory issues**: Adjust `projfsCacheSize` in configuration

## 📚 Resources

- [ONE First Principles](https://docs.refinio.one/one_first_principles/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [FUSE Documentation](https://www.kernel.org/doc/html/latest/filesystems/fuse.html)

## 🎯 Next Steps

1. Enable ProjFS feature on Windows
2. Install Node.js and build tools
3. Build and configure ONE.filer
4. Start the virtual filesystem
5. Open `C:\OneFiler` in Windows Explorer

## 📋 Advanced Configuration

### Performance Tuning
```json
{
    "filerConfig": {
        "projfsCacheSize": 209715200,  // 200MB cache
        "poolThreadCount": 8,          // Increase thread pool
        "concurrentThreadCount": 0      // Auto-detect
    }
}
```

### Multiple Virtual Drives
You can run multiple instances with different mount points:
```cmd
# Instance 1
npm start -- start -s SECRET1 -c config1.json

# Instance 2 (different projfsRoot)
npm start -- start -s SECRET2 -c config2.json
``` 