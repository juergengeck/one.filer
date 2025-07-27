@echo off
echo Starting ONE Filer service with Windows compatibility...
echo.
echo This will start the ONE federated file system with Windows Explorer integration.
echo Content will be accessible at: \\wsl.localhost\kali-linux\home\refinio\one-files
echo.
echo Press Ctrl+C to stop the service.
echo.

wsl -d kali-linux sudo node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-windows-compatible.json

pause 