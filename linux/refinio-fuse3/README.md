# @refinio/fuse3

Modern FUSE3 N-API bindings for Node.js - Pure native bindings without business logic.

## Overview

This package provides low-level FUSE3 (Filesystem in Userspace) bindings for Node.js applications running on Linux. It serves as a modern replacement for the outdated `fuse-native` package, offering direct access to the FUSE3 API through a native N-API addon.

**Key Features:**
- ✅ **FUSE3 Protocol Support** - Uses the latest FUSE protocol
- ✅ **Modern Node.js Compatibility** - Works with Node.js 18+
- ✅ **N-API Bindings** - Stable across Node.js versions
- ✅ **Pure Native Layer** - No business logic, just bindings
- ✅ **TypeScript Support** - Full type definitions included
- ✅ **Linux/Debian Focus** - Optimized for Linux systems

## Architecture Position

This package sits at the lowest level of the ONE.filer stack:

```
┌─────────────────────────────────────────────┐
│         Application Layer                    │
├─────────────────────────────────────────────┤
│   one.leute.replicant (orchestrator)        │
│   - Uses @refinio/fuse3 for Linux           │
│   - Contains Filer with business logic      │
├─────────────────────────────────────────────┤
│   @refinio/one.filer.fuse3                  │
│   - ONE.filer implementation                │
│   - Uses @refinio/fuse3                     │
├─────────────────────────────────────────────┤
│   @refinio/fuse3 (THIS PACKAGE)             │
│   - Pure FUSE3 N-API bindings               │
│   - No business logic                       │
└─────────────────────────────────────────────┘
```

## Installation

```bash
npm install @refinio/fuse3
```

### System Requirements

- **Operating System:** Linux (Debian, Ubuntu, or compatible)
- **Node.js:** Version 18.0.0 or higher
- **FUSE3:** Must be installed on the system

#### Installing FUSE3

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install fuse3 libfuse3-dev
```

**Fedora/RHEL:**
```bash
sudo dnf install fuse3 fuse3-devel
```

**Arch Linux:**
```bash
sudo pacman -S fuse3
```

## Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd linux/refinio-fuse3

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build N-API addon (if needed)
cd lib/binding
node-gyp rebuild
```

## Usage

### Basic Example

```typescript
import { Fuse, type FuseOperations } from '@refinio/fuse3';

// Define your filesystem operations
const operations: FuseOperations = {
    getattr: (path, cb) => {
        if (path === '/') {
            cb(0, {
                mode: 0o040755, // directory
                size: 4096,
                // ... other stats
            });
        } else {
            cb(ENOENT); // File not found
        }
    },
    
    readdir: (path, cb) => {
        if (path === '/') {
            cb(0, ['file1.txt', 'file2.txt']);
        } else {
            cb(ENOENT);
        }
    },
    
    open: (path, flags, cb) => {
        // Handle file opening
        cb(0, 42); // Return file descriptor
    },
    
    read: (path, fd, buffer, length, position, cb) => {
        // Handle reading
        const data = Buffer.from('Hello, World!');
        data.copy(buffer);
        cb(data.length);
    }
};

// Create and mount FUSE filesystem
const fuse = new Fuse('/mnt/myfs', operations, {
    force: true,
    debug: false
});

fuse.mount((err) => {
    if (err) {
        console.error('Mount failed:', err);
        return;
    }
    console.log('Filesystem mounted at /mnt/myfs');
});

// Unmount when done
process.on('SIGINT', () => {
    fuse.unmount(() => {
        console.log('Filesystem unmounted');
        process.exit(0);
    });
});
```

### Checking FUSE3 Availability

```typescript
import { checkFuse3Available } from '@refinio/fuse3';

const isAvailable = await checkFuse3Available();
if (!isAvailable) {
    console.error('FUSE3 is not available on this system');
    process.exit(1);
}
```

## API Reference

### Class: `Fuse`

Main class for creating FUSE filesystems.

#### Constructor

```typescript
new Fuse(mountPath: string, operations: FuseOperations, options?: FuseOptions)
```

- `mountPath`: The path where the filesystem will be mounted
- `operations`: Object containing filesystem operation handlers
- `options`: Optional mount options
  - `force`: Force mount even if mount point is in use
  - `debug`: Enable debug output
  - `local`: Mark as local filesystem

