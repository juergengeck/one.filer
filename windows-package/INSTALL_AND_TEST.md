# ONE Filer Windows Installation and Testing Guide

## Overview

This package contains everything needed to install and run ONE Filer on Windows using Ubuntu WSL2.

## Prerequisites

- Windows 10 version 2004 or higher (or Windows 11)
- Administrator privileges
- At least 4GB of free disk space
- Internet connection for initial setup

## Installation Steps

### 1. Run the Installer

1. Navigate to the `installer` folder
2. Right-click on `install-one-filer-ubuntu.bat`
3. Select "Run as administrator"
4. Follow the on-screen prompts

The installer will:
- Enable WSL2 if not already enabled
- Install Ubuntu from the Microsoft Store
- Deploy ONE Filer to Ubuntu
- Configure the mount point (default: O:\onefiler)
- Create desktop and Start Menu shortcuts

**Note:** If WSL2 is newly enabled, you may need to restart your computer and run the installer again.

### 2. First-time Ubuntu Setup

If this is your first time using Ubuntu on WSL2, you'll be prompted to:
1. Create a username (use lowercase, no spaces)
2. Set a password (you'll need this for sudo commands)

## Starting ONE Filer

### Method 1: Desktop Shortcut
- Double-click the "ONE Filer" shortcut on your desktop

### Method 2: Command Line
Open PowerShell or Command Prompt and run:
```powershell
wsl -d Ubuntu -- bash -c 'cd ~/one.filer && ./start.sh'
```

### Method 3: Start Menu
- Click Start → ONE Filer → ONE Filer

## Testing the Installation

### From Windows PowerShell

1. Open PowerShell as Administrator
2. Navigate to the test scripts folder:
   ```powershell
   cd "C:\path\to\windows-package\wsl-files\one.filer\test\scripts"
   ```
3. Run the Windows access test:
   ```powershell
   .\test-windows-access.ps1
   ```

The test will verify:
- Mount point accessibility
- File creation and reading
- File attributes
- File deletion
- WSL path access

### From Ubuntu WSL

1. Open Ubuntu terminal:
   ```bash
   wsl -d Ubuntu
   ```
2. Navigate to ONE Filer:
   ```bash
   cd ~/one.filer
   ```
3. Run the FUSE tests:
   ```bash
   npm test
   ```

## Accessing Files

Once ONE Filer is running, you can access your files at:
- **Windows Explorer:** O:\onefiler (or your custom mount point)
- **Command line:** O:\onefiler
- **WSL path:** \\wsl$\Ubuntu\mnt\o\onefiler

## Troubleshooting

### ONE Filer won't start
1. Check if Ubuntu is running:
   ```powershell
   wsl -l -v
   ```
2. Ensure FUSE is properly installed:
   ```bash
   wsl -d Ubuntu -- ls -la /dev/fuse
   ```

### Mount point not accessible
1. Verify ONE Filer is running:
   ```powershell
   wsl -d Ubuntu -- ps aux | grep node
   ```
2. Check logs in Ubuntu:
   ```bash
   wsl -d Ubuntu -- tail -f ~/one.filer/logs/filer.log
   ```

### Permission issues
1. Ensure your user has proper permissions:
   ```bash
   wsl -d Ubuntu -- groups
   ```
2. Reinstall FUSE if needed:
   ```bash
   wsl -d Ubuntu -- sudo apt-get reinstall fuse3 libfuse3-dev
   ```

### WSL2 not working
1. Enable virtualization in BIOS
2. Run Windows Update
3. Reinstall WSL2:
   ```powershell
   wsl --install
   ```

## Advanced Configuration

### Custom Mount Point
To use a different mount point, run the installer with:
```powershell
powershell -ExecutionPolicy Bypass -File ".\installer\install-one-filer-ubuntu.ps1" -MountPoint "D:\MyFiles"
```

### Manual Installation
If the automated installer fails, you can install manually:

1. Enable WSL2:
   ```powershell
   wsl --install
   ```

2. Install Ubuntu:
   ```powershell
   wsl --install -d Ubuntu
   ```

3. Copy files to Ubuntu:
   ```powershell
   wsl -d Ubuntu -- cp -r /mnt/c/path/to/wsl-files/one.filer ~/
   ```

4. Run setup:
   ```bash
   wsl -d Ubuntu
   cd ~/one.filer
   chmod +x setup-one-filer.sh
   ./setup-one-filer.sh
   ```

## Uninstallation

To completely remove ONE Filer:

1. Stop ONE Filer:
   ```powershell
   wsl -d Ubuntu -- pkill -f "node.*one.filer"
   ```

2. Remove from Ubuntu:
   ```bash
   wsl -d Ubuntu -- rm -rf ~/one.filer
   ```

3. Remove shortcuts:
   - Delete desktop shortcut
   - Delete Start Menu folder: %APPDATA%\Microsoft\Windows\Start Menu\Programs\ONE Filer

4. (Optional) Remove Ubuntu:
   ```powershell
   wsl --unregister Ubuntu
   ```

## Support

For issues or questions:
- Check the logs: `wsl -d Ubuntu -- cat ~/one.filer/logs/filer.log`
- Visit: https://github.com/refinio/one.filer
- Email: support@refinio.net