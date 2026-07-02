import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

test('state route delegates state and tombstone writes to one atomic persistence function', () => {
  const app = createFakeApp()
  const calls = { persisted: [], upserts: 0, deleted: 0 }
  createStateRouter({
    selectState: { get: () => ({ entries_json: JSON.stringify([{ id: 'old-feed' }]), diapers_json: '[]', medicines_json: '[]', tummy_times_json: '[]', growth_measurements_json: '[]', updated_at: 'server-old' }) },
    upsertState: { run: () => { calls.upserts += 1 } },
    serializeState: () => ({ entries: [] }),
    resolveIncomingState: (_row, incoming) => ({ ...incoming, stale: false }),
    deletedItemOptions: () => ({}),
    buildStateAudit: () => ({ entries: { removed: [{ id: 'old-feed' }] } }),
    recordDeletedItems: () => { calls.deleted += 1 },
    writeStateAndDeletedItems: (statePayload, audit, updatedAt) => calls.persisted.push({ statePayload, audit, updatedAt }),
    appendEventLog: () => {},
    summarizeState: () => ({}),
    notificationScheduler: { evaluate: () => {} },
    broadcastStateChange: () => {},
    handleStateEvents: () => {},
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({ body: { entries: [], diapers: [], medicines: [], tummyTimes: [], growthMeasurements: [], session: null, theme: 'light' } }, res)

  assert.equal(calls.persisted.length, 1)
  assert.equal(calls.persisted[0].statePayload.entries_json, '[]')
  assert.equal(calls.persisted[0].audit.entries.removed[0].id, 'old-feed')
  assert.ok(calls.persisted[0].updatedAt)
  assert.equal(calls.upserts, 0)
  assert.equal(calls.deleted, 0)
})
