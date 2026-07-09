import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthMiddleware, hashSessionToken } from '../server/auth.js'
import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_USER_ID } from '../server/database.js'

function runMiddleware(middleware, req) {
  let nextCalled = false
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  middleware(req, res, () => {
    nextCalled = true
  })
  return { req, res, nextCalled }
}

test('auth middleware preserves local single-family mode when auth is disabled', () => {
  const middleware = createAuthMiddleware({ authRequired: false })

  const result = runMiddleware(middleware, { headers: {} })

  assert.equal(result.nextCalled, true)
  assert.deepEqual(result.req.auth, {
    userId: DEFAULT_USER_ID,
    householdId: DEFAULT_HOUSEHOLD_ID,
    babyId: DEFAULT_BABY_ID,
    role: 'owner',
    mode: 'local',
  })
})

test('auth middleware resolves a bearer session to user household and default baby context', () => {
  const token = 'session-token-123'
  const middleware = createAuthMiddleware({
    authRequired: true,
    selectSessionContext: {
      get: (tokenHash) => {
        assert.equal(tokenHash, hashSessionToken(token))
        return {
          user_id: 'user-1',
          household_id: 'household-1',
          baby_id: 'baby-1',
          role: 'caregiver',
        }
      },
    },
  })

  const result = runMiddleware(middleware, { headers: { authorization: 'Bearer ' + token } })

  assert.equal(result.nextCalled, true)
  assert.deepEqual(result.req.auth, {
    userId: 'user-1',
    householdId: 'household-1',
    babyId: 'baby-1',
    role: 'caregiver',
    mode: 'session',
    tokenHash: hashSessionToken(token),
  })
})

test('auth middleware rejects missing or invalid bearer sessions when auth is required', () => {
  const missing = runMiddleware(createAuthMiddleware({ authRequired: true, selectSessionContext: { get: () => null } }), { headers: {} })
  assert.equal(missing.nextCalled, false)
  assert.equal(missing.res.statusCode, 401)
  assert.deepEqual(missing.res.body, { ok: false, error: 'Authentication required' })

  const invalid = runMiddleware(createAuthMiddleware({ authRequired: true, selectSessionContext: { get: () => null } }), { headers: { authorization: 'Bearer nope' } })
  assert.equal(invalid.nextCalled, false)
  assert.equal(invalid.res.statusCode, 401)
  assert.deepEqual(invalid.res.body, { ok: false, error: 'Invalid or expired session' })
})
