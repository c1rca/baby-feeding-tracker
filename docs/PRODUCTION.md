# Baby Feeding Tracker Production Runbook

## Production shape

This is a single-container Docker Compose app with one durable state file:

- Compose file: `docker-compose.yml`
- App container: `baby-feeding-tracker`
- App URL: `http://SERVER_IP:8080`
- Health endpoint: `http://SERVER_IP:8080/api/health`
- Durable DB: `./data/feeding-tracker.db` mounted to `/data/feeding-tracker.db`
- Portable backups: `./backups/feeding-tracker-YYYYMMDD-HHMMSS.db`

There is no separate Postgres, Redis, uploads directory, or sidecar config to migrate.

## Fresh production deploy

```bash
git clone <repo-url> baby-feeding-tracker
cd baby-feeding-tracker
mkdir -p data backups
docker compose up -d --build
curl -fsS http://localhost:8080/api/health
```

## Move to another production server

Yes — this is intentionally migratable by copying the project plus one flat SQLite backup file.

### On the old server

```bash
cd /path/to/baby-feeding-tracker
npm ci
npm run backup:db
ls -lh backups/*.db
```

Copy the newest `backups/feeding-tracker-*.db` file to the new server.

### On the new server

```bash
cd /path/to/baby-feeding-tracker
mkdir -p data backups
cp /path/to/feeding-tracker-YYYYMMDD-HHMMSS.db backups/
npm ci
npm run restore:db -- backups/feeding-tracker-YYYYMMDD-HHMMSS.db
docker compose up -d --build
curl -fsS http://localhost:8080/api/health
```

### Verify migrated data

```bash
docker compose ps
docker compose logs --no-color --tail=80 feeding-tracker
curl -fsS http://localhost:8080/api/state | head -c 300 && echo
```

Then open the UI and verify recent feeds are present.

## Backup setup

Manual backup:

```bash
npm run backup:db
```

Backups are written to `./backups/` as one standalone `.db` file using SQLite's backup API, so they are safe while WAL mode is enabled.

Current installed cron on this server:

```cron
15 3 * * * cd /home/alex/Documents/baby-feeding-tracker && npm run backup:db >/tmp/baby-feeding-tracker-backup.log 2>&1
```

Check it with:

```bash
crontab -l
```

Last backup log:

```bash
tail -50 /tmp/baby-feeding-tracker-backup.log
```

Recommended after migrating: install the same cron with the new server path.

## Restore / rollback

Stop first, restore, start, verify:

```bash
docker compose down
npm run restore:db -- backups/feeding-tracker-YYYYMMDD-HHMMSS.db
docker compose up -d
curl -fsS http://localhost:8080/api/health
```

The restore command validates that the backup contains the expected `app_state` schema and removes stale target WAL/SHM sidecars before copying.

## Offline behavior

The app is built to keep working through short server/network outages:

- UI shell is cached by a service worker after the first successful visit.
- Feed entries/session state are always written to browser `localStorage` immediately.
- If `/api/state` is unavailable, the app shows `Offline changes saved`.
- Offline changes are marked with `baby-feeding-tracker:v1:pending-sync`.
- When the browser comes back online or the tab receives focus, pending state is pushed to the server automatically.
- The header status changes to `Synced` after the server accepts the update.

Important limits:

- This is last-writer-wins whole-state sync, not multi-user conflict resolution.
- Best production use is one household/device at a time, or at least avoid concurrent edits from multiple devices while offline.
- For public internet exposure, put it behind an auth proxy/VPN first.

## Validation before/after changes

```bash
npm test
npm run build
npm run lint
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/api/health
```

## Production UI checklist

- Primary Start side action is visible first.
- Left/right split remains visible during active feeds.
- Bottle can be logged standalone or attached to active nursing.
- Missed/manual feeds can be added later.
- Data actions are behind Settings.
- Dark mode is high contrast for overnight use.
- Header sync pill shows whether the browser is synced or holding offline changes.

## Disaster recovery quick answer

If the server dies, you need:

1. The repo / Compose file.
2. One file from `backups/*.db`.
3. Docker Compose on the new host.

Restore with `npm run restore:db -- backups/<file>.db`, then `docker compose up -d --build`.
