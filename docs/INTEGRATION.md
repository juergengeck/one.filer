# ONE.FILER + REFINIO.API + REFINIO.CLI Integration

This document describes the integration between one.filer, refinio.api, and refinio.cli for unified filesystem administration.

## Overview

The integration provides:
- **one.filer**: Core filesystem functionality with FUSE (Linux) and ProjFS (Windows) support
- **refinio.api**: Admin API server for remote management
- **refinio.cli**: Command-line interface for admin operations

## Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│   refinio.cli   │─────▶│ refinio.api  │─────▶│  one.filer  │
│  (CLI Client)   │ QUIC │ (API Server) │      │ (Filesystem)│
└─────────────────┘      └──────────────┘      └─────────────┘
                              │                       │
                              ▼                       ▼
                         ┌──────────┐           ┌──────────┐
                         │  Auth    │           │  Models  │
                         │ Manager  │           │  (Leute, │
                         └──────────┘           │   IoM)   │
                                                └──────────┘
```

## Features

### Filer Admin Operations

The integration adds the following admin capabilities:

1. **Mount/Unmount Operations**
   - Mount filesystem with custom configuration
   - Unmount filesystem gracefully
   - Support for both FUSE and ProjFS modes

2. **Status Monitoring**
   - Check mount status
   - View active filesystems
   - Monitor configuration

3. **Configuration Management**
   - Update mount point
   - Configure IoM mode (full/light)
   - Enable/disable logging

4. **Filesystem Operations**
   - List mounted filesystems
   - Get filesystem information
   - Clear filesystem caches
   - Refresh/remount filesystems

## Usage

### Starting one.filer with Admin API

```bash
# Start with admin API enabled
node dist/cli.js start \
  -s <secret> \
  --filer true \
  --enable-admin-api \
  --api-port 3000 \
  --api-host localhost
```

### Using refinio.cli for Administration

```bash
# Check filer status
refinio filer status

# Mount filesystem
refinio filer mount --mount-point /mnt/filer --iom-mode light

# List filesystems
refinio filer list-fs

# Get filesystem info
refinio filer fs-info /chats

# Clear cache
refinio filer clear-cache

# Unmount
refinio filer unmount

# Interactive setup
refinio filer setup
```

### Profile-based Usage

```bash
# Configure profile
refinio profile add admin --url localhost:3000

# Use profile for commands
refinio admin filer status
refinio admin filer mount
```

## API Endpoints

The FilerHandler provides the following operations via refinio.api:

| Operation | Description |
|-----------|-------------|
| `mount` | Mount the filesystem with configuration |
| `unmount` | Unmount the filesystem |
| `status` | Get current mount status and configuration |
| `config` | View/update configuration |
| `refresh` | Remount filesystem to refresh |
| `listFileSystems` | List all mounted filesystems |
| `fileSystemInfo` | Get details about specific filesystem |
| `clearCache` | Clear filesystem caches |

## Configuration

### Filer Configuration
```json
{
  "mountPoint": "mnt",
  "pairingUrl": "https://leute.dev.refinio.one/invites/invitePartner/",
  "iomMode": "light",
  "logCalls": false,
  "fuseOptions": {}
}
```

### API Server Configuration
```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "instance": {
    "name": "admin",
    "email": "admin@example.com",
    "secret": "secure-secret",
    "directory": "./data",
    "encryptStorage": true
  }
}
```

## Development

### Building

```bash
# Build all components
npm run build

# Build individual components
cd refinio.api && npm run build
cd refinio.cli && npm run build
```

### Testing

```bash
# Run integration test
node test-admin-integration.js

# Run individual tests
npm test
```

## Platform Support

- **Linux/WSL**: Uses FUSE for filesystem mounting
- **Windows**: Uses ProjFS (Projected File System)
- **macOS**: FUSE support (requires macFUSE)

## Security

- Instance-based authentication for admin operations
- Person key authentication for CLI access
- Encrypted storage for sensitive data
- QUIC transport with built-in encryption

## Troubleshooting

### Common Issues

1. **FUSE not available**
   - Ensure FUSE is installed: `sudo apt-get install fuse3`
   - Check permissions: User must be in `fuse` group

2. **ProjFS not available (Windows)**
   - Enable Windows Projected File System feature
   - Requires Windows 10 version 1809 or later

3. **API connection failed**
   - Check firewall settings
   - Verify port availability
   - Ensure instance is running

4. **Permission denied**
   - Check instance ownership
   - Verify authentication credentials
   - Ensure proper file permissions

## Future Enhancements

- [ ] Web-based admin dashboard
- [ ] Real-time filesystem monitoring
- [ ] Batch operations support
- [ ] Performance metrics and analytics
- [ ] Automated backup/restore
- [ ] Multi-instance management
- [ ] Role-based access control
- [ ] Audit logging