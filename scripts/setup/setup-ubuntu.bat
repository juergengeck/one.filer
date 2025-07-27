@echo off
echo Setting up ONE.filer in Ubuntu WSL2...
echo.

echo 1. Checking Ubuntu environment...
wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && pwd && ls package.json"

echo.
echo 2. Installing dependencies...
wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && npm install"

echo.
echo 3. Building project...
wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && npm run build"

echo.
echo 4. Testing basic functionality...
wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && node --enable-source-maps lib/index.js --help"

echo.
echo 5. Setting up mount directory...
wsl -d Ubuntu bash -c "mkdir -p /home/gecko/one-files && ls -la /home/gecko/one-files"

echo.
echo Setup complete! You can now run:
echo   wsl -d Ubuntu bash -c "cd /home/gecko/one.filer && node --enable-source-maps lib/index.js start --secret test123"
pause 