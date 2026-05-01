# Start the CRM Belarus stack (Supabase + UI crm-belarus).
# Root docker-compose.yml uses `include:` to pull in supabase/docker-compose.yml,
# so a single `docker compose up -d --build` from the project root does everything.
# Run: .\setup\03-start-stack.ps1

$ErrorActionPreference = "Stop"

if ($PSScriptRoot) {
    $root = Split-Path $PSScriptRoot -Parent
} else {
    $root = Split-Path (Get-Location).Path -Parent
}
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$rootCompose     = Join-Path $root "docker-compose.yml"
$supabaseCompose = Join-Path $root "supabase\docker-compose.yml"
$rootEnv         = Join-Path $root ".env"
$supabaseEnv     = Join-Path $root "supabase\.env"
$dbContainer     = "crm-supabase-db"

Write-Host ""
Write-Host "=== CRM Belarus: starting stack ===" -ForegroundColor Cyan
Write-Host ""

foreach ($f in @($rootCompose, $supabaseCompose, $rootEnv, $supabaseEnv)) {
    if (-not (Test-Path $f)) {
        Write-Host "[!!] File not found: $f" -ForegroundColor Red
        Write-Host "     Run .\setup\02-setup-supabase.ps1 first." -ForegroundColor Yellow
        Read-Host "Press Enter to close"
        exit 1
    }
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Docker daemon is not responding. Start Docker Desktop." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# Windows CRLF in these files crashes Elixir/Vector inside containers.
$poolerExs = Join-Path $root "supabase\volumes\pooler\pooler.exs"
$vectorYml = Join-Path $root "supabase\volumes\logs\vector.yml"
foreach ($p in @($poolerExs, $vectorYml)) {
    if (Test-Path $p) {
        $raw = [System.IO.File]::ReadAllText($p)
        if ($raw -match "`r") {
            $raw = $raw -replace "`r`n", "`n"
            [System.IO.File]::WriteAllText($p, $raw, (New-Object System.Text.UTF8Encoding $false))
            Write-Host "[OK] Fixed line endings: $p" -ForegroundColor Green
        }
    }
}

Write-Host "[1/2] docker compose up -d --build (Supabase + crm-belarus) ..." -ForegroundColor Yellow
Push-Location $root
try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }
    Write-Host "[OK] Containers started." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "[2/2] Waiting for $dbContainer to become healthy ..." -ForegroundColor Yellow
$maxWait = 180
$elapsed = 0
$lastStatus = ""
while ($elapsed -lt $maxWait) {
    $health = docker inspect --format "{{.State.Health.Status}}" $dbContainer 2>$null
    if ($LASTEXITCODE -eq 0 -and $health -eq "healthy") {
        Write-Host "[OK] $dbContainer is ready." -ForegroundColor Green
        break
    }
    if ($health -and $health -ne $lastStatus) {
        Write-Host "     ... status=$health (elapsed ${elapsed}s)"
        $lastStatus = $health
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
}
if ($elapsed -ge $maxWait) {
    Write-Host "[!!] $dbContainer did not become healthy within ${maxWait}s." -ForegroundColor Red
    Write-Host "     Logs: docker logs $dbContainer" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "Stack is up:" -ForegroundColor Green
Write-Host "  UI (crm-belarus)       : http://localhost:8080"
Write-Host "  Supabase API (Kong)     : http://localhost:54321"
Write-Host "  Supabase Studio         : http://localhost:54321 (via Kong)"
Write-Host "  Postgres (pooler)       : localhost:54322"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  .\setup\04-restore-db.ps1    # restore DB from backups\*.dump (optional)"
Write-Host "  .\setup\05-healthcheck.ps1   # verify service health"

Read-Host "Press Enter to close"
