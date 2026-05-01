# Dump the CRM Belarus Supabase database to a .dump file (pg_dump -Fc).
# The resulting file can be restored via setup\04-restore-db.ps1.
#
# Usage:
#   .\setup\06-backup-db.ps1                                  # backups\supabase-postgres-<ts>.dump
#   .\setup\06-backup-db.ps1 -OutputFile "backups\my.dump"    # custom path
#   .\setup\06-backup-db.ps1 -KeepLast 10                     # rotate: keep N newest dumps
#   .\setup\06-backup-db.ps1 -SchemaOnly                      # structure only, no data
#   .\setup\06-backup-db.ps1 -DataOnly                        # data only, no schema

param(
    [string]$OutputFile,
    [int]$KeepLast = 0,
    [switch]$SchemaOnly,
    [switch]$DataOnly
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
Write-Host "=== CRM Belarus: database backup ===" -ForegroundColor Cyan
Write-Host ""

if ($SchemaOnly -and $DataOnly) {
    Write-Host "[!!] -SchemaOnly and -DataOnly are mutually exclusive." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

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

# --- Container must be running ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($LASTEXITCODE -ne 0 -or $status -ne "running") {
    Write-Host "[!!] Container $ContainerName is not running (status: $status)." -ForegroundColor Red
    Write-Host "     Run .\setup\03-start-stack.ps1 first." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

# --- Ensure backups/ exists ---
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[OK] Created backups/ folder." -ForegroundColor Green
}

# --- Resolve output path ---
if (-not $OutputFile) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $suffix = ""
    if ($SchemaOnly) { $suffix = "-schema" }
    if ($DataOnly)   { $suffix = "-data" }
    $OutputFile = Join-Path $BackupDir ("supabase-postgres-$ts$suffix.dump")
} elseif (-not [System.IO.Path]::IsPathRooted($OutputFile)) {
    $OutputFile = Join-Path $root $OutputFile
}

$outputDir = Split-Path $OutputFile -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Container   : $ContainerName"
Write-Host "Database    : $DbName"
Write-Host "Output file : $OutputFile"
if ($SchemaOnly) { Write-Host "Mode        : schema only" }
elseif ($DataOnly) { Write-Host "Mode        : data only" }
else { Write-Host "Mode        : full (schema + data)" }
Write-Host ""

# --- Build pg_dump flags ---
# -Fc       : custom format (compressed; required for pg_restore --clean)
# --no-owner / --no-privileges : portable across environments
$pgFlags = "-Fc --no-owner --no-privileges"
if ($SchemaOnly) { $pgFlags += " --schema-only" }
if ($DataOnly)   { $pgFlags += " --data-only" }

$containerPath = "/tmp/dump.$(Get-Random).dump"

# --- Run pg_dump inside the container ---
Write-Host "Running pg_dump ..." -ForegroundColor Yellow
$dumpCmd = "export PGPASSWORD='$pgPassword'; pg_dump -U $DbUser -d $DbName $pgFlags -f $containerPath"
docker exec $ContainerName sh -lc $dumpCmd
$dumpCode = $LASTEXITCODE
if ($dumpCode -ne 0) {
    Write-Host "[!!] pg_dump failed (exit $dumpCode)." -ForegroundColor Red
    docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null
    Read-Host "Press Enter to close"
    exit 1
}

# --- Copy dump out of the container ---
Write-Host "Copying dump to host ..." -ForegroundColor Yellow
docker cp "${ContainerName}:${containerPath}" $OutputFile
$copyCode = $LASTEXITCODE
docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null

if ($copyCode -ne 0 -or -not (Test-Path $OutputFile)) {
    Write-Host "[!!] Failed to copy dump out of the container." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$fileSizeMB = [math]::Round((Get-Item $OutputFile).Length / 1MB, 2)
Write-Host ""
Write-Host "[OK] Backup created: $OutputFile ($fileSizeMB MB)" -ForegroundColor Green

# --- Rotation: keep only the N newest .dump files in backups/ ---
if ($KeepLast -gt 0) {
    $allDumps = Get-ChildItem -Path $BackupDir -Filter "*.dump" -File |
                Sort-Object LastWriteTime -Descending
    if ($allDumps.Count -gt $KeepLast) {
        $toDelete = $allDumps | Select-Object -Skip $KeepLast
        foreach ($old in $toDelete) {
            Remove-Item -Path $old.FullName -Force
            Write-Host "[--] Removed old backup: $($old.Name)" -ForegroundColor DarkYellow
        }
        Write-Host "[OK] Rotation: kept $KeepLast newest, removed $($toDelete.Count) old file(s)." -ForegroundColor Green
    } else {
        Write-Host "[OK] Rotation: $($allDumps.Count) file(s) in backups/, nothing to remove." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Restore later with:" -ForegroundColor Green
Write-Host "  .\setup\04-restore-db.ps1 -BackupFile `"$OutputFile`""

Read-Host "Press Enter to close"
