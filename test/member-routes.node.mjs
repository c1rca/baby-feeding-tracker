import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemberRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

const ownerAuth = (overrides = {}) => ({ userId: 'owner-1', householdId: 'household-1', babyId: 'baby-1', role: 'owner', mode: 'session', ...overrides })
const caregiverAuth = (overrides = {}) => ownerAuth({ userId: 'caregiver-1', role: 'caregiver', ...overrides })

function mountRouter(deps) {
  const app = createFakeApp()
  createMemberRouter(deps)(app)
  return app
}

test('member list returns only current household members with safe user fields', () => {
  const app = mountRouter({
    selectMembersByHousehold: { all: (householdId) => householdId === 'household-1' ? [
      { user_id: 'owner-1', email: 'owner@example.com', display_name: 'Owner', role: 'owner', created_at: '2026-07-01T00:00:00.000Z' },
      { user_id: 'caregiver-1', email: 'care@example.com', display_name: 'Care', role: 'caregiver', created_at: '2026-07-02T00:00:00.000Z' },
    ] : [] },
  })
  const res = createJsonResponse()

  app.route('GET', '/api/household-members')({ auth: ownerAuth() }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.members, [
    { userId: 'owner-1', email: 'owner@example.com', displayName: 'Owner', role: 'owner', createdAt: '2026-07-01T00:00:00.000Z' },
    { userId: 'caregiver-1', email: 'care@example.com', displayName: 'Care', role: 'caregiver', createdAt: '2026-07-02T00:00:00.000Z' },
  ])
})

test('owner updates a household member role but cannot assign owner through role edit', () => {
  const calls = { updates: [], events: [] }
  const app = mountRouter({
    updateMemberRole: { run: (payload) => { calls.updates.push(payload); return { changes: payload.user_id === 'caregiver-1' ? 1 : 0 } } },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
  })

  const updated = createJsonResponse()
  app.route('PATCH', '/api/household-members/:userId')({ auth: ownerAuth(), params: { userId: 'caregiver-1' }, body: { role: 'viewer' } }, updated)
  assert.equal(updated.statusCode, 200)
  assert.deepEqual(calls.updates[0], { household_id: 'household-1', user_id: 'caregiver-1', role: 'viewer' })
  assert.deepEqual(calls.events, [{ event: 'member_role_update', payload: { householdId: 'household-1', targetUserId: 'caregiver-1', role: 'viewer', userId: 'owner-1' } }])

  const badRole = createJsonResponse()
  app.route('PATCH', '/api/household-members/:userId')({ auth: ownerAuth(), params: { userId: 'caregiver-1' }, body: { role: 'owner' } }, badRole)
  assert.equal(badRole.statusCode, 400)
})

test('member mutations reject non-owners, missing household context, self-removal, and missing targets', () => {
  const calls = { removals: 0, updates: 0 }
  const app = mountRouter({
    updateMemberRole: { run: () => { calls.updates += 1; return { changes: 0 } } },
    removeMember: { run: () => { calls.removals += 1; return { changes: 0 } } },
    appendEventLog: () => {},
  })

  const caregiverUpdate = createJsonResponse()
  app.route('PATCH', '/api/household-members/:userId')({ auth: caregiverAuth(), params: { userId: 'owner-1' }, body: { role: 'viewer' } }, caregiverUpdate)
  assert.equal(caregiverUpdate.statusCode, 403)

  const noHousehold = createJsonResponse()
  app.route('DELETE', '/api/household-members/:userId')({ auth: ownerAuth({ householdId: null }), params: { userId: 'caregiver-1' } }, noHousehold)
  assert.equal(noHousehold.statusCode, 403)

  const self = createJsonResponse()
  app.route('DELETE', '/api/household-members/:userId')({ auth: ownerAuth(), params: { userId: 'owner-1' } }, self)
  assert.equal(self.statusCode, 400)

  const missing = createJsonResponse()
  app.route('PATCH', '/api/household-members/:userId')({ auth: ownerAuth(), params: { userId: 'missing' }, body: { role: 'viewer' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(calls.updates, 1)
  assert.equal(calls.removals, 0)
})

test('owner removes a non-owner household member scoped to current household', () => {
  const calls = { removals: [], events: [] }
  const app = mountRouter({
    removeMember: { run: (payload) => { calls.removals.push(payload); return { changes: 1 } } },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
  })
  const res = createJsonResponse()

  app.route('DELETE', '/api/household-members/:userId')({ auth: ownerAuth(), params: { userId: 'caregiver-1' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls.removals[0], { household_id: 'household-1', user_id: 'caregiver-1' })
  assert.deepEqual(calls.events, [{ event: 'member_remove', payload: { householdId: 'household-1', targetUserId: 'caregiver-1', userId: 'owner-1' } }])
})
