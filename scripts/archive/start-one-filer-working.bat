@echo off
echo Starting ONE Filer with Windows-compatible FUSE permissions...
echo.
echo This will mount ONE content with proper permissions for Windows access
echo Access via Windows Explorer: \\wsl.localhost\kali-linux\home\refinio\one-files
echo.
echo Press Ctrl+C to stop the service.
echo.

wsl -d kali-linux bash -c "cd /mnt/c/Users/juerg/source/one.filer && sudo node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-fixed.json"

pause 