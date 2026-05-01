# Check CRM Belarus service health.
# Run: .\setup\05-healthcheck.ps1

$ErrorActionPreference = "Stop"

if ($PSScriptRoot) {
    $root = Split-Path $PSScriptRoot -Parent
} else {
    $root = Split-Path (Get-Location).Path -Parent
}
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$EnvPath = Join-Path $root "supabase\.env"

Write-Host ""
Write-Host "=== CRM Belarus: health check ===" -ForegroundColor Cyan
Write-Host ""

$allOk = $true

function Test-Container($name) {
    $status = docker inspect --format "{{.State.Status}}" $name 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] $name : container not found" -ForegroundColor Red
        $script:allOk = $false
        return
    }

    $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" $name 2>$null
    if ($status -eq "running" -and ($health -eq "healthy" -or $health -eq "no-healthcheck")) {
        Write-Host "[OK] $name : running ($health)" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name : $status ($health)" -ForegroundColor Red
        $script:allOk = $false
    }
}

function Test-Http($name, $url, [int[]]$acceptableStatuses = @(200, 201, 204, 301, 302, 401, 404)) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $code = [int]$resp.StatusCode
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
        } else {
            Write-Host "[!!] $name : $url - unavailable ($($_.Exception.Message))" -ForegroundColor Red
            $script:allOk = $false
            return
        }
    } catch {
        Write-Host "[!!] $name : $url - unavailable ($($_.Exception.Message))" -ForegroundColor Red
        $script:allOk = $false
        return
    }
    if ($acceptableStatuses -contains $code) {
        Write-Host "[OK] $name : $url (HTTP $code)" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name : $url - unexpected status (HTTP $code)" -ForegroundColor Red
        $script:allOk = $false
    }
}

Write-Host "Supabase containers:" -ForegroundColor Yellow
$supabaseContainers = @(
    "crm-supabase-db",
    "crm-supabase-kong",
    "crm-supabase-auth",
    "crm-supabase-rest",
    "crm-supabase-storage",
    "crm-supabase-studio",
    "crm-supabase-pooler",
    "crm-supabase-analytics",
    "crm-supabase-meta",
    "crm-supabase-imgproxy",
    "crm-supabase-vector",
    "crm-supabase-edge-functions",
    "realtime-dev.crm-supabase-realtime"
)
foreach ($c in $supabaseContainers) { Test-Container $c }

Write-Host ""
Write-Host "UI:" -ForegroundColor Yellow
docker inspect --format "{{.State.Status}}" "crm-belarus" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Test-Container "crm-belarus"
} else {
    Write-Host "[--] crm-belarus : container not found (UI may be running locally via npm run dev)" -ForegroundColor Yellow
}

# --- Postgres pg_isready ---
Write-Host ""
Write-Host "Postgres:" -ForegroundColor Yellow
docker exec crm-supabase-db pg_isready -U postgres -h localhost 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] crm-supabase-db : pg_isready OK" -ForegroundColor Green
} else {
    Write-Host "[!!] crm-supabase-db : pg_isready failed" -ForegroundColor Red
    $allOk = $false
}

# --- Count tables in public ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if ($pgPassword) {
    $tableCount = docker exec -e "PGPASSWORD=$pgPassword" crm-supabase-db `
        psql -U postgres -d postgres -t -A -c `
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Tables in public schema: $($tableCount.Trim())" -ForegroundColor Green
    }
}

# --- HTTP ---
Write-Host ""
Write-Host "HTTP endpoints:" -ForegroundColor Yellow
# UI must return 200 (static index.html).
Test-Http "UI (crm-belarus)"   "http://localhost:8080"                 -acceptableStatuses @(200)
# Kong without apikey returns 401 by design; treat 401 as "alive".
Test-Http "Supabase API (Kong)" "http://localhost:54321/"               -acceptableStatuses @(200, 401, 404)

# Supabase Auth health endpoint requires the anon apikey header.
$anonKey = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*ANON_KEY=(.+)$') {
            $anonKey = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
try {
    if ($anonKey) {
        $authResp = Invoke-WebRequest -Uri "http://localhost:54321/auth/v1/health" `
            -Headers @{ "apikey" = $anonKey } `
            -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    } else {
        $authResp = Invoke-WebRequest -Uri "http://localhost:54321/auth/v1/health" `
            -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    }
    Write-Host "[OK] Supabase Auth (via Kong) : HTTP $($authResp.StatusCode)" -ForegroundColor Green
} catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401) {
        # 401 at /auth/v1/health means Kong and gotrue are reachable but apikey was rejected.
        Write-Host "[OK] Supabase Auth (via Kong) : HTTP 401 (service alive, apikey check)" -ForegroundColor Green
    } else {
        Write-Host "[!!] Supabase Auth (via Kong) : /auth/v1/health unavailable ($($_.Exception.Message))" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All checks passed. The system is ready." -ForegroundColor Green
    Write-Host "  UI       : http://localhost:8080"
    Write-Host "  Supabase : http://localhost:54321"
} else {
    Write-Host "Some checks failed. See messages above." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Read-Host "Press Enter to close"
