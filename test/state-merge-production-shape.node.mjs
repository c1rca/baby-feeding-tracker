import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStatePayload } from '../server/stateValidation.js'
import { resolveIncomingState } from '../server/stateMerge.js'

const state = {
  entries: [{ id: 'feed', type: 'breast', startedAt: 1, endedAt: 2, leftSeconds: 1, rightSeconds: 0, bottleOunces: 0, note: '', diaperKinds: [] }],
  diapers: [{ id: 'diaper', at: 2, kinds: ['wet'] }], medicines: [{ id: 'medicine', at: 3, kind: 'vitamin_d' }],
  tummyTimes: [{ id: 'tummy', startedAt: 3, endedAt: 4 }], pumpEvents: [{ id: 'pump', startedAt: 4, endedAt: 5, leftOunces: 1, rightOunces: null, note: '' }],
  growthMeasurements: [{ id: 'growth', measuredAt: 5, weightLb: 9 }], healthRecords: [{ id: 'health', at: 6, kind: 'vaccine', name: 'test' }],
  customTrackers: [{ id: 'tracker', name: 'Vitamin C', createdAt: 1, goal: { kind: 'count', target: 1 } }], customEvents: [{ id: 'event', trackerId: 'tracker', at: 7 }],
  session: { id: 'active-feed', startedAt: 8, activeSide: 'left', segmentStart: 8, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
  pumpSession: null, tummySession: null, tummyGoalMinutes: 20, pumpGoalOunces: 0, pumpGoalSessions: 0, babyDob: '2026-01-01', theme: 'dark', updatedAt: 9,
}
const row = { updated_at: 9, entries_json: JSON.stringify(state.entries), diapers_json: JSON.stringify(state.diapers), medicines_json: JSON.stringify(state.medicines), tummy_times_json: JSON.stringify(state.tummyTimes), pump_events_json: JSON.stringify(state.pumpEvents), growth_measurements_json: JSON.stringify(state.growthMeasurements), health_records_json: JSON.stringify(state.healthRecords), custom_trackers_json: JSON.stringify(state.customTrackers), custom_events_json: JSON.stringify(state.customEvents), session_json: JSON.stringify(state.session), pump_session_json: 'null', tummy_session_json: 'null' }

test('production-shaped whole state validates and round-trips without collection loss', () => {
  assert.deepEqual(validateStatePayload(state), { ok: true })
  const resolved = resolveIncomingState(row, state)
  for (const key of ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements', 'healthRecords', 'customTrackers', 'customEvents']) assert.deepEqual(resolved[key], state[key], key)
  assert.deepEqual(resolved.session, state.session)
})
