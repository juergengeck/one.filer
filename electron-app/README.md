# ONE Filer Login App

A Windows Electron application that manages the ONE Filer service running in WSL2, providing a user-friendly interface for connecting to ONE Leute Replicant.

## Features

- **System Tray Integration** - Runs in background with quick access
- **Automatic WSL Detection** - Checks and validates WSL2 installation
- **Real-time Status Monitoring** - Shows connection status and metrics
- **Secure Credential Handling** - Safely manages ONE instance secrets
- **Single Instance Lock** - Prevents multiple instances with IPC communication
- **Auto-start Support** - Can be configured to start with Windows
- **Process Management** - Direct control of ONE Filer process in WSL

## Prerequisites

- Windows 10/11
- WSL2 with Ubuntu installed
- Node.js 20+ (for development)
- ONE Filer built and ready in WSL at `/mnt/c/Users/juerg/source/one.filer`

## Development Setup

```bash
# Clone the repository
git clone https://github.com/refinio/one.filer.git
cd one.filer/electron-app

# Install dependencies
npm install

# Build TypeScript and CSS
npm run build

# Run in development mode
npm run dev

# Or just start normally
npm start
```

## Building for Distribution

```bash
# Build Windows installer (.exe)
npm run build-win

# Build portable version
npm run dist
```

Output files will be in `dist-app/` directory.

## Usage

### First Time Setup

1. **Build ONE Filer in WSL first**:
   ```bash
   # In WSL Ubuntu
   cd /mnt/c/Users/juerg/source/one.filer
   npm install
   npm run build
   node fix-all-imports.js  # Important: Fix ES module imports
   ```

2. **Launch the Electron app**:
   ```bash
   cd electron-app
   npm start
   ```

3. **Connect to ONE Leute Replicant**:
   - Enter your ONE instance secret (password)
   - Optionally specify a custom config file path
   - Click "Connect" to start ONE Filer
   - The app will show "Connected" when successful

### Daily Usage

1. Launch "ONE Filer Login" from Start Menu or desktop
2. App starts in system tray
3. Click tray icon to show/hide window
4. Enter credentials and connect
5. Access your files via the FUSE mount point

## Configuration

The app uses `config.json` for settings:

```json
{
  "startMinimized": false,
  "showInSystemTray": true,
  "autoConnect": false,
  "wslDistro": "Ubuntu",
  "replicantPath": "/mnt/c/Users/juerg/source/one.filer"
}
```

## Troubleshooting

### "Another instance is already running"
```bash
# Kill existing electron processes
powershell -Command "Get-Process electron | Stop-Process -Force"
```

### "Cannot find module" errors in WSL
```bash
# Fix ES module imports
cd /mnt/c/Users/juerg/source/one.filer
node fix-all-imports.js
```

### App won't start
1. Check if port 17890 is in use: `netstat -an | findstr 17890`
2. Ensure all dependencies are installed: `npm install`
3. Rebuild: `npm run build`

### ONE Filer won't start
- Verify ONE Filer is built in WSL: `ls -la lib/`
- Check WSL is running: `wsl --list --running`
- Ensure correct path in main.ts (should be `/mnt/c/Users/juerg/source/one.filer`)

## Architecture

- **main.ts**: Main process handling WSL communication and process management
- **preload.ts**: Secure bridge between renderer and main process
- **renderer.ts**: UI logic and status monitoring
- Uses Node.js child_process to spawn WSL commands
- Real-time status monitoring with periodic updates
- Direct process control without HTTP APIs