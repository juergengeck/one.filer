# ONE.Filer Testing Guide

## Overview

ONE.Filer uses a unified testing approach through `refinio.cli` that works across all platforms:
- **Windows** - ProjFS virtualization
- **Linux** - FUSE3 filesystem
- **WSL2** - Linux FUSE3 with Windows interoperability

All tests use the same CLI commands, ensuring consistent behavior across platforms.

## Prerequisites

### All Platforms
- Node.js 18 or later
- refinio.cli installed and linked
- ONE.Filer built for your platform

### Windows Specific
- Windows 10 1809 or later
- ProjFS feature enabled: `Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS`
- Electron app built: `cd electron-app && npm run build:native`

### Linux Specific
- FUSE3 installed: `sudo apt-get install fuse3 libfuse3-dev`
- FUSE3 addon built: `cd packages/one.filer.linux && npm run build:addon`
- User must be in `fuse` group: `sudo usermod -a -G fuse $USER`

### WSL2 Specific
- Windows 10 2004 or later with WSL2
- Ubuntu 20.04 or later in WSL
- FUSE3 support in WSL2 kernel

## Test Structure

```
test/
├── cross-platform-refinio-cli.test.ts   # TypeScript cross-platform tests
├── integration/
│   └── refinio-cli-integration.test.ts  # Platform integration tests
test-cross-platform-refinio-cli.js       # Node.js cross-platform test
test-refinio-cli-programmatic.js         # Programmatic test runner
test-with-refinio-cli.sh                 # Linux shell script tests
test-windows-refinio-cli.bat             # Windows batch script tests
test-windows-refinio-cli.ps1             # Windows PowerShell tests
```

## Running Tests

### Quick Start

```bash
# Linux/WSL
./test-with-refinio-cli.sh

# Windows (Command Prompt)
test-windows-refinio-cli.bat

# Windows (PowerShell)
.\test-windows-refinio-cli.ps1

# Cross-platform (Node.js)
node test-cross-platform-refinio-cli.js
```

### Integration Tests

```bash
# Run Jest tests
npm test

# Run specific test suite
npm test -- --grep "Cross-Platform"

# Run with coverage
npm test -- --coverage
```

### Manual Testing

1. **Start ONE instance:**
   ```bash
   # Linux
   one-filer start -s test-secret --filer true
   
   # Windows
   electron electron-app --secret test-secret --enable-api
   ```

2. **Run refinio.cli commands:**
   ```bash
   # Check status
   refinio filer status
   
   # Mount filesystem
   refinio filer mount --mount-point /tmp/test
   
   # List filesystems
   refinio filer list-fs
   
   # Unmount
   refinio filer unmount
   ```

## Test Categories

### 1. Platform Detection Tests
- Verify correct platform identification
- Check for WSL environment
- Validate platform-specific features

### 2. Filesystem Operations
- Mount/unmount operations
- Directory structure verification
- File read/write operations
- Permission handling

### 3. Platform-Specific Features

#### Windows (ProjFS)
- Virtual file access
- On-demand hydration
- Directory enumeration
- File placeholder management

#### Linux (FUSE3)
- FUSE mount verification
- Direct filesystem operations
- Permission handling
- Signal handling

### 4. Cross-Platform Compatibility
- Data format consistency
- Line ending normalization
- Path separator handling
- Character encoding

### 5. Performance Tests
- Directory listing speed
- File creation performance
- Concurrent operations
- Memory usage

### 6. Network Synchronization
- Multi-instance detection
- Data synchronization
- Conflict resolution
- Connection monitoring

## Writing Tests

### Test Template

```javascript
// test/my-feature.test.js
const { refinioCmd, isMounted } = require('./test-utils');

describe('My Feature', () => {
    before(async () => {
        // Setup
        await refinioCmd('filer mount --mount-point /tmp/test');
    });
    
    after(async () => {
        // Cleanup
        await refinioCmd('filer unmount');
    });
    
    it('should do something', async () => {
        const { stdout, success } = await refinioCmd('filer status');
        expect(success).to.be.true;
        expect(stdout).to.include('Mounted');
    });
});
```

### Platform-Specific Tests

