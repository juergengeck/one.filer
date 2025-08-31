# refinio.cli Reference Guide

## Overview

`refinio.cli` is the unified command-line interface for managing ONE.Filer across all platforms. It provides consistent commands for filesystem operations, configuration management, and system monitoring whether you're on Windows (ProjFS), Linux (FUSE3), or WSL2.

## Installation

### Prerequisites
- Node.js 18 or later
- npm or yarn package manager
- ONE.Filer installed on your system

### Install Steps

```bash
# Clone the repository
git clone https://github.com/juergengeck/one.filer.git
cd one.filer/refinio.cli

# Install dependencies
npm install

# Link globally
npm link

# Verify installation
refinio --version
```

## Basic Usage

```bash
refinio [options] <command> [command-options]
```

### Global Options

| Option | Description |
|--------|-------------|
| `--profile <name>` | Use a specific profile configuration |
| `--config <path>` | Path to configuration file |
| `--verbose` | Enable verbose output |
| `--json` | Output in JSON format |
| `--help` | Show help information |
| `--version` | Show version information |

## Commands

### Filer Commands

Manage the ONE.Filer filesystem.

#### `filer mount`

Mount the ONE filesystem at a specified location.

```bash
refinio filer mount [options]

Options:
  -m, --mount-point <path>   Mount point path (default: platform-specific)
  -u, --pairing-url <url>    Pairing URL for IoM
  --iom-mode <mode>          IoM mode: 'full' or 'light' (default: 'light')
  --log-calls                Enable call logging
```

**Examples:**

```bash
# Linux
refinio filer mount --mount-point /mnt/onefiler

# Windows
refinio filer mount --mount-point C:\OneFiler

# With pairing
refinio filer mount --pairing-url https://example.com/invite --iom-mode full
```

#### `filer unmount`

Unmount the ONE filesystem.

```bash
refinio filer unmount
refinio filer umount  # Alias
```

#### `filer status`

Get the current status of the filer filesystem.

```bash
refinio filer status
```

**Output Example:**

```
Filer Status:
  Mounted: Yes
  Mount point: /mnt/onefiler
  Platform: linux
  Mode: fuse3
  
Mounted file systems:
  - /objects
  - /profiles
  - /chats
  - /connections
  - /invites
```

#### `filer list-fs`

List all mounted filesystems.

```bash
refinio filer list-fs
refinio filer ls-fs  # Alias
```

#### `filer fs-info`

Get detailed information about a specific filesystem.

```bash
refinio filer fs-info <path>

Example:
refinio filer fs-info /objects
```

#### `filer config`

View or update filer configuration.

```bash
refinio filer config [options]

Options:
  -s, --set <key=value>   Set a configuration value
  -g, --get <key>         Get a configuration value
```

**Examples:**

```bash
# View all configuration
refinio filer config

# Set a value
refinio filer config --set logCalls=true

# Get a value
refinio filer config --get mountPoint
```

#### `filer clear-cache`

Clear the filesystem cache.

```bash
refinio filer clear-cache [filesystem]

Examples:
# Clear all caches
refinio filer clear-cache

# Clear specific filesystem cache
refinio filer clear-cache /objects
```

#### `filer refresh`

Refresh the filesystem (remount).

```bash
refinio filer refresh
```

#### `filer setup`

Interactive setup wizard for mounting the filer.

```bash
refinio filer setup
```

### Connection Commands

Manage connections to other ONE instances.

#### `connect`

Connect to another ONE instance.

```bash
refinio connect <address> [options]

Options:
  -p, --port <port>       Port number (default: 8080)
  -s, --secure           Use secure connection
  --profile <name>       Connection profile to use
```

#### `connect-local`

Connect to a local ONE instance.

```bash
refinio connect-local [options]

Options:
  -p, --port <port>       Local port (default: 8080)
```

#### `disconnect`

Disconnect from a ONE instance.

```bash
refinio disconnect [connection-id]
```

### Data Commands (CRUD)

Perform CRUD operations on ONE objects.

#### `crud create`

Create a new object.

```bash
refinio crud create <type> [options]

Options:
  -d, --data <json>       Object data as JSON
  -f, --file <path>       Read data from file
```

**Example:**

