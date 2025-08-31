# Running ONE.filer with Windows ProjectedFS

## The Problem
The current setup uses FUSE in WSL, which creates a filesystem that Windows cannot properly access. Windows sees the WSL filesystem path (\\wsl$\Ubuntu\...) but cannot interact with the FUSE-mounted content properly.

## The Solution
Use Windows ProjectedFS (ProjFS) to create a native Windows virtual filesystem that any Windows application can access directly.

## How to Run

### From Windows Command Prompt or PowerShell:

1. Open Command Prompt or PowerShell as Administrator (required for first run)

2. Navigate to the one.filer directory:
   ```
   cd C:\Users\juerg\source\one.filer
   ```

3. Run the ProjFS version:
   ```
   start-projfs.cmd
   ```
   
   Or with PowerShell:
   ```
   .\start-projfs.ps1
   ```

### What This Does

1. Creates a virtual drive at `C:\OneFiler` (by default)
2. Uses Windows ProjectedFS API for native performance
3. Provides direct access from any Windows application
4. No WSL/FUSE overhead

### Configuration

The ProjFS integration uses these environment variables:
- `ONE_SECRET` - The password (defaults to "test123" for demo)
- `PROJFS_ROOT` - Where to create the virtual drive (defaults to "C:\OneFiler")
- `ONE_DIRECTORY` - Where to store ONE data (defaults to ".one-data")

### Features

- Native Windows Explorer integration
- Direct access from all Windows applications
- High performance (no WSL translation layer)
- Content-addressed storage with deduplication
- Real-time synchronization

### Architecture

```
Windows Application (Explorer, Office, etc.)
              ↓
      ProjFS Driver (Windows Kernel)
              ↓
      projfs.one (Node-API)
              ↓
        one.filer
              ↓
   Content-Addressed Storage
```

This provides a truly native Windows experience without the limitations of WSL FUSE mounts.