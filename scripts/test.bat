@echo off
setlocal enabledelayedexpansion

:: ONE Filer Test Runner
:: =====================
:: Usage: test.bat [type]
::
:: Types:
::   unit        - Run unit tests
::   fuse        - Test FUSE mounting
::   integration - Run integration tests
::   mount       - Test basic mount functionality
::   all         - Run all tests (default)

set "TEST_TYPE=%~1"
if "%TEST_TYPE%"=="" set "TEST_TYPE=all"

echo ONE Filer Test Runner
echo =====================
echo.

if /i "%TEST_TYPE%"=="unit" goto :run_unit
if /i "%TEST_TYPE%"=="fuse" goto :run_fuse
if /i "%TEST_TYPE%"=="integration" goto :run_integration
if /i "%TEST_TYPE%"=="mount" goto :run_mount
if /i "%TEST_TYPE%"=="all" goto :run_all

echo Error: Unknown test type "%TEST_TYPE%"
echo.
echo Available test types:
echo   unit        - Run unit tests
echo   fuse        - Test FUSE mounting
echo   integration - Run integration tests  
echo   mount       - Test basic mount functionality
echo   all         - Run all tests
goto :end

:run_unit
echo Running unit tests...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm test"
goto :end

:run_fuse
echo Running FUSE tests...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && node test/scripts/test-fuse.js"
goto :end

:run_integration
echo Running integration tests...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && node simple-mount.mjs"
goto :end

:run_mount
echo Testing basic mount functionality...
wsl --cd ~ bash -c "mkdir -p ~/test-mount && node -e \"const fuse = require('fuse-native'); const fs = require('fs'); const ops = { readdir: (path, cb) => cb(0, ['test.txt']), getattr: (path, cb) => { if (path === '/') return cb(0, {mtime: new Date(), atime: new Date(), ctime: new Date(), size: 4096, mode: 16877, uid: process.getuid(), gid: process.getgid()}); if (path === '/test.txt') return cb(0, {mtime: new Date(), atime: new Date(), ctime: new Date(), size: 11, mode: 33188, uid: process.getuid(), gid: process.getgid()}); cb(fuse.ENOENT); }, read: (path, fd, buf, len, pos, cb) => { if (path === '/test.txt') { const str = 'hello world'; buf.write(str); return cb(str.length); } cb(fuse.ENOENT); } }; const f = new fuse('./test-mount', ops); f.mount(err => { if (err) throw err; console.log('Mount successful! Press Ctrl+C to unmount.'); }); process.on('SIGINT', () => { f.unmount(() => { console.log('Unmounted'); process.exit(0); }); });\""
goto :end

:run_all
echo Running all tests...
echo.
echo [1/4] Unit tests...
call :run_unit
echo.
echo [2/4] FUSE tests...
call :run_fuse
echo.
echo [3/4] Integration tests...
call :run_integration
echo.
echo [4/4] Mount tests...
call :run_mount
echo.
echo All tests completed!
goto :end

:end
endlocal