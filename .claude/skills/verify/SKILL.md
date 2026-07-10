---
name: verify
description: Build, launch, and drive the baby feeding tracker locally to verify changes end-to-end without touching prod.
---

# Verifying the baby feeding tracker locally

**Never touch the prod container (`baby-feeding-tracker` in docker) or the prod DB under `data/`.** Always run verification servers on a scratch port with a scratch `DB_DIR`.

## Build and launch

```bash
npm run build   # server serves ./dist statically

PORT=18080 DB_DIR=/path/to/scratch-db \
  AUTH_REQUIRED=1 AUTH_BOOTSTRAP_PASSWORD=verify-pass-123 \
  node server.js
```

Omit `AUTH_REQUIRED`/`AUTH_BOOTSTRAP_PASSWORD` for local no-auth mode. `DB_DIR` gets a fresh sqlite DB with seeded defaults (`default-household`, `default-baby`, `default-user` / `local@baby-feeding-tracker.invalid`). The bootstrap password is applied once, only when the default user has no password yet.

## Flows worth driving

```bash
# auth mode lifecycle
curl -s -w '\n%{http_code}\n' localhost:18080/api/state                       # 401
curl -s -X POST localhost:18080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"local@baby-feeding-tracker.invalid","password":"verify-pass-123"}'  # -> token
curl -s -H "Authorization: Bearer $TOKEN" localhost:18080/api/auth/me         # mode:"session"
curl -s -H "Authorization: Bearer $TOKEN" localhost:18080/api/state           # 200
curl -s -X POST -H "Authorization: Bearer $TOKEN" localhost:18080/api/auth/logout
curl -s -H "Authorization: Bearer $TOKEN" localhost:18080/api/state           # 401 (revoked)

# no-auth mode: /api/state is open, /api/auth/me returns mode:"local",
# POST /api/auth/login returns 404 "Authentication is not enabled"
```

## Gotchas

- No headless browser is installed here; verify the client via `npx vitest run` UI tests plus the HTTP surface, and grep the served `assets/index-*.js` for new UI strings to confirm the bundle is current.
- Several long-running `node server.js` processes belong to the user. When cleaning up, `kill` only the exact PIDs you started — never `pkill -f "node server.js"`.
- After any work, re-check prod is untouched:
  `docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.State.Status}}' baby-feeding-tracker`
