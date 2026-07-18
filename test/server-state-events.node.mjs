import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateEventHub, sendStateEvent } from '../server/stateEvents.js'

test('sendStateEvent writes Server-Sent Event framing with JSON payloads', () => {
  const writes = []
  sendStateEvent({ write: (chunk) => writes.push(chunk) }, 'state', { ok: true })

  assert.deepEqual(writes, ['event: state\n', 'data: {"ok":true}\n\n'])
})

test('state event hub scopes initial and broadcast states to the subscribed household baby', () => {
  const household1Writes = []
  const household2Writes = []
  const makeResponse = (writes) => ({ set() {}, flushHeaders() {}, write: (chunk) => writes.push(chunk), end: () => {} })
  const makeRequest = (auth) => ({ auth, on: (event, handler) => { if (event === 'close') closeHandlers.push(handler) } })
  const closeHandlers = []
  const hub = createStateEventHub({
    selectState: { get: () => ({ household_id: 'default-household', baby_id: 'default-baby', theme: 'legacy' }) },
    selectStateForBaby: { get: (householdId, babyId) => ({ household_id: householdId, baby_id: babyId, theme: `${householdId}:${babyId}` }) },
    serializeState: (row) => ({ theme: row.theme }),
  })

  hub.handleStateEvents(makeRequest({ householdId: 'household-1', babyId: 'baby-1' }), makeResponse(household1Writes))
  hub.handleStateEvents(makeRequest({ householdId: 'household-2', babyId: 'baby-2' }), makeResponse(household2Writes))
  hub.broadcastStateChange({ theme: 'household-1 update' }, { householdId: 'household-1', babyId: 'baby-1' })

  assert.equal(household1Writes[1], 'data: {"theme":"household-1:baby-1"}\n\n')
  assert.equal(household2Writes[1], 'data: {"theme":"household-2:baby-2"}\n\n')
  assert.equal(household1Writes.some((chunk) => chunk.includes('household-1 update')), true)
  assert.equal(household2Writes.some((chunk) => chunk.includes('household-1 update')), false)
  closeHandlers.forEach((handler) => handler())
})

test('state event hub sends initial state, broadcasts updates, and removes closed clients', () => {
  const writes = []
  let closeHandler
  const response = {
    set(headers) {
      assert.equal(headers['Content-Type'], 'text/event-stream')
      assert.equal(headers['Cache-Control'], 'no-cache')
      assert.equal(headers.Connection, 'keep-alive')
      // Disables reverse-proxy (nginx/OpenResty) buffering so live frames stream.
      assert.equal(headers['X-Accel-Buffering'], 'no')
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

test('broadcastStateChange tags the origin so the writing client can ignore its own echo', () => {
  const writes = []
  const closeHandlers = []
  const response = { set() {}, flushHeaders() {}, write: (chunk) => writes.push(chunk), end: () => {} }
  const request = { on: (event, handler) => { if (event === 'close') closeHandlers.push(handler) } }
  const hub = createStateEventHub({ selectState: { get: () => ({ theme: 'x' }) }, serializeState: (row) => ({ theme: row.theme }) })

  hub.handleStateEvents(request, response)
  hub.broadcastStateChange({ updatedAt: 'next' }, null, 'client-abc')
  hub.broadcastStateChange({ updatedAt: 'plain' }, null, null)

  assert.equal(writes.some((chunk) => chunk.includes('"origin":"client-abc"')), true)
  // A broadcast without an origin must not inject an origin key.
  assert.equal(writes.some((chunk) => chunk.includes('plain') && chunk.includes('"origin":')), false)
  closeHandlers.forEach((handler) => handler())
})

test('state event hub scopes by the babyId query param when auth carries no baby (EventSource cannot send headers)', () => {
  const babyAWrites = []
  const babyBWrites = []
  const closeHandlers = []
  const makeResponse = (writes) => ({ set() {}, flushHeaders() {}, write: (chunk) => writes.push(chunk), end: () => {} })
  const makeRequest = (query) => ({ query, on: (event, handler) => { if (event === 'close') closeHandlers.push(handler) } })
  const hub = createStateEventHub({
    selectState: { get: () => ({}) },
    selectStateForBaby: { get: (householdId, babyId) => ({ theme: `${householdId}:${babyId}` }) },
    serializeState: (row) => ({ theme: row.theme }),
  })

  hub.handleStateEvents(makeRequest({ babyId: 'baby-A' }), makeResponse(babyAWrites))
  hub.handleStateEvents(makeRequest({ babyId: 'baby-B' }), makeResponse(babyBWrites))
  hub.broadcastStateChange({ theme: 'A only' }, { householdId: 'default-household', babyId: 'baby-A' })

  assert.equal(babyAWrites[1], 'data: {"theme":"default-household:baby-A"}\n\n')
  assert.equal(babyBWrites[1], 'data: {"theme":"default-household:baby-B"}\n\n')
  assert.equal(babyAWrites.some((chunk) => chunk.includes('A only')), true)
  assert.equal(babyBWrites.some((chunk) => chunk.includes('A only')), false)
  closeHandlers.forEach((handler) => handler())
})

test('state event hub rejects a babyId query param that does not belong to the household', () => {
  const hub = createStateEventHub({
    selectState: { get: () => ({}) },
    selectStateForBaby: { get: () => ({ theme: 'scoped' }) },
    serializeState: (row) => ({ theme: row.theme }),
    selectBabyForHousehold: { get: (babyId, householdId) => babyId === 'baby-mine' && householdId === 'household-1' },
  })
  let status = null
  let body = null
  const res = { status(code) { status = code; return this }, json(payload) { body = payload }, set() {}, flushHeaders() {}, write() {}, end() {} }
  const req = { auth: { householdId: 'household-1', userId: 'user-1' }, query: { babyId: 'baby-foreign' }, on() {} }

  hub.handleStateEvents(req, res)

  assert.equal(status, 404)
  assert.deepEqual(body, { ok: false, error: 'Baby not found' })
})

test('state event hub caps concurrent streams per user, evicting the oldest', () => {
  const ended = []
  const closeHandlers = []
  const makeReq = (userId) => ({ auth: { householdId: 'household-1', userId }, query: {}, on: (event, handler) => { if (event === 'close') closeHandlers.push(handler) } })
  const makeRes = (id) => ({ set() {}, flushHeaders() {}, write() {}, end() { ended.push(id) } })
  const hub = createStateEventHub({
    selectState: { get: () => ({}) },
    selectStateForBaby: { get: () => ({}) },
    serializeState: () => ({}),
    maxClientsPerUser: 2,
  })

  hub.handleStateEvents(makeReq('user-1'), makeRes('first'))
  hub.handleStateEvents(makeReq('user-1'), makeRes('second'))
  assert.deepEqual(ended, [])
  // The third connection for the same user evicts the oldest (first).
  hub.handleStateEvents(makeReq('user-1'), makeRes('third'))
  assert.deepEqual(ended, ['first'])
  // A different user is unaffected by user-1's cap.
  hub.handleStateEvents(makeReq('user-2'), makeRes('other'))
  assert.deepEqual(ended, ['first'])
  closeHandlers.forEach((handler) => handler())
})