```bash
refinio crud create Person --data '{"email":"user@example.com","name":"John Doe"}'
```

#### `crud read`

Read an object by hash.

```bash
refinio crud read <hash> [options]

Options:
  --format <format>       Output format: json, yaml, raw
```

#### `crud update`

Update an existing object.

```bash
refinio crud update <hash> [options]

Options:
  -d, --data <json>       Updated data as JSON
  -f, --file <path>       Read data from file
```

#### `crud delete`

Delete an object.

```bash
refinio crud delete <hash> [options]

Options:
  --confirm              Skip confirmation prompt
```

### Profile Commands

Manage user profiles and identities.

#### `profile create`

Create a new profile.

```bash
refinio profile create <name> [options]

Options:
  -e, --email <email>     Email address
  -n, --name <name>       Display name
  -s, --secret <secret>   Profile secret
```

#### `profile list`

List all profiles.

```bash
refinio profile list
```

#### `profile switch`

Switch to a different profile.

```bash
refinio profile switch <name>
```

#### `profile delete`

Delete a profile.

```bash
refinio profile delete <name> [options]

Options:
  --confirm              Skip confirmation prompt
```

### Recipe Commands

Manage ONE object recipes.

#### `recipe list`

List all available recipes.

```bash
refinio recipe list [options]

Options:
  --type <type>          Filter by type
  --verbose             Show detailed information
```

#### `recipe show`

Show details of a specific recipe.

```bash
refinio recipe show <name>
```

#### `recipe validate`

Validate an object against its recipe.

```bash
refinio recipe validate <object-hash>
```

### System Commands

System management and monitoring.

#### `auth`

Authenticate with a ONE instance.

```bash
refinio auth [options]

Options:
  -u, --user <email>      User email
  -p, --password <pass>   Password
  -s, --secret <secret>   Secret key
```

#### `invite`

Manage invitations.

```bash
refinio invite create [options]
refinio invite list
refinio invite accept <code>
refinio invite reject <code>
```

#### `sync`

Synchronize data between instances.

```bash
refinio sync [options]

Options:
  --direction <dir>      Sync direction: push, pull, both
  --filter <pattern>     Filter objects to sync
  --dry-run             Show what would be synced
```

#### `debug`

Debug commands for troubleshooting.

```bash
refinio debug logs           # Show logs
refinio debug cache          # Show cache info
refinio debug connections    # Show active connections
refinio debug performance    # Show performance metrics
```

## Configuration

### Configuration File

Create a configuration file at `~/.refinio/config.json`:

```json
{
  "defaultProfile": "main",
  "profiles": {
    "main": {
      "email": "user@example.com",
      "dataDir": "~/.one-data",
      "mountPoint": "/mnt/onefiler"
    },
    "test": {
      "email": "test@example.com",
      "dataDir": "/tmp/one-test",
      "mountPoint": "/tmp/test-mount"
    }
  },
  "api": {
    "host": "localhost",
    "port": 8080,
    "secure": false
  },
  "filer": {
    "logCalls": false,
    "cacheSize": 1000,
    "iomMode": "light"
  }
}
```

### Environment Variables

```bash
# API configuration
REFINIO_API_HOST=localhost
REFINIO_API_PORT=8080

# Profile selection
REFINIO_PROFILE=main

# Logging
REFINIO_LOG_LEVEL=info
REFINIO_LOG_FILE=/var/log/refinio.log

# Data directory
REFINIO_DATA_DIR=~/.one-data
```

## Profiles

Profiles allow you to manage multiple configurations and switch between them easily.

### Creating a Profile

```bash
# Interactive
refinio profile create work

# Non-interactive
refinio profile create work \
  --email work@company.com \
  --secret my-work-secret \
  --data-dir ~/work-data
```

### Using Profiles

```bash
# Use a specific profile for a command
refinio --profile work filer mount

# Set default profile
refinio profile set-default work

# List all profiles
refinio profile list
```

## Platform-Specific Notes

### Windows (ProjFS)

- Mount points must be on NTFS volumes
- Requires Windows 10 1809 or later
- ProjFS must be enabled
- Use Windows-style paths: `C:\OneFiler`

### Linux (FUSE3)

