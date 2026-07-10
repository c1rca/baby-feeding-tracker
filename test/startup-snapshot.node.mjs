import test from 'node:test'
import assert from 'node:assert/strict'
import { appendStartupStateSnapshot } from '../server/startup.js'

test('startup snapshot emits one scoped event per baby_state row and ignores legacy app_state when scoped rows exist', () => {
  const events = []
  const scopedRows = [
    { household_id: 'household-a', baby_id: 'baby-a', entries_json: JSON.stringify([{ id: 'feed-a' }]), diapers_json: '[]', medicines_json: '[]', growth_measurements_json: '[]', tummy_times_json: '[]', session_json: null, tummy_session_json: null, baby_dob: '2026-06-01', theme: 'light' },
    { household_id: 'household-b', baby_id: 'baby-b', entries_json: JSON.stringify([{ id: 'feed-b' }]), diapers_json: '[]', medicines_json: '[]', growth_measurements_json: '[]', tummy_times_json: '[]', session_json: null, tummy_session_json: null, baby_dob: '2026-06-02', theme: 'dark' },
  ]

  appendStartupStateSnapshot({
    selectState: { get: () => ({ household_id: 'legacy', baby_id: 'legacy', entries_json: JSON.stringify([{ id: 'legacy-feed' }]) }) },
    selectAllStates: { all: () => scopedRows },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: (entries, session, theme) => ({ entryCount: entries.length, theme, hasSession: Boolean(session) }),
    redactError: (error) => ({ message: error.message }),
  })

  assert.deepEqual(events.map((event) => event.event), ['startup_state_snapshot', 'startup_state_snapshot'])
  assert.deepEqual(events.map((event) => [event.payload.householdId, event.payload.babyId, event.payload.entryCount, event.payload.theme]), [
    ['household-a', 'baby-a', 1, 'light'],
    ['household-b', 'baby-b', 1, 'dark'],
  ])
  assert.deepEqual(events.flatMap((event) => event.payload.entries.map((entry) => entry.id)), ['feed-a', 'feed-b'])
})

test('startup snapshot falls back to legacy app_state when no scoped baby_state rows exist', () => {
  const events = []

  appendStartupStateSnapshot({
    selectState: { get: () => ({ entries_json: JSON.stringify([{ id: 'legacy-feed' }]), diapers_json: '[]', medicines_json: '[]', growth_measurements_json: '[]', tummy_times_json: '[]', theme: 'light' }) },
    selectAllStates: { all: () => [] },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: (entries) => ({ entryCount: entries.length }),
    redactError: (error) => ({ message: error.message }),
  })

  assert.equal(events.length, 1)
  assert.equal(events[0].payload.entryCount, 1)
  assert.equal(events[0].payload.entries[0].id, 'legacy-feed')
})
