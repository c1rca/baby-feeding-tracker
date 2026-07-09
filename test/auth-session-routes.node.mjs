import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthSessionRouter, hashSessionToken } from '../server/auth.js'
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
  })
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
