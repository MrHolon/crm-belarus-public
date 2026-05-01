# Restore CRM Belarus Supabase database from a pg_dump file.
# Usage:
#   .\setup\04-restore-db.ps1                                  # latest .dump from backups/
#   .\setup\04-restore-db.ps1 -BackupFile "backups\my.dump"    # specific file

param(
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if ($PSScriptRoot) {
    $root = Split-Path $PSScriptRoot -Parent
} else {
    $root = Split-Path (Get-Location).Path -Parent
}
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$ContainerName = "crm-supabase-db"
$DbUser        = "postgres"
$DbName        = "postgres"
$EnvPath       = Join-Path $root "supabase\.env"
$BackupDir     = Join-Path $root "backups"

Write-Host ""
Write-Host "=== CRM Belarus: database restore ===" -ForegroundColor Cyan
Write-Host ""

# --- Read POSTGRES_PASSWORD from supabase/.env ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

if (-not $pgPassword) {
    Write-Host "[!!] Failed to read POSTGRES_PASSWORD from: $EnvPath" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# --- Locate backup file ---
if ($BackupFile) {
    if (-not [System.IO.Path]::IsPathRooted($BackupFile)) {
        $BackupFile = Join-Path $root $BackupFile
    }
} else {
    if (-not (Test-Path $BackupDir)) {
        Write-Host "[!!] Folder $BackupDir does not exist. Put a .dump file there." -ForegroundColor Red
        Read-Host "Press Enter to close"
        exit 1
    }
    $latest = Get-ChildItem -Path $BackupDir -Filter "*.dump" -File -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1
    if (-not $latest) {
        Write-Host "[!!] No .dump files in $BackupDir" -ForegroundColor Red
        Write-Host "     Put a backup into backups/ or pass -BackupFile <path>." -ForegroundColor Yellow
        Read-Host "Press Enter to close"
        exit 1
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "[!!] Backup file not found: $BackupFile" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$fileSizeMB = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host "Backup file : $BackupFile ($fileSizeMB MB)"
Write-Host "Container   : $ContainerName"
Write-Host "Database    : $DbName"

# --- Container must be running ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($LASTEXITCODE -ne 0 -or $status -ne "running") {
    Write-Host "[!!] Container $ContainerName is not running (status: $status)." -ForegroundColor Red
    Write-Host "     Run .\setup\03-start-stack.ps1 first." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

# --- Copy dump into container ---
Write-Host ""
Write-Host "Copying backup into container ..." -ForegroundColor Yellow
$containerPath = "/tmp/restore.dump"
docker cp $BackupFile "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Failed to copy the backup file into the container." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# --- pg_restore ---
Write-Host "Running pg_restore (--clean --if-exists --no-owner --no-privileges) ..." -ForegroundColor Yellow
docker exec $ContainerName sh -lc "
export PGPASSWORD='$pgPassword'
pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges $containerPath 2>&1
"
$restoreCode = $LASTEXITCODE

docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null

if ($restoreCode -ne 0) {
    Write-Host ""
    Write-Host "[!!] pg_restore finished with warnings (exit $restoreCode)." -ForegroundColor Yellow
    Write-Host "     This is often normal: pg_restore complains about existing objects" -ForegroundColor Yellow
    Write-Host "     in system schemas (auth / storage / extensions)." -ForegroundColor Yellow
    Write-Host "     Verify manually: docker exec $ContainerName psql -U $DbUser -d $DbName -c '\dt'" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[OK] Database restored successfully." -ForegroundColor Green
}

# --- Quick verification ---
Write-Host ""
Write-Host "Verification: tables in the public schema ..." -ForegroundColor Yellow
docker exec -e "PGPASSWORD=$pgPassword" $ContainerName `
    psql -U $DbUser -d $DbName -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

Write-Host ""
Write-Host "Next step:" -ForegroundColor Green
Write-Host "  .\setup\05-healthcheck.ps1   # verify services"

Read-Host "Press Enter to close"
