# ONE Filer Installation Guide

## Overview

ONE Filer is a Windows application that integrates the ONE federated database system with Windows Explorer through WSL2. This guide covers the complete installation and setup process.

## System Requirements

- **Windows 10** version 2004 or later, or **Windows 11**
- **8GB RAM** minimum (16GB recommended)
- **20GB free disk space**
- **Virtualization** enabled in BIOS/UEFI
- **Internet connection** for installation

## Installation Methods

### Method 1: Quick Install (Recommended)

1. **Download** the ONE Filer installer package
2. **Extract** all files to a folder (e.g., `C:\temp\one-filer-installer`)
3. **Right-click** on `install-one-filer-unified.bat`
4. **Select** "Run as administrator"
5. **Follow** the on-screen prompts

The installer will:
- Enable WSL2 and install Debian
- Install and configure the ONE Filer replicant
- Install the Windows control application
- Set up system tray integration
- Create shortcuts and optional auto-start

### Method 2: Custom Installation

For advanced users who want to customize the installation:

```powershell
# Open PowerShell as Administrator
cd C:\path\to\installer

# Custom installation with specific options
.\install-one-filer-unified.ps1 `
    -InstallPath "D:\Programs\ONE Filer" `
    -WSLDistro "MyCustomDistro" `
    -MountPoint "O:" `
    -InstallAsService $true `
    -AutoStart $false
```

Parameters:
- `-InstallPath`: Where to install ONE Filer (default: `C:\Program Files\ONE Filer`)
- `-WSLDistro`: WSL distribution name (default: `ONE-Debian`)
- `-MountPoint`: Drive letter for FUSE mount (default: `Z:`)
- `-InstallAsService`: Install as Windows service (default: `$true`)
- `-AutoStart`: Enable auto-start on Windows login (default: `$true`)
- `-SkipWSLSetup`: Skip WSL installation if already configured (default: `$false`)

## Post-Installation Setup

### First Launch

1. **Launch** ONE Filer from:
   - Desktop shortcut
   - Start Menu → ONE Filer
   - System tray (if running)

2. **Initial Configuration**:
   - The app will check WSL and replicant status
   - Enter your **ONE instance secret** (password)
   - Optionally specify a configuration file path
   - Click **"Start Replicant"**

3. **Verify Installation**:
   - Check the status indicators show "Running"
   - The mount point will be displayed when ready
   - Your files will be accessible through Windows Explorer

### System Tray Integration

The ONE Filer control app runs in the system tray:

- **Left-click** the tray icon to show/hide the main window
- **Right-click** for menu options:
  - Show/Hide
  - Start/Stop Replicant
  - Check for Updates
  - Quit

### Configuration

The main configuration file is located at:
```
C:\Program Files\ONE Filer\config.json
```

Example configuration:
```json
{
  "startMinimized": true,
  "showInSystemTray": true,
  "autoConnect": false,
  "wslDistro": "ONE-Debian",
  "replicantPath": "/opt/one-filer-source"
}
```

### Advanced WSL Configuration

To modify replicant settings in WSL:

```bash
# Access WSL
wsl -d ONE-Debian

# Edit configuration
sudo nano /etc/one-filer/config.json

# Restart service
sudo systemctl restart one-filer
```

## Managing ONE Filer

### Starting and Stopping

**From Windows:**
- Use the system tray menu
- Or run: `"C:\Program Files\ONE Filer\start-one-filer.bat"`
- Or run: `"C:\Program Files\ONE Filer\stop-one-filer.bat"`

**From PowerShell (if installed as service):**
```powershell
# Start service
Start-Service ONEFilerService

# Stop service
Stop-Service ONEFilerService

# Check status
Get-Service ONEFilerService
```

### Updating

**Automatic Updates:**
- The installer creates a daily update check task
- Updates are downloaded and installed automatically
- You'll be notified in the system tray

**Manual Update:**
```batch
"C:\Program Files\ONE Filer\update-one-filer.bat"
```

Or from PowerShell:
```powershell
& "C:\Program Files\ONE Filer\scripts\auto-updater.ps1"
```

### Accessing Your Files

Your ONE files are accessible through:

1. **Windows Explorer**: Navigate to the mount point (default: `Z:` drive)
2. **Network Path**: `\\wsl$\ONE-Debian\mnt\one-files`
3. **Command Line**: `cd Z:\` or specified mount point

## Troubleshooting

### Common Issues

**WSL2 Not Available**
- Enable virtualization in BIOS/UEFI
- Run Windows Update
- Enable WSL feature: `dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all`

**Replicant Won't Start**
- Check the secret/password is correct
- Verify WSL is running: `wsl --list --running`
- Check logs in the app or WSL

**Files Not Visible**
- Ensure replicant is running (check system tray)
- Verify mount point exists
- Try restarting the service

### Viewing Logs

**Windows Logs:**
- Application logs are shown in the Electron app
- Service logs: Event Viewer → Windows Logs → Application

**WSL Logs:**
```bash
# View replicant logs
wsl -d ONE-Debian
sudo journalctl -u one-filer -f

# Or check log files
sudo tail -f /var/log/one-filer/replicant.log
```

### Reset Installation

If you need to start fresh:

1. Run the uninstaller: `uninstall-one-filer.ps1`
2. Choose to keep or remove user data
3. Reinstall using the unified installer

## Uninstallation

To remove ONE Filer:

1. Run `C:\Program Files\ONE Filer\uninstall-one-filer.ps1` as Administrator
2. Choose whether to:
   - Keep user data (backed up to Documents)
   - Remove WSL distribution
3. Restart when prompted

## Security Considerations

- Your ONE instance secret is never stored in plain text
- Communication between Windows and WSL is local only
- The replicant runs with minimal privileges in WSL
- FUSE mount is only accessible to your Windows user

## Support

For help and support:
- Check the [GitHub repository](https://github.com/refinio/one.filer)
- Report issues on GitHub
- Consult the ONE documentation

## Advanced Topics

### Custom Service Configuration

Modify service behavior using NSSM:
```batch
"C:\Program Files\ONE Filer\nssm.exe" edit ONEFilerService
```

### Multiple Instances

To run multiple ONE instances:
1. Install to different directories
2. Use different WSL distributions
3. Configure different mount points
4. Use separate secrets for each instance

### Development Mode

For developers:
1. Clone the repository in Windows
2. Install development dependencies
3. Use the Electron app in development mode
4. Modify and test the replicant in WSL

---

**ONE Filer** - Seamless integration of federated databases with Windows Explorer.