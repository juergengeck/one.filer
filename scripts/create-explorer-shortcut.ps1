# Create Windows Explorer shortcut to WSL FUSE mount

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\ONE Filer.lnk")
$Shortcut.TargetPath = "explorer.exe"
$Shortcut.Arguments = "\\wsl$\Ubuntu\home\gecko\one-files"
$Shortcut.IconLocation = "shell32.dll,3"
$Shortcut.Description = "ONE Filer - WSL FUSE Mount"
$Shortcut.Save()

Write-Host "Created shortcut on Desktop: ONE Filer" -ForegroundColor Green
Write-Host "Double-click to open the FUSE mount in Windows Explorer" -ForegroundColor Cyan

# Also create in Start Menu
$StartMenu = [Environment]::GetFolderPath("StartMenu")
$Shortcut2 = $WshShell.CreateShortcut("$StartMenu\Programs\ONE Filer.lnk")
$Shortcut2.TargetPath = "explorer.exe"
$Shortcut2.Arguments = "\\wsl$\Ubuntu\home\gecko\one-files"
$Shortcut2.IconLocation = "shell32.dll,3"
$Shortcut2.Description = "ONE Filer - WSL FUSE Mount"
$Shortcut2.Save()

Write-Host "Also added to Start Menu" -ForegroundColor Green

# Open the location
explorer "\\wsl$\Ubuntu\home\gecko\one-files"