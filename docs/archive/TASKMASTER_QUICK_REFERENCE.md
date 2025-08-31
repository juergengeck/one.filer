# TaskMaster Quick Reference - ONE.filer

## Essential Commands

### Status & Planning
```bash
# Current project overview
task-master list --with-subtasks

# Next recommended task  
task-master next

# View specific task details
task-master show 8  # Task #8: Data Ingestion Pipeline
```

### Task Management
```bash
# Break down complex tasks (use for Task #8)
task-master expand --id=8 --research --force

# Set task status
task-master set-status --id=8 --status=in-progress
task-master set-status --id=8.1 --status=done

# Add new tasks as discovered
task-master add-task --prompt="Implement MIME type caching" --dependencies=8 --priority=medium
```

### Development Logging
```bash
# Log exploration findings
task-master update-subtask --id=8.1 --prompt="
Found key files:
- src/ingestion/detector.ts (file type detection)
- src/core/recipes.ts (recipe management)
- Need to implement structured vs unstructured routing
"

# Document implementation progress
task-master update-subtask --id=8.2 --prompt="
✅ Structured data detection working
⚠️  BLOB storage integration pending
🔄 Testing with JSON/XML files
"

# Update multiple dependent tasks
task-master update --from=9 --prompt="
Task #8 changed the file detection API.
New detectFileStructure() function replaces guessFileType().
Update performance optimization tasks accordingly.
"
```

### Project-Specific Context

**Current Focus**: Task #8 - Two-Tier Data Ingestion Pipeline
- **Structured Path**: Files with recipes → ONE objects
- **Unstructured Path**: Binary files → BLOB/CLOB + metadata

**Key Files to Watch**:
- `src/ingestion/` - Data ingestion logic
- `one.core/src/recipes.ts` - Recipe management
- `src/filesystem/` - FUSE integration

**Architecture Notes**:
- ONE objects use microdata format (HTML5)
- Hash-based content addressing (SHA-256)
- Versioned vs unversioned object distinction
- Recipe-driven type safety

## AI Model Configuration

**Local Ollama Setup** (cost-effective):
```bash
# Set models to use local Ollama
task-master models --set-main=gemma2:latest --ollama
task-master models --set-research=llama3.2:latest --ollama

# Check current configuration
task-master models
```

**Environment**: Ensure `.cursor/mcp.json` includes:
```json
{
  "env": {
    "OLLAMA_BASE_URL": "http://localhost:11434/api"
  }
}
```

## Development Workflow

1. **Start Session**: `task-master next`
2. **Break Down**: `task-master expand --id=X --research`
3. **Begin Work**: `task-master set-status --id=X.Y --status=in-progress`
4. **Log Progress**: `task-master update-subtask --id=X.Y --prompt="..."`
5. **Complete**: `task-master set-status --id=X.Y --status=done`
6. **Update Dependencies**: `task-master update --from=Z --prompt="..."`

## Emergency Commands

```bash
# If tasks get corrupted
task-master validate-dependencies
task-master fix-dependencies

# Reset to clean state
task-master move --from=X --to=Y  # Reorganize if needed

# View complexity analysis
task-master analyze-complexity --research
task-master complexity-report
```

For detailed guidance, see [DOCUMENTATION.md](DOCUMENTATION.md) 