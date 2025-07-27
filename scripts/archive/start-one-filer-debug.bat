@echo off
echo Starting ONE Filer service with FULL DEBUG LOGGING...
echo.
echo This will start the ONE federated file system with comprehensive logging.
echo Content will be accessible at: \\wsl$\kali-linux\home\refinio\one-files
echo.
echo Please wait while the service starts...
echo This may take 30-60 seconds. Look for the success messages in the new window:
echo - "FUSE filesystem mounted successfully"
echo - "Replicant started successfully"
echo.
echo DEBUG OUTPUT will show detailed information about FUSE operations and timeouts.
echo.

echo Starting service with debug logging...
wsl -d kali-linux bash -c "cd /mnt/c/Users/juerg/source/one.filer && node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-corrected.json --log-debug"

pause 