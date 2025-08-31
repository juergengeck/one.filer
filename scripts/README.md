# ONE.Filer Scripts Directory

This directory contains organized scripts for various ONE.Filer operations.

## Directory Structure

### post-build.mjs
Post-build processing script that runs after TypeScript compilation to update commit hashes and perform other build finalizations.

### /testing
Test scripts for various components and platforms:
- `test-cross-platform-refinio-cli.js` - Main cross-platform test using refinio.cli
- `test-with-refinio-cli.sh` - Linux test suite using refinio.cli
- `test-windows-refinio-cli.bat` - Windows batch test suite
- `test-windows-refinio-cli.ps1` - Windows PowerShell test suite
- Other legacy test scripts (being phased out in favor of refinio.cli tests)

### /setup
Build and setup scripts:
- `setup-*.js` - Setup scripts for various configurations
- `build-*.cmd` - Windows build scripts
- `install-*.cmd` - Installation scripts

### /fixes
Debug and fix utilities:
- `debug-*.js` - Debug utilities for troubleshooting
- `fix-*.js` - Scripts to fix common issues
- `clear-*.bat` - Cache clearing utilities

### /utilities
General utility scripts:
- `run-*.js` - Scripts to run various configurations
- `start-*.js` - Scripts to start instances
- `demo-*.js` - Demonstration scripts
- `check-*.js` - Verification utilities

### /archive
Obsolete or deprecated scripts kept for reference:
- Old test scripts replaced by refinio.cli tests
- Legacy batch files and PowerShell scripts
- Scripts that are no longer maintained

## Primary Test Scripts

The main test infrastructure now uses **refinio.cli** for unified testing across platforms:

1. **Cross-Platform Test**
   ```bash
   node scripts/testing/test-cross-platform-refinio-cli.js
   ```

2. **Linux Testing**
   ```bash
   ./scripts/testing/test-with-refinio-cli.sh
   ```

3. **Windows Testing**
   ```powershell
   .\scripts\testing\test-windows-refinio-cli.ps1
   ```

## Quick Start

### Running Tests
```bash
# Install refinio.cli first
cd refinio.cli
npm install
npm link

# Run cross-platform tests
npm test

# Or run platform-specific tests
npm run test:linux    # Linux with FUSE3
npm run test:windows  # Windows with ProjFS
npm run test:wsl      # WSL2 environment
```

### Common Operations

#### Start ONE.Filer Instance
```bash
# Linux
one-filer start -s <secret> --filer true

# Windows (from electron-app)
npm run start:native
```

#### Mount Filesystem
```bash
refinio filer mount --mount-point /path/to/mount
```

#### Check Status
```bash
refinio filer status
```

## Migrating from Old Scripts

If you're using old test scripts, please migrate to the new refinio.cli-based tests:

| Old Script | New Command |
|------------|-------------|
| `test-projfs-mount.js` | `refinio filer mount` |
| `test-fuse.js` | `refinio filer mount` (Linux) |
| `run-windows-test.ps1` | `npm run test:windows` |
| `test-linux-fuse.sh` | `npm run test:linux` |

## CI/CD Integration

Tests are automatically run via GitHub Actions:
- See `.github/workflows/cross-platform-tests.yml`
- Tests run on Linux, Windows, and WSL2
- All use refinio.cli for consistency

## Documentation

For more information:
- [Testing Guide](../docs/testing.md)
- [CLI Reference](../docs/cli.md)
- [Architecture Overview](../ARCHITECTURE.md)