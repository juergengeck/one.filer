# ONE.filer Documentation & AI Assistant Guide

This document provides comprehensive guidance for AI assistants and TaskMaster integration when working on the ONE.filer project.

## Project Overview

**ONE.filer** is a Windows Explorer integration that enables Windows users to access ONE database objects as regular files and folders through native Windows filesystem APIs.

### Architecture

#### Current Architecture (ProjFS - Windows Native)
```
Windows Explorer → ProjFS Driver (Windows Kernel) → one.filer + one.projfs → one.core
                                                    ↑
                                          ALL PROCESSING HAPPENS HERE
```

**IMPORTANT ARCHITECTURE NOTES**:
- ✅ **one.filer runs natively on Windows** using Node.js for Windows
- ✅ **ProjFS (Projected File System)** provides virtual filesystem functionality
- ✅ **one.core runs on Windows** (Windows Node.js)
- ✅ **Direct Windows Explorer integration** without WSL2 overhead
- ✅ **10x faster file access** compared to WSL2/FUSE approach

#### Legacy Architecture (WSL2 + FUSE - Deprecated)
```
Windows Explorer → \\wsl$\Ubuntu → WSL2 (one.filer + FUSE + one.core)
```
This approach is now deprecated in favor of native Windows ProjFS integration.

### Platform Requirements
- **Windows**: Windows 10 version 1809+ or Windows 11 (with ProjFS support)
- **Node.js**: Windows version 20.0.0 or later
- **Visual Studio**: 2019 or later (for native module compilation)
- **ProjFS**: Windows Projected File System (optional Windows feature)

### Performance Targets
- **File Operations**: <50ms response time (10x improvement over WSL2)
- **Memory Usage**: <100MB footprint  
- **Platform Support**: Windows 10/11 with ProjFS enabled

## ONE Core System Understanding

Based on the ONE core source analysis, here are the key concepts:

### ONE Objects & Recipes

**ONE Objects** are structured data entities with strong typing defined by **Recipes**:

```typescript
// Recipe defines object structure
interface Recipe {
    $type$: 'Recipe';
    name: string;           // Object type name (e.g., 'Person', 'File')
    rule: RecipeRule[];     // Array of property definitions
}

// Recipe rules define individual properties
interface RecipeRule {
    itemprop: string;       // Property name
    isId?: boolean;         // Part of object ID (versioned objects)
    valueType?: ValueType;  // Data type (string, number, referenceToObj, etc.)
    // ... other properties
}
```

### Key ONE Concepts for File System Integration

1. **Microdata Format**: Objects stored as HTML5 microdata strings
2. **Hash-based Storage**: Content-addressable using SHA-256 hashes
3. **Versioned vs Unversioned Objects**:
   - **Versioned**: Have `isId: true` properties, support version history
   - **Unversioned**: Immutable, no versioning (like BLOB/CLOB data)

4. **Data Types**:
   - **Structured Data**: JSON, XML, CSV → ONE objects via recipes
   - **Unstructured Data**: Binary files → BLOB storage
   - **Text Data**: Plain text → CLOB storage

### File System Integration Patterns

```typescript
// For structured data (Task #8 focus)
interface PersistentFileSystemFile {
    $type$: 'PersistentFileSystemFile';
    path: string;           // Windows file path
    mimeType: string;       // Content type
    size: number;           // File size
    lastModified: Date;     // Timestamp
    content: SHA256Hash;    // Hash to actual content
}

// For binary/unstructured data
interface BlobDescriptor {
    $type$: 'BlobDescriptor';
    mimeType: string;
    encoding?: string;
    metadata: Map<string, any>;
    blobHash: SHA256Hash;   // Points to BLOB storage
}
```

## TaskMaster Integration Guide

### Current Project Status
- **Progress**: 50% complete (6/12 tasks done)
- **Next Priority**: Task #8 - Two-Tier Data Ingestion Pipeline
- **Configuration**: Local Ollama AI models (Gemma2 5.4GB, Llama3.2 2GB)

### TaskMaster Configuration

The project uses **local AI models** to avoid expensive cloud costs:

