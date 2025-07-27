@echo off
setlocal enabledelayedexpansion

:: ONE Filer Initializer
:: =====================
:: Usage: init.bat [type]
::
:: Types:
::   demo  - Initialize demo instance with sample data
::   full  - Initialize full instance with all recipes
::   quick - Quick init without recipes (default)

set "INIT_TYPE=%~1"
if "%INIT_TYPE%"=="" set "INIT_TYPE=quick"

echo ONE Filer Initializer
echo =====================
echo.

if /i "%INIT_TYPE%"=="demo" goto :init_demo
if /i "%INIT_TYPE%"=="full" goto :init_full
if /i "%INIT_TYPE%"=="quick" goto :init_quick

echo Error: Unknown init type "%INIT_TYPE%"
echo.
echo Available types:
echo   demo  - Initialize demo instance with sample data
echo   full  - Initialize full instance with all recipes
echo   quick - Quick init without recipes
goto :end

:init_demo
echo Initializing demo instance...
echo.
echo Creating demo credentials:
echo   username: demo@example.com
echo   password: demo123
echo.

wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && rm -rf data-demo && mkdir -p data-demo && cd data-demo && npx one-core init --secret 9e2a2f24264846e18dc96ab2c3cf6ad8 create --username demo@example.com --password demo123"
echo.
echo Demo instance initialized at: data-demo/
echo Use 'one-filer.bat demo' to start with demo configuration
goto :end

:init_full
echo Initializing full instance with all recipes...
echo.
set /p USERNAME="Enter username (email): "
set /p PASSWORD="Enter password: "
set /p SECRET="Enter secret (or press Enter for default): "
if "%SECRET%"=="" set "SECRET=9e2a2f24264846e18dc96ab2c3cf6ad8"

echo.
echo Installing recipes...
wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && rm -rf data && mkdir -p data && cd data && npx one-core init --secret %SECRET% create --username %USERNAME% --password %PASSWORD% && npx one-core recipe install @refinio/one.core:filer && npx one-core recipe install @refinio/one.core:onespace && npx one-core recipe install @refinio/one.core:files && npx one-core recipe install @refinio/one.core:objects && npx one-core recipe install @refinio/one.core:access-rights-management"

echo.
echo Full instance initialized at: data/
goto :end

:init_quick
echo Quick initialization...
echo.
set /p USERNAME="Enter username (email): "
set /p PASSWORD="Enter password: "

wsl --cd ~ bash -c "cd /mnt/c/Users/juerg/source/one.filer && rm -rf data && mkdir -p data && cd data && npx one-core init --secret 9e2a2f24264846e18dc96ab2c3cf6ad8 create --username %USERNAME% --password %PASSWORD%"

echo.
echo Instance initialized at: data/
echo Note: No recipes installed. Install them manually if needed.
goto :end

:end
endlocal