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

test('resolveIncomingState keeps tummySession server-authoritative on stale writes after server has ended it', () => {
  const staleTummySession = { id: 'stale-tummy-session', startedAt: 1000, note: 'stale active timer' }
  const existingRow = {
    entries_json: JSON.stringify([]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    tummy_times_json: JSON.stringify([]),
    tummy_session_json: null,
    growth_measurements_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-after-tummy-ended',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [],
    diapers: [],
    medicines: [],
    tummyTimes: [],
    tummySession: staleTummySession,
    growthMeasurements: [],
    babyDob: '2026-06-03',
    session: null,
    theme: 'light',
    updatedAt: 'server-before-tummy-ended',
  })

  assert.equal(resolved.stale, true)
  assert.equal(resolved.tummySession, null)
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

test('resolveIncomingState dedupes current full-state writes that contain two entries from the same active session', () => {
  const existingRow = {
    entries_json: JSON.stringify([]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [
      { id: 'stale-completion', sourceSessionId: 'session-1', type: 'breast', startedAt: 1000, endedAt: 2200, leftSeconds: 0, rightSeconds: 1200, bottleOunces: null, diaperKinds: ['wet'] },
      { id: 'current-completion', sourceSessionId: 'session-1', type: 'breast', startedAt: 1000, endedAt: 2190, leftSeconds: 0, rightSeconds: 1190, bottleOunces: null, diaperKinds: [] },
    ],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-v2',
  })

  assert.equal(resolved.stale, false)
  assert.equal(resolved.entries.length, 1)
  assert.deepEqual(resolved.entries[0], { id: 'stale-completion', sourceSessionId: 'session-1', type: 'breast', startedAt: 1000, endedAt: 2200, leftSeconds: 0, rightSeconds: 1200, bottleOunces: null, diaperKinds: ['wet'] })
})
