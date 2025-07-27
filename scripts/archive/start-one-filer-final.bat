@echo off
echo Starting ONE Filer with proper user permissions...
echo.
echo This will mount ONE content accessible from Windows Explorer
echo Access via: \\wsl.localhost\kali-linux\home\refinio\one-files
echo.
echo Press Ctrl+C to stop the service.
echo.

wsl -d kali-linux bash -c "cd /mnt/c/Users/juerg/source/one.filer && node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-fixed.json"

pause 