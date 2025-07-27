# ONE.filer Documentation & AI Assistant Guide

This document provides comprehensive guidance for AI assistants and TaskMaster integration when working on the ONE.filer project.

## Project Overview

**ONE.filer** is a Windows Explorer integration that enables Windows users to access ONE database objects as regular files and folders. **CRITICAL: The entire one.filer application runs inside Debian WSL2 using Linux Node.js and FUSE.**

### Architecture
```
Windows Explorer → WSL2 File Bridge → DEBIAN WSL2 (one.filer + FUSE + one.core) 
                                     ↑
                              ALL PROCESSING HAPPENS HERE
```

**IMPORTANT ARCHITECTURE NOTES**:
- ✅ **one.filer runs entirely in Debian WSL2** (Linux environment)
- ✅ **FUSE filesystem runs in Debian WSL2** (requires Linux Node.js)  
- ✅ **one.core runs in Debian WSL2** (Linux Node.js required)
- ❌ **Nothing runs on Windows side** except Explorer accessing WSL2 files
- ❌ **Windows Node.js CANNOT be used** - must use Linux Node.js in WSL2

### Platform Requirements
- **WSL2**: Ubuntu 24.04 LTS (or compatible Debian-based distribution)
- **Node.js**: Must be installed **inside WSL2** (Linux version, not Windows)
- **FUSE**: Linux FUSE implementation (fuse-native package)
- **Mount Point**: Linux filesystem path (e.g., `/home/user/one-files`)

### Performance Targets
- **File Operations**: <500ms response time
- **Memory Usage**: <100MB footprint  
- **Platform Support**: Windows 10/11 with WSL2 + Ubuntu

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
│   ├── filesystem/     # FUSE integration layer
│   ├── windows/        # Windows-specific integration
│   ├── core/          # ONE core interaction
│   └── ingestion/     # Data ingestion pipeline (Task #8 focus)
├── one.core/          # ONE database core (submodule)
├── tasks/             # TaskMaster task files
├── scripts/           # Build and setup scripts
└── .taskmasterconfig  # TaskMaster configuration
```

## Key Dependencies

- **one.core**: Database and object management
- **fuse-node**: FUSE filesystem bindings
- **node-windows**: Windows service integration
- **mime-types**: File type detection
- **TaskMaster**: Project management and AI coordination

## Common Pitfalls

1. **Recipe Timing**: Ensure recipes are registered before object creation
2. **Path Handling**: Windows vs Linux path differences in WSL2
3. **Memory Management**: ONE objects can be large; use streaming for big files
4. **Hash Validation**: Always verify content hashes for data integrity
5. **Transaction Boundaries**: ONE operations may need explicit transaction management

## Emergency Procedures

If development gets stuck:

1. **Check TaskMaster logs**: Debug issues with task breakdown
2. **Verify ONE instance**: Ensure database initialization succeeded
3. **WSL2 Connectivity**: Test Windows ↔ WSL2 communication
4. **Rollback Strategy**: Use git to return to known working state
5. **Clean Rebuild**: Remove `node_modules/`, `dist/`, reinstall dependencies

This documentation should be updated as the project evolves and new patterns emerge during Task #8 implementation and beyond.

## Critical Troubleshooting

### ❌ Common WSL2 Setup Issue: "fuse-shared-library is not currently supported on: win32"

**Problem**: When running `wsl npm start`, you get:
```
Error: fuse-shared-library is not currently supported on: win32
```

**Root Cause**: WSL2 is using the Windows Node.js installation instead of a Linux Node.js installation.

**Check the issue**:
```bash
wsl which npm
# If this shows: /mnt/c/Program Files/nodejs//npm 
# Then you're using Windows Node.js (WRONG!)
```

**Solution**: Install Node.js **inside** WSL2 Ubuntu:
```bash
# Enter WSL2
wsl

# Update package list
sudo apt update

# Install Node.js (Ubuntu 24.04 LTS)
sudo apt install nodejs npm

# Verify Linux Node.js is now used
which node    # Should show: /usr/bin/node (not /mnt/c/...)
which npm     # Should show: /usr/bin/npm (not /mnt/c/...)

# Check platform detection
node -e "console.log(process.platform)"  # Should show: linux
```

**Then run the filer**:
```bash
# Inside WSL2, navigate to project
cd /mnt/c/Users/[user]/source/one.filer

# Install dependencies with Linux npm
npm install

# Build with Linux Node.js
npm run build

# Run with Linux Node.js (will now work!)
npm start
```

### ✅ Expected Success Output
When properly running with Linux Node.js in WSL2:
```
🐧 WSL2 FUSE mounted successfully at /home/gecko/one-files
🪟 Access via Windows Explorer: C:\Users\[user]\AppData\Local\Packages\[...]
[info]: Filer file system was mounted at /home/gecko/one-files
``` 