## Development Notes

- We do not use fuse on Windows. We use fuse on Linux via WSL
- wmic is the way to go to kill the app

## Important Safety Rules

### NEVER Kill All Node.js Processes
- **CRITICAL**: Never use `taskkill /F /IM node.exe` without specific filters
- Claude Code runs in a Node.js process, so killing all node.exe processes will terminate Claude itself
- Instead, use specific process filtering:
  - Kill only electron: `taskkill /F /IM electron.exe`
  - Kill specific node processes by command line: `wmic process where "name='node.exe' and commandline like '%one.filer%'" delete`
  - Always check what's running first: `wmic process where "name='node.exe'" get processid,commandline`

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.