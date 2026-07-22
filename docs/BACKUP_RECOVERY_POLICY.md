# Backup and recovery policy

SQLite databases and backup artifacts contain protected health and identity data. Portable verified SQLite artifacts are the only supported recovery source; JSONL logs are not recoverable state.

## Local backup contract

`npm run backup:db` creates a standalone SQLite backup through SQLite's backup API, validates `integrity_check`, `foreign_key_check`, and the minimum tracker `app_state` identity, then sets the backup directory to `0700` and artifact to `0600`. It reports only artifact basename, size, checksum, verification result, and retention counts. It never prints records, contact data, database contents, or credentials.

Canonical backups use `feeding-tracker-YYYYMMDDTHHMMSSZ-random.db`. After a successful verification, the runtime atomically records its own artifact basename, checksum, and size in a private (`0600`) `.managed-artifacts.json` manifest. Retention only deletes files that match a recorded runtime artifact's checksum and size; canonical-looking, manually placed, historical, WAL, and SHM files are never eligible. It currently keeps the newest 28 daily runtime-managed artifacts. Do not use a separate `find -mtime` cleanup rule.

`BACKUP_ON_START=1` is the current production baseline, so every service start creates a verified local artifact. A scheduled backup cadence and off-host replication remain incomplete operator decisions; do not claim an RPO based on restart-driven backups alone.

Verify a received artifact before restore:

```bash
npm run verify:backup -- /protected/path/feeding-tracker-....db
```

## Restore

Stop the service before restoring. The explicit acknowledgement is required:

```bash
docker compose down
npm run restore:db -- --replace /protected/path/feeding-tracker-....db
docker compose up -d
curl -fsS http://localhost:8080/api/health
```

Restore validates the source before touching the target. If a target exists it creates and verifies a private pre-restore copy first, restores to a staging file, boots current migrations against staging, validates again, and only then replaces the target. Keep the reported pre-restore artifact until post-restore acceptance is complete.

## Off-host hook (not configured)

Off-host copying is deliberately disabled by default. `BACKUP_ENCRYPT_ARGS` and `BACKUP_UPLOAD_ARGS` must both be supplied as secret JSON argv arrays; a configured adapter is only validated on this branch and **does not upload or encrypt**. Do not put command values, destinations, keys, or credentials in Git. Before enabling an actual adapter, select an independent storage account, encryption/key custodians, immutable retention, and a quarterly non-production restore drill.

Proposed operational targets pending approval: RPO <= 4 hours, RTO <= 60 minutes, monthly scratch restore drills and quarterly isolated operator drills. No production access, credentials, upload, encryption, scheduler, or crontab was used by this implementation.
