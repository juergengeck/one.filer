@echo off
echo Starting ONE Filer...
echo.

REM Check if Ubuntu is running
wsl -d Ubuntu --exec echo "Ubuntu is accessible" >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Ubuntu...
    wsl -d Ubuntu --exec echo "Ubuntu started"
)

REM Start ONE Filer in Ubuntu
echo Launching ONE Filer in Ubuntu...
wsl -d Ubuntu -- bash -c "one-leute-replicant start --filer true --mount-point /mnt/c/Users/%USERNAME%/OneFiler"

pause