```json
// .cursor/mcp.json environment section
{
  "env": {
    "ANTHROPIC_API_KEY": "your-key-here",
    "OLLAMA_BASE_URL": "http://localhost:11434/api"
  }
}
```

### Key TaskMaster Commands for ONE.filer

```bash
# View current status
task-master list --with-subtasks

# Get next recommended task
task-master next

# Break down complex tasks (especially Task #8)
task-master expand --id=8 --research --force

# Update implementation details during development
task-master update-subtask --id=8.1 --prompt="Implementation notes..."

# Mark progress
task-master set-status --id=8.1 --status=in-progress
task-master set-status --id=8.1 --status=done
```

## AI Assistant Guidelines

### Task #8: Two-Tier Data Ingestion Implementation

**Architecture Understanding Required**:
1. **Structured Data Pathway**: Files with known recipes → ONE objects
2. **Unstructured Data Pathway**: Binary/unknown files → BLOB/CLOB with metadata

**Key Implementation Areas**:

#### 1. File Type Detection
```typescript
// Detect if file can be converted to ONE object
function detectFileStructure(filePath: string): 'structured' | 'unstructured' {
    // Check extension, MIME type, content analysis
    // Return pathway designation
}
```

#### 2. Recipe Matching
```typescript
// Match file format to available recipes
function findMatchingRecipe(fileContent: string, mimeType: string): Recipe | null {
    // Check against registered recipes
    // JSON → JSON recipe, XML → XML recipe, etc.
}
```

#### 3. Structured Data Conversion
```typescript
// Convert structured file to ONE object
async function convertToOneObject(filePath: string, recipe: Recipe): Promise<OneObjectTypes> {
    // Parse file content according to recipe rules
    // Create properly typed ONE object
    // Store via one.core storage APIs
}
```

#### 4. Unstructured Data Storage
```typescript
// Store as BLOB/CLOB with metadata
async function storeUnstructuredFile(filePath: string): Promise<{
    descriptor: BlobDescriptor,
    fileSystemObject: PersistentFileSystemFile
}> {
    // Extract metadata (size, timestamps, Windows attributes)
    // Store content as BLOB
    // Create descriptor objects
}
```

### Development Workflow Integration

#### Before Starting ANY Task:
1. **Check TaskMaster status**: `task-master list`
2. **Review next task**: `task-master next`
3. **Break down complex tasks**: `task-master expand --id=X --research`

#### During Implementation:
1. **Log exploration findings**: 
   ```bash
   task-master update-subtask --id=X.Y --prompt="
   Explored codebase and found:
   - Key files: src/filesystem/adapter.ts, src/core/ingestion.ts
   - Implementation approach: Use detectFileStructure() + recipe matching
   - Challenges: MIME type detection, recipe registration timing
   "
   ```

2. **Document implementation decisions**:
   ```bash
   task-master update-subtask --id=X.Y --prompt="
   Implementation Progress:
   - ✅ File detection working for JSON/XML
   - ⚠️  Recipe matching needs caching optimization
   - 🔄 Testing BLOB storage integration
   "
   ```

#### After Implementation:
1. **Mark completion**: `task-master set-status --id=X.Y --status=done`
2. **Update dependent tasks** if approach changed:
   ```bash
   task-master update --from=9 --prompt="
   Task #8 implementation changed the file detection API.
   Now using detectFileStructure() instead of guessFileType().
   Update performance optimization tasks accordingly.
   "
   ```

### Code Pattern Recognition

When working with ONE.filer, watch for these patterns:

#### ONE Object Creation
```typescript
// Always use proper typing
const fileObject: PersistentFileSystemFile = {
    $type$: 'PersistentFileSystemFile',
    path: windowsPath,
    mimeType: detectMimeType(filePath),
    size: stats.size,
    lastModified: stats.mtime,
    content: await storeContent(filePath)
};
```

#### Recipe Management
```typescript
// Check recipe availability before use
if (!hasRecipe('CustomFileFormat')) {
    await registerRecipes([customFileFormatRecipe]);
}
```

