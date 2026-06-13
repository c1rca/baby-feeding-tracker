import test from 'node:test'
import assert from 'node:assert/strict'
import { isStaleStateWrite, mergeByIdPreservingExisting, resolveIncomingState } from '../server/stateMerge.js'
import { buildStateAudit } from '../server/auditLog.js'

test('isStaleStateWrite treats missing or mismatched client timestamps as stale', () => {
  assert.equal(isStaleStateWrite(null, undefined), false)
  assert.equal(isStaleStateWrite('2026-01-01T00:00:00.000Z', undefined), true)
  assert.equal(isStaleStateWrite('2026-01-01T00:00:00.000Z', 'old'), true)
  assert.equal(isStaleStateWrite('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'), false)
})

test('mergeByIdPreservingExisting keeps server-only medicine events and updates matching IDs', () => {
  assert.deepEqual(
    mergeByIdPreservingExisting(
      [{ id: 'tylenol-1', kind: 'tylenol', at: 10 }, { id: 'motrin-1', kind: 'motrin', at: 20 }],
      [{ id: 'motrin-1', kind: 'motrin', at: 25 }, { id: 'tylenol-2', kind: 'tylenol', at: 30 }],
    ).sort((a, b) => a.id.localeCompare(b.id)),
    [{ id: 'motrin-1', kind: 'motrin', at: 25 }, { id: 'tylenol-1', kind: 'tylenol', at: 10 }, { id: 'tylenol-2', kind: 'tylenol', at: 30 }].sort((a, b) => a.id.localeCompare(b.id)),
  )
})

test('resolveIncomingState preserves persisted medicines on stale full-state writes', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'feed-1', endedAt: 10 }]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([{ id: 'tylenol-1', kind: 'tylenol', at: 10 }, { id: 'motrin-1', kind: 'motrin', at: 20 }]),
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [{ id: 'feed-1', endedAt: 10 }, { id: 'feed-2', endedAt: 20 }],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'dark',
    updatedAt: '2025-12-31T23:59:00.000Z',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.medicines.map((medicine) => medicine.id).sort(), ['motrin-1', 'tylenol-1'])
  assert.deepEqual(resolved.entries.map((entry) => entry.id).sort(), ['feed-1', 'feed-2'])
})

test('resolveIncomingState allows current clients to intentionally delete medicines', () => {
  const existingRow = {
    entries_json: JSON.stringify([]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([{ id: 'tylenol-1', kind: 'tylenol', at: 10 }]),
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'dark',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })

  assert.equal(resolved.stale, false)
  assert.deepEqual(resolved.medicines, [])
})

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

test('resolveIncomingState preserves server-only entities when stale writes omit them', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'server-feed', endedAt: 10 }]),
    diapers_json: JSON.stringify([{ id: 'server-diaper', kinds: ['wet'], at: 20 }]),
    medicines_json: JSON.stringify([{ id: 'server-med', kind: 'tylenol', at: 30 }]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-v1',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.entries.map((entry) => entry.id), ['server-feed'])
  assert.deepEqual(resolved.diapers.map((diaper) => diaper.id), ['server-diaper'])
  assert.deepEqual(resolved.medicines.map((medicine) => medicine.id), ['server-med'])
})

test('resolveIncomingState does not resurrect stale entries that were already deleted on the server', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'server-feed', endedAt: 20 }]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-after-delete',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [{ id: 'deleted-feed', endedAt: 10 }, { id: 'server-feed', endedAt: 20 }, { id: 'new-offline-feed', endedAt: 30 }],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-before-delete',
  }, {
    deletedEntryIds: ['deleted-feed'],
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.entries.map((entry) => entry.id).sort(), ['new-offline-feed', 'server-feed'])
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

test('resolveIncomingState dedupes legacy stale duplicate active-feed saves conservatively', () => {
  const startedAt = 1781312332300
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'current-feed', type: 'breast', startedAt, endedAt: 1781315602140, leftSeconds: 1708, rightSeconds: 0, bottleOunces: null }]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-v2',
  }

  const resolved = resolveIncomingState(existingRow, {
    entries: [{ id: 'stale-feed', type: 'breast', startedAt, endedAt: 1781315593475, leftSeconds: 1699, rightSeconds: 0, bottleOunces: null }],
    diapers: [],
    medicines: [],
    session: null,
    theme: 'light',
    updatedAt: 'server-v1',
  })

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.entries.map((entry) => entry.id), ['current-feed'])
})

test('buildStateAudit captures compact rebuild-critical timeline changes', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'feed-old', type: 'breast', startedAt: 100, endedAt: 200, leftSeconds: 60, rightSeconds: 0, bottleOunces: null, note: 'before' }]),
    diapers_json: JSON.stringify([{ id: 'diaper-old', at: 210, kinds: ['wet'], context: 'standalone' }]),
    medicines_json: JSON.stringify([]),
    session_json: null,
    theme: 'light',
    updated_at: 'server-v1',
  }

  const audit = buildStateAudit(existingRow, {
    entries: [{ id: 'feed-new', type: 'bottle', startedAt: 300, endedAt: 360, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' }],
    diapers: [{ id: 'diaper-old', at: 210, kinds: ['wet', 'stool'], context: 'standalone' }],
    medicines: [{ id: 'med-new', at: 400, kind: 'tylenol' }],
    session: { startedAt: 500, activeSide: 'left', segmentStart: 500, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
    theme: 'dark',
  }, { staleWriteMerged: true, clientUpdatedAt: 'client-v0', nextUpdatedAt: 'server-v2' })

  assert.equal(audit.event, 'state_write_audit')
  assert.equal(audit.staleWriteMerged, true)
  assert.deepEqual(audit.entries.added, [{ id: 'feed-new', type: 'bottle', startedAt: 300, endedAt: 360, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3 }])
  assert.deepEqual(audit.entries.removed.map((entry) => entry.id), ['feed-old'])
  assert.deepEqual(audit.diapers.updated, [{ id: 'diaper-old', at: 210, kinds: ['wet', 'stool'], context: 'standalone' }])
  assert.deepEqual(audit.medicines.added, [{ id: 'med-new', at: 400, kind: 'tylenol' }])
  assert.equal(audit.session.after.startedAt, 500)
  assert.deepEqual(audit.theme, { before: 'light', after: 'dark' })
  assert.deepEqual(audit.counts, { entries: 1, diapers: 1, medicines: 1, hasSession: true })
})
