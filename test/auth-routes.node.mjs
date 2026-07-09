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

test('google auth status reports availability only when configured and auth is enabled', () => {
  const unavailableApp = mountRouter({ authRequired: true })
  const unavailableRes = createJsonResponse()
  unavailableApp.route('GET', '/api/auth/google/status')({}, unavailableRes)
  assert.deepEqual(unavailableRes.body, { ok: true, available: false })

  const availableApp = mountRouter({ authRequired: true, googleAuth: { clientId: 'client-id', clientSecret: 'secret', redirectUri: 'http://app.test/api/auth/google/callback' } })
  const availableRes = createJsonResponse()
  availableApp.route('GET', '/api/auth/google/status')({}, availableRes)
  assert.deepEqual(availableRes.body, { ok: true, available: true })
})

test('google start redirects to Google with a signed state', () => {
  const app = mountRouter({
    authRequired: true,
    googleAuth: { clientId: 'client-id', clientSecret: 'secret', redirectUri: 'http://app.test/api/auth/google/callback' },
    stateFactory: () => 'signed-state',
  })
  const res = createJsonResponse()
  app.route('GET', '/api/auth/google/start')({}, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.redirectUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), true)
  assert.equal(new URL(res.redirectUrl).searchParams.get('client_id'), 'client-id')
  assert.equal(new URL(res.redirectUrl).searchParams.get('state'), 'signed-state')
})

test('google callback provisions a session for the matched or created user', async () => {
  const calls = { users: [], sessions: [], events: [] }
  const usersByGoogleSub = new Map()
  const usersByEmail = new Map()
  const app = mountRouter({
    authRequired: true,
    googleAuth: { clientId: 'client-id', clientSecret: 'secret', redirectUri: 'http://app.test/api/auth/google/callback' },
    verifyGoogleState: (state) => state === 'ok-state',
    exchangeGoogleCode: async (code) => ({ access_token: `access-${code}` }),
    fetchGoogleProfile: async (token) => ({ sub: 'google-sub-1', email: 'mom@example.com', name: `Mom ${token}`, email_verified: true }),
    selectUserByGoogleSub: { get: (sub) => usersByGoogleSub.get(sub) || null },
    selectUserByEmail: { get: (email) => usersByEmail.get(email) || null },
    upsertGoogleUser: { run: (user) => { calls.users.push(user); usersByGoogleSub.set(user.google_sub, { id: user.id, email: user.email, display_name: user.display_name, password_hash: null }); usersByEmail.set(user.email, { id: user.id, email: user.email, display_name: user.display_name, password_hash: null }) } },
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => 'google-session-token',
    idFactory: () => calls.users.length ? 'session-id-1' : 'google-user-1',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  const res = createJsonResponse()
  await app.route('GET', '/api/auth/google/callback')({ query: { code: 'auth-code', state: 'ok-state' } }, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.redirectUrl, '/?auth_token=google-session-token')
  assert.equal(calls.users[0].email, 'mom@example.com')
  assert.equal(calls.users[0].google_sub, 'google-sub-1')
  assert.equal(calls.sessions[0].token_hash, hashSessionToken('google-session-token'))
  assert.deepEqual(calls.events, [{ event: 'auth_google_login', payload: { userId: 'google-user-1' } }])
})

test('login route stays unavailable until auth is enabled', () => {
  const app = mountRouter({ authRequired: false })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/login')({ body: { email: 'parent@example.com', password: 'pw' } }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Authentication is not enabled' })
})
