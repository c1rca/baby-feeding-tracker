# Baby Feeding Tracker

A simple newborn feeding tracker optimized for one-handed, low-light use.

## Features

- Breast timer with left/right side tracking, pause/resume, and side switching.
- Suggested next side based on the last nursing feed and daily balance.
- Live active-feed split for left, right, bottle amount, and total time.
- Quick bottle logging with common ounce presets.
- Timeline with edit, delete, undo, notes, import, and export.
- SQLite persistence with localStorage fallback.
- Docker Compose deployment with healthcheck.

## Run locally

```bash
npm ci
npm run dev
```

## Validate

```bash
npm test -- --run
npm run build
```

## Production deployment

```bash
docker compose up -d --build
curl http://localhost:8080/api/health
```

The app stores SQLite data under `./data/feeding-tracker.db` via the compose volume.

## Backups

Create an on-demand backup:

```bash
npm run backup:db
```

Backups are written to `./backups/` and include WAL/SHM files when present.

Recommended daily cron from this repo directory:

```cron
15 3 * * * cd /home/alex/Documents/baby-feeding-tracker && npm run backup:db >/tmp/baby-feeding-tracker-backup.log 2>&1
```

## Restore

1. Stop the app:
   ```bash
   docker compose down
   ```
2. Copy the desired backup files into `./data/` as `feeding-tracker.db`, plus matching `feeding-tracker.db-wal` / `feeding-tracker.db-shm` if present.
3. Restart:
   ```bash
   docker compose up -d
   ```

## Security note

This app is intended for trusted LAN/private deployment. Add an auth proxy before exposing it publicly.
