# OneFiler Test Suite

This test suite is designed to systematically debug and fix OneFiler issues by testing each component in isolation.

## Test Structure

```
test/
├── integration/          # Integration tests
│   ├── 00-basic-fuse-mount.test.ts    # Basic FUSE mounting in WSL
│   ├── 01-wsl-access.test.ts          # Windows → WSL filesystem access
│   └── 02-minimal-fuse-example.test.ts # Minimal FUSE implementation
├── unit/                 # Unit tests (to be added)
├── scripts/              # Test runner scripts
│   ├── run-tests.sh      # WSL test runner
│   └── run-windows-tests.ps1  # Windows test runner
└── README.md            # This file
```

## Running Tests

### From WSL2 (Ubuntu)
```bash
cd /home/gecko/one.filer  # or your project directory
./test/scripts/run-tests.sh
```

### From Windows PowerShell
```powershell
cd C:\Users\[username]\source\one.filer
.\test\scripts\run-windows-tests.ps1
```

## Test Descriptions

### Test 00: Basic FUSE Mount
- Verifies FUSE is available in WSL2
- Mounts a basic FUSE filesystem
- Tests basic read/write operations
- **Must pass before proceeding to other tests**

### Test 01: WSL Filesystem Access
- Verifies Windows can access WSL through \\wsl$
- Tests file read/write from Windows to WSL
- Checks permissions and ownership
- **Run from Windows PowerShell**

### Test 02: Minimal FUSE Example
- Creates the simplest possible FUSE filesystem
- Isolates OneFiler-specific issues from FUSE issues
- Provides a working reference implementation

## Debugging Steps

1. **Start with Test 00** - If this fails, check:
   - Are you running in WSL2? (`cat /proc/version` should mention Microsoft)
   - Is FUSE installed? (`sudo apt install libfuse3-dev`)
   - Do you have permission to mount? (try with sudo)

2. **Run Test 01 from Windows** - If this fails, check:
   - Is WSL2 running? (`wsl --status`)
   - Can you access `\\wsl$\Ubuntu` in File Explorer?
   - Are Windows Defender/firewall blocking access?

3. **Run Test 02** - If this works but OneFiler doesn't:
   - The issue is in OneFiler's implementation
   - Compare the minimal example with OneFiler's FuseFrontend

## Next Steps

Once all basic tests pass, we can:
1. Add tests for OneFiler-specific functionality
2. Test Windows Explorer integration
3. Test ONE database operations
4. Add performance benchmarks