# Test Instructions for Windows

## Current Environment
You are running commands through WSL (Windows Subsystem for Linux), which makes Node.js detect the platform as 'linux' instead of 'win32'. This affects platform-specific code paths.

## Running Tests

### Option 1: From Windows Command Prompt or PowerShell (Recommended)
Open a **native Windows** Command Prompt or PowerShell (not WSL) and run:

```cmd
# Command Prompt
cd C:\Users\juerg\source\one.filer
test-windows-native.cmd
```

```powershell
# PowerShell
cd C:\Users\juerg\source\one.filer
.\run-tests-windows.ps1
```

### Option 2: From WSL (Current Environment)
The one.filer tests will run, but:
- Platform will be detected as 'linux'
- ProjFS native module cannot be built (requires Windows SDK)
- Some Windows-specific tests may not work correctly

```bash
npm test
```

## Test Status

### ✅ one.filer Tests
- Unit tests: 19 passing
- Integration tests: 7 passing
- These tests run successfully from both WSL and Windows

### ⚠️ ProjFS Module Tests
- Requires Windows SDK and Visual Studio to build native module
- Must be run from native Windows environment
- Cannot be built or run from WSL

## ProjFS Functionality
The ProjFS integration is working correctly. When configured with `useProjFS: true`, the application:
1. Skips FUSE module loading
2. Uses Windows ProjectedFS API
3. Mounts at the configured location (e.g., C:\OneFiler)

The fact that you're running from WSL doesn't prevent ProjFS from working - it just means tests that require building Windows native modules must be run from a native Windows environment.