# ONE Filer Quick Start Guide

This guide will get you running ONE Filer with native Windows ProjFS support in 5 minutes.

## Prerequisites

- Windows 10 version 1809+ or Windows 11
- Node.js 20+ for Windows
- Visual Studio 2022 or Build Tools
- Git

## Step 1: Enable ProjFS and Clone Project

```powershell
# Enable ProjFS (run as Administrator)
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
# Restart computer after this

# Clone the repository
git clone https://github.com/refinio/one.filer.git
cd one.filer

# Install and build
npm install
npm run build
```

## Step 2: Build and Start Electron App

```bash
# Back in Windows (exit WSL first)
exit

# In Windows
cd electron-app
npm install
npm run build
npm start
```

## Step 3: Start ONE Filer with ProjFS

```cmd
# Quick start with demo config
npm start -- start -s YOUR_SECRET -c configs/demo-config.json

# Or use PowerShell script
.\start-projfs.ps1
```

1. Enter your ONE instance secret when prompted
2. Wait for "Filer file system was mounted at C:\OneFiler"
3. Open Windows Explorer and navigate to C:\OneFiler
4. Your files are now accessible!

## Troubleshooting Quick Fixes

### Port Already in Use
```powershell
# Kill all electron processes
powershell -Command "Get-Process electron | Stop-Process -Force"
```

### ProjFS Not Available
```powershell
# Check if enabled
Get-WindowsOptionalFeature -Online -FeatureName Client-ProjFS

# Enable if needed (as Administrator)
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart
```

### Build Errors
```cmd
# Clean rebuild
npm run clean
npm install
npm run build

# Rebuild native modules if needed
cd one.projfs
npm run build:native
cd ..
```

## Next Steps

- Explore the virtual filesystem at C:\OneFiler
- Configure custom mount points in config files
- Check performance with `npm run test:performance`
- Set up auto-start with Windows Task Scheduler

## Support

- GitHub Issues: https://github.com/refinio/one.filer/issues
- Documentation: See README.md for full details