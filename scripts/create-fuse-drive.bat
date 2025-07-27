@echo off
REM Create drive mapping for WSL FUSE mount using subst

echo Creating ONE.filer drive mapping...

REM Remove existing mapping if present
subst O: /D >nul 2>&1

REM Create a symbolic link first
if exist "C:\onefiler-mount" rmdir "C:\onefiler-mount" >nul 2>&1
mklink /D "C:\onefiler-mount" "\\wsl$\Ubuntu\home\gecko\one-files"

if %errorlevel% == 0 (
    REM Map the symbolic link to drive O:
    subst O: "C:\onefiler-mount"
    
    if %errorlevel% == 0 (
        echo SUCCESS: ONE.filer is now accessible as drive O:
        echo.
        echo Opening O: drive in Explorer...
        explorer O:\
    ) else (
        echo ERROR: Failed to create drive mapping
    )
) else (
    echo ERROR: Failed to create symbolic link. Run as Administrator.
)

pause