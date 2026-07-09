import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthRouter, hashPassword } from '../server/auth.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

const PASSWORD_HASH = hashPassword('let-me-in', { salt: 'rate-limit-salt' })

const mountRouter = (overrides = {}) => {
  const app = createFakeApp()
  createAuthRouter({
    authRequired: true,
    selectUserByEmail: { get: (email) => email === 'parent@example.com' ? { id: 'user-1', email, display_name: 'Parent', password_hash: PASSWORD_HASH } : null },
    insertSession: { run: () => {} },
    appendEventLog: () => {},
    maxLoginAttempts: 3,
    ...overrides,
  })(app)
  return app
}

const loginRequest = (password, ip = '203.0.113.9') => ({ ip, body: { email: 'parent@example.com', password } })

test('login rate limit rejects further attempts after repeated failures, even with the right password', () => {
  const app = mountRouter()
  const login = app.route('POST', '/api/auth/login')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = createJsonResponse()
    login(loginRequest('wrong'), res)
    assert.equal(res.statusCode, 401)
  }

  const limitedRes = createJsonResponse()
  login(loginRequest('let-me-in'), limitedRes)
  assert.equal(limitedRes.statusCode, 429)
  assert.equal(limitedRes.body.ok, false)
  assert.match(limitedRes.body.error, /too many/i)
})

test('login rate limit tracks callers separately by address', () => {
  const app = mountRouter()
  const login = app.route('POST', '/api/auth/login')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    login(loginRequest('wrong', '203.0.113.9'), createJsonResponse())
  }

  const otherRes = createJsonResponse()
  login(loginRequest('let-me-in', '198.51.100.7'), otherRes)
  assert.equal(otherRes.statusCode, 200)
})

test('login rate limit clears after the window passes', () => {
  let currentTime = new Date('2026-01-01T00:00:00.000Z').getTime()
  const app = mountRouter({ now: () => new Date(currentTime), loginWindowMs: 15 * 60 * 1000 })
  const login = app.route('POST', '/api/auth/login')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    login(loginRequest('wrong'), createJsonResponse())
  }
  const limitedRes = createJsonResponse()
  login(loginRequest('let-me-in'), limitedRes)
  assert.equal(limitedRes.statusCode, 429)

  currentTime += 16 * 60 * 1000
  const recoveredRes = createJsonResponse()
  login(loginRequest('let-me-in'), recoveredRes)
  assert.equal(recoveredRes.statusCode, 200)
})

test('successful login resets the failure counter', () => {
  const app = mountRouter()
  const login = app.route('POST', '/api/auth/login')

  for (let attempt = 0; attempt < 2; attempt += 1) {
    login(loginRequest('wrong'), createJsonResponse())
  }
  const okRes = createJsonResponse()
  login(loginRequest('let-me-in'), okRes)
  assert.equal(okRes.statusCode, 200)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = createJsonResponse()
    login(loginRequest('wrong'), res)
    assert.equal(res.statusCode, 401, 'fresh failures after a success should not be limited yet')
  }
})
