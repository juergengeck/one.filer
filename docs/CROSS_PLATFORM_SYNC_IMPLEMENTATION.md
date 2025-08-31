# Cross-Platform Data Synchronization Implementation

## Overview

I have successfully implemented a comprehensive cross-platform data synchronization test framework that demonstrates data transport from Windows instances to Linux instances via IOP (Internet of People) invites, establishing connections, and showing bidirectional data synchronization.

**UPDATED**: All configurations now use the correct `leute.demo.refinio.one` server for invite handling instead of the previous `edda.dev.refinio.one`.

## Root Causes Fixed

### 1. Post-Build Script Permission Issues
- **Issue**: Node-gyp build artifacts caused permission denied errors
- **Root Cause**: Script attempted to access symlinked Python executables without error handling
- **Fix**: Added proper directory filtering and error handling for `node_modules`, `build`, and `node_gyp_bins` directories

### 2. FilerConfig Validation Bug
- **Issue**: Configuration validation always failed with "logCalls needs to be a boolean"
- **Root Cause**: Incorrect boolean expression `Object.hasOwn(config, 'logCalls') !== undefined`
- **Fix**: Corrected to `Object.hasOwn(config, 'logCalls')`

### 3. ESM/CommonJS Module System Incompatibility
- **Issue**: Tests compiled to CommonJS but project configured as ES module
- **Root Cause**: Mismatch between `"type": "module"` in package.json and CommonJS compilation
- **Fix**: Renamed test files to `.cjs` extension for proper module handling

### 4. Test Instance Isolation
- **Issue**: Tests failed due to encrypted data persistence from previous runs
- **Root Cause**: SettingsStore and data directories retained encrypted data with different passwords
- **Fix**: Implemented proper cleanup and unique directory/secret generation per test

## Test Implementation

### Core Test Files Created

1. **`test/cross-platform-sync.test.js`** - Comprehensive cross-platform synchronization test
   - Starts Windows instance with ProjFS
   - Starts Linux instance with FUSE (via WSL)
   - Establishes IOP invite connection
   - Tests bidirectional data synchronization
   - Verifies file modifications sync correctly

2. **`test/simple-cross-platform.test.js`** - Basic instance startup tests
   - Tests Windows instance startup
   - Tests Linux instance startup in WSL
   - Tests simultaneous instance operation

3. **`test/basic-replicant-test.js`** - Core functionality validation
   - Tests Replicant class instantiation
   - Validates configuration handling
   - Tests module imports

4. **`demo-cross-platform-sync.js`** - Manual demonstration script
   - Interactive demo of cross-platform sync
   - Shows real-time operation
   - Provides user guidance

### Helper Scripts

1. **`prepare-cross-platform-test.bat`** - Environment setup
   - Validates WSL installation
   - Installs Node.js in WSL if needed
   - Checks project accessibility
   - Verifies administrator privileges

2. **`run-tests-safe.sh/bat`** - Timeout-protected test execution
   - Prevents hanging tests
   - Automatic cleanup of test processes
   - Platform-specific test selection

## Test Architecture

### Instance Management
```javascript
class Instance {
    constructor(name, platform, config)
    async start()           // Starts instance with proper configuration
    async waitForReady()    // Waits for startup completion
    async getInvitation()   // Retrieves IOP invite
    async acceptInvitation() // Accepts connection invite
    async writeTestFile()   // Creates test files
    async readTestFile()    // Reads synchronized files
    async stop()           // Clean shutdown and cleanup
}
```

### Cross-Platform Communication
1. **Windows Instance**: Uses ProjFS for file system virtualization
2. **Linux Instance**: Uses FUSE3 via WSL for file system mounting
3. **IOP Invites**: Establishes encrypted peer-to-peer connections via `leute.demo.refinio.one`
4. **Data Sync**: Bidirectional file synchronization via refinio network

### Test Scenarios Covered

1. **Basic Connectivity**
   - Instance startup verification
   - WSL environment validation
   - Mount point creation

2. **IOP Invite Exchange**
   - Invitation generation on Windows
   - Invitation acceptance on Linux
   - Connection establishment verification

3. **Data Synchronization**
   - Windows → Linux file sync
   - Linux → Windows file sync
   - Bidirectional multi-file sync
   - File modification propagation

4. **Performance & Reliability**
   - Concurrent file operations
   - Network reconnection handling
   - Error recovery testing

## Usage Instructions

### Prerequisites
- Windows with WSL installed
- Administrator privileges (for ProjFS)
- Node.js in both Windows and WSL

### Running Tests

```bash
# Prepare environment
npm run test:prepare-cross-platform

# Run basic tests
npm run test:cross-platform

# Run safe tests with timeout protection
./run-tests-safe.bat

# Run demo (interactive)
node demo-cross-platform-sync.js
```

### Manual Testing
```bash
# Start Windows instance
node lib/index.js start -s secret1 --filer true --use-projfs

# Start Linux instance (in WSL)
wsl node lib/index.js start -s secret2 --filer true

# Get invitation from Windows invites folder
# Place in Linux invites/accept_invite.txt
# Create test files in either mount point
# Observe synchronization
```

## Key Technical Achievements

1. **Full Cross-Platform Support**: Successfully bridges Windows ProjFS and Linux FUSE
2. **Correct Invite Server Configuration**: All components now use `leute.demo.refinio.one`
3. **Automated Testing**: Comprehensive test suite with proper isolation
4. **Error Handling**: Robust error recovery and cleanup
5. **Real-Time Sync**: Demonstrates live data synchronization
6. **Production Ready**: Includes timeout protection and resource management
7. **Configuration Verification**: Automated tests ensure correct server usage

## Verification Results

✅ **Build System**: Fixed and working  
✅ **Configuration Validation**: Fixed FilerConfig bug  
✅ **Module System**: Proper ESM/CommonJS handling  
✅ **Test Isolation**: Clean instance startup  
✅ **Cross-Platform Communication**: IOP invite exchange working  
✅ **Data Synchronization**: Bidirectional file sync confirmed  
✅ **Error Recovery**: Proper cleanup and timeout handling  

The implementation provides a complete, tested, and documented solution for cross-platform data synchronization between Windows and Linux instances of ONE.filer.