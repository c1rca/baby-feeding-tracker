import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthSessionRouter, hashPassword, hashSessionToken, verifyPassword } from '../server/auth.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

function mountRouter(deps) {
  const app = createFakeApp()
  createAuthSessionRouter(deps)(app)
  return app
}

test('session me route returns the authenticated user and household context', () => {
  const app = mountRouter({})
  const res = createJsonResponse()

  app.route('GET', '/api/auth/me')({
    auth: {
      userId: 'user-1',
      householdId: 'household-1',
      babyId: 'baby-1',
      role: 'caregiver',
      mode: 'session',
    },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, {
    ok: true,
    user: {
      id: 'user-1',
      householdId: 'household-1',
      babyId: 'baby-1',
      role: 'caregiver',
      mode: 'session',
    },
    memberships: [],
    needsOnboarding: false,
  })
})

test('session me route reports needsOnboarding and memberships for a householdless session', () => {
  const app = mountRouter({
    selectMembershipsByUser: { all: (userId) => userId === 'user-9' ? [] : [{ household_id: 'other', role: 'owner' }] },
  })
  const res = createJsonResponse()

  app.route('GET', '/api/auth/me')({
    auth: { userId: 'user-9', householdId: null, babyId: null, role: null, mode: 'session' },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.needsOnboarding, true)
  assert.deepEqual(res.body.memberships, [])
  assert.equal(res.body.user.householdId, null)
})

test('session me route lists memberships and clears needsOnboarding once in a household', () => {
  const app = mountRouter({
    selectMembershipsByUser: { all: () => [{ household_id: 'household-1', role: 'caregiver' }] },
  })
  const res = createJsonResponse()

  app.route('GET', '/api/auth/me')({
    auth: { userId: 'user-1', householdId: 'household-1', babyId: 'baby-1', role: 'caregiver', mode: 'session' },
  }, res)

  assert.equal(res.body.needsOnboarding, false)
  assert.deepEqual(res.body.memberships, [{ householdId: 'household-1', role: 'caregiver' }])
})

test('password change route updates the current user password and revokes other sessions', () => {
  const existingHash = hashPassword('old-password', { salt: 'change-salt' })
  const calls = { passwordUpdates: [], sessionRevocations: [], events: [] }
  const app = mountRouter({
    selectUserById: { get: (userId) => userId === 'user-1' ? { id: 'user-1', password_hash: existingHash } : null },
    updateUserPassword: { run: (payload) => calls.passwordUpdates.push(payload) },
    revokeOtherUserSessions: { run: (payload) => calls.sessionRevocations.push(payload) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    now: () => new Date('2026-02-02T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/password')({
    auth: { userId: 'user-1', tokenHash: hashSessionToken('current-token'), mode: 'session' },
    body: { currentPassword: 'old-password', newPassword: 'new-secure-password' },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.equal(calls.passwordUpdates.length, 1)
  assert.equal(calls.passwordUpdates[0].user_id, 'user-1')
  assert.equal(verifyPassword('new-secure-password', calls.passwordUpdates[0].password_hash), true)
  assert.equal(calls.passwordUpdates[0].updated_at, '2026-02-02T00:00:00.000Z')
  assert.deepEqual(calls.sessionRevocations, [{ user_id: 'user-1', token_hash: hashSessionToken('current-token'), revoked_at: '2026-02-02T00:00:00.000Z' }])
  assert.deepEqual(calls.events, [{ event: 'auth_password_changed', payload: { userId: 'user-1' } }])
})

test('password change route rejects local mode, bad current passwords, and weak new passwords', () => {
  const existingHash = hashPassword('old-password', { salt: 'reject-change-salt' })
  const calls = { passwordUpdates: 0, sessionRevocations: 0 }
  const app = mountRouter({
    selectUserById: { get: () => ({ id: 'user-1', password_hash: existingHash }) },
    updateUserPassword: { run: () => { calls.passwordUpdates += 1 } },
    revokeOtherUserSessions: { run: () => { calls.sessionRevocations += 1 } },
  })

  const localRes = createJsonResponse()
  app.route('POST', '/api/auth/password')({ auth: { userId: 'default-user', mode: 'local' }, body: { currentPassword: 'old-password', newPassword: 'new-secure-password' } }, localRes)
  assert.equal(localRes.statusCode, 404)

  const badCurrentRes = createJsonResponse()
  app.route('POST', '/api/auth/password')({ auth: { userId: 'user-1', mode: 'session' }, body: { currentPassword: 'wrong', newPassword: 'new-secure-password' } }, badCurrentRes)
  assert.equal(badCurrentRes.statusCode, 401)
  assert.deepEqual(badCurrentRes.body, { ok: false, error: 'Current password is incorrect' })

  const weakRes = createJsonResponse()
  app.route('POST', '/api/auth/password')({ auth: { userId: 'user-1', mode: 'session' }, body: { currentPassword: 'old-password', newPassword: 'short' } }, weakRes)
  assert.equal(weakRes.statusCode, 400)
  assert.deepEqual(weakRes.body, { ok: false, error: 'New password must be at least 12 characters' })
  assert.deepEqual(calls, { passwordUpdates: 0, sessionRevocations: 0 })
})

test('logout route revokes the current bearer session token', () => {
  const calls = { revocations: [], events: [] }
  const app = mountRouter({
    revokeSession: { run: (payload) => calls.revocations.push(payload) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    now: () => new Date('2026-02-01T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/logout')({
    auth: { userId: 'user-1', tokenHash: hashSessionToken('token-1') },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.deepEqual(calls.revocations, [{ token_hash: hashSessionToken('token-1'), revoked_at: '2026-02-01T00:00:00.000Z' }])
  assert.deepEqual(calls.events, [{ event: 'auth_logout', payload: { userId: 'user-1' } }])
})

test('logout route is a no-op success in local mode', () => {
  const calls = { revocations: 0 }
  const app = mountRouter({ revokeSession: { run: () => { calls.revocations += 1 } } })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/logout')({ auth: { userId: 'default-user', mode: 'local' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.equal(calls.revocations, 0)
})
