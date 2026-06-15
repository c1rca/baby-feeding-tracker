import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveIncomingState } from '../server/stateMerge.js'

test('resolveIncomingState preserves existing server session on stale null-session writes', () => {
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

test('resolveIncomingState preserves existing server session on stale old-session writes', () => {
  const existingSession = { startedAt: 2000, activeSide: 'right', segmentStart: 2000, segments: [], bottleOunces: 0, note: 'server', diaperKinds: [] }
  const staleSession = { startedAt: 1000, activeSide: 'left', segmentStart: 1000, segments: [], bottleOunces: 0, note: 'stale', diaperKinds: [] }
  const existingRow = {
    entries_json: JSON.stringify([]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: JSON.stringify(existingSession),
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [],
    diapers: [],
    medicines: [],
    session: staleSession,
    theme: 'light',
    updatedAt: 'server-v1',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.session, existingSession)
})

test('resolveIncomingState dedupes stale duplicate feed entries by source session id', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'current-feed', sourceSessionId: 'session-1', type: 'breast', startedAt: 1000, endedAt: 2000, leftSeconds: 10, rightSeconds: 0, bottleOunces: null }]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [{ id: 'stale-feed', sourceSessionId: 'session-1', type: 'breast', startedAt: 1000, endedAt: 1900, leftSeconds: 9, rightSeconds: 0, bottleOunces: null }],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-v1',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.entries.map((entry) => entry.id), ['current-feed'])
})
