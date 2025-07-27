# ONE Filer Quick Start Guide

This guide will get you running ONE Filer with the Electron app in 5 minutes.

## Prerequisites

- Windows 10/11
- WSL2 with Ubuntu installed
- Git

## Step 1: Clone and Build ONE Filer

```bash
# In Windows PowerShell/Terminal
git clone https://github.com/refinio/one.filer.git
cd one.filer

# Switch to WSL Ubuntu
wsl

# In WSL Ubuntu
cd /mnt/c/path/to/one.filer
npm install
npm run build

# IMPORTANT: Fix ES module imports
node fix-all-imports.js
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

## Step 3: Connect to ONE Leute Replicant

1. The ONE Filer Login window will appear
2. Enter your ONE instance secret (password)
3. Click "Connect"
4. Wait for "Connected" status
5. Your files are now accessible!

## Troubleshooting Quick Fixes

### Port Already in Use
```powershell
# Kill all electron processes
powershell -Command "Get-Process electron | Stop-Process -Force"
```

### Module Not Found Errors
```bash
# In WSL
cd /mnt/c/path/to/one.filer
node fix-all-imports.js
node scripts/fix-all-imports.js
```

### Build Errors
```bash
# Clean rebuild
rm -rf lib/ node_modules/
npm install
npm run build
node fix-all-imports.js
```

## Next Steps

- Check `electron-app/README.md` for detailed documentation
- Configure auto-start with Windows
- Set up custom mount points
- Explore the FUSE filesystem at `./mnt`

## Support

- GitHub Issues: https://github.com/refinio/one.filer/issues
- Documentation: See README.md for full details