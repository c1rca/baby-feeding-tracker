import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveIncomingState } from '../server/stateMerge.js'

const tracker = (over = {}) => ({ id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'once' }, createdAt: 1000, archivedAt: null, ...over })

const rowWith = (trackers, updatedAt = 'server-v1') => ({
  entries_json: JSON.stringify([]),
  diapers_json: JSON.stringify([]),
  medicines_json: JSON.stringify([]),
  tummy_times_json: JSON.stringify([]),
  pump_events_json: JSON.stringify([]),
  growth_measurements_json: JSON.stringify([]),
  health_records_json: JSON.stringify([]),
  custom_trackers_json: JSON.stringify(trackers),
  custom_events_json: JSON.stringify([]),
  session_json: null,
  tummy_session_json: null,
  theme: 'light',
  updated_at: updatedAt,
})

const incomingWith = (trackers, updatedAt) => ({
  entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [],
  growthMeasurements: [], healthRecords: [], customTrackers: trackers, customEvents: [],
  session: null, tummySession: null, theme: 'light', updatedAt,
})

const trackersOf = (resolved) => resolved.customTrackers.map((item) => `${item.name}:${item.archivedAt ? 'archived' : 'active'}`)

// Archiving is an update, not a delete, so it rides the ordinary merge. If the
// merge ever preferred the existing copy, an archived tracker would reappear on
// the next sync — which is exactly what "it came back" would look like.
test('an archive from a stale client wins over the server copy rather than being reverted', () => {
  const resolved = resolveIncomingState(
    rowWith([tracker()]),
    incomingWith([tracker({ archivedAt: 5000 })], 'client-is-behind'),
  )
  assert.equal(resolved.stale, true)
  assert.deepEqual(trackersOf(resolved), ['Vitamin C:archived'])
})

test('a restore from a stale client wins too', () => {
  const resolved = resolveIncomingState(
    rowWith([tracker({ archivedAt: 5000 })]),
    incomingWith([tracker({ archivedAt: null })], 'client-is-behind'),
  )
  assert.deepEqual(trackersOf(resolved), ['Vitamin C:active'])
})

// The other half of the contract: a stale client must not delete by omission.
// A tracker it has never heard of has to survive its write.
test('a tracker the stale client has never seen survives its write', () => {
  const resolved = resolveIncomingState(
    rowWith([tracker(), tracker({ id: 't2', name: 'Physio', createdAt: 2000 })]),
    incomingWith([tracker({ archivedAt: 5000 })], 'client-is-behind'),
  )
  assert.deepEqual(trackersOf(resolved).sort(), ['Physio:active', 'Vitamin C:archived'])
})

test('a current client replaces state wholesale, so an archive is never merged away', () => {
  const resolved = resolveIncomingState(
    rowWith([tracker()], 'server-v1'),
    incomingWith([tracker({ archivedAt: 5000 })], 'server-v1'),
  )
  assert.equal(resolved.stale, false)
  assert.deepEqual(trackersOf(resolved), ['Vitamin C:archived'])
})

test('an add from a stale client is kept alongside what the server already had', () => {
  const resolved = resolveIncomingState(
    rowWith([tracker()]),
    incomingWith([tracker(), tracker({ id: 't2', name: 'Physio', createdAt: 2000 })], 'client-is-behind'),
  )
  assert.deepEqual(trackersOf(resolved).sort(), ['Physio:active', 'Vitamin C:active'])
})
