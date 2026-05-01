@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp006-backup-db.ps1" %*
pause
