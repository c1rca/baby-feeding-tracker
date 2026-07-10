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

function googleCallbackDeps(overrides = {}) {
  const calls = { users: [], members: [], sessions: [], codes: [], events: [] }
  const usersByGoogleSub = new Map()
  const usersByEmail = new Map()
  const deps = {
    calls,
    usersByGoogleSub,
    usersByEmail,
    router: {
      authRequired: true,
      googleAuth: { clientId: 'client-id', clientSecret: 'secret', redirectUri: 'http://app.test/api/auth/google/callback' },
      verifyGoogleState: (state) => state === 'ok-state',
      exchangeGoogleCode: async (code) => ({ access_token: `access-${code}` }),
      fetchGoogleProfile: async (token) => ({ sub: 'google-sub-1', email: 'mom@example.com', name: `Mom ${token}`, email_verified: true }),
      selectUserByGoogleSub: { get: (sub) => usersByGoogleSub.get(sub) || null },
      selectUserByEmail: { get: (email) => usersByEmail.get(email) || null },
      upsertGoogleUser: { run: (user) => { calls.users.push(user); usersByGoogleSub.set(user.google_sub, { id: user.id, email: user.email, display_name: user.display_name, password_hash: null }); usersByEmail.set(user.email, { id: user.id, email: user.email, display_name: user.display_name, password_hash: null }) } },
      upsertGoogleHouseholdMember: { run: (member) => calls.members.push(member) },
      insertSession: { run: (session) => calls.sessions.push(session) },
      insertLoginCode: { run: (loginCode) => calls.codes.push(loginCode) },
      appendEventLog: (event, payload) => calls.events.push({ event, payload }),
      tokenFactory: () => 'google-handoff-code',
      idFactory: () => calls.users.length ? 'session-id-1' : 'google-user-1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      allowedEmails: ['mom@example.com'],
      ...overrides,
    },
  }
  return deps
}

test('google callback provisions an account for an allow-listed new user without granting household membership', async () => {
  const { router, calls } = googleCallbackDeps()
  const app = mountRouter(router)
  const res = createJsonResponse()
  await app.route('GET', '/api/auth/google/callback')({ query: { code: 'auth-code', state: 'ok-state' } }, res)

  assert.equal(res.statusCode, 302)
  // The token never rides in the URL: the browser gets a single-use code in the fragment.
  assert.equal(res.redirectUrl, '/#auth_code=google-handoff-code')
  assert.equal(calls.users[0].email, 'mom@example.com')
  assert.equal(calls.users[0].google_sub, 'google-sub-1')
  // The core lockdown: a new Google account never becomes an owner of the shared household.
  assert.equal(calls.members.length, 0)
  // No session is minted at the callback; only a short-lived handoff code.
  assert.equal(calls.sessions.length, 0)
  assert.equal(calls.codes.length, 1)
  assert.equal(calls.codes[0].code_hash, hashSessionToken('google-handoff-code'))
  assert.equal(calls.codes[0].user_id, 'google-user-1')
  assert.equal(calls.codes[0].expires_at, '2026-01-01T00:01:00.000Z')
  assert.deepEqual(calls.events, [{ event: 'auth_google_login', payload: { userId: 'google-user-1' } }])
})

test('google callback rejects an unknown off-allow-list email and creates no rows', async () => {
  const { router, calls } = googleCallbackDeps({ allowedEmails: ['someone@else.example'] })
  const app = mountRouter(router)
  const res = createJsonResponse()
  await app.route('GET', '/api/auth/google/callback')({ query: { code: 'auth-code', state: 'ok-state' } }, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.redirectUrl, '/?auth_error=not_invited')
  assert.equal(calls.users.length, 0)
  assert.equal(calls.members.length, 0)
  assert.equal(calls.sessions.length, 0)
  assert.equal(calls.codes.length, 0)
  assert.deepEqual(calls.events, [{ event: 'auth_google_denied', payload: { email: 'mom@example.com' } }])
})

