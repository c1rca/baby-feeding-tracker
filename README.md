# Baby Feeding Tracker

A tiny, polished newborn feeding tracker for one-handed, low-light use. Tracks left/right nursing time, bottle ounces, mixed feeds, notes, missed feeds, and daily trends.

## Production quick start

```bash
git clone <repo-url> baby-feeding-tracker
cd baby-feeding-tracker
mkdir -p data backups
docker compose up -d --build
curl http://localhost:8080/api/health
```

Open: `http://SERVER_IP:8080`

## What to copy to another server

Copy the repo plus one flat SQLite backup file. That is enough.

```bash
# On old server
cd /path/to/baby-feeding-tracker
npm ci
npm run backup:db
ls -lh backups/*.db
```

Move the newest `backups/feeding-tracker-YYYYMMDD-HHMMSS.db` to the new server.

```bash
# On new server
cd /path/to/baby-feeding-tracker
mkdir -p data backups
cp /path/to/feeding-tracker-YYYYMMDD-HHMMSS.db backups/
npm ci
npm run restore:db -- backups/feeding-tracker-YYYYMMDD-HHMMSS.db
docker compose up -d --build
curl http://localhost:8080/api/health
```

The app stores durable state at:

- `./data/feeding-tracker.db` — SQLite database mounted into Docker at `/data/feeding-tracker.db`
- `./backups/*.db` — portable single-file backups

## Docker Compose

```yaml
services:
  feeding-tracker:
    build: .
    container_name: baby-feeding-tracker
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DB_DIR=/data
      - DB_PATH=/data/feeding-tracker.db
    volumes:
      - ./data:/data
    restart: unless-stopped
```

Change the left side of `8080:8080` if another service already uses the port.

## Backups

Create a consistent, portable SQLite backup:

```bash
npm run backup:db
```

Recommended daily cron:

```cron
15 3 * * * cd /path/to/baby-feeding-tracker && npm run backup:db >/tmp/baby-feeding-tracker-backup.log 2>&1
```

## Restore

Restore only while the app is stopped:

```bash
docker compose down
npm run restore:db -- backups/feeding-tracker-YYYYMMDD-HHMMSS.db
docker compose up -d
curl http://localhost:8080/api/health
```

## Local development

```bash
npm ci
npm run dev
```

## Validation checklist

Run before shipping changes:

```bash
npm test
npm run build
npm run lint
docker compose config
docker compose up -d --build
curl http://localhost:8080/api/health
```

## UI/UX checklist

- First screen stays focused on active feed.
- Primary action is obvious and thumb-friendly.
- Left/right split remains visible during active feeds.
- Bottle copy changes based on context: bottle-only vs add bottle to active feed.
- Settings/data actions are tucked away but easy to reach.
- Dark mode remains high-contrast for overnight use.

## Security note

Designed for trusted LAN/private deployment. Put it behind an auth proxy before exposing it publicly.
