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
    broadcastStateChange: (payload, scope) => calls.broadcasts.push({ payload, scope }),
    handleStateEvents: () => {},
    selectBabyForHousehold: { get: (babyId, householdId) => ({ id: babyId, household_id: householdId }) },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-2', babyId: 'baby-2' },
    body: { entries: [], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'client-old' },
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
  // Privacy: the event carries only the summary, never the full record arrays.
  assert.equal(calls.events[1].payload.entries, undefined)
  assert.equal(calls.events[1].payload.diapers, undefined)
  assert.equal(calls.events[1].payload.medicines, undefined)
  assert.equal(calls.events[1].payload.session, undefined)
  assert.equal(calls.evaluations, 1)
  assert.deepEqual(calls.broadcasts, [{ payload: res.body.state, scope: { householdId: 'household-2', babyId: 'baby-2' } }])
  assert.equal(res.body.ok, true)
  assert.equal(res.body.staleWriteMerged, true)
})

test('state route rejects writes for babies outside the authenticated household', () => {
  const app = createFakeApp()
  const calls = { upserts: 0, events: 0, evaluations: 0, broadcasts: 0 }
  createStateRouter({
    selectState: { get: () => ({ household_id: 'household-1', baby_id: 'baby-1', updated_at: 'server-old' }) },
    upsertState: { run: () => { calls.upserts += 1 } },
    serializeState: () => ({ entries: [] }),
    resolveIncomingState: () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], growthMeasurements: [], session: null, tummySession: null, tummyGoalMinutes: 20, babyDob: '2026-06-03', theme: 'light', stale: false }),
    deletedItemOptions: () => ({}),
    buildStateAudit: () => ({}),
    recordDeletedItems: () => {},
    appendEventLog: () => { calls.events += 1 },
    summarizeState: () => ({}),
    notificationScheduler: { evaluate: () => { calls.evaluations += 1 } },
    broadcastStateChange: () => { calls.broadcasts += 1 },
    handleStateEvents: () => {},
    selectBabyForHousehold: { get: () => null },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-1', babyId: 'other-baby' },
    body: { entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-old' },
  }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Baby not found' })
  assert.deepEqual(calls, { upserts: 0, events: 0, evaluations: 0, broadcasts: 0 })
})

test('state route rejects viewer writes before resolving or persisting state', () => {
  const app = createFakeApp()
  const calls = { resolved: 0, upserts: 0, events: 0, evaluations: 0, broadcasts: 0 }
  createStateRouter({
    selectState: { get: () => ({ household_id: 'household-1', baby_id: 'baby-1', updated_at: 'server-old' }) },
    upsertState: { run: () => { calls.upserts += 1 } },
    serializeState: () => ({ entries: [] }),
    resolveIncomingState: () => { calls.resolved += 1; return {} },
    deletedItemOptions: () => ({}),
    buildStateAudit: () => ({}),
    recordDeletedItems: () => {},
    appendEventLog: () => { calls.events += 1 },
    summarizeState: () => ({}),
    notificationScheduler: { evaluate: () => { calls.evaluations += 1 } },
    broadcastStateChange: () => { calls.broadcasts += 1 },
    handleStateEvents: () => {},
    selectBabyForHousehold: { get: () => ({ id: 'baby-1', household_id: 'household-1' }) },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-1', babyId: 'baby-1', role: 'viewer' },
    body: { entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-old' },
  }, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.body, { ok: false, error: 'Insufficient permissions' })
  assert.deepEqual(calls, { resolved: 0, upserts: 0, events: 0, evaluations: 0, broadcasts: 0 })
})
