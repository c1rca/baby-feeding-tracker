import test from 'node:test'
import assert from 'node:assert/strict'
import { createAiCareAssistantRouter } from '../server/aiCareAssistant.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

const auth = { userId: 'parent-1', householdId: 'house-a', babyId: 'baby-a', role: 'caregiver' }
const state = {
  entries: [
    { id: 'feed-1', endedAt: 1_700_000_000_000, startTime: 1_699_999_400_000, amount: 4, unit: 'oz', type: 'bottle', note: 'kept out' },
    { id: 'feed-2', endedAt: 1_699_000_000_000, amount: 3, unit: 'oz', type: 'bottle' },
  ],
  diapers: [{ id: 'diaper-1', timestamp: 1_700_000_000_000, kinds: ['wet'] }],
  medicines: [],
  tummyTimes: [],
  pumpEvents: [],
  growthMeasurements: [],
  healthRecords: [],
}

const setup = ({ apiKey = 'test-key', fetchImpl = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Two bottle feeds are recorded.' } }] }), { status: 200 }) } = {}) => {
  const app = createFakeApp()
  const reads = []
  createAiCareAssistantRouter({ apiKey, selectStateForBaby: { get: (householdId, babyId) => { reads.push({ householdId, babyId }); return { state_json: JSON.stringify(state) } } }, fetchImpl })(app)
  return { app, reads }
}

test('AI care assistant scopes a compact data request to the authenticated household and baby', async () => {
  let request
  const { app, reads } = setup({ fetchImpl: async (_url, init) => {
    request = JSON.parse(init.body)
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Two bottle feeds are recorded.' } }] }), { status: 200 })
  } })
  const res = createJsonResponse()

  await app.route('POST', '/api/ai-care-assistant')({ auth, body: { question: 'How many bottles are logged?', model: 'gpt-4o-mini' } }, res)

  assert.deepEqual(reads, [{ householdId: 'house-a', babyId: 'baby-a' }])
  assert.equal(request.model, 'gpt-4o-mini')
  assert.equal(request.max_tokens, 350)
  assert.match(request.messages[0].content, /informational tracker-data support/i)
  const context = request.messages[1].content
  assert.match(context, /How many bottles are logged\?/)
  assert.match(context, /feed-1/)
  assert.doesNotMatch(context, /kept out/)

  assert.deepEqual(res.body, { ok: true, answer: 'Two bottle feeds are recorded.', model: 'gpt-4o-mini' })
})

test('AI care assistant rejects untrusted models and invalid questions before reading data', async () => {
  const { app, reads } = setup()
  for (const body of [{ question: '', model: 'gpt-4o-mini' }, { question: 'x'.repeat(1001), model: 'gpt-4o-mini' }, { question: 'Hello', model: 'gpt-4o' }, { question: 'Hello', model: 'gpt-4o-mini', apiKey: 'browser-secret' }]) {
    const res = createJsonResponse()
    await app.route('POST', '/api/ai-care-assistant')({ auth, body }, res)
    assert.equal(res.statusCode, 400)
  }
  assert.deepEqual(reads, [])
})

test('AI care assistant returns a friendly configuration error without calling OpenAI', async () => {
  let called = false
  const { app } = setup({ apiKey: '', fetchImpl: async () => { called = true; throw new Error('unexpected') } })
  const res = createJsonResponse()

  await app.route('POST', '/api/ai-care-assistant')({ auth, body: { question: 'What was logged?', model: 'gpt-4o-mini' } }, res)

  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { ok: false, error: 'The AI assistant is not configured yet. Please ask your administrator to add OPENAI_API_KEY.' })
  assert.equal(called, false)
})

test('AI care assistant rejects requests without a resolved household and baby scope', async () => {
  const { app, reads } = setup()
  const res = createJsonResponse()
  await app.route('POST', '/api/ai-care-assistant')({ auth: { userId: 'parent-1', role: 'caregiver' }, body: { question: 'What was logged?', model: 'gpt-4o-mini' } }, res)
  assert.equal(res.statusCode, 403)
  assert.deepEqual(reads, [])
})
