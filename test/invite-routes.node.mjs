import test from 'node:test'
import assert from 'node:assert/strict'
import { createInviteRouter } from '../server/apiRoutes.js'
import { createAuthRouter, hashSessionToken, verifyPassword } from '../server/auth.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

const ownerAuth = (overrides = {}) => ({ userId: 'owner-1', householdId: 'household-1', babyId: 'baby-1', role: 'owner', mode: 'session', ...overrides })

function mountInviteRouter(deps) {
  const app = createFakeApp()
  createInviteRouter(deps)(app)
  return app
}

function mountAuthRouter(deps) {
  const app = createFakeApp()
  createAuthRouter(deps)(app)
  return app
}

test('owner creates a household invite with a one-time token and scoped active listing', () => {
  const calls = { invites: [], events: [] }
  const app = mountInviteRouter({
    selectActiveInvitesByHousehold: { all: (householdId) => calls.invites.filter((invite) => invite.household_id === householdId && !invite.accepted_at && !invite.revoked_at) },
    selectInviteByEmail: { get: () => null },
    insertInvite: { run: (invite) => calls.invites.push(invite) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    idFactory: () => 'invite-1',
    tokenFactory: () => 'plain-invite-token',
    now: () => new Date('2026-07-09T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/household-invites')({ auth: ownerAuth(), body: { email: ' New@Example.com ', role: 'caregiver' } }, res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.invite.token, 'plain-invite-token')
  assert.equal(res.body.invite.email, 'new@example.com')
  assert.equal(res.body.invite.role, 'caregiver')
  assert.equal(calls.invites[0].token_hash, hashSessionToken('plain-invite-token'))
  assert.equal(calls.invites[0].household_id, 'household-1')
  assert.deepEqual(calls.events, [{ event: 'invite_create', payload: { inviteId: 'invite-1', householdId: 'household-1', email: 'new@example.com', role: 'caregiver', createdBy: 'owner-1' } }])

  const list = createJsonResponse()
  app.route('GET', '/api/household-invites')({ auth: ownerAuth() }, list)
  assert.deepEqual(list.body.invites, [{ id: 'invite-1', email: 'new@example.com', role: 'caregiver', createdAt: '2026-07-09T00:00:00.000Z', expiresAt: '2026-07-16T00:00:00.000Z' }])
})

test('invite creation rejects viewers, invalid roles, duplicates, and missing household context', () => {
  const calls = { inserts: 0 }
  const app = mountInviteRouter({
    selectInviteByEmail: { get: (householdId, email) => email === 'dupe@example.com' ? { id: 'invite-existing' } : null },
    insertInvite: { run: () => { calls.inserts += 1 } },
    appendEventLog: () => {},
  })

  const viewer = createJsonResponse()
  app.route('POST', '/api/household-invites')({ auth: ownerAuth({ role: 'viewer' }), body: { email: 'a@example.com' } }, viewer)
  assert.equal(viewer.statusCode, 403)

  const badRole = createJsonResponse()
  app.route('POST', '/api/household-invites')({ auth: ownerAuth(), body: { email: 'a@example.com', role: 'owner' } }, badRole)
  assert.equal(badRole.statusCode, 400)

  const duplicate = createJsonResponse()
  app.route('POST', '/api/household-invites')({ auth: ownerAuth(), body: { email: 'dupe@example.com' } }, duplicate)
  assert.equal(duplicate.statusCode, 409)

  const noHousehold = createJsonResponse()
  app.route('POST', '/api/household-invites')({ auth: ownerAuth({ householdId: null }), body: { email: 'a@example.com' } }, noHousehold)
  assert.equal(noHousehold.statusCode, 403)
  assert.equal(calls.inserts, 0)
})

test('owner revokes only invites scoped to the current household', () => {
  const calls = { revoked: [], events: [] }
  const app = mountInviteRouter({
    revokeInvite: { run: (payload) => { calls.revoked.push(payload); return { changes: payload.id === 'invite-1' && payload.household_id === 'household-1' ? 1 : 0 } } },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    now: () => new Date('2026-07-10T00:00:00.000Z'),
  })

  const res = createJsonResponse()
  app.route('DELETE', '/api/household-invites/:id')({ auth: ownerAuth(), params: { id: 'invite-1' } }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls.revoked[0], { id: 'invite-1', household_id: 'household-1', revoked_at: '2026-07-10T00:00:00.000Z' })
  assert.deepEqual(calls.events, [{ event: 'invite_revoke', payload: { inviteId: 'invite-1', householdId: 'household-1', userId: 'owner-1' } }])

  const missing = createJsonResponse()
  app.route('DELETE', '/api/household-invites/:id')({ auth: ownerAuth(), params: { id: 'other' } }, missing)
  assert.equal(missing.statusCode, 404)
})

test('invite accept creates a password account, household membership, session, and consumes the invite', () => {
  const calls = { users: [], members: [], sessions: [], accepted: [], events: [] }
  const app = mountAuthRouter({
    authRequired: true,
    selectInviteByToken: { get: (hash) => hash === hashSessionToken('invite-token') ? { id: 'invite-1', household_id: 'household-1', email: 'new@example.com', role: 'caregiver', expires_at: '2026-07-16T00:00:00.000Z', accepted_at: null, revoked_at: null } : null },
    selectUserByEmail: { get: () => null },
    insertPasswordUser: { run: (user) => calls.users.push(user) },
    insertHouseholdMember: { run: (member) => calls.members.push(member) },
    acceptInvite: { run: (payload) => { calls.accepted.push(payload); return { changes: 1 } } },
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    idFactory: () => calls.users.length ? 'session-1' : 'user-new',
    tokenFactory: () => 'session-token',
    now: () => new Date('2026-07-10T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/invites/accept')({ body: { token: 'invite-token', email: ' New@Example.com ', password: 'strong-password', displayName: 'New Parent' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.token, 'session-token')
  assert.deepEqual(res.body.user, { id: 'user-new', email: 'new@example.com', displayName: 'New Parent' })
  assert.equal(verifyPassword('strong-password', calls.users[0].password_hash), true)
  assert.deepEqual(calls.members[0], { user_id: 'user-new', household_id: 'household-1', role: 'caregiver', created_at: '2026-07-10T00:00:00.000Z' })
  assert.deepEqual(calls.accepted[0], { id: 'invite-1', accepted_at: '2026-07-10T00:00:00.000Z' })
  assert.equal(calls.sessions[0].user_id, 'user-new')
  assert.deepEqual(calls.events, [{ event: 'invite_accept', payload: { inviteId: 'invite-1', householdId: 'household-1', userId: 'user-new' } }])
})

test('invite accept rejects expired, email-mismatched, duplicate-racing, and weak-password attempts', () => {
  const invite = { id: 'invite-1', household_id: 'household-1', email: 'new@example.com', role: 'viewer', expires_at: '2026-07-09T00:00:00.000Z', accepted_at: null, revoked_at: null }
  const app = mountAuthRouter({
    authRequired: true,
    selectInviteByToken: { get: () => invite },
    selectUserByEmail: { get: () => null },
    insertPasswordUser: { run: () => {} },
    insertHouseholdMember: { run: () => {} },
    acceptInvite: { run: () => ({ changes: 0 }) },
    insertSession: { run: () => {} },
    appendEventLog: () => {},
    now: () => new Date('2026-07-10T00:00:00.000Z'),
  })

  const expired = createJsonResponse()
  app.route('POST', '/api/auth/invites/accept')({ body: { token: 't', email: 'new@example.com', password: 'strong-password' } }, expired)
  assert.equal(expired.statusCode, 401)

  invite.expires_at = '2026-07-16T00:00:00.000Z'
  const mismatch = createJsonResponse()
  app.route('POST', '/api/auth/invites/accept')({ body: { token: 't', email: 'other@example.com', password: 'strong-password' } }, mismatch)
  assert.equal(mismatch.statusCode, 403)

  const weak = createJsonResponse()
  app.route('POST', '/api/auth/invites/accept')({ body: { token: 't', email: 'new@example.com', password: 'short' } }, weak)
  assert.equal(weak.statusCode, 400)

  const raced = createJsonResponse()
  app.route('POST', '/api/auth/invites/accept')({ body: { token: 't', email: 'new@example.com', password: 'strong-password' } }, raced)
  assert.equal(raced.statusCode, 409)
})
