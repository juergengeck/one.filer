@echo off
echo Starting ONE Filer in WSL
echo =========================
echo.
echo ONE Filer will mount to: ~/OneFiler (in your Ubuntu home)
echo.

wsl -d Ubuntu -- bash -l -c "cd ~/../../mnt/c/Users/juerg/source/one.filer && ./start-one-filer.sh"

pause