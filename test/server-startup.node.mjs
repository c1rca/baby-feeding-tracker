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
        session_json: '{"startedAt":1}',
        theme: 'dark',
      }),
    },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: (entries, session, theme, diapers, medicines) => ({
      entryCount: entries.length,
      diaperCount: diapers.length,
      medicineCount: medicines.length,
      hasSession: Boolean(session),
      theme,
    }),
    redactError: (error) => ({ name: error.name }),
  })

  assert.equal(events[0].event, 'startup_state_snapshot')
  assert.equal(events[0].payload.entryCount, 1)
  assert.deepEqual(events[0].payload.entries, [{ id: 'feed-1' }])

  appendStartupStateSnapshot({
    selectState: { get: () => ({ entries_json: 'not-json' }) },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: () => ({}),
    redactError: (error) => ({ name: error.name }),
  })

  assert.equal(events[1].event, 'startup_state_snapshot_failed')
  assert.equal(events[1].payload.error.name, 'SyntaxError')
})
