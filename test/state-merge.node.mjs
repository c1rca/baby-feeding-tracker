import test from 'node:test'
import assert from 'node:assert/strict'
import { isStaleStateWrite, mergeByIdPreservingExisting, resolveIncomingState } from '../server/stateMerge.js'

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
