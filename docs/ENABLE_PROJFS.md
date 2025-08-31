# Enabling Windows Projected File System (ProjFS)

The new 2-layer architecture for one.filer uses Windows Projected File System (ProjFS) for native Windows integration. This provides better performance and compatibility than the previous WSL-based approach.

## Requirements

- Windows 10 version 1809 or later
- Administrator privileges

## How to Enable ProjFS

### Option 1: Using PowerShell (Recommended)

1. **Run PowerShell as Administrator**
   - Right-click on Start button
   - Select "Windows PowerShell (Admin)"

2. **Enable ProjFS**
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName "Client-ProjFS" -All
   ```

3. **Restart your computer** when prompted

### Option 2: Using Windows Features Dialog

1. Press `Win + R` and type `optionalfeatures`
2. Find "Windows Projected File System" in the list
3. Check the box next to it
4. Click OK and restart when prompted

### Option 3: Using the provided script

1. **Run PowerShell as Administrator**
2. Navigate to the one.filer directory:
   ```powershell
   cd C:\Users\juerg\source\one.filer
   ```
3. Run the enable script:
   ```powershell
   .\enable-projfs.ps1
   ```

## Verifying ProjFS is Enabled

After restarting, you can verify ProjFS is enabled by running:
```powershell
Get-WindowsOptionalFeature -Online -FeatureName "Client-ProjFS"
```

The State should show as "Enabled".

## Troubleshooting

If ProjFS is not available:
- Ensure you're running Windows 10 version 1809 or later
- Check Windows Update for any pending updates
- For Enterprise/Education editions, ProjFS might be disabled by group policy

## Next Steps

Once ProjFS is enabled, you can run the one.filer electron app and it will use the native 2-layer architecture for optimal performance.