#### Error Handling
```typescript
// ONE core uses specific error patterns
try {
    const obj = await getObjectByIdHash(hash, 'PersistentFileSystemFile');
} catch (err) {
    if (err.name === 'FileNotFoundError') {
        // Handle missing file
    }
    throw err; // Re-throw other errors
}
```

### Testing Strategy

For ONE.filer development, always test:

1. **File System Operations**: 
   - Windows → WSL2 path translation
   - FUSE mount/unmount cycles
   - Permission handling

2. **ONE Object Integrity**:
   - Recipe validation
   - Hash consistency
   - Version tracking (for versioned objects)

3. **Performance Benchmarks**:
   - File operation timing (<500ms target)
   - Memory usage monitoring (<100MB target)
   - Concurrent access handling

## Important Files & Directories

```
one.filer/
├── src/
│   ├── filer/          # Main filer implementation with ProjFS support
│   ├── commands/       # CLI commands (start, init, configure)
│   ├── misc/           # Utilities and helpers
│   └── types/          # TypeScript type definitions
├── one.projfs/         # Windows ProjFS integration module
│   ├── src/            # ProjFS provider implementation
│   ├── native/         # C++ Node-API bindings
│   └── examples/       # Usage examples
├── one.core/           # ONE database core (submodule)
├── one.models/         # ONE data models (submodule)
├── tasks/              # TaskMaster task files
├── scripts/            # Build and setup scripts
└── configs/            # Configuration files
```

## Key Dependencies

- **one.core**: Database and object management
- **one.models**: Data models and filesystem abstractions
- **one.projfs**: Windows Projected File System integration
- **node-gyp**: Native module compilation
- **commander**: CLI framework
- **TaskMaster**: Project management and AI coordination

## Common Pitfalls

1. **Recipe Timing**: Ensure recipes are registered before object creation
2. **ProjFS Availability**: Ensure Windows Projected File System feature is enabled
3. **Memory Management**: ONE objects can be large; use streaming for big files
4. **Hash Validation**: Always verify content hashes for data integrity
5. **Transaction Boundaries**: ONE operations may need explicit transaction management
6. **Native Module Build**: Ensure Visual Studio and Windows SDK are installed

## Emergency Procedures

If development gets stuck:

1. **Check TaskMaster logs**: Debug issues with task breakdown
2. **Verify ONE instance**: Ensure database initialization succeeded
3. **ProjFS Status**: Check if Windows Projected File System is enabled
4. **Native Module Issues**: Rebuild with `npm run build:native` in one.projfs
5. **Rollback Strategy**: Use git to return to known working state
6. **Clean Rebuild**: Remove `node_modules/`, `dist/`, reinstall dependencies

This documentation should be updated as the project evolves and new patterns emerge during Task #8 implementation and beyond.

## Critical Troubleshooting

### ❌ Common ProjFS Setup Issue: "ProjFS not available on this system"

**Problem**: When running `npm start`, you get:
```
Error: ProjFS not available on this system
```

**Root Cause**: Windows Projected File System feature is not enabled.

**Solution**: Enable ProjFS feature:
```powershell
# Run as Administrator in PowerShell
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart

# Restart your computer after enabling
```

### ❌ Native Module Build Issues

**Problem**: Build fails with node-gyp errors

**Solution**: Install build dependencies:
```powershell
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# Or install full Visual Studio with C++ workload
# Select "Desktop development with C++" during installation
```

### ✅ Expected Success Output
When properly running with ProjFS on Windows:
```
🪟 Starting ProjFS (Windows native mode)...
[info]: Filer file system was mounted at C:\OneFiler using ProjFS
```

### Running the Application

**Quick Start**:
```cmd
# Command prompt
npm start -- start -s YOUR_SECRET -c configs/demo-config.json

# PowerShell
.\start-projfs.ps1
```

**Configuration for ProjFS**:
```json
{
    "useFiler": true,
    "filerConfig": {
        "useProjFS": true,
        "projfsRoot": "C:\\OneFiler",
        "projfsCacheSize": 104857600
    }
}
``` 