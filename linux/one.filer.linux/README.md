# one.filer.linux

Complete ONE File System Bridge for Linux using FUSE3

## Overview

This package provides the full ONE filesystem implementation for Linux systems using FUSE3. It's the Linux counterpart to `one.filer.windows`, sharing the same core codebase but using FUSE3 instead of ProjectedFS.

**Key Features:**
- Complete Replicant implementation matching current project
- FUSE3 filesystem mounting via @refinio/fuse3
- Uses current project's Filer implementation
- Full ONE.models integration
- CLI commands for initialization and management
- Access rights management
- Multiple filesystem types (Chat, Debug, Objects, Types, Invites)
- TypeScript/ES modules support

## Architecture

Platform-specific implementation architecture:

```
┌──────────────────────────────────────────────────┐
│           one.filer.windows                      │
│      Windows implementation (ProjFS)             │
├──────────────────────────────────────────────────┤
│           one.filer.linux (THIS)                 │
│       Linux implementation (FUSE3)               │
├──────────────────────────────────────────────────┤
│            @refinio/fuse3                        │
│      Pure FUSE3 N-API bindings                   │
├──────────────────────────────────────────────────┤
│         one.leute.replicant                      │
│    Cross-platform orchestrator (updated)         │
└──────────────────────────────────────────────────┘
```

## Relationship to one.filer.windows

This package shares the core implementation with `one.filer.windows`:
- **Filer.ts** - Core filesystem implementation
- **FuseFrontend.ts** - FUSE interface (Linux-specific)
- **FuseApiToIFileSystemAdapter.ts** - Adapter layer
- **Replicant.ts** - Orchestrator component

The key difference is the filesystem backend:
- **one.filer.windows** uses Windows ProjectedFS
- **one.filer.linux** uses Linux FUSE3 via @refinio/fuse3

## Installation

```bash
npm install @refinio/one.filer.fuse3
```

### System Requirements

- **Operating System:** Linux (Debian, Ubuntu, or compatible)
- **Node.js:** Version 18.0.0 or higher
- **FUSE3:** Must be installed (see @refinio/fuse3 documentation)
- **Dependencies:** 
  - @refinio/fuse3
  - @refinio/one.core
  - @refinio/one.models
  - commander

## Quick Start

### 1. Initialize a New Instance

```bash
# Create a new ONE instance with identity
one-filer-fuse3 init --secret "your-secure-password" --directory /opt/one-data

# This will:
# - Generate a new identity
# - Create the data directory
# - Save configuration to config.json
```

### 2. Start the Service

```bash
# Start with configuration file
one-filer-fuse3 start --secret "your-secure-password" --config config.json

# Or specify options directly
one-filer-fuse3 start \
  --secret "your-secure-password" \
  --directory /opt/one-data \
  --filer-mount-point /mnt/one-filer \
  --log
```

### 3. Access the Filesystem

Once started, the filesystem is accessible at the mount point (default: `/tmp/one-filer`):

```bash
# List available filesystems
ls /tmp/one-filer/

# Expected structure:
# /chats    - Chat filesystem
# /debug    - Debug information
# /invites  - Pairing/invitation system
# /objects  - Object storage
# /types    - Type definitions
```

## CLI Commands

### `init` - Initialize Instance

Initialize a new ONE instance with identity generation.

```bash
one-filer-fuse3 init [options]

Options:
  -s, --secret <string>      ONE instance password (required)
  -d, --directory <string>   Data folder location (default: "data")
  -c, --config <string>      Config file path (default: "config.json")
  --force                    Force initialization even if exists
```

### `start` - Start Service (Default)

Start the ONE.filer service with Replicant and FUSE mounting.

```bash
one-filer-fuse3 start [options]

Options:
  -s, --secret <string>            Instance password (required)
  -c, --config <string>            Configuration file path
  -d, --directory <string>         Data folder location
  -l, --log                        Enable logging
  --log-debug                      Enable debug logging
  --commServerUrl <URL>            Communication server URL
  --pairing-url <URL>              Pairing service URL
  --pairing-iom-mode <mode>        IoM mode: "full" or "light"
  --filer <boolean>                Enable filer (default: true)
  --filer-log-calls <boolean>      Log all FUSE operations
  --filer-mount-point <string>     Mount point path
```

### `configure` - Interactive Configuration

Configure the instance interactively.

```bash
one-filer-fuse3 configure [options]

Options:
  -c, --config <string>    Configuration file (default: "config.json")
```

### `delete` - Delete Instance

Delete a ONE instance and all its data.