#### Methods

##### `mount(callback: (err?: Error) => void): void`

Mount the filesystem.

##### `unmount(callback: (err?: Error) => void): void`

Unmount the filesystem.

##### Static Methods

###### `Fuse.isConfigured(callback: (err: Error | null, isConfigured: boolean) => void): void`

Check if FUSE3 is configured on the system.

###### `Fuse.unmount(mountPath: string, callback: (err?: Error) => void): void`

Unmount a filesystem at the specified path.

### Interface: `FuseOperations`

Defines the filesystem operations that can be implemented.

```typescript
interface FuseOperations {
    init?: (cb: (err: number) => void) => void;
    getattr?: (path: string, cb: (err: number, stat?: Stats) => void) => void;
    readdir?: (path: string, cb: (err: number, files?: string[]) => void) => void;
    open?: (path: string, flags: number, cb: (err: number, fd?: number) => void) => void;
    read?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (bytesRead: number) => void) => void;
    write?: (path: string, fd: number, buffer: Buffer, length: number, position: number, cb: (bytesWritten: number) => void) => void;
    release?: (path: string, fd: number, cb: (err: number) => void) => void;
    create?: (path: string, mode: number, cb: (err: number, fd?: number) => void) => void;
    unlink?: (path: string, cb: (err: number) => void) => void;
    rename?: (src: string, dest: string, cb: (err: number) => void) => void;
    mkdir?: (path: string, mode: number, cb: (err: number) => void) => void;
    rmdir?: (path: string, cb: (err: number) => void) => void;
    truncate?: (path: string, size: number, cb: (err: number) => void) => void;
    chmod?: (path: string, mode: number, cb: (err: number) => void) => void;
    chown?: (path: string, uid: number, gid: number, cb: (err: number) => void) => void;
    utimens?: (path: string, atime: Date, mtime: Date, cb: (err: number) => void) => void;
    statfs?: (path: string, cb: (err: number, stat?: any) => void) => void;
    // ... and more
}
```

### Error Constants

The package exports standard POSIX error codes:

```typescript
import { ENOENT, EACCES, EIO, EISDIR, ENOTDIR } from '@refinio/fuse3';
```

- `EPERM` (1) - Operation not permitted
- `ENOENT` (2) - No such file or directory
- `EIO` (5) - I/O error
- `EACCES` (13) - Permission denied
- `EEXIST` (17) - File exists
- `ENOTDIR` (20) - Not a directory
- `EISDIR` (21) - Is a directory
- `EINVAL` (22) - Invalid argument
- `ENOSPC` (28) - No space left on device
- `EROFS` (30) - Read-only filesystem
- `EBUSY` (16) - Device or resource busy
- `ENOTEMPTY` (39) - Directory not empty

## Platform Support

This package only works on Linux systems. The `platform` utility can be used to check compatibility:

```typescript
import { platform } from '@refinio/fuse3';

if (platform.isLinux) {
    // Safe to use FUSE3
} else {
    console.error('This platform is not supported');
}
```

## Troubleshooting

### FUSE3 Not Found

If you get an error about FUSE3 not being available:

1. Check if FUSE3 is installed:
   ```bash
   fusermount3 --version
   ```

2. Install FUSE3 if missing (see Installation section)

3. Ensure the user has permission to mount FUSE filesystems:
   ```bash
   sudo usermod -a -G fuse $USER
   ```
   Then log out and back in.

### Permission Denied

If you get permission errors when mounting:

1. Check if the mount point exists and you have write permission
2. Ensure you're not running as root (FUSE doesn't allow root by default)
3. Try using the `force` option if the mount point is already in use

### N-API Addon Issues

If the N-API addon fails to load:

1. Rebuild the addon:
   ```bash
   cd lib/binding
   npm install
   node-gyp rebuild
   ```

2. Check Node.js version compatibility (requires Node.js 18+)

3. Ensure build tools are installed:
   ```bash
   sudo apt-get install build-essential
   ```

## License

SEE LICENSE IN LICENSE.md

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows the existing style
3. TypeScript types are properly defined
4. Documentation is updated

## Support

For issues and questions, please use the GitHub issue tracker.

## Authors

REFINIO GmbH

---

This is a low-level FUSE3 binding package. For higher-level filesystem abstractions, see `@refinio/one.filer.fuse3`.