import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveIncomingState } from '../server/stateMerge.js'

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
