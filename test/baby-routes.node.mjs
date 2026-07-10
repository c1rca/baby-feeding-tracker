import test from 'node:test'
import assert from 'node:assert/strict'
import { createBabyRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

function mountRouter(deps) {
  const app = createFakeApp()
  createBabyRouter(deps)(app)
  return app
}

test('baby list route returns only babies in the authenticated household', () => {
  const app = mountRouter({
    selectBabiesByHousehold: {
      all: (householdId) => [
        { id: 'baby-1', household_id: householdId, name: 'Avery', dob: '2026-01-01', archived_at: null },
      ],
    },
  })
  const res = createJsonResponse()

  app.route('GET', '/api/babies')({ auth: { householdId: 'household-1' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, {
    ok: true,
    babies: [{ id: 'baby-1', householdId: 'household-1', name: 'Avery', dob: '2026-01-01', archivedAt: null }],
  })
})

test('baby create route inserts a baby scoped to the authenticated household', () => {
  const calls = { inserts: [], events: [] }
  const app = mountRouter({
    insertBaby: { run: (payload) => calls.inserts.push(payload) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    idFactory: () => 'baby-new',
    now: () => new Date('2026-03-01T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/babies')({
    auth: { userId: 'user-1', householdId: 'household-1', role: 'caregiver' },
    body: { name: ' Riley ', dob: '2026-02-14' },
  }, res)

  assert.equal(res.statusCode, 201)
  assert.deepEqual(res.body, { ok: true, baby: { id: 'baby-new', householdId: 'household-1', name: 'Riley', dob: '2026-02-14', archivedAt: null } })
  assert.deepEqual(calls.inserts, [{
    id: 'baby-new',
    household_id: 'household-1',
    name: 'Riley',
    dob: '2026-02-14',
    archived_at: null,
    created_at: '2026-03-01T00:00:00.000Z',
  }])
  assert.deepEqual(calls.events, [{ event: 'baby_create', payload: { babyId: 'baby-new', householdId: 'household-1', userId: 'user-1' } }])
})

test('baby create route rejects invalid names and DOBs', () => {
  const calls = { inserts: 0 }
  const app = mountRouter({ insertBaby: { run: () => { calls.inserts += 1 } } })

  const badName = createJsonResponse()
  app.route('POST', '/api/babies')({ auth: { householdId: 'household-1' }, body: { name: '', dob: '2026-02-14' } }, badName)
  assert.equal(badName.statusCode, 400)
  assert.deepEqual(badName.body, { ok: false, error: 'Baby name is required' })

  const badDob = createJsonResponse()
  app.route('POST', '/api/babies')({ auth: { householdId: 'household-1' }, body: { name: 'Riley', dob: 'not-a-date' } }, badDob)
  assert.equal(badDob.statusCode, 400)
  assert.deepEqual(badDob.body, { ok: false, error: 'Baby date of birth must use YYYY-MM-DD' })
  assert.equal(calls.inserts, 0)
})

test('baby create route rejects viewer role without inserting', () => {
  const calls = { inserts: 0, events: 0 }
  const app = mountRouter({
    insertBaby: { run: () => { calls.inserts += 1 } },
    appendEventLog: () => { calls.events += 1 },
  })
  const res = createJsonResponse()

  app.route('POST', '/api/babies')({
    auth: { userId: 'viewer-1', householdId: 'household-1', role: 'viewer' },
    body: { name: 'Riley', dob: '2026-02-14' },
  }, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.body, { ok: false, error: 'Insufficient permissions' })
  assert.deepEqual(calls, { inserts: 0, events: 0 })
})

test('baby archive route archives only babies in the authenticated household', () => {
  const calls = { archives: [], events: [] }
  const app = mountRouter({
    archiveBaby: { run: (payload) => ({ changes: payload.id === 'baby-1' && payload.household_id === 'household-1' ? (calls.archives.push(payload), 1) : 0 }) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    now: () => new Date('2026-04-01T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('DELETE', '/api/babies/:id')({
    params: { id: 'baby-1' },
    auth: { userId: 'user-1', householdId: 'household-1' },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.deepEqual(calls.archives, [{ id: 'baby-1', household_id: 'household-1', archived_at: '2026-04-01T00:00:00.000Z' }])
  assert.deepEqual(calls.events, [{ event: 'baby_archive', payload: { babyId: 'baby-1', householdId: 'household-1', userId: 'user-1' } }])
})

test('baby archive route returns 404 for cross-household or missing babies', () => {
  const calls = { events: 0 }
  const app = mountRouter({
    archiveBaby: { run: () => ({ changes: 0 }) },
    appendEventLog: () => { calls.events += 1 },
  })
  const res = createJsonResponse()

  app.route('DELETE', '/api/babies/:id')({ params: { id: 'other-baby' }, auth: { householdId: 'household-1' } }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Baby not found' })
  assert.equal(calls.events, 0)
})

test('baby archive route rejects viewer role without archiving', () => {
  const calls = { archives: 0, events: 0 }
  const app = mountRouter({
    archiveBaby: { run: () => { calls.archives += 1; return { changes: 1 } } },
    appendEventLog: () => { calls.events += 1 },
  })
  const res = createJsonResponse()

  app.route('DELETE', '/api/babies/:id')({ params: { id: 'baby-1' }, auth: { householdId: 'household-1', role: 'viewer' } }, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.body, { ok: false, error: 'Insufficient permissions' })
  assert.deepEqual(calls, { archives: 0, events: 0 })
})
