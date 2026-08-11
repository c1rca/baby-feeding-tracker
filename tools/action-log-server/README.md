# Action backup log

An append-only record of every action taken in the tracker, held outside the
tracker's own database so it survives that database.

## Run it

```bash
python3 tools/action-log-server/server.py --port 8099 --data-dir ~/bft-action-log
```

No dependencies — standard library only, so recovery never depends on a working
`npm install`.

## Point the app at it

Two settings, because they solve different halves of the problem:

| Setting | Where | Why |
| --- | --- | --- |
| `VITE_ACTION_LOG_URL` | build arg | Vite inlines `VITE_*` at build time, so the client has to know the endpoint when the image is built. |
| `ACTION_LOG_ORIGIN` | server env | The app's CSP is `connect-src 'self'`; without this the browser blocks the POST. |

```bash
docker compose -p baby-tracker-dev -f docker-compose.dev.yml build \
  --build-arg VITE_ACTION_LOG_URL=http://localhost:8099
```

Both unset means logging is off and the CSP stays exactly as strict as it was.

## What gets stored

```
actions/actions-YYYY-MM-DD.jsonl   every action, in arrival order, appended
snapshots/<household>__<baby>.json newest full state
snapshots/<household>__<baby>.meta.json
```

Every action carries the **full resulting state**, so recovery does not depend
on replaying the log in order or on the log being gap-free.

## Recover

```bash
curl 'http://localhost:8099/recover?babyId=default-baby' | jq .state > state.json
```

Or just read `snapshots/<household>__<baby>.json` — it is the same bytes. To
restore, PUT it back:

```bash
curl -X PUT http://localhost:8080/api/state \
  -H 'Content-Type: application/json' --data @state.json
```

For a moment the newest snapshot has already passed, pull the state off the
relevant line of the JSONL instead:

```bash
grep -n '"action": "entries.removed"' actions/actions-2026-07-27.jsonl \
  | tail -1 | cut -d: -f2- | jq .action.state
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/log` | `{"actions": [...]}` — appends and updates snapshots |
| `GET` | `/recover?householdId=&babyId=` | newest snapshot plus its metadata |
| `GET` | `/stats` | files, byte totals, record count |
| `GET` | `/health` | liveness |

## Guarantees, and what they cost

- **Appends only.** Nothing is rewritten or deleted, so a later bug cannot
  destroy what an earlier version captured. The data directory grows forever;
  it is full state per action, so budget for that and prune deliberately if you
  ever need to.
- **Never rejects on shape.** Payloads it cannot parse are written to
  `actions/unparseable.jsonl` rather than dropped.
- **`fsync` per write**, and snapshots are written to a temporary file and
  renamed, so a torn snapshot cannot masquerade as valid JSON.
- **The client does not drop actions when this server is down.** They queue in
  `localStorage`, retry with backoff, drain on reconnect, and get a `sendBeacon`
  handoff when the tab is hidden or closed.

## Tests

```bash
python3 tools/action-log-server/test_server.py
```
