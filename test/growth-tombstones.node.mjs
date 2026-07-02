import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStateAudit } from '../server/auditLog.js'
import { createDeletedItemOptionsReader, createDeletedItemRecorder } from '../server/stateStore.js'
import { resolveIncomingState } from '../server/stateMerge.js'

test('growth measurement deletions are tombstoned and stale clients cannot resurrect them', () => {
  const removedMeasurement = { id: 'growth-deleted', at: 100, weightKg: 4.1, lengthCm: 53 }
  const existingRow = {
    entries_json: JSON.stringify([]),
    diapers_json: JSON.stringify([]),
    medicines_json: JSON.stringify([]),
    tummy_times_json: JSON.stringify([]),
    growth_measurements_json: JSON.stringify([removedMeasurement]),
    session_json: null,
    tummy_session_json: null,
    theme: 'light',
    updated_at: 'server-before-delete',
  }
  const audit = buildStateAudit(existingRow, {
    entries: [],
    diapers: [],
    medicines: [],
    tummyTimes: [],
    growthMeasurements: [],
    session: null,
    tummySession: null,
    theme: 'light',
  })
  const deletedRows = []
  createDeletedItemRecorder({ run: (row) => deletedRows.push(row) })(audit, 'server-after-delete')
  assert.deepEqual(deletedRows, [{ item_id: 'growth-deleted', collection: 'growthMeasurements', deleted_at: 'server-after-delete' }])

  const deletedOptions = createDeletedItemOptionsReader({ all: () => deletedRows.map(({ item_id, collection }) => ({ item_id, collection })) })()
  const resolved = resolveIncomingState({ ...existingRow, growth_measurements_json: JSON.stringify([]), updated_at: 'server-after-delete' }, {
    entries: [],
    diapers: [],
    medicines: [],
    tummyTimes: [],
    growthMeasurements: [removedMeasurement, { id: 'growth-offline-new', at: 200, weightKg: 4.3 }],
    babyDob: '2026-06-03',
    session: null,
    tummySession: null,
    theme: 'light',
    updatedAt: 'server-before-delete',
  }, deletedOptions)

  assert.equal(resolved.stale, true)
  assert.deepEqual(resolved.growthMeasurements.map((measurement) => measurement.id), ['growth-offline-new'])
})
