import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeConfig } from '../server/runtimeConfig.js'

test('runtime config exposes explicit auth bypass flag separately from auth required', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', AUTH_BYPASS: '1', GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret', GOOGLE_REDIRECT_URI: 'https://app.example.com/api/auth/google/callback' } })

  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, true)
  assert.deepEqual(config.googleAuth, { clientId: 'google-client', clientSecret: 'google-secret', redirectUri: 'https://app.example.com/api/auth/google/callback' })
})

test('production requires auth and rejects a missing AUTH_REQUIRED', () => {
  assert.throws(
    () => createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production' } }),
    /AUTH_REQUIRED/,
  )
})

test('production rejects AUTH_BYPASS even when auth is required', () => {
  assert.throws(
    () => createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production', AUTH_REQUIRED: '1', AUTH_BYPASS: '1' } }),
    /AUTH_BYPASS/,
  )
})

test('production with AUTH_REQUIRED=1 and no bypass builds a locked-down config', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production', AUTH_REQUIRED: '1' } })
  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, false)
})

test('ALLOW_INSECURE_LOCAL_MODE escapes the production guard for local diagnostics', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production', ALLOW_INSECURE_LOCAL_MODE: '1', AUTH_BYPASS: '1' } })
  assert.equal(config.authRequired, false)
  assert.equal(config.authBypass, true)
})

test('non-production config is unaffected by the guard', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: {} })
  assert.equal(config.authRequired, false)
  assert.equal(config.authBypass, false)
})

test('session TTL defaults to 30 days and clamps out-of-range values', () => {
  assert.equal(createRuntimeConfig({ rootDir: '/app', env: {} }).sessionTtlDays, 30)
  assert.equal(createRuntimeConfig({ rootDir: '/app', env: { AUTH_SESSION_TTL_DAYS: '7' } }).sessionTtlDays, 7)
  assert.equal(createRuntimeConfig({ rootDir: '/app', env: { AUTH_SESSION_TTL_DAYS: '99999' } }).sessionTtlDays, 365)
  assert.equal(createRuntimeConfig({ rootDir: '/app', env: { AUTH_SESSION_TTL_DAYS: '0' } }).sessionTtlDays, 1)
  assert.equal(createRuntimeConfig({ rootDir: '/app', env: { AUTH_SESSION_TTL_DAYS: 'garbage' } }).sessionTtlDays, 30)
})

test('phone allow-list normalizes numbers to E.164 and drops junk', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_ALLOWED_PHONES: '(555) 123-4567, 15550009999, nope' } })
  assert.deepEqual(config.allowedPhones, ['+15551234567', '+15550009999'])
})
