# ONE.Filer Project Structure

## Clean Organization (Updated: 2025-08-31)

The project has been reorganized for better maintainability and clarity.

## Root Directory Structure

### Core Directories
- **`src/`** - TypeScript source code
- **`lib/`** - Compiled JavaScript output
- **`test/`** - Test files and specifications
- **`packages/`** - Platform-specific packages (one.filer.linux, one.filer.windows)
- **`electron-app/`** - Windows Electron application

### Integration Packages
- **`refinio.api/`** - Management API integration
- **`refinio.cli/`** - Command-line interface
- **`one.leute.replicant/`** - Core replicant functionality
- **`one.projfs/`** - Windows ProjFS integration
- **`one.fuse3/`** - Linux FUSE3 integration
- **`one.ifsprojfs/`** - IFS ProjFS bridge

### Documentation & Configuration
- **`docs/`** - All documentation files (moved from root)
  - Technical documentation
  - Architecture guides
  - Implementation notes
  - Images and diagrams
- **`configs/`** - Configuration files
- **`.github/`** - GitHub workflows and CI/CD

### Organized Scripts
- **`scripts/`** - All scripts organized by category
  - `testing/` - Test scripts (96 files)
  - `setup/` - Setup and build scripts (29 files)
  - `utilities/` - Utility scripts (43 files)
  - `fixes/` - Debug and fix scripts (24 files)
  - `archive/` - Deprecated/obsolete scripts (39+ files)

### Build & Dependencies
- **`vendor/`** - Third-party packages and dependencies
- **`node_modules/`** - NPM dependencies
- **`bin/`** - Binary executables

### Data & Logs
- **`data/`** - Active data directory
- **`logs/`** - Log files (moved from root)
- **`archive-data/`** - Old test data directories
- **`archive-configs/`** - Old configuration files

### Platform-Specific
- **`debian/`** - Debian package configuration
- **`windows-installer/`** - Windows installer files
- **`windows-package/`** - Windows package files
- **`linux/`** - Linux-specific files

### Development
- **`tasks/`** - Task definitions
- **`cleanup/`** - Cleanup utilities
- **`temp-models/`** - Temporary model files

## Key Configuration Files (Root)
- `package.json` - Main package configuration
- `tsconfig.json` - TypeScript configuration
- `README.md` - Project documentation
- `CLAUDE.md` - Development notes and safety rules
- `LICENSE` - MIT license
- `.gitignore` - Git ignore rules
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier configuration

## Cleanup Summary

### Before Cleanup
- 254 files in root directory
- Scripts scattered everywhere
- Test data directories mixed with source
- Documentation files cluttering root

### After Cleanup
- ~25 essential files in root
- All scripts organized in `scripts/` directory
- Documentation moved to `docs/`
- Test data archived in `archive-data/`
- Logs moved to `logs/`
- Clear, logical structure

## Quick Navigation

### Running Tests
```bash
npm test                    # Cross-platform tests
npm run test:linux         # Linux-specific
npm run test:windows       # Windows-specific
```

### Key Scripts
- Testing: `scripts/testing/test-cross-platform-refinio-cli.js`
- Setup: Check `scripts/setup/`
- Utilities: Check `scripts/utilities/`

### Documentation
- Architecture: `docs/ARCHITECTURE.md`
- Testing Guide: `docs/testing.md`
- CLI Reference: `docs/cli.md`

## Development Workflow

1. Source code in `src/`
2. Compile to `lib/` with `npm run build`
3. Run tests from `test/`
4. Use scripts from `scripts/` for operations
5. Check `docs/` for documentation

The project is now clean, organized, and ready for efficient development!