test('google callback logs in an existing google user even with an empty allow-list', async () => {
  const { router, calls, usersByGoogleSub } = googleCallbackDeps({ allowedEmails: [] })
  usersByGoogleSub.set('google-sub-1', { id: 'existing-user', email: 'mom@example.com', display_name: 'Mom', password_hash: null, google_sub: 'google-sub-1' })
  const app = mountRouter(router)
  const res = createJsonResponse()
  await app.route('GET', '/api/auth/google/callback')({ query: { code: 'auth-code', state: 'ok-state' } }, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.redirectUrl, '/#auth_code=google-handoff-code')
  assert.equal(calls.members.length, 0)
  assert.equal(calls.codes[0].user_id, 'existing-user')
  assert.deepEqual(calls.events, [{ event: 'auth_google_login', payload: { userId: 'existing-user' } }])
})

test('google callback links a google_sub onto an existing email user without an allow-list entry', async () => {
  const { router, calls, usersByEmail } = googleCallbackDeps({ allowedEmails: [] })
  usersByEmail.set('mom@example.com', { id: 'password-user', email: 'mom@example.com', display_name: 'Mom', password_hash: 'pw', google_sub: null })
  const app = mountRouter(router)
  const res = createJsonResponse()
  await app.route('GET', '/api/auth/google/callback')({ query: { code: 'auth-code', state: 'ok-state' } }, res)

  assert.equal(res.statusCode, 302)
  assert.equal(calls.users[0].id, 'password-user')
  assert.equal(calls.users[0].google_sub, 'google-sub-1')
  assert.equal(calls.members.length, 0)
  assert.equal(calls.codes[0].user_id, 'password-user')
})