```bash
one-filer-fuse3 delete [options]

Options:
  -d, --directory <string>    Data folder to delete
  -c, --config <string>       Configuration file to read directory from
  --force                     Delete without confirmation
```

### `write-default-config` - Generate Configuration

Generate a default configuration file.

```bash
one-filer-fuse3 write-default-config <path>

# Example:
one-filer-fuse3 write-default-config config.json
```

## Programmatic Usage

### As a Library

```typescript
import { Replicant, Filer } from '@refinio/one.filer.fuse3';

// Quick start
import { quickStart } from '@refinio/one.filer.fuse3';

const replicant = await quickStart('my-secret', {
    directory: '/opt/one-data',
    useFiler: true,
    filerConfig: {
        mountPoint: '/mnt/one-filer',
        logCalls: false
    }
});

// Shutdown when done
await replicant.stop();
```

### Custom Replicant Configuration

```typescript
import { Replicant } from '@refinio/one.filer.fuse3';

const config = {
    directory: '/opt/one-data',
    commServerUrl: 'wss://comm.one.eu.replicant.refinio.one',
    createEveryoneGroup: false,
    useFiler: true,
    filerConfig: {
        mountPoint: '/mnt/one-filer',
        tmpDir: '/tmp/one-filer-tmp',
        logCalls: false,
        pairingUrl: 'https://app.leute.io',
        iomMode: 'light' as const
    },
    connectionsConfig: {
        blacklist: [],
        whitelist: [],
        incomingConnectionLimit: 100,
        outgoingConnectionLimit: 100,
        acceptIncoming: true,
        establishOutgoing: true
    }
};

const replicant = new Replicant(config);
await replicant.start('my-secret');

// Access the identity
const identity = await replicant.getIdentity();
console.log('Identity hash:', identity?.identity);

// Graceful shutdown
process.on('SIGINT', async () => {
    await replicant.stop();
    process.exit(0);
});
```

### Using Filer Directly

```typescript
import { Filer, type FilerModels } from '@refinio/one.filer.fuse3';
import {
    ChannelManager,
    ConnectionsModel,
    LeuteModel,
    TopicModel
} from '@refinio/one.models/lib/models/index.js';

// Initialize models
const models: FilerModels = {
    channelManager: new ChannelManager(leuteModel),
    connections: new ConnectionsModel(leuteModel, config),
    leuteModel: new LeuteModel(commServerUrl),
    notifications: new Notifications(channelManager),
    topicModel: new TopicModel(channelManager, leuteModel),
    iomManager: new IoMManager(leuteModel, commServerUrl)
};

// Create and initialize Filer
const filer = new Filer(models, {
    mountPoint: '/mnt/one-filer',
    logCalls: true
});

await filer.init();

// Shutdown when done
await filer.shutdown();
```

### Custom Filesystem Implementation

```typescript
import { FuseApiToIFileSystemAdapter } from '@refinio/one.filer.fuse3';
import { Fuse } from '@refinio/fuse3';

// Create your IFileSystem implementation
const myFileSystem = {
    async stat(path: string) { /* ... */ },
    async readdir(path: string) { /* ... */ },
    async readFile(path: string) { /* ... */ },
    async writeFile(path: string, data: Buffer) { /* ... */ },
    // ... other IFileSystem methods
};

// Create adapter
const adapter = new FuseApiToIFileSystemAdapter(
    myFileSystem,
    '/mnt/myfs',
    { logCalls: true }
);

// Create FUSE operations
const operations = {
    getattr: (path, cb) => adapter.fuseGetattr(path, cb),
    readdir: (path, cb) => adapter.fuseReaddir(path, cb),
    // ... map other operations
};

// Mount
const fuse = new Fuse('/mnt/myfs', operations);
await new Promise((resolve, reject) => {
    fuse.mount(err => err ? reject(err) : resolve(undefined));
});
```

## Configuration

### Configuration File Structure

```json
{
  "directory": "data",
  "commServerUrl": "wss://comm.one.eu.replicant.refinio.one",
  "createEveryoneGroup": false,
  "useFiler": true,
  "filer": {
    "mountPoint": "/tmp/one-filer",
    "tmpDir": "/tmp/one-filer-tmp",
    "logCalls": false,
    "pairingUrl": "https://app.leute.io",
    "iomMode": "light"
  },
  "connections": {
    "blacklist": [],
    "whitelist": [],
    "incomingConnectionLimit": 100,
    "outgoingConnectionLimit": 100,
    "acceptIncoming": true,
    "establishOutgoing": true
  }
}
```

### Environment Variables

The package respects standard Node.js environment variables:

- `NODE_ENV` - Set to 'production' for production deployments
- `DEBUG` - Enable debug output (e.g., `DEBUG=one:*`)

