import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

test('state route writes resolved canonical state, audit/event logs it, evaluates reminders, and broadcasts response state', () => {
  const app = createFakeApp()
  const calls = { upserts: [], audits: [], events: [], broadcasts: [], evaluations: 0 }
  const existingRow = { updated_at: 'server-old' }
  createStateRouter({
    selectState: { get: () => existingRow },
    upsertState: { run: (payload) => calls.upserts.push(payload) },
    serializeState: () => ({ entries: [] }),
    resolveIncomingState: (row, incoming, deletedOptions) => {
      assert.equal(row, existingRow)
      assert.deepEqual(deletedOptions, { deleted: true })
      assert.equal(incoming.theme, 'dark')
      return {
        entries: [{ id: 'feed-1' }],
        diapers: [{ id: 'diaper-1' }],
        medicines: [{ id: 'med-1' }],
        session: null,
        theme: 'dark',
        stale: true,
      }
    },
    deletedItemOptions: () => ({ deleted: true }),
    buildStateAudit: (_row, state, meta) => ({ state, meta }),
    recordDeletedItems: (audit, updatedAt) => calls.audits.push({ audit, updatedAt }),
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    summarizeState: (entries, session, theme, diapers, medicines) => ({
      entryCount: entries.length,
      diaperCount: diapers.length,
      medicineCount: medicines.length,
      hasSession: Boolean(session),
      theme,
    }),
    notificationScheduler: { evaluate: () => { calls.evaluations += 1 } },
    broadcastStateChange: (payload) => calls.broadcasts.push(payload),
    handleStateEvents: () => {},
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-2', babyId: 'baby-2' },
    body: { entries: 'bad', diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'client-old' },
  }, res)

  assert.equal(calls.upserts.length, 1)
  assert.equal(calls.upserts[0].entries_json, '[{"id":"feed-1"}]')
  assert.equal(calls.upserts[0].household_id, 'household-2')
  assert.equal(calls.upserts[0].baby_id, 'baby-2')
  assert.equal(calls.upserts[0].session_json, null)
  assert.equal(calls.upserts[0].theme, 'dark')
  assert.equal(calls.audits.length, 1)
  assert.equal(calls.events[0].event, 'state_write_audit')
  assert.equal(calls.events[1].event, 'state_replace')
  assert.equal(calls.events[1].payload.staleWriteMerged, true)
  assert.equal(calls.evaluations, 1)
  assert.deepEqual(calls.broadcasts, [res.body.state])
  assert.equal(res.body.ok, true)
  assert.equal(res.body.staleWriteMerged, true)
})
