# OneFiler Project Structure

## Clean Project Layout

```
one.filer/
├── src/                      # TypeScript source code
│   ├── filer/               # Core FUSE filesystem implementation
│   ├── commands/            # CLI commands (start, init, etc.)
│   ├── misc/                # Utilities and helpers
│   ├── fuse/                # FUSE native bindings
│   └── types/               # TypeScript type definitions
│
├── test/                     # Test suite
│   ├── integration/         # Integration tests
│   │   ├── 00-basic-fuse-mount.test.ts
│   │   ├── 01-wsl-access.test.ts
│   │   └── 02-minimal-fuse-example.test.ts
│   ├── unit/                # Unit tests (to be added)
│   ├── scripts/             # Test runner scripts
│   └── README.md            # Test documentation
│
├── scripts/                  # Development scripts
│   ├── setup/               # Setup and installation scripts
│   │   ├── run-ubuntu-setup.sh
│   │   └── wsl-native-setup.sh
│   ├── testing/             # Old test scripts (use /test instead)
│   ├── fixes/               # Fix attempts and workarounds
│   └── archive/             # Old/deprecated scripts
│
├── configs/                  # Configuration files
│   └── filer.json           # Main configuration
│
├── docs/                     # Documentation
│   └── archive/             # Old task-specific docs
│
├── lib/                      # Built JavaScript (generated)
├── node_modules/             # Dependencies (generated)
│
├── package.json              # Project manifest
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Main documentation
├── CLAUDE.md                 # AI assistant guide
├── LICENSE.md                # MIT License
└── .windsurfrules           # Development workflow rules
```

## Key Directories

### `/src` - Source Code
- All TypeScript source files
- Organized by functionality
- Platform-specific code in system-* directories

### `/test` - New Test Suite
- Systematic tests to debug FUSE issues
- Run with `npm test` (in WSL) or `npm run test:windows`
- See `/test/README.md` for details

### `/scripts` - Organized Scripts
- `setup/` - Installation and setup scripts
- `archive/` - Old scripts kept for reference
- Cleaned up from ~40 scripts in root to organized structure

### `/configs` - Configuration
- JSON configuration files
- Main config: `filer.json`

## Development Workflow

1. **Setup**: Use scripts in `/scripts/setup/`
2. **Development**: Edit TypeScript in `/src/`
3. **Build**: Run `npm run build`
4. **Test**: Use new test suite in `/test/`
5. **Run**: `npm start` or `node lib/index.js`

## What Changed

### Before (Messy Root)
- 40+ scripts scattered in root
- Multiple test attempts with unclear purpose
- Duplicate functionality across scripts
- No systematic testing approach

### After (Organized)
- Scripts organized by purpose
- New systematic test suite
- Clear project structure
- Documented testing strategy

## Next Steps

1. Run the test suite to identify issues
2. Fix FUSE mounting problems systematically
3. Implement Windows Explorer integration
4. Add more comprehensive tests