# Database backups

This folder holds `pg_dump -Fc` backups of the CRM Belarus Supabase database.

## Files shipped with the repository

- **`seed.dump`** — seed dump used to bootstrap a fresh install on a new
  machine. Restore with:

  ```powershell
  .\setup\04-restore-db.ps1 -BackupFile "backups\seed.dump"
  ```

  Or simply (the script picks the most recently modified `.dump`):

  ```powershell
  .\setup\04-restore-db.ps1
  ```

  You do **not** need to run any migrations after restoring — the dump already
  contains the full schema, RLS policies, functions, triggers and initial
  reference data.

## Creating new backups

```powershell
.\setup\06-backup-db.ps1                # -> backups\supabase-postgres-<ts>.dump
.\setup\06-backup-db.ps1 -KeepLast 10   # keep only the 10 newest
```

New `*.dump` files are ignored by git (see `.gitignore`); only `seed.dump` is
tracked explicitly via `git add -f`.
