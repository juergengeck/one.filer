@echo off
setlocal enabledelayedexpansion

:: ONE Filer Instance Setup
:: ========================
:: Sets up a complete ONE instance with all required recipes

cd /d "%~dp0\.."

echo ONE Filer Instance Setup
echo ========================
echo.

:: Check if data directory exists
if exist "data" (
    echo WARNING: Data directory already exists!
    echo This will delete your existing instance.
    set /p CONFIRM="Continue? (y/N): "
    if /i not "!CONFIRM!"=="y" (
        echo Setup cancelled.
        goto :end
    )
    echo.
    echo Removing existing data...
    rmdir /s /q data
)

echo Creating new ONE instance...
echo.

:: Get credentials
set /p USERNAME="Enter username (email): "
set /p PASSWORD="Enter password: "
set "SECRET=9e2a2f24264846e18dc96ab2c3cf6ad8"

echo.
echo Initializing instance...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && mkdir -p data && cd data && npx one-core init --secret %SECRET% create --username %USERNAME% --password %PASSWORD%"

echo.
echo Installing required recipes...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer/data && npx --prefix .. one-core recipe install @refinio/one.core:filer && npx --prefix .. one-core recipe install @refinio/one.core:onespace && npx --prefix .. one-core recipe install @refinio/one.core:files && npx --prefix .. one-core recipe install @refinio/one.core:objects && npx --prefix .. one-core recipe install @refinio/one.core:access-rights-management && npx --prefix .. one-core recipe install @refinio/one.models:contacts && npx --prefix .. one-core recipe install @refinio/one.models:groups"

echo.
echo ========================================
echo Setup complete!
echo.
echo You can now start ONE Filer with:
echo   one-filer.bat
echo.
echo Your credentials:
echo   Username: %USERNAME%
echo   Password: %PASSWORD%
echo ========================================

:end
endlocal
pause