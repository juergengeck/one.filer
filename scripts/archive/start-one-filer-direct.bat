@echo off
echo Starting ONE Filer with direct Windows access...
echo.
echo This will mount ONE content directly to C:\one-files
echo Access your ONE files directly at: C:\one-files
echo.
echo Press Ctrl+C to stop the service.
echo.

wsl -d kali-linux node --enable-source-maps lib/index.js start --secret test123 -c configs/filer-direct-windows.json

pause 