import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveIncomingState } from '../server/stateMerge.js'

test('stale writes merge pump events by ID and tombstones prevent resurrection', () => {
  const existingRow = {
    updated_at: 'server-current',
    entries_json: '[]', diapers_json: '[]', medicines_json: '[]', tummy_times_json: '[]',
    pump_events_json: JSON.stringify([{ id: 'server-pump', startedAt: 20, endedAt: 30, leftOunces: 2, rightOunces: null }]),
    growth_measurements_json: '[]', tummy_session_json: null, session_json: null, baby_dob: '2026-06-03', tummy_goal_minutes: 20,
  }
  const result = resolveIncomingState(existingRow, {
    updatedAt: 'stale-client', entries: [], diapers: [], medicines: [], tummyTimes: [],
    pumpEvents: [
      { id: 'server-pump', startedAt: 20, endedAt: 30, leftOunces: 2.5, rightOunces: null },
      { id: 'deleted-pump', startedAt: 10, endedAt: 15, leftOunces: null, rightOunces: 1 },
    ],
    growthMeasurements: [], tummySession: null, tummyGoalMinutes: 20, babyDob: '2026-06-03', session: null, theme: 'light',
  }, { deletedPumpEventIds: ['deleted-pump'] })

  assert.equal(result.stale, true)
  assert.deepEqual(result.pumpEvents, [{ id: 'server-pump', startedAt: 20, endedAt: 30, leftOunces: 2.5, rightOunces: null }])
})
