import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthRouter, hashPassword, verifyPassword, hashSessionToken } from '../server/auth.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

function mountRouter(deps) {
  const app = createFakeApp()
  createAuthRouter(deps)(app)
  return app
}

test('password hashing verifies the original password and rejects the wrong password', () => {
  const hash = hashPassword('correct horse battery staple', { salt: 'test-salt' })

  assert.equal(verifyPassword('correct horse battery staple', hash), true)
  assert.equal(verifyPassword('wrong password', hash), false)
})

test('login route creates a hashed session token for a valid password', () => {
  const passwordHash = hashPassword('let-me-in', { salt: 'login-salt' })
  const calls = { sessions: [], events: [] }
  const app = mountRouter({
    authRequired: true,
    selectUserByEmail: { get: (email) => email === 'parent@example.com' ? { id: 'user-1', email, display_name: 'Parent', password_hash: passwordHash } : null },
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => 'plain-session-token',
    idFactory: () => 'session-id-1',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })

  const res = createJsonResponse()
  app.route('POST', '/api/auth/login')({ body: { email: ' PARENT@example.com ', password: 'let-me-in' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.token, 'plain-session-token')
  assert.deepEqual(res.body.user, { id: 'user-1', email: 'parent@example.com', displayName: 'Parent' })
  assert.equal(calls.sessions.length, 1)
  assert.equal(calls.sessions[0].id, 'session-id-1')
  assert.equal(calls.sessions[0].user_id, 'user-1')
  assert.equal(calls.sessions[0].token_hash, hashSessionToken('plain-session-token'))
  assert.equal(calls.sessions[0].created_at, '2026-01-01T00:00:00.000Z')
  assert.equal(calls.sessions[0].expires_at, '2026-01-31T00:00:00.000Z')
  assert.deepEqual(calls.events, [{ event: 'auth_login', payload: { userId: 'user-1' } }])
})

test('login route rejects bad credentials without creating a session', () => {
  const passwordHash = hashPassword('let-me-in', { salt: 'reject-salt' })
  const calls = { sessions: 0 }
  const app = mountRouter({
    authRequired: true,
    selectUserByEmail: { get: () => ({ id: 'user-1', email: 'parent@example.com', display_name: 'Parent', password_hash: passwordHash }) },
    insertSession: { run: () => { calls.sessions += 1 } },
    appendEventLog: () => {},
  })

  const res = createJsonResponse()
  app.route('POST', '/api/auth/login')({ body: { email: 'parent@example.com', password: 'wrong' } }, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { ok: false, error: 'Invalid email or password' })
  assert.equal(calls.sessions, 0)
})

test('login route stays unavailable until auth is enabled', () => {
  const app = mountRouter({ authRequired: false })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/login')({ body: { email: 'parent@example.com', password: 'pw' } }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Authentication is not enabled' })
})
