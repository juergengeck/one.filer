# ONE Filer Demo Setup

This demo configuration allows you to quickly test ONE Filer with pre-configured settings.

## Demo Credentials

- **Email**: `demo@example.com`
- **Password**: `test123`
- **Instance**: `demo-instance`
- **Config File**: `configs/demo-config.json`

## Quick Start

### Step 1: Initialize Demo Instance (First Time Only)
Run this command once to create the demo instance:
```
INIT_DEMO.bat
```

### Step 2: Start the Demo
After initialization, you can start the demo using:
```
START_DEMO.bat
```

### Option 2: Using the Electron App
1. Start the Electron app:
   ```
   cd electron-app
   npm start
   ```
2. In the login form:
   - Email: `demo@example.com`
   - Password: `test123`
   - Config Path: `configs/demo-config.json`
3. Click "Start"

### Option 3: Manual Command
```bash
# From Windows
wsl -d Ubuntu -e bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm start -- start --secret test123 --config configs/demo-config.json"

# From WSL
cd /home/juerg/one.filer
npm start -- start --secret test123 --config configs/demo-config.json
```

## Demo Configuration Details

The demo configuration (`configs/demo-config.json`) includes:
- Data directory: `data-demo` (separate from production data)
- Mount point: `~/filer-mount`
- Communication server: `wss://comm10.dev.refinio.one`
- Filer logging enabled for debugging
- Light IoM mode for faster startup

## How the Multiuser System Works

ONE Filer is a multiuser system where:
- **Email** identifies the person (e.g., demo@example.com)
- **Password/Secret** authenticates the user
- **Instance Name** identifies different devices for the same person
- Multiple users can have separate instances with their own data

## Notes

- You must run `INIT_DEMO.bat` once before using the demo to create the instance
- The demo uses a separate data directory (`data-demo`) to avoid conflicts with production data
- Each person can have multiple instances (e.g., laptop, desktop) with the same email