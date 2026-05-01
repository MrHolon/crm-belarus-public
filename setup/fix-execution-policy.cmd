@echo off
chcp 65001 >nul
echo ============================================
echo  Fix PowerShell Execution Policy
echo ============================================
echo.

REM Try to set RemoteSigned for current user (may be overridden by Group Policy)
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" 2>nul

powershell -ExecutionPolicy Bypass -Command "$p = (Get-ExecutionPolicy -List | Where-Object { $_.Scope -eq 'CurrentUser' }).ExecutionPolicy; $eff = Get-ExecutionPolicy; if ($eff -eq 'Bypass' -or $eff -eq 'RemoteSigned' -or $eff -eq 'Unrestricted') { exit 0 } else { exit 1 }"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [OK] Scripts can run. Your effective policy allows it.
    echo      Use 03-start-stack.cmd to start the stack (it bypasses policy).
    echo.
) else (
    echo.
    echo Policy could not be changed (e.g. overridden by Group Policy).
    echo Use 03-start-stack.cmd instead of 03-start-stack.ps1 to start the stack.
    echo It runs the script with Bypass so no policy change is needed.
    echo.
)

pause
