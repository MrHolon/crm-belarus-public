# Check prerequisites for CRM Belarus.
# Run: .\setup\01-install-prerequisites.ps1

$ErrorActionPreference = "Stop"

$allOk = $true

function Test-Command($cmd, $name, $installHint) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "[OK] $name : $ver" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name not found. Install from: $installHint" -ForegroundColor Red
        $script:allOk = $false
    }
}

Write-Host ""
Write-Host "=== CRM Belarus: prerequisite check ===" -ForegroundColor Cyan
Write-Host ""

Test-Command "git"    "Git"    "https://git-scm.com/download/win"
Test-Command "docker" "Docker" "https://docs.docker.com/desktop/install/windows-install/"

# Docker Compose v2 plugin + daemon running
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    $composeVer = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker Compose : $composeVer" -ForegroundColor Green
    } else {
        Write-Host "[!!] Docker Compose v2 not found. Update Docker Desktop." -ForegroundColor Red
        $allOk = $false
    }

    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] Docker daemon is not responding. Start Docker Desktop." -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "[OK] Docker daemon is running." -ForegroundColor Green
    }
}

# Node.js is optional: UI is built inside a container. Useful only for local
# development (`npm run dev`, lint, tests, regenerating TS types).
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js : $nodeVer (optional, for local dev)" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js not found (optional, only needed for local dev without Docker)." -ForegroundColor Yellow
}

Write-Host ""
if ($allOk) {
    Write-Host "All required prerequisites are installed. Next step:" -ForegroundColor Green
    Write-Host "  .\setup\02-setup-supabase.ps1"
} else {
    Write-Host "Some prerequisites are missing. Install them and run again." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Read-Host "Press Enter to close"
