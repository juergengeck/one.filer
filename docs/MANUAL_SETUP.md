# Manual Setup Guide for ONE.filer

Step-by-step guide for setting up ONE.filer on Windows with ProjFS support.

## 🔧 Manual Setup Steps

### Step 1: Enable Windows ProjFS Feature

Open **PowerShell as Administrator** and run:
```powershell
# Enable Projected File System
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart

# Restart your computer to apply changes
Restart-Computer
```

### Step 2: Install Prerequisites

#### Install Node.js for Windows
```cmd
# Using winget (recommended)
winget install OpenJS.NodeJS.LTS

# Or download from https://nodejs.org/
# Choose the LTS version for Windows
```

#### Install Visual Studio Build Tools
```cmd
# Install build tools for native modules
winget install Microsoft.VisualStudio.2022.BuildTools

# During installation, select:
# - "Desktop development with C++" workload
# - Windows 10/11 SDK
```

### Step 3: Clone and Build Project

```cmd
# Clone the repository
git clone https://github.com/refinio/one.filer.git
cd one.filer

# Install dependencies
npm install

# Build the project (including native ProjFS module)
npm run build
```

### Step 4: Configure ONE.filer

Create a configuration file `configs/my-config.json`:
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

### Step 5: Initialize ONE Instance

```cmd
# Create a new ONE instance
npm start -- init -s YOUR_SECRET -d data
```

### Step 6: Start ONE.filer with ProjFS

```cmd
# Start the service
npm start -- start -s YOUR_SECRET -c configs/my-config.json

# Or use the demo configuration
npm start -- start -s YOUR_SECRET -c configs/demo-config.json
```

## 🎯 Expected Results

- ✅ ProjFS feature enabled on Windows
- ✅ Node.js LTS installed (v20+)
- ✅ Visual Studio Build Tools installed
- ✅ Project built successfully
- ✅ Virtual filesystem mounted at `C:\OneFiler`
- ✅ Files accessible via Windows Explorer

## 🐛 If Something Goes Wrong

### ProjFS Not Available
```powershell
# Check if ProjFS is enabled
Get-WindowsOptionalFeature -Online -FeatureName Client-ProjFS

# If not enabled, run as Administrator:
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
```

### Build Errors
```cmd
# Clean and rebuild
npm run clean
cd one.projfs
npm install
npm run build:native
cd ..
npm run build
```

### Permission Issues
```cmd
# Run as Administrator or check folder permissions
icacls "C:\OneFiler" /grant "%USERNAME%:F"
```

## 🚀 Next Steps After Setup

1. Open Windows Explorer and navigate to `C:\OneFiler`
2. Create and modify files through Windows Explorer
3. Test different file operations (copy, move, delete)
4. Monitor performance and logs

## 📝 Notes

- ProjFS provides native Windows filesystem integration
- The virtual filesystem is created on-demand
- All operations are performed through standard Windows APIs
- For Linux/WSL2, the system automatically falls back to FUSE mode 