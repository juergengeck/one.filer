# Windows ProjFS Setup Instructions

## Important: Run from Windows, not WSL!

The ProjFS integration only works when running from native Windows, not from WSL. This is because:

1. **Platform Detection**: When running from WSL, `process.platform` returns 'linux', not 'win32'
2. **ProjFS is Windows-only**: ProjectedFS is a Windows kernel feature that cannot be accessed from WSL
3. **FUSE in WSL is not accessible from Windows**: The FUSE mount created in WSL is only visible within WSL

## How to Run

### From Windows Command Prompt or PowerShell:

```cmd
cd C:\Users\juerg\source\one.filer
node test-projfs-direct.js
```

Or use the provided scripts:

```cmd
.\test-projfs-now.cmd
```

### Configuration

Make sure your config file (e.g., `configs/windows-native.json`) has ProjFS enabled:

```json
{
    "filerConfig": {
        "useProjFS": true,
        "projfsRoot": "C:\\OneFiler",
        "projfsCacheSize": 104857600
    }
}
```

## Architecture

- **Windows Native**: Uses ProjFS (ProjectedFS) - same technology as OneDrive
- **Linux/WSL**: Uses FUSE (Filesystem in Userspace)
- **Dynamic Loading**: Modules are loaded based on platform to avoid errors

## Troubleshooting

If you see FUSE errors when running on Windows:
1. Make sure you're running from Windows, not WSL
2. Check that `useProjFS: true` is set in your config
3. Verify the native module is built: `one.projfs/build/Release/projfs.node`