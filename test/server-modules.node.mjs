import test from 'node:test'
import assert from 'node:assert/strict'
import { createHealthRouter, createNotificationSettingsRouter, createStateRouter } from '../server/apiRoutes.js'
import { createStateEventHub, sendStateEvent } from '../server/stateEvents.js'
import { appendStartupStateSnapshot } from '../server/startup.js'

const createFakeApp = () => {
  const routes = new Map()
  return {
    get(path, handler) {
      routes.set(`GET ${path}`, handler)
    },
    put(path, handler) {
      routes.set(`PUT ${path}`, handler)
    },
    route(method, path) {
      const handler = routes.get(`${method} ${path}`)
      assert.equal(typeof handler, 'function', `${method} ${path} was not registered`)
      return handler
    },
  }
}

const createJsonResponse = () => {
  const response = {
    headers: new Map(),
    body: undefined,
    set(key, value) {
      if (typeof key === 'object') {
        for (const [header, headerValue] of Object.entries(key)) response.headers.set(header, headerValue)
      } else {
        response.headers.set(key, value)
      }
    },
    json(payload) {
      response.body = payload
    },
  }
  return response
}

test('sendStateEvent writes Server-Sent Event framing with JSON payloads', () => {
  const writes = []
  sendStateEvent({ write: (chunk) => writes.push(chunk) }, 'state', { ok: true })

  assert.deepEqual(writes, ['event: state\n', 'data: {"ok":true}\n\n'])
})

test('state event hub sends initial state, broadcasts updates, and removes closed clients', () => {
  const writes = []
  let closeHandler
  const response = {
    set(headers) {
      assert.equal(headers['Content-Type'], 'text/event-stream')
      assert.equal(headers['Cache-Control'], 'no-cache')
      assert.equal(headers.Connection, 'keep-alive')
    },
    flushHeaders() {},
    write: (chunk) => writes.push(chunk),
    end: () => writes.push('ended'),
  }
  const request = { on: (event, handler) => { if (event === 'close') closeHandler = handler } }
  const hub = createStateEventHub({ selectState: { get: () => ({ entries_json: '[]', theme: 'dark' }) }, serializeState: (row) => ({ theme: row.theme }) })

  hub.handleStateEvents(request, response)
  hub.broadcastStateChange({ updatedAt: 'next' })
  closeHandler()
  hub.broadcastStateChange({ updatedAt: 'after-close' })

  assert.equal(writes[0], 'event: state\n')
  assert.equal(writes[1], 'data: {"theme":"dark"}\n\n')
  assert.equal(writes[2], 'event: state\n')
  assert.equal(writes[3], 'data: {"updatedAt":"next"}\n\n')
  assert.equal(writes.at(-1), 'ended')
  assert.equal(writes.some((chunk) => chunk.includes('after-close')), false)
})

test('health route reports runtime availability and current reminder enablement', () => {
  const app = createFakeApp()
  createHealthRouter({
    config: { dbPath: '/data/app.db', notificationChannelsAvailable: true, gotifyAvailable: true, textEmailAvailable: false },
    getGotifyRemindersEnabled: () => true,
  })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/health')({}, res)

  assert.deepEqual(res.body, {
    ok: true,
    dbPath: '/data/app.db',
    notificationsAvailable: true,
    gotifyAvailable: true,
    textEmailAvailable: false,
    gotifyRemindersEnabled: true,
  })
})

test('notification settings route clamps disabled channels and persists the resulting setting', () => {
  const app = createFakeApp()
  let enabled = true
  const writes = []
  const events = []
  const schedulerCalls = []
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: false },
    getGotifyRemindersEnabled: () => enabled,
    setGotifyRemindersEnabled: (value) => { enabled = value },
    writeBooleanSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: (value) => schedulerCalls.push(value) },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ body: { gotifyRemindersEnabled: true } }, res)

  assert.equal(enabled, false)
  assert.deepEqual(writes, [{ key: 'gotify_reminders_enabled', value: false }])
  assert.deepEqual(schedulerCalls, [false])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'gotify_reminders_enabled', value: '0' } }])
  assert.deepEqual(res.body, { ok: true, available: false, gotifyRemindersEnabled: false })
})

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
      return { entries: [{ id: 'feed-1' }], diapers: [{ id: 'diaper-1' }], medicines: [{ id: 'med-1' }], session: null, theme: 'dark', stale: true }
    },
    deletedItemOptions: () => ({ deleted: true }),
    buildStateAudit: (_row, state, meta) => ({ state, meta }),
    recordDeletedItems: (audit, updatedAt) => calls.audits.push({ audit, updatedAt }),
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    summarizeState: (entries, session, theme, diapers, medicines) => ({ entryCount: entries.length, diaperCount: diapers.length, medicineCount: medicines.length, hasSession: Boolean(session), theme }),
    notificationScheduler: { evaluate: () => { calls.evaluations += 1 } },
    broadcastStateChange: (payload) => calls.broadcasts.push(payload),
    handleStateEvents: () => {},
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/state')({ body: { entries: 'bad', diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'client-old' } }, res)

  assert.equal(calls.upserts.length, 1)
  assert.equal(calls.upserts[0].entries_json, '[{"id":"feed-1"}]')
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

test('startup snapshot logs reconstructable state and redacts parse failures', () => {
  const events = []
  appendStartupStateSnapshot({
    selectState: { get: () => ({ entries_json: '[{"id":"feed-1"}]', diapers_json: '[{"id":"diaper-1"}]', medicines_json: '[{"id":"med-1"}]', session_json: '{"startedAt":1}', theme: 'dark' }) },
    appendEventLog: (event, payload) => events.push({ event, payload }),
    summarizeState: (entries, session, theme, diapers, medicines) => ({ entryCount: entries.length, diaperCount: diapers.length, medicineCount: medicines.length, hasSession: Boolean(session), theme }),
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
