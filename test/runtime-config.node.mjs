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