- User must be in `fuse` group
- Mount points must have appropriate permissions
- Use Unix-style paths: `/mnt/onefiler`
- May require `sudo` for some operations

### WSL2

- Can access both Windows and Linux filesystems
- Use `/mnt/c/` to access Windows drives
- FUSE support requires WSL2 (not WSL1)
- Performance may vary for cross-filesystem operations

## Advanced Usage

### Scripting

refinio.cli is designed to be scriptable:

```bash
#!/bin/bash
# Backup script example

# Mount filesystem
refinio filer mount --mount-point /backup/mount

# Perform backup operations
rsync -av /backup/mount/objects/ /backup/storage/

# Unmount
refinio filer unmount

# Check status
if refinio filer status | grep -q "Mounted: No"; then
  echo "Backup complete"
fi
```

### JSON Output

Use `--json` for machine-readable output:

```bash
# Get status as JSON
refinio --json filer status

# Parse with jq
refinio --json filer list-fs | jq '.filesystems[]'
```

### Batch Operations

```bash
# Create multiple objects from CSV
while IFS=, read -r email name; do
  refinio crud create Person --data "{\"email\":\"$email\",\"name\":\"$name\"}"
done < users.csv
```

## Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Connection error |
| 4 | Authentication error |
| 5 | Permission denied |
| 6 | Resource not found |
| 7 | Resource already exists |
| 8 | Operation timeout |
| 9 | Configuration error |

## Troubleshooting

### Common Issues

#### "refinio: command not found"

```bash
# Ensure refinio.cli is linked globally
cd refinio.cli
npm link

# Or add to PATH
export PATH=$PATH:/path/to/refinio.cli/bin
```

#### "Cannot connect to API"

```bash
# Check if ONE instance is running
ps aux | grep one-filer

# Check API port
netstat -an | grep 8080

# Test API directly
curl http://localhost:8080/health
```

#### "Mount failed: Permission denied"

```bash
# Linux: Add user to fuse group
sudo usermod -a -G fuse $USER

# Windows: Run as Administrator
# Or check mount point permissions
```

#### "Profile not found"

```bash
# List available profiles
refinio profile list

# Create profile if missing
refinio profile create <name>
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Set debug environment variable
export DEBUG=refinio:*

# Or use verbose flag
refinio --verbose filer mount

# View debug logs
refinio debug logs --tail 100
```

## Examples

### Complete Setup Flow

```bash
# 1. Create a profile
refinio profile create main --email user@example.com

# 2. Start ONE instance (in another terminal)
one-filer start -s my-secret --filer true

# 3. Mount filesystem
refinio filer mount --mount-point /mnt/onefiler

# 4. Verify mount
refinio filer status

# 5. List available filesystems
refinio filer list-fs

# 6. Access files
ls -la /mnt/onefiler/objects/

# 7. Unmount when done
refinio filer unmount
```

### Cross-Platform Sync

```bash
# On Linux machine
refinio --profile linux-box filer mount
refinio sync --direction push --filter "*.doc"

# On Windows machine
refinio --profile windows-pc filer mount
refinio sync --direction pull --filter "*.doc"
```

### Monitoring Script

```bash
#!/bin/bash
# Monitor filesystem status

while true; do
  clear
  echo "ONE.Filer Status Monitor"
  echo "========================"
  
  refinio filer status
  echo
  
  echo "Active Connections:"
  refinio debug connections
  echo
  
  echo "Performance Metrics:"
  refinio debug performance
  
  sleep 5
done
```

## API Integration

refinio.cli communicates with the ONE.Filer API. You can also use the API directly:

```bash
# Direct API calls
curl -X GET http://localhost:8080/api/filer/status
curl -X POST http://localhost:8080/api/filer/mount \
  -H "Content-Type: application/json" \
  -d '{"mountPoint": "/mnt/onefiler"}'
```

## Contributing

To add new commands to refinio.cli:

1. Create command file in `src/commands/`
2. Export command from file
3. Register in main CLI entry point
4. Add tests in `test/commands/`
5. Update this documentation

## Support

- GitHub Issues: https://github.com/juergengeck/one.filer/issues
- Documentation: https://docs.refinio.com
- Community: https://community.refinio.com