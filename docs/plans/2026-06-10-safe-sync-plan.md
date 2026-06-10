# Safe Sync Hardening Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Prevent stale browser windows and offline retries from overwriting live production data while preserving reliable local capture for feeds, diapers, and medicines.

**Architecture:** Keep the current full-state sync model for the urgent fix, but make the server the final safety layer for stale writes. Preserve server-owned active session state on stale writes, keep merge-by-ID for append-like entities, and add tests that model real household/dev-window failure modes. Defer event-sourcing/operation-sync until after the immediate data-loss risks are closed.

**Tech Stack:** React, localStorage, Express, SQLite, Vitest, Node test runner.

---

## Current Risk Summary

The app currently saves browser state to localStorage first, then syncs the full state blob to `/api/state`. This is good for offline capture: a started or ended feed remains visible locally even if the server is unavailable.

The urgent risk is stale full-state sync from old browser windows:

- Backend stale-write merge protects `entries`, `diapers`, and `medicines` by ID.
- Backend stale-write merge does **not** protect `session`.
- A stale browser can still clear, replace, or resurrect the active server session.
- Deletes and edits are ambiguous because missing items in a full-state payload can mean either “intentionally deleted” or “old browser did not know about it.”

## Priorities

1. **P0:** Stale clients must not overwrite active server session state.
2. **P0:** Offline/local entries must still sync when back online without deleting server-only entries.
3. **P1:** Stale deletes/edits should be safe by default and explicit where possible.
4. **P1:** Dev/test browser windows should be visibly isolated or harder to accidentally sync to prod.
5. **P2:** Plan migration from full-state replacement to operation-based sync.

---

## Task 1: Add Backend Tests for Stale Session Protection

**Objective:** Capture the current dangerous behavior before changing code.

**Files:**
- Modify: `test/state-merge.node.mjs`
- Exercise: `server/stateMerge.js`

**Step 1: Add failing tests**

Add tests covering:

1. Stale client with `session: null` must not clear existing server session.
2. Stale client with old `session` must not replace existing server session.
3. Stale client entries still merge by ID.

Example test intent:

```js
test('resolveIncomingState preserves existing server session on stale writes', () => {
  const existingSession = { startedAt: 1000, activeSide: 'left', segmentStart: 1000, segments: [], bottleOunces: 0, note: '', diaperKinds: [] }
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'server-feed', endedAt: 10 }]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: JSON.stringify(existingSession),
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [{ id: 'local-feed', endedAt: 20 }],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-v1',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.session, existingSession)
  assert.deepEqual(resolved.entries.map((entry) => entry.id).sort(), ['local-feed', 'server-feed'])
})
```

**Step 2: Run tests and verify failure**

Run:

```bash
npm run test:node -- test/state-merge.node.mjs
```

Expected: fails because stale incoming `session` currently wins.

---

## Task 2: Preserve Server Session on Stale Writes

**Objective:** Make the backend reject stale session replacement while keeping existing entity merge behavior.

**Files:**
- Modify: `server/stateMerge.js`
- Test: `test/state-merge.node.mjs`

**Implementation direction:**

In `resolveIncomingState`, when `stale === true`, parse the existing server session and use it instead of `incoming.session`.

Suggested helper:

```js
function parseJsonValue(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}
```

Suggested stale branch behavior:

```js
return {
  ...incoming,
  entries: mergeByIdPreservingExisting(parseJsonArray(existingRow.entries_json), incoming.entries),
  diapers: mergeByIdPreservingExisting(parseJsonArray(existingRow.diapers_json), incoming.diapers),
  medicines: mergeByIdPreservingExisting(parseJsonArray(existingRow.medicines_json), incoming.medicines),
  session: parseJsonValue(existingRow.session_json, null),
  stale,
}
```

**Step 1: Implement minimal fix**

Only modify stale-write resolution. Do not refactor unrelated server code.

**Step 2: Run targeted tests**

```bash
npm run test:node -- test/state-merge.node.mjs
```

Expected: all state merge tests pass.

**Step 3: Run full validation**

```bash
npm test
npm run build
```

Expected: all tests pass and production build succeeds.

---

## Task 3: Harden Client Pending-Sync Session Replay

**Objective:** Avoid the client choosing a stale local session over a fresher server session during pending-sync replay.

**Files:**
- Modify: `src/sync/useServerSync.ts`
- Modify: `src/sync/useServerSync.test.tsx`

**Current behavior:**

When `pending-sync=1`, client does:

```ts
const mergedSession = localPayload.session ?? normalizeSession(serverState.session ?? null)
```

This can prefer an old local session over a server session from another device.

**Safer immediate rule:**

When pending sync exists:

- If server has a session, preserve server session.
- If server has no session, allow local session to sync.
- Do not attempt clever timestamp conflict resolution until sessions have IDs/revisions.

Suggested behavior:

```ts
const serverSession = normalizeSession(serverState.session ?? null)
const mergedSession = serverSession ?? localPayload.session
```

**Step 1: Add tests**

Add coverage to `src/sync/useServerSync.test.tsx`:

1. Pending local session + server session => PUT uses server session.
2. Pending local session + no server session => PUT uses local session.