function exchangeDeps(overrides = {}) {
  const calls = { sessions: [], events: [], consumed: [] }
  const codeRow = overrides.codeRow === undefined
    ? { code_hash: hashSessionToken('handoff-code'), user_id: 'user-9', created_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-01-01T00:01:00.000Z', consumed_at: null }
    : overrides.codeRow
  const router = {
    authRequired: true,
    selectLoginCode: { get: (hash) => (codeRow && hash === codeRow.code_hash ? codeRow : null) },
    consumeLoginCode: { run: () => { if (codeRow.consumed_at) return { changes: 0 }; codeRow.consumed_at = '2026-01-01T00:00:30.000Z'; calls.consumed.push(codeRow.code_hash); return { changes: 1 } } },
    selectUserById: { get: (id) => (id === 'user-9' ? { id: 'user-9', email: 'mom@example.com', display_name: 'Mom' } : null) },
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => 'exchanged-session-token',
    idFactory: () => 'session-x',
    now: () => new Date('2026-01-01T00:00:30.000Z'),
    ...overrides,
  }
  return { calls, router }
}

test('google exchange trades a valid code for a session token and marks it consumed', () => {
  const { router, calls } = exchangeDeps()
  const app = mountRouter(router)
  const res = createJsonResponse()
  app.route('POST', '/api/auth/google/exchange')({ body: { code: 'handoff-code' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.token, 'exchanged-session-token')
  assert.deepEqual(res.body.user, { id: 'user-9', email: 'mom@example.com', displayName: 'Mom' })
  assert.equal(calls.sessions[0].user_id, 'user-9')
  assert.equal(calls.consumed.length, 1)
  assert.deepEqual(calls.events, [{ event: 'auth_google_exchange', payload: { userId: 'user-9' } }])
})

test('google exchange rejects a second use of the same code', () => {
  const { router, calls } = exchangeDeps()
  const app = mountRouter(router)
  app.route('POST', '/api/auth/google/exchange')({ body: { code: 'handoff-code' } }, createJsonResponse())

  const res = createJsonResponse()
  app.route('POST', '/api/auth/google/exchange')({ body: { code: 'handoff-code' } }, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { ok: false, error: 'Invalid or expired code' })
  assert.equal(calls.sessions.length, 1)
})

test('google exchange rejects an expired code', () => {
  const { router } = exchangeDeps({ now: () => new Date('2026-01-01T00:02:00.000Z') })
  const app = mountRouter(router)
  const res = createJsonResponse()
  app.route('POST', '/api/auth/google/exchange')({ body: { code: 'handoff-code' } }, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { ok: false, error: 'Invalid or expired code' })
})

test('google exchange rejects an unknown code', () => {
  const { router } = exchangeDeps({ codeRow: null })
  const app = mountRouter(router)
  const res = createJsonResponse()
  app.route('POST', '/api/auth/google/exchange')({ body: { code: 'nope' } }, res)

  assert.equal(res.statusCode, 401)
})

test('text login request creates or finds a phone user and sends a magic link plus copyable code', async () => {
  const calls = { users: [], codes: [], messages: [], events: [] }
  const app = mountRouter({
    authRequired: true,
    baseUrl: 'https://feedr.test',
    textLoginAvailable: true,
    selectUserByPhone: { get: () => null },
    insertPhoneUser: { run: (user) => calls.users.push(user) },
    insertLoginCode: { run: (code) => calls.codes.push(code) },
    sendTextLogin: async (payload) => calls.messages.push(payload),
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => '123456',
    idFactory: () => 'phone-user-1',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })

  const res = createJsonResponse()
  await app.route('POST', '/api/auth/text/request')({ body: { phone: '(555) 123-4567' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true, maskedPhone: '••• ••• 4567' })
  assert.equal(calls.users.length, 1)
  assert.equal(calls.users[0].phone, '+15551234567')
  assert.equal(calls.users[0].display_name, 'Caregiver 4567')
  assert.equal(calls.codes[0].code_hash, hashSessionToken('123456'))
  assert.equal(calls.codes[0].user_id, 'phone-user-1')
  assert.equal(calls.codes[0].expires_at, '2026-01-01T00:10:00.000Z')
  assert.equal(calls.messages.length, 1)
  assert.equal(calls.messages[0].to, '+15551234567')
  assert.equal(calls.messages[0].code, '123456')
  assert.equal(calls.messages[0].link, 'https://feedr.test/#text_code=123456')
  assert.match(calls.messages[0].message, /123456/)
  assert.match(calls.messages[0].message, /https:\/\/feedr\.test\/#text_code=123456/)
  assert.deepEqual(calls.events, [{ event: 'auth_text_login_requested', payload: { userId: 'phone-user-1' } }])
})

test('text login confirm consumes the code and creates a long-lived session', () => {
  const calls = { sessions: [], consumed: [], events: [] }
  const codeRow = { code_hash: hashSessionToken('654321'), user_id: 'phone-user-1', created_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-01-01T00:10:00.000Z', consumed_at: null }
  const app = mountRouter({
    authRequired: true,
    selectLoginCode: { get: (hash) => hash === codeRow.code_hash ? codeRow : null },
    consumeLoginCode: { run: ({ code_hash }) => { calls.consumed.push(code_hash); return { changes: 1 } } },
    selectUserById: { get: () => ({ id: 'phone-user-1', email: 'phone:+15551234567', display_name: 'Caregiver 4567', phone: '+15551234567' }) },
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => 'long-lived-session-token',
    idFactory: () => 'session-id-1',
    now: () => new Date('2026-01-01T00:02:00.000Z'),
    sessionTtlDays: 365,
  })

  const res = createJsonResponse()
  app.route('POST', '/api/auth/text/confirm')({ body: { code: '654321' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.token, 'long-lived-session-token')
  assert.deepEqual(res.body.user, { id: 'phone-user-1', email: 'phone:+15551234567', displayName: 'Caregiver 4567' })
  assert.equal(calls.sessions[0].expires_at, '2027-01-01T00:02:00.000Z')
  assert.deepEqual(calls.events, [{ event: 'auth_text_login_confirmed', payload: { userId: 'phone-user-1' } }])
})

test('password reset request creates a short-lived reset code without leaking unknown emails', () => {
  const calls = { resetCodes: [], events: [] }
  const app = mountRouter({
    authRequired: true,
    exposePasswordResetToken: true,
    selectUserByEmail: { get: (email) => email === 'parent@example.com' ? { id: 'user-1', email, password_hash: 'hash' } : null },
    insertPasswordResetCode: { run: (row) => calls.resetCodes.push(row) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    tokenFactory: () => 'reset-code-plain',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })

  const knownRes = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/request')({ body: { email: ' Parent@Example.com ' } }, knownRes)

  assert.equal(knownRes.statusCode, 200)
  assert.equal(knownRes.body.ok, true)
  assert.equal(knownRes.body.resetToken, 'reset-code-plain')
  assert.equal(calls.resetCodes.length, 1)
  assert.equal(calls.resetCodes[0].code_hash, hashSessionToken('reset-code-plain'))
  assert.equal(calls.resetCodes[0].user_id, 'user-1')
  assert.equal(calls.resetCodes[0].expires_at, '2026-01-01T00:15:00.000Z')
  assert.deepEqual(calls.events, [{ event: 'auth_password_reset_requested', payload: { userId: 'user-1' } }])

  const unknownRes = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/request')({ body: { email: 'unknown@example.com' } }, unknownRes)
  assert.equal(unknownRes.statusCode, 200)
  assert.deepEqual(unknownRes.body, { ok: true })
  assert.equal(calls.resetCodes.length, 1)
})

test('password reset confirm updates password, consumes code, and revokes sessions', () => {
  const codeRow = { code_hash: hashSessionToken('reset-code-plain'), user_id: 'user-1', expires_at: '2026-01-01T00:15:00.000Z', consumed_at: null }
  const calls = { consumed: [], passwordUpdates: [], revocations: [], events: [] }
  const app = mountRouter({
    authRequired: true,
    selectPasswordResetCode: { get: (hash) => hash === codeRow.code_hash ? codeRow : null },
    consumePasswordResetCode: { run: (payload) => { calls.consumed.push(payload); codeRow.consumed_at = payload.consumed_at; return { changes: 1 } } },
    updateUserPassword: { run: (payload) => calls.passwordUpdates.push(payload) },
    revokeUserSessions: { run: (payload) => calls.revocations.push(payload) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    now: () => new Date('2026-01-01T00:05:00.000Z'),
  })

  const res = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/confirm')({ body: { token: 'reset-code-plain', newPassword: 'new-reset-password' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.deepEqual(calls.consumed, [{ code_hash: codeRow.code_hash, consumed_at: '2026-01-01T00:05:00.000Z' }])
  assert.equal(calls.passwordUpdates[0].user_id, 'user-1')
  assert.equal(verifyPassword('new-reset-password', calls.passwordUpdates[0].password_hash), true)
  assert.deepEqual(calls.revocations, [{ user_id: 'user-1', revoked_at: '2026-01-01T00:05:00.000Z' }])
  assert.deepEqual(calls.events, [{ event: 'auth_password_reset_confirmed', payload: { userId: 'user-1' } }])
})

test('password reset confirm rejects invalid, expired, consumed, and weak reset attempts', () => {
  const validHash = hashSessionToken('reset-code-plain')
  const calls = { consumed: 0, passwordUpdates: 0, revocations: 0 }
  const app = mountRouter({
    authRequired: true,
    selectPasswordResetCode: { get: (hash) => hash === validHash ? { code_hash: validHash, user_id: 'user-1', expires_at: '2026-01-01T00:01:00.000Z', consumed_at: null } : null },
    consumePasswordResetCode: { run: () => { calls.consumed += 1; return { changes: 0 } } },
    updateUserPassword: { run: () => { calls.passwordUpdates += 1 } },
    revokeUserSessions: { run: () => { calls.revocations += 1 } },
    now: () => new Date('2026-01-01T00:02:00.000Z'),
  })

  const expiredRes = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/confirm')({ body: { token: 'reset-code-plain', newPassword: 'new-reset-password' } }, expiredRes)
  assert.equal(expiredRes.statusCode, 401)

  const weakRes = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/confirm')({ body: { token: 'reset-code-plain', newPassword: 'short' } }, weakRes)
  assert.equal(weakRes.statusCode, 400)

  const invalidRes = createJsonResponse()
  app.route('POST', '/api/auth/password-reset/confirm')({ body: { token: 'missing', newPassword: 'new-reset-password' } }, invalidRes)
  assert.equal(invalidRes.statusCode, 401)
  assert.deepEqual(calls, { consumed: 0, passwordUpdates: 0, revocations: 0 })
})

test('password signup creates an allow-listed account, household, first baby, and session', () => {
  const calls = { users: [], households: [], sessions: [], events: [] }
  const ids = ['user-new', 'household-new', 'baby-new', 'session-new']
  let idIndex = 0
  const app = mountRouter({
    authRequired: true,
    allowedEmails: ['new@example.com'],
    selectUserByEmail: { get: () => null },
    insertPasswordUser: { run: (user) => calls.users.push(user) },
    createSignupHousehold: (payload) => calls.households.push(payload),
    insertSession: { run: (session) => calls.sessions.push(session) },
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    idFactory: () => ids[idIndex++],
    tokenFactory: () => 'signup-session-token',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/signup')({ body: { email: ' New@Example.com ', password: 'strong-password', displayName: 'New Parent', householdName: 'New House', babyName: 'Ryan', babyDob: '2026-06-03' } }, res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.token, 'signup-session-token')
  assert.deepEqual(res.body.user, { id: 'user-new', email: 'new@example.com', displayName: 'New Parent' })
  assert.equal(calls.users[0].email, 'new@example.com')
  assert.equal(verifyPassword('strong-password', calls.users[0].password_hash), true)
  assert.deepEqual(calls.households[0], { userId: 'user-new', householdId: 'household-new', householdName: 'New House', babyId: 'baby-new', babyName: 'Ryan', babyDob: '2026-06-03', createdAt: '2026-01-01T00:00:00.000Z' })
  assert.equal(calls.sessions[0].user_id, 'user-new')
  assert.deepEqual(calls.events, [{ event: 'auth_signup', payload: { userId: 'user-new', email: 'new@example.com', householdId: 'household-new' } }])
})

test('password signup rejects closed allow-list, duplicate email, and weak passwords', () => {
  const calls = { users: 0, sessions: 0 }
  const app = mountRouter({
    authRequired: true,
    allowedEmails: ['allowed@example.com', 'taken@example.com'],
    selectUserByEmail: { get: (email) => email === 'taken@example.com' ? { id: 'taken' } : null },
    insertPasswordUser: { run: () => { calls.users += 1 } },
    insertSession: { run: () => { calls.sessions += 1 } },
    appendEventLog: () => {},
  })

  const offList = createJsonResponse()
  app.route('POST', '/api/auth/signup')({ body: { email: 'off@example.com', password: 'strong-password' } }, offList)
  assert.equal(offList.statusCode, 403)
  assert.equal(offList.body.error, 'not_invited')

  const weak = createJsonResponse()
  app.route('POST', '/api/auth/signup')({ body: { email: 'allowed@example.com', password: 'short' } }, weak)
  assert.equal(weak.statusCode, 400)

  const duplicate = createJsonResponse()
  app.route('POST', '/api/auth/signup')({ body: { email: 'taken@example.com', password: 'strong-password' } }, duplicate)
  assert.equal(duplicate.statusCode, 409)
  assert.equal(calls.users, 0)
  assert.equal(calls.sessions, 0)
})

test('login route stays unavailable until auth is enabled', () => {
  const app = mountRouter({ authRequired: false })
  const res = createJsonResponse()

  app.route('POST', '/api/auth/login')({ body: { email: 'parent@example.com', password: 'pw' } }, res)

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Authentication is not enabled' })
})