```javascript
if (process.platform === 'win32') {
    it('should use ProjFS on Windows', async () => {
        const { stdout } = await refinioCmd('filer status');
        expect(stdout).to.include('projfs');
    });
}

if (process.platform === 'linux') {
    it('should use FUSE3 on Linux', async () => {
        const { stdout } = await refinioCmd('filer status');
        expect(stdout).to.include('fuse');
    });
}
```

## CI/CD Integration

### GitHub Actions

The project includes automated cross-platform testing:

```yaml
# .github/workflows/cross-platform-tests.yml
- test-linux: Ubuntu with FUSE3
- test-windows: Windows with ProjFS
- test-wsl: Windows Subsystem for Linux
- cross-platform-sync: Compatibility verification
```

### Running in CI

Tests automatically run on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

### Test Reports

CI generates:
- Platform-specific test results
- Cross-platform compatibility report
- Performance metrics
- Coverage reports

## Debugging Tests

### Enable Verbose Logging

```bash
# Set environment variable
export DEBUG=one-filer:*

# Or in test command
DEBUG=one-filer:* npm test
```

### Common Issues

#### Windows
- **ProjFS not enabled**: Enable with PowerShell as Administrator
- **Access denied**: Run as Administrator or check mount point permissions
- **Electron not starting**: Check if port 8080 is available

#### Linux
- **FUSE permission denied**: Add user to fuse group
- **Mount point busy**: Use `fusermount -u` to unmount
- **Module not found**: Rebuild FUSE3 addon

#### WSL
- **Cannot access Windows drives**: Check WSL configuration
- **FUSE not supported**: Update WSL2 kernel
- **Performance issues**: Use WSL2, not WSL1

## Test Configuration

### Environment Variables

```bash
# Test configuration
TEST_MOUNT_POINT=/tmp/test     # Mount point for tests
TEST_SECRET=test-secret         # Instance secret
TEST_PROFILE=test-profile       # refinio.cli profile
TEST_TIMEOUT=60000             # Test timeout in ms
```

### Configuration Files

```json
// test-config.json
{
  "mountPoint": "/tmp/test",
  "dataDir": "/tmp/test-data",
  "logLevel": "debug",
  "apiPort": 8080
}
```

## Performance Benchmarks

Expected performance metrics:

| Operation | Windows (ProjFS) | Linux (FUSE3) | WSL2 |
|-----------|-----------------|---------------|------|
| Mount | < 2s | < 1s | < 2s |
| Directory List (1000 items) | < 500ms | < 200ms | < 500ms |
| File Create | < 100ms | < 50ms | < 100ms |
| File Read (1MB) | < 50ms | < 20ms | < 50ms |

## Troubleshooting

### Test Failures

1. **Check ONE instance is running:**
   ```bash
   refinio filer status
   ```

2. **Verify refinio.cli is installed:**
   ```bash
   refinio --version
   ```

3. **Check mount point:**
   ```bash
   # Linux
   mount | grep fuse
   
   # Windows
   dir C:\OneFiler
   ```

4. **Review logs:**
   ```bash
   # Application logs
   tail -f ~/.one-filer/logs/app.log
   
   # Test logs
   npm test -- --verbose
   ```

### Reporting Issues

When reporting test failures, include:
- Platform and version
- Test command used
- Error messages
- Log files
- `refinio filer status` output

## Best Practices

1. **Always cleanup**: Unmount filesystems and clean test data
2. **Use profiles**: Isolate test configurations with refinio.cli profiles
3. **Test incrementally**: Run unit tests before integration tests
4. **Platform awareness**: Account for platform differences in tests
5. **Mock external services**: Don't depend on external servers in unit tests
6. **Parallel safety**: Ensure tests can run in parallel without conflicts
7. **Deterministic data**: Use fixed timestamps and IDs for reproducibility

## Contributing Tests

1. Write tests for new features
2. Ensure cross-platform compatibility
3. Add performance benchmarks for critical paths
4. Document platform-specific behavior
5. Update CI configuration if needed
6. Run full test suite before submitting PR

## Additional Resources

- [refinio.cli Documentation](./cli.md)
- [Architecture Overview](../ARCHITECTURE.md)
- [API Reference](./api.md)
- [Troubleshooting Guide](./troubleshooting.md)