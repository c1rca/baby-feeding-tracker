# Baby Feeding Tracker

Production-ready baby feeding tracker with:
- polished mobile-first UI
- persistent state across reloads
- SQLite-backed server state (`/data/feeding-tracker.db`)
- Docker Compose deployment with mounted DB volume

## Run locally (dev)

1. Terminal A (API + SQLite):
```bash
npm run start
```
2. Terminal B (frontend dev server):
```bash
npm run dev
```
3. Open: `http://localhost:5173`

Vite proxies `/api/*` to `http://localhost:8080`.

## Run with Docker Compose (production style)

```bash
docker compose up -d --build
```

Open: `http://localhost:8080`

### Persistence
Database is mounted to host:
- `./data/feeding-tracker.db`

So container rebuild/restart does not lose data.

## Backup / Restore

### Backup
```bash
npm run backup:db
```
Creates timestamped snapshots in `./backups/`.

### Restore
1. Stop app:
```bash
docker compose down
```
2. Copy backup over live DB file in `./data/`.
3. Start app:
```bash
docker compose up -d
```

## Health check
- `GET /api/health`
- `GET /api/state`

## Production move checklist
- Copy project directory including `data/` and `docker-compose.yml`
- On target host run `docker compose up -d --build`
- Verify `http://<host>:8080/api/health`

That’s it — state follows the mounted SQLite file.