## Filesystem Structure

The mounted filesystem provides access to different ONE subsystems:

### `/chats` - Chat Filesystem
Access to chat messages and conversations managed by the IoM system.

### `/debug` - Debug Filesystem
Debugging information including:
- System status
- Connection information
- Identity details
- Commit hash

### `/invites` - Pairing Filesystem
Invitation and pairing system for connecting with other instances.

### `/objects` - Objects Filesystem
Direct access to ONE objects stored in the database.

### `/types` - Types Filesystem
Type definitions and schemas used by the system.

## Architecture

```
┌─────────────────────────────────────┐
│         CLI Commands                 │
│  (init, start, configure, delete)    │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│          Replicant                   │
│  (Orchestrator for all services)     │
├──────────────────────────────────────┤
│  - LeuteModel                        │
│  - ChannelManager                    │
│  - ConnectionsModel                  │
│  - IoMManager                        │
│  - TopicModel                        │
│  - Notifications                     │
│  - AccessRightsManager               │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│           Filer                      │
│  (Filesystem composition & mounting) │
├──────────────────────────────────────┤
│  - TemporaryFileSystem (root)        │
│  - ChatFileSystem                    │
│  - DebugFileSystem                   │
│  - PairingFileSystem                 │
│  - ObjectsFileSystem                 │
│  - TypesFileSystem                   │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│        FuseFrontend                  │
│  (FUSE3 mounting interface)          │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│   FuseApiToIFileSystemAdapter        │
│  (Bridge between FUSE3 & IFileSystem)│
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│      @refinio/fuse3                  │
│  (Native FUSE3 N-API bindings)       │
└──────────────────────────────────────┘
```

## Development

### Building from Source

```bash
# Clone repository
git clone <repository-url>
cd linux/one-filer-fuse3

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Testing

```bash
# Run unit tests
npm test

# Run with debug output
DEBUG=one:* npm test

# Test CLI commands
npm run build
node lib/cli.js --help
```

### Development Mode

```bash
# Watch for changes and rebuild
npm run dev

# Run with debug logging
DEBUG=one:* node lib/cli.js start --secret test --log-debug
```

## Troubleshooting

### Mount Point Already in Use

```bash
# Check if already mounted
mount | grep one-filer

# Force unmount if needed
fusermount -u /tmp/one-filer

# Or use force option
one-filer-fuse3 start --secret xxx --filer-mount-point /tmp/one-filer --force
```

### Permission Denied

1. Ensure user is in the `fuse` group:
   ```bash
   sudo usermod -a -G fuse $USER
   ```

2. Log out and back in for group changes to take effect

3. Check mount point permissions:
   ```bash
   ls -la /tmp/one-filer
   ```

### Instance Already Exists

```bash
# Delete existing instance
one-filer-fuse3 delete --directory /opt/one-data --force

# Or reinitialize with force
one-filer-fuse3 init --secret xxx --directory /opt/one-data --force
```

### Debug Output

Enable detailed logging:

```bash
# Via CLI
one-filer-fuse3 start --secret xxx --log-debug --filer-log-calls

# Via environment
DEBUG=one:* one-filer-fuse3 start --secret xxx
```

## API Compatibility

This package is designed to be API-compatible with the original Linux one.filer. Existing code using the original can be migrated by:

1. Changing the import from local files to this package
2. Using the same configuration format
3. All CLI commands work identically

### Migration Example

```typescript
// Old (original one.filer)
import { Replicant } from './src/Replicant';
import { Filer } from './src/filer/Filer';

// New (this package)
import { Replicant, Filer } from '@refinio/one.filer.fuse3';

// Everything else remains the same!
```

## Security Considerations

1. **Never run as root** - The package prevents running with root privileges
2. **Secure your secret** - Use strong passwords and never commit them
3. **File permissions** - Mounted filesystems respect Linux permissions
4. **Network security** - Use secure WebSocket connections (wss://)

## License

SEE LICENSE IN LICENSE.md

## Contributing

Contributions are welcome! Please ensure:

1. Code follows TypeScript best practices
2. All tests pass
3. CLI commands maintain backward compatibility
4. Documentation is updated

## Support

For issues and questions, please use the GitHub issue tracker.

## See Also

- [@refinio/fuse3](../refinio-fuse3/README.md) - Low-level FUSE3 bindings
- [@refinio/one.models](https://github.com/refinio/one.models) - ONE data models
- [@refinio/one.core](https://github.com/refinio/one.core) - ONE core functionality

## Authors

REFINIO GmbH

---

This package provides the complete ONE.filer implementation for Linux systems with FUSE3 support.