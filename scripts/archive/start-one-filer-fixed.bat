@echo off
echo Starting ONE Filer service with WINDOWS FUSE ACCESS CONFIGURATION...
echo.
echo This will start the ONE federated file system with allow_other and allow_root options.
echo Content will be accessible at: \\wsl.localhost\kali-linux\home\refinio\one-files
echo.
echo Please wait while the service starts...
echo This may take 30-60 seconds. Look for the success messages:
echo - "FUSE filesystem mounted successfully"
echo - "Replicant started successfully"
echo.

echo Cleaning up any previous instances...
wsl -d kali-linux bash -c "pkill -f 'lib/index.js' 2>/dev/null || true"
wsl -d kali-linux bash -c "fusermount -u /home/refinio/one-files 2>/dev/null || true"
wsl -d kali-linux bash -c "rm -rf /home/refinio/one-files && mkdir -p /home/refinio/one-files"

echo Starting service with Windows-compatible FUSE options...
wsl -d kali-linux bash -c "cd /mnt/c/Users/juerg/source/one.filer && node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-windows-test.json"

pause 