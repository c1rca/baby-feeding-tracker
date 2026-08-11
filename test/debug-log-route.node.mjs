import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createDebugLogRouter } from '../server/apiRoutes.js'

const appWith = ({ forwardActionLog = null, role = 'owner' } = {}) => {
  const app = express()
  app.use(express.json({ limit: '64mb' }))
  app.use((req, _res, next) => { req.auth = { role, householdId: 'h1', babyId: 'b1' }; next() })
  createDebugLogRouter({ forwardActionLog })(app)
  return app
}

const post = async (app, body) => {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/debug-logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => null)
  server.close()
  return { status: response.status, json }
}

test('forwards each journalled failure to the backup log', async () => {
  const forwarded = []
  const app = appWith({ forwardActionLog: (record) => forwarded.push(record) })

  const { status, json } = await post(app, {
    entries: [
      { id: 1, at: '2026-07-28T10:00:00.000Z', reason: 'sync failed (503)', status: 503, babyId: 'b1', clientId: 'c1', counts: { entries: 12 }, payload: { entries: [{ id: 'e1' }] } },
      { id: 2, at: '2026-07-28T10:05:00.000Z', reason: 'offline', status: null, babyId: 'b1', clientId: 'c1', counts: { entries: 13 }, payload: { entries: [{ id: 'e1' }, { id: 'e2' }] } },
    ],
  })

  assert.equal(status, 200)
  assert.deepEqual(json.accepted, [1, 2])
  assert.equal(forwarded.length, 2)
  assert.equal(forwarded[0].action, 'client.send-failure')
  assert.equal(forwarded[0].httpStatus, 503)
  // The payload the client could not deliver has to survive intact — it is the
  // whole point of the journal.
  assert.deepEqual(forwarded[1].state, { entries: [{ id: 'e1' }, { id: 'e2' }] })
})

test('refuses when no backup log is configured, so the client keeps its journal', async () => {
  const app = appWith({ forwardActionLog: null })
  const { status, json } = await post(app, { entries: [{ id: 1, payload: {} }] })
  // Reporting success here would let the client delete records nothing stored.
  assert.equal(status, 503)
  assert.equal(json.ok, false)
})

test('rejects a malformed upload', async () => {
  const app = appWith({ forwardActionLog: () => {} })
  const { status } = await post(app, { entries: 'nope' })
  assert.equal(status, 400)
})

test('refuses an upload too large to be one batch', async () => {
  const app = appWith({ forwardActionLog: () => {} })
  const { status } = await post(app, { entries: Array.from({ length: 501 }, (_, i) => ({ id: i })) })
  assert.equal(status, 413)
})

test('a viewer cannot upload', async () => {
  const app = appWith({ forwardActionLog: () => {}, role: 'viewer' })
  const { status } = await post(app, { entries: [] })
  assert.equal(status, 403)
})

test('only entries with ids are reported accepted, so the rest stay on the device', async () => {
  const forwarded = []
  const app = appWith({ forwardActionLog: (record) => forwarded.push(record) })
  const { json } = await post(app, { entries: [{ id: 7, payload: {} }, { payload: {} }] })
  assert.deepEqual(json.accepted, [7])
  assert.equal(json.received, 2)
  assert.equal(forwarded.length, 2)
})

test('stores a diagnostics bundle even when the journal is empty', async () => {
  const forwarded = []
  const app = appWith({ forwardActionLog: (record) => forwarded.push(record) })

  const diagnostics = {
    at: '2026-07-29T02:00:00.000Z',
    clientId: 'c9',
    babyId: 'b1',
    app: { url: 'https://example.test/', userAgent: 'test', language: 'en', online: true, standalone: false },
    sync: { pendingSyncRaw: null, pendingSyncBaby: null },
    localState: { 'baby-feeding-tracker:v1:entries': [{ id: 'e1' }, { id: 'e2' }] },
    localStateKeys: ['baby-feeding-tracker:v1:entries'],
    errors: [{ at: '2026-07-29T01:59:00.000Z', kind: 'console', message: 'boom' }],
  }
  const { status, json } = await post(app, { entries: [], diagnostics })

  assert.equal(status, 200)
  assert.equal(json.diagnostics, true)
  const record = forwarded.find((entry) => entry.action === 'client.diagnostics')
  assert.ok(record, 'no diagnostics record was forwarded')
  // The local record has to arrive whole — this is what a missing entry would
  // be reconstructed from.
  assert.deepEqual(record.state['baby-feeding-tracker:v1:entries'], [{ id: 'e1' }, { id: 'e2' }])
  assert.equal(record.diagnostics.errors.length, 1)
  assert.equal(record.counts.errors, 1)
})

test('accepts a bundle with no entries key at all', async () => {
  const app = appWith({ forwardActionLog: () => {} })
  const { status } = await post(app, { diagnostics: { at: '2026-07-29T02:00:00.000Z', localState: {} } })
  assert.equal(status, 200)
})

test('still rejects a request carrying neither entries nor diagnostics', async () => {
  const app = appWith({ forwardActionLog: () => {} })
  const { status } = await post(app, {})
  assert.equal(status, 400)
})
