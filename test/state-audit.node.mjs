import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStateAudit } from '../server/auditLog.js'

test('buildStateAudit captures compact rebuild-critical timeline changes', () => {
  const existingRow = {
    entries_json: JSON.stringify([{ id: 'feed-old', type: 'breast', startedAt: 100, endedAt: 200, leftSeconds: 60, rightSeconds: 0, bottleOunces: null, note: 'before' }]),
    diapers_json: JSON.stringify([{ id: 'diaper-old', at: 210, kinds: ['wet'], context: 'standalone' }]),
    medicines_json: JSON.stringify([]),
    tummy_times_json: JSON.stringify([]),
    growth_measurements_json: JSON.stringify([]),
    tummy_session_json: null,
    session_json: null,
    theme: 'light',
    updated_at: 'server-v1',
  }

  const audit = buildStateAudit(existingRow, {
    entries: [{ id: 'feed-new', type: 'bottle', startedAt: 300, endedAt: 360, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' }],
    diapers: [{ id: 'diaper-old', at: 210, kinds: ['wet', 'stool'], context: 'standalone' }],
    medicines: [{ id: 'med-new', at: 400, kind: 'tylenol' }],
    tummyTimes: [{ id: 'tummy-new', startedAt: 420, endedAt: 1020, note: 'mat' }],
    growthMeasurements: [{ id: 'growth-new', at: 450, weightKg: 4.5 }],
    tummySession: null,
    session: { startedAt: 500, activeSide: 'left', segmentStart: 500, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
    theme: 'dark',
  }, { staleWriteMerged: true, clientUpdatedAt: 'client-v0', nextUpdatedAt: 'server-v2' })

  assert.equal(audit.event, 'state_write_audit')
  assert.equal(audit.staleWriteMerged, true)
  assert.deepEqual(audit.entries.added, [{ id: 'feed-new', type: 'bottle', startedAt: 300, endedAt: 360, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3 }])
  assert.deepEqual(audit.entries.removed.map((entry) => entry.id), ['feed-old'])
  assert.deepEqual(audit.diapers.updated, [{ id: 'diaper-old', at: 210, kinds: ['wet', 'stool'], context: 'standalone' }])
  assert.deepEqual(audit.medicines.added, [{ id: 'med-new', at: 400, kind: 'tylenol' }])
  assert.deepEqual(audit.tummyTimes.added, [{ id: 'tummy-new', startedAt: 420, endedAt: 1020, note: 'mat' }])
  assert.deepEqual(audit.growthMeasurements.added, [{ id: 'growth-new', at: 450, weightKg: 4.5 }])
  assert.equal(audit.session.after.startedAt, 500)
  assert.deepEqual(audit.theme, { before: 'light', after: 'dark' })
  assert.deepEqual(audit.counts, { entries: 1, diapers: 1, medicines: 1, tummyTimes: 1, growthMeasurements: 1, hasSession: true, hasTummySession: false })
})
