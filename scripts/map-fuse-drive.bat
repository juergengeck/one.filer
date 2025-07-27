@echo off
REM Map WSL FUSE mount to Windows drive letter

echo Mapping ONE.filer FUSE mount to drive O:...

REM Remove existing mapping if present
net use O: /delete /y >nul 2>&1

REM Map the WSL FUSE mount to drive O:
net use O: \\wsl$\Ubuntu\home\gecko\one-files /persistent:yes

if %errorlevel% == 0 (
    echo SUCCESS: ONE.filer is now accessible as drive O:
    echo.
    echo Opening O: drive in Explorer...
    explorer O:\
) else (
    echo ERROR: Failed to map drive. Make sure:
    echo   1. one.filer is running in WSL
    echo   2. The mount point /home/gecko/one-files exists
    echo   3. You have the necessary permissions
)

pause