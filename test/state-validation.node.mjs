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
  const pumpEvents = Array.from({ length: 20001 }, (_, i) => ({ id: `p${i}` }))
  assert.equal(validateStatePayload({ pumpEvents }).ok, false)
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

const completeState = {
  entries: [{ id: 'feed-1', sourceSessionId: 'feed-session-1', type: 'mixed', startedAt: 1000, endedAt: 2000, leftSeconds: 30, rightSeconds: 20, bottleOunces: 2.5, note: '', diaperKinds: ['wet'] }],
  diapers: [{ id: 'diaper-1', kinds: ['wet', 'stool'], at: 2100, context: 'standalone' }],
  medicines: [{ id: 'medicine-1', kind: 'tylenol', at: 2200 }],
  tummyTimes: [{ id: 'tummy-1', startedAt: 2300, endedAt: 2400, note: '', kind: 'tummy' }],
  pumpEvents: [{ id: 'pump-1', startedAt: 2500, endedAt: 2600, leftOunces: 1.5, rightOunces: null, note: '' }],
  growthMeasurements: [{ id: 'growth-1', measuredAt: 2700, ageMonths: 1, weightLb: 9, lengthCm: 54, headCm: null, note: '' }],
  session: { id: 'feed-session-2', startedAt: 2800, activeSide: 'left', segmentStart: 2800, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
  pumpSession: { id: 'pump-session-1', startedAt: 2900, side: 'both', runningStartedAt: 2900, elapsedSeconds: 0 },
  tummySession: { id: 'tummy-session-1', startedAt: 3000, runningStartedAt: 3000, elapsedSeconds: 0, note: '', kind: 'sleep' },
  tummyGoalMinutes: 20,
  babyDob: '2026-06-03',
  theme: 'dark',
  updatedAt: '2026-06-10T12:31:00.000Z',
}

test('a complete current state passes strict validation', () => {
  assert.deepEqual(validateStatePayload(completeState), { ok: true })
})

test('strict validation rejects malformed persisted domain data', () => {
  const cases = [
    ['blank ID', { entries: [{ ...completeState.entries[0], id: '   ' }] }],
    ['duplicate collection ID', { diapers: [{ ...completeState.diapers[0] }, { ...completeState.diapers[0] }] }],
    ['non-finite timestamp', { entries: [{ ...completeState.entries[0], startedAt: Number.POSITIVE_INFINITY }] }],
    ['invalid timestamp string', { entries: [{ ...completeState.entries[0], startedAt: 'not-a-date' }] }],
    ['end before start', { pumpEvents: [{ ...completeState.pumpEvents[0], endedAt: 2499 }] }],
    ['invalid feed enum', { entries: [{ ...completeState.entries[0], type: 'unknown' }] }],
    ['invalid diaper enum', { diapers: [{ ...completeState.diapers[0], kinds: ['wet', 'bogus'] }] }],
    ['invalid numeric value', { growthMeasurements: [{ ...completeState.growthMeasurements[0], weightLb: -1 }] }],
    ['malformed active session', { session: { ...completeState.session, segments: [{ side: 'wrong', startedAt: 1, endedAt: 2 }] } }],
    ['invalid active pump session', { pumpSession: { ...completeState.pumpSession, side: 'wrong' } }],
    ['invalid theme', { theme: 'sepia' }],
    ['null collection is not a legacy omission', { entries: null }],
    ['null goal', { tummyGoalMinutes: null }],
    ['null DOB', { babyDob: null }],
    ['invalid goal', { tummyGoalMinutes: 0 }],
    ['invalid DOB', { babyDob: '2026-02-30' }],
    ['invalid updated timestamp', { updatedAt: 'tomorrowish' }],
  ]
  for (const [name, partial] of cases) {
    assert.equal(validateStatePayload({ ...completeState, ...partial }).ok, false, name)
  }
})
