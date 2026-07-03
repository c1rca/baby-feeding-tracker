import test from 'node:test'
import assert from 'node:assert/strict'
import { appendStartupStateSnapshot } from '../server/startup.js'

test('startup snapshot logs reconstructable state and redacts parse failures', () => {
  const events = []
  appendStartupStateSnapshot({
    selectState: {
      get: () => ({
        entries_json: '[{"id":"feed-1"}]',
        diapers_json: '[{"id":"diaper-1"}]',
        medicines_json: '[{"id":"med-1"}]',
        growth_measurements_json: '[{"id":"growth-1"}]',
        baby_dob: '2026-06-04',
        tummy_times_json: '[{"id":"tummy-1"}]',
        tummy_session_json: '{"startedAt":2}',
        session_json: '{"startedAt":1}',
        theme: 'dark',
      }),
    },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: (entries, session, theme, diapers, medicines, growthMeasurements, babyDob, tummyTimes, tummySession) => ({
      entryCount: entries.length,
      diaperCount: diapers.length,
      medicineCount: medicines.length,
      growthMeasurementCount: growthMeasurements.length,
      babyDob,
      tummyTimeCount: tummyTimes.length,
      hasTummySession: Boolean(tummySession),
      hasSession: Boolean(session),
      theme,
    }),
    redactError: (error) => ({ name: error.name }),
  })

  assert.equal(events[0].event, 'startup_state_snapshot')
  assert.equal(events[0].payload.entryCount, 1)
  assert.deepEqual(events[0].payload.entries, [{ id: 'feed-1' }])
  assert.deepEqual(events[0].payload.tummyTimes, [{ id: 'tummy-1' }])
  assert.deepEqual(events[0].payload.tummySession, { startedAt: 2 })
  assert.equal(events[0].payload.tummyTimeCount, 1)
  assert.equal(events[0].payload.hasTummySession, true)
  assert.deepEqual(events[0].payload.growthMeasurements, [{ id: 'growth-1' }])
  assert.equal(events[0].payload.babyDob, '2026-06-04')

  appendStartupStateSnapshot({
    selectState: { get: () => ({ entries_json: 'not-json' }) },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: () => ({}),
    redactError: (error) => ({ name: error.name }),
  })

  assert.equal(events[1].event, 'startup_state_snapshot_failed')
  assert.equal(events[1].payload.error.name, 'SyntaxError')
})
