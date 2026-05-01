# Prepare Supabase self-hosted environment for CRM Belarus.
# - copies .env from .env.example (if missing);
# - creates backups/ folder;
# - fixes line endings (CRLF -> LF) in pooler.exs / vector.yml.
# Run: .\setup\02-setup-supabase.ps1

$ErrorActionPreference = "Stop"

function Resolve-ProjectRoot {
    if ($PSScriptRoot) {
        $candidate = Split-Path -Path $PSScriptRoot -Parent
    } else {
        $candidate = (Get-Location).Path
    }
    if (-not (Test-Path (Join-Path $candidate "docker-compose.yml"))) {
        $candidate = (Get-Location).Path
    }
    return $candidate
}

function Convert-CrlfToLf($path, $label) {
    if (-not (Test-Path $path)) { return }
    $raw = [System.IO.File]::ReadAllText($path)
    if ($raw -match "`r") {
        $raw = $raw -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($path, $raw, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "[OK] $label : fixed line endings (CRLF -> LF)." -ForegroundColor Green
    } else {
        Write-Host "[OK] $label : line endings are correct." -ForegroundColor Green
    }
}

try {
    Clear-Host
    Write-Host ""
    Write-Host "=== CRM Belarus: Supabase setup ===" -ForegroundColor Cyan
    Write-Host ""

    $root               = Resolve-ProjectRoot
    $rootEnv            = Join-Path $root ".env"
    $rootEnvExample     = Join-Path $root ".env.example"
    $supabaseDir        = Join-Path $root "supabase"
    $supabaseCompose    = Join-Path $supabaseDir "docker-compose.yml"
    $supabaseEnv        = Join-Path $supabaseDir ".env"
    $supabaseEnvExample = Join-Path $supabaseDir ".env.example"
    $backupsDir         = Join-Path $root "backups"
    $poolerExs          = Join-Path $supabaseDir "volumes\pooler\pooler.exs"
    $vectorYml          = Join-Path $supabaseDir "volumes\logs\vector.yml"
    $testAccounts       = Join-Path $root "local-test-accounts.md"
    $testAccountsEx     = Join-Path $root "local-test-accounts.example.md"

    Write-Host "Project root : $root" -ForegroundColor DarkGray
    Write-Host ""

    if (-not (Test-Path $supabaseCompose)) {
        throw "Not found: $supabaseCompose. The supabase/ folder must be part of the repo (self-hosted stack)."
    }
    Write-Host "[OK] Supabase docker-compose found." -ForegroundColor Green

    # --- Root .env (consumed by crm-belarus UI container build) ---
    if (Test-Path $rootEnv) {
        Write-Host "[OK] Root .env already exists." -ForegroundColor Green
    } elseif (Test-Path $rootEnvExample) {
        Copy-Item -Path $rootEnvExample -Destination $rootEnv -Force
        Write-Host "[OK] Created .env from .env.example." -ForegroundColor Green
        Write-Host "     Edit if needed: $rootEnv" -ForegroundColor Yellow
    } else {
        throw "Neither .env nor .env.example found in project root."
    }

    # --- supabase/.env (Supabase stack config) ---
    if (Test-Path $supabaseEnv) {
        Write-Host "[OK] supabase/.env already exists." -ForegroundColor Green
    } elseif (Test-Path $supabaseEnvExample) {
        Copy-Item -Path $supabaseEnvExample -Destination $supabaseEnv -Force
        Write-Host "[OK] Created supabase/.env from supabase/.env.example." -ForegroundColor Green
        Write-Host "     For production: rotate secrets in $supabaseEnv" -ForegroundColor Yellow
    } else {
        throw "Neither supabase/.env nor supabase/.env.example found."
    }

    # --- backups/ for pg_dump files (used by 04-restore-db.ps1) ---
    if (-not (Test-Path $backupsDir)) {
        New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
        Write-Host "[OK] Created backups/ folder (for .dump files)." -ForegroundColor Green
    } else {
        Write-Host "[OK] backups/ folder already exists." -ForegroundColor Green
    }

    # --- local-test-accounts.md (dev users list) ---
    if ((-not (Test-Path $testAccounts)) -and (Test-Path $testAccountsEx)) {
        Copy-Item -Path $testAccountsEx -Destination $testAccounts -Force
        Write-Host "[OK] Created local-test-accounts.md from .example template." -ForegroundColor Green
    }

    # --- CRLF -> LF in files that break on Windows line endings ---
    Convert-CrlfToLf $poolerExs "supabase/volumes/pooler/pooler.exs"
    Convert-CrlfToLf $vectorYml "supabase/volumes/logs/vector.yml"

    Write-Host ""
    Write-Host "Done. Next step:" -ForegroundColor Green
    Write-Host "  .\setup\03-start-stack.ps1" -ForegroundColor White
}
catch {
    Write-Host ""
    Write-Host "[ERROR] Script failed." -ForegroundColor Red
    Write-Host ("Message: " + $_.Exception.Message) -ForegroundColor Red

    if ($_.InvocationInfo) {
        if ($_.InvocationInfo.ScriptName)       { Write-Host ("File: "    + $_.InvocationInfo.ScriptName)       -ForegroundColor Red }
        if ($_.InvocationInfo.ScriptLineNumber) { Write-Host ("Line: "    + $_.InvocationInfo.ScriptLineNumber) -ForegroundColor Red }
        if ($_.InvocationInfo.Line)             { Write-Host ("Command: " + $_.InvocationInfo.Line.Trim())      -ForegroundColor Red }
    }
}
finally {
    Write-Host ""
    Read-Host "Press Enter to close"
}