**Step 2: Implement minimal client change**

Update only the pending-sync session merge line.

**Step 3: Validate**

```bash
npm run test:ui -- src/sync/useServerSync.test.tsx
npm test
npm run build
```

---

## Task 4: Make Stale Delete Semantics Explicitly Safe

**Objective:** Ensure stale clients cannot delete server-only items by omission.

**Files:**
- Review: `server/stateMerge.js`
- Modify: `test/state-merge.node.mjs`

**Current behavior:**

Stale writes already merge existing + incoming by ID for `entries`, `diapers`, and `medicines`, so server-only items are preserved. This is the desired safe default.

**Step 1: Add explicit tests**

Add tests proving stale incoming empty arrays do not clear server arrays:

- stale `entries: []` preserves existing entries
- stale `diapers: []` preserves existing diapers
- stale `medicines: []` preserves existing medicines

**Step 2: Validate no implementation needed**

Run:

```bash
npm run test:node -- test/state-merge.node.mjs
```

Expected: pass. If any fail, fix `mergeByIdPreservingExisting` or stale branch only.

---

## Task 5: Add a Readable Sync Contract Comment

**Objective:** Document the intended safety contract near the merge logic so future dev work does not regress it.

**Files:**
- Modify: `server/stateMerge.js`

**Add a short comment above `resolveIncomingState`:**

```js
// Sync safety contract:
// - Current clients may replace full state intentionally.
// - Stale clients are treated as offline replays and may only add/update ID-based entities.
// - Stale clients must not delete server-only entities by omission.
// - Stale clients must not replace active server session state; session conflict handling stays server-authoritative until sessions have IDs/revisions.
```

**Validation:**

```bash
npm run test:node -- test/state-merge.node.mjs
```

---

## Task 6: Improve Dev/Prod Safety for Browser Windows

**Objective:** Reduce the chance that local/dev browser windows pointed at prod accidentally sync stale state.

**Files:**
- Review: `docker-compose.yml`
- Review: `docker-compose.dev.yml`
- Review: `src/sync/useServerSync.ts`
- Potentially modify: `.env.example` or README/docs if present

**Recommended simple policy:**

- Prod app on `8080` syncs normally.
- Dev app on `8081` should use dev DB and dev localStorage origin.
- Avoid testing live prod in many tabs unless actively verifying production.

**Implementation options, choose the least invasive:**

1. Confirm dev Compose uses isolated DB and origin. If yes, document it.
2. Add a small visible environment label only in dev builds, if not already obvious.
3. Consider a `VITE_SYNC_ENABLED=false` style flag for intentionally disabling sync in dev-only builds, but do not add this unless it is easy and clearly controlled.

**Validation:**

- Dev container still runs on `8081`.
- Prod container still runs on `8080`.
- No prod data path is used by dev Compose.

---

## Task 7: Production Deployment Procedure

**Objective:** Ship the hardening safely without risking the live household data.

**Files:**
- No source changes unless deployment docs exist.

**Steps:**

1. Confirm clean working tree:

```bash
git status --short
```

2. Create prod SQLite backup and verify integrity before deploy.

3. Run validation:

```bash
npm test
npm run build
```

4. Rebuild/recreate prod container without `--remove-orphans`:

```bash
docker compose up -d --build
```

5. Verify health/API:

```bash
docker compose ps feeding-tracker
curl -fsS http://localhost:8080/api/state >/tmp/bft-state.json
```

6. Confirm app state counts and latest entry/session look reasonable.

7. Commit after green validation:

```bash
git add server/stateMerge.js test/state-merge.node.mjs src/sync/useServerSync.ts src/sync/useServerSync.test.tsx
 git commit -m "Harden stale sync session handling"
```

---

## Deferred Design: Operation-Based Sync

Do not implement this in the urgent patch. Track it as the next architectural improvement.

Full-state PUT is simple, but it makes deletes/edits/session conflicts ambiguous. The better long-term model is operation sync:

- `opId`
- `clientId`
- `createdAt`
- operation type, e.g. `feed_started`, `feed_ended`, `medicine_logged`, `entry_deleted`
- entity ID, e.g. `sessionId`, `entryId`
- payload

Benefits:

- Idempotent retries.
- No stale full-state overwrite class.
- Explicit deletes instead of inferred missing data.
- Better audit trail and replay.

This should be designed separately after P0 safety work is shipped.

---

## Acceptance Criteria

- Stale browser with `session: null` cannot clear active server session.
- Stale browser with old active session cannot replace current server session.
- Offline local entries/diapers/medicines still merge into server when back online.
- Stale empty arrays cannot delete server-only entries/diapers/medicines.
- Pending-sync client replay prefers server session when server has one.
- Full test suite and build pass.
- Prod deploy includes backup + health/API verification.

## Rollback Plan

If deployment behaves unexpectedly:

1. Stop making client changes from browsers.
2. Restore from the verified pre-deploy SQLite backup if data is affected.
3. Revert the code commit.
4. Rebuild/recreate container.
5. Verify `/api/state` counts and latest entry/session before resuming normal use.
