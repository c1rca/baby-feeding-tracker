import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateEventHub, sendStateEvent } from '../server/stateEvents.js'

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
  const hub = createStateEventHub({
    selectState: { get: () => ({ entries_json: '[]', theme: 'dark' }) },
    serializeState: (row) => ({ theme: row.theme }),
  })

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
