import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStatePayload } from '../server/stateValidation.js'

// A realistic legacy single-family payload — must pass untouched.
const legacyPayload = {
  entries: [
    { id: 'e1', startedAt: '2026-06-10T08:00:00.000Z', endedAt: '2026-06-10T08:20:00.000Z', amountMl: 90, side: 'left', notes: 'sleepy feed' },
    { id: 'e2', startedAt: '2026-06-10T11:00:00.000Z', amountMl: 120, notes: '' },
  ],
  diapers: [{ id: 'd1', at: '2026-06-10T09:00:00.000Z', kind: 'wet' }],
  medicines: [{ id: 'm1', at: '2026-06-10T07:00:00.000Z', name: 'tylenol', doseMl: 2.5 }],
  tummyTimes: [{ id: 't1', startedAt: '2026-06-10T10:00:00.000Z', durationSeconds: 300 }],
  growthMeasurements: [{ id: 'g1', at: '2026-06-10', weightGrams: 4200, lengthCm: 54 }],
  tummySession: { startedAt: '2026-06-10T12:00:00.000Z' },
  tummyGoalMinutes: 20,
  babyDob: '2026-06-03',
  session: { startedAt: '2026-06-10T12:30:00.000Z', side: 'right' },
  theme: 'light',
  updatedAt: '2026-06-10T12:31:00.000Z',
}

test('a realistic legacy payload passes validation', () => {
  assert.deepEqual(validateStatePayload(legacyPayload), { ok: true })
})

test('an empty object and a missing body pass', () => {
  assert.deepEqual(validateStatePayload({}), { ok: true })
  assert.deepEqual(validateStatePayload(undefined), { ok: true })
  assert.deepEqual(validateStatePayload(null), { ok: true })
})

test('a non-object body is rejected', () => {
  assert.equal(validateStatePayload([]).ok, false)
  assert.equal(validateStatePayload('nope').ok, false)
  assert.equal(validateStatePayload(42).ok, false)
})

test('a collection that is not an array is rejected', () => {
  assert.equal(validateStatePayload({ entries: { id: 'x' } }).ok, false)
})

test('non-object entries within a collection are rejected', () => {
  assert.equal(validateStatePayload({ entries: ['not-an-object'] }).ok, false)
  assert.equal(validateStatePayload({ diapers: [null] }).ok, false)
})

test('an oversized collection is rejected', () => {
  const entries = Array.from({ length: 20001 }, (_, i) => ({ id: `e${i}` }))
  assert.equal(validateStatePayload({ entries }).ok, false)
})

test('an overlong string field is rejected', () => {
  const entries = [{ id: 'e1', notes: 'x'.repeat(10001) }]
  assert.equal(validateStatePayload({ entries }).ok, false)
})

test('an invalid babyDob is rejected, a valid one passes', () => {
  assert.equal(validateStatePayload({ babyDob: 'June 3' }).ok, false)
  assert.equal(validateStatePayload({ babyDob: '2026-13-40' }).ok, false)
  assert.deepEqual(validateStatePayload({ babyDob: '2026-06-03' }), { ok: true })
})

test('session and tummySession must be objects when present', () => {
  assert.equal(validateStatePayload({ session: 'active' }).ok, false)
  assert.equal(validateStatePayload({ tummySession: [] }).ok, false)
})
