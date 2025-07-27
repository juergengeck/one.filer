@echo off
echo Starting ONE Filer service with TIMEOUT OPTIMIZATION...
echo.
echo This will start the ONE federated file system in a separate window.
echo Content will be accessible at: \\wsl$\kali-linux\home\refinio\one-files
echo.
echo Please wait while the service starts...
echo This may take 30-60 seconds. Look for the success messages in the new window:
echo - "FUSE filesystem mounted successfully"
echo - "Replicant started successfully"
echo.

echo Starting service in background window...
start "ONE Filer Service" wsl -d kali-linux bash -c "cd /mnt/c/Users/juerg/source/one.filer && node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-corrected.json"

echo Waiting for service to start up...
timeout /t 10 /nobreak > nul

echo Opening FUSE folder in Windows Explorer...
explorer "\\wsl$\kali-linux\home\refinio\one-files"

echo.
echo Service is running in a separate window with TIMEOUT OPTIMIZATION:
echo - Reduced operation timeouts (2s instead of 20s for faster response)
echo The FUSE folder should now be open in Windows Explorer.
echo To stop the service, close the "ONE Filer Service" window.
echo.

pause 