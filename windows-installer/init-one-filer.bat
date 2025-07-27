@echo off
echo Initializing ONE Filer
echo ======================
echo.

echo This will create a ONE Filer instance with a test password.
echo.

wsl -d Ubuntu -- bash -c "one-leute-replicant init --secret testpassword123 --mount-point ~/one-files"

pause