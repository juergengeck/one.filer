# Linux Packages for ONE Filer

This directory contains the Linux-specific packages for the ONE filesystem bridge, providing modern FUSE3 support for mounting ONE databases as filesystems on Linux.

## Package Structure

### 1. `@refinio/fuse3` (refinio-fuse3/)
**Pure FUSE3 N-API bindings**
- Low-level native bindings for FUSE3
- No business logic, just the native layer
- Replaces outdated `fuse-native`
- Modern Node.js 18+ support

### 2. `one.filer.linux` (one.filer.linux/)
**Complete Linux implementation**
- Linux counterpart to `one.filer.windows`
- Full Replicant orchestrator
- Filer with all filesystem types
- Uses @refinio/fuse3 for mounting
- Shares core code with Windows implementation

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    Applications                        │
│          (User applications, file managers)            │
├────────────────────────────────────────────────────────┤
│                 Linux Kernel FUSE                      │
├────────────────────────────────────────────────────────┤
│                one.filer.linux                         │
│         (Business logic, filesystem impl)              │
├────────────────────────────────────────────────────────┤
│                 @refinio/fuse3                         │
│            (Pure FUSE3 N-API bindings)                 │
└────────────────────────────────────────────────────────┘
```

## Relationship to Other Projects

### one.filer.windows (Parent Project)
The Windows implementation provides:
- Windows support via ProjectedFS (ProjFS)
- Core implementation shared with Linux
- Electron app for Windows

### one.filer.linux
The Linux implementation:
- Uses the same core codebase
- Replaces ProjFS with FUSE3
- Platform-specific adaptations

### one.leute.replicant
The standard orchestrator package that:
- Has been updated to use @refinio/fuse3
- Provides the Replicant class
- Manages all ONE.models

Repository: https://github.com/juergengeck/one.leute.replicant

## Installation & Usage

### For Development

```bash
# Install dependencies for both packages
cd linux/refinio-fuse3
npm install
npm run build

cd ../one-filer-fuse3
npm install
npm run build
```

### For Production Use

The packages can be published to npm or used locally:

```bash
# In your project
npm install @refinio/fuse3
npm install @refinio/one.filer.fuse3

# Or use one.leute.replicant directly
npm install github:juergengeck/one.leute.replicant
```

## Key Improvements Over Legacy System

1. **Modern FUSE3 Support**
   - Replaces outdated fuse-native
   - Works with current Node.js versions
   - Better performance and stability

2. **Unified Codebase**
   - Uses same implementation as Windows version
   - Easier maintenance
   - Consistent behavior across platforms

3. **Clean Architecture**
   - Clear separation of concerns
   - Pure bindings vs business logic
   - Reusable components

## Development Workflow

1. **@refinio/fuse3** - Provides the native layer
2. **Current project's code** - Provides implementation
3. **@refinio/one.filer.fuse3** - Adapts implementation for Linux
4. **one.leute.replicant** - Uses everything together

## Testing

```bash
# Test FUSE3 bindings
cd linux/refinio-fuse3
npm test

# Test full implementation
cd linux/one-filer-fuse3
npm test

# Run integration tests
npm run test:integration
```

## Platform Requirements

- Linux kernel with FUSE3 support
- Node.js 18 or higher
- FUSE3 development headers (`libfuse3-dev`)
- Build tools (gcc, make, python3)

## Future Improvements

- [ ] Publish packages to npm registry
- [ ] Add automated CI/CD for Linux builds
- [ ] Create Debian/Ubuntu packages
- [ ] Add systemd service files
- [ ] Performance benchmarks

## Support

For issues specific to Linux packages:
- https://github.com/juergengeck/refinio-fuse3
- https://github.com/juergengeck/one-filer-fuse3

For general ONE.filer issues:
- Use the main project's issue tracker

## License

SEE LICENSE IN LICENSE.md