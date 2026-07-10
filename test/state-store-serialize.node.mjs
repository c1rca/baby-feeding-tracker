import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeState } from '../server/stateStore.js'

const baseRow = {
  household_id: 'h1',
  baby_id: 'b1',
  entries_json: '[{"id":"e1"}]',
  diapers_json: '[]',
  medicines_json: '[]',
  tummy_times_json: '[]',
  growth_measurements_json: '[]',
  baby_dob: '2026-06-03',
  tummy_goal_minutes: 20,
  session_json: null,
  tummy_session_json: null,
  theme: 'light',
  updated_at: 'now',
}

test('serializeState parses a well-formed row', () => {
  const state = serializeState({ ...baseRow, session_json: '{"id":"s1"}' })
  assert.deepEqual(state.entries, [{ id: 'e1' }])
  assert.deepEqual(state.session, { id: 's1' })
})

test('a corrupt collection blob falls back to an empty array instead of throwing', () => {
  const state = serializeState({ ...baseRow, entries_json: '{ this is not json', diapers_json: 'null' })
  assert.deepEqual(state.entries, [])
  assert.deepEqual(state.diapers, [])
  // A non-corrupt sibling collection is unaffected.
  assert.deepEqual(state.medicines, [])
})

test('a corrupt session blob falls back to null instead of throwing', () => {
  const state = serializeState({ ...baseRow, session_json: '{bad', tummy_session_json: '[1,2,3]' })
  assert.equal(state.session, null)
  // An array where an object is expected is rejected too.
  assert.equal(state.tummySession, null)
})
