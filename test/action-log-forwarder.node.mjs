import test from 'node:test'
import assert from 'node:assert/strict'
import { createActionLogForwarder } from '../server/actionLogForwarder.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

test('does nothing at all when no URL is configured', async () => {
  const forwarder = createActionLogForwarder({ url: '', fetchImpl: () => { throw new Error('must not be called') } })
  assert.equal(forwarder.enabled, false)
  forwarder.forward({ action: 'state.write' })
  await settle()
  assert.equal(forwarder.pending(), 0)
})

test('posts an accepted write to the log endpoint', async () => {
  const calls = []
  const forwarder = createActionLogForwarder({
    url: 'http://log.test:8099',
    fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 } },
  })

  forwarder.forward({ action: 'state.write', babyId: 'b1', state: { entries: [{ id: 'e1' }] } })
  await settle()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://log.test:8099/log')
  assert.equal(calls[0].body.actions[0].action, 'state.write')
  assert.deepEqual(calls[0].body.actions[0].state, { entries: [{ id: 'e1' }] })
})

// The whole point of forwarding server-side is that it is invisible to the
// caregiver. A log server that is down, slow, or returning 500 must never
// surface as a failed or delayed care write.
test('a dead log server neither throws nor blocks the caller', async () => {
  const forwarder = createActionLogForwarder({
    url: 'http://log.test:8099',
    fetchImpl: async () => { throw new Error('ECONNREFUSED') },
  })

  const started = Date.now()
  assert.doesNotThrow(() => forwarder.forward({ action: 'state.write', state: {} }))
  assert.ok(Date.now() - started < 50, 'forward must return immediately')
  await settle()
  // The record is retained for a later retry rather than discarded.
  assert.equal(forwarder.pending(), 1)
})

test('a non-ok response keeps the record queued for retry', async () => {
  const forwarder = createActionLogForwarder({
    url: 'http://log.test:8099',
    fetchImpl: async () => ({ ok: false, status: 500 }),
  })
  forwarder.forward({ action: 'state.write', state: {} })
  await settle()
  assert.equal(forwarder.pending(), 1)
})

test('the queue is bounded, dropping oldest first', async () => {
  const forwarder = createActionLogForwarder({
    url: 'http://log.test:8099',
    fetchImpl: async () => { throw new Error('down') },
  })
  for (let i = 0; i < 260; i += 1) forwarder.forward({ action: 'state.write', seq: i, state: {} })
  await settle()
  // Bounded, and safe to bound: every record is a full snapshot, so whatever
  // survives supersedes whatever was dropped.
  assert.ok(forwarder.pending() <= 200, `queue grew to ${forwarder.pending()}`)
})

test('drains the backlog once the log server comes back', async () => {
  let up = false
  const delivered = []
  const forwarder = createActionLogForwarder({
    url: 'http://log.test:8099',
    fetchImpl: async (_url, init) => {
      if (!up) throw new Error('down')
      delivered.push(...JSON.parse(init.body).actions)
      return { ok: true, status: 200 }
    },
  })

  forwarder.forward({ action: 'state.write', seq: 1, state: {} })
  await settle()
  assert.equal(forwarder.pending(), 1)

  up = true
  forwarder.forward({ action: 'state.write', seq: 2, state: {} })
  await settle()
  await settle()

  assert.equal(forwarder.pending(), 0)
  assert.deepEqual(delivered.map((r) => r.seq), [1, 2], 'the earlier record is not lost')
})
