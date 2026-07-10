import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeConfig } from '../server/runtimeConfig.js'

test('runtime config exposes explicit auth bypass flag separately from auth required', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', AUTH_BYPASS: '1', ALLOW_INSECURE_LOCAL_MODE: '1', GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret', GOOGLE_REDIRECT_URI: 'https://app.example.com/api/auth/google/callback' } })

  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, true)
  assert.deepEqual(config.googleAuth, { clientId: 'google-client', clientSecret: 'google-secret', redirectUri: 'https://app.example.com/api/auth/google/callback' })
})

test('the guard fails closed and rejects a missing AUTH_REQUIRED regardless of NODE_ENV', () => {
  assert.throws(
    () => createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production' } }),
    /AUTH_REQUIRED/,
  )
  // The whole point of finding 8: forgetting NODE_ENV must NOT open the app.
  assert.throws(
    () => createRuntimeConfig({ rootDir: '/app', env: {} }),
    /AUTH_REQUIRED/,
  )
})

test('the guard rejects AUTH_BYPASS unless insecure local mode is acknowledged', () => {
  assert.throws(
    () => createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production', AUTH_REQUIRED: '1', AUTH_BYPASS: '1' } }),
    /AUTH_BYPASS/,
  )
})

test('AUTH_REQUIRED=1 with no bypass builds a locked-down config', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { NODE_ENV: 'production', AUTH_REQUIRED: '1' } })
  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, false)
})

test('ALLOW_INSECURE_LOCAL_MODE escapes the guard for local diagnostics', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { ALLOW_INSECURE_LOCAL_MODE: '1', AUTH_BYPASS: '1' } })
  assert.equal(config.authRequired, false)
  assert.equal(config.authBypass, true)
})

test('session TTL defaults to 30 days and clamps out-of-range values', () => {
  const build = (extra) => createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', ...extra } })
  assert.equal(build({}).sessionTtlDays, 30)
  assert.equal(build({ AUTH_SESSION_TTL_DAYS: '7' }).sessionTtlDays, 7)
  assert.equal(build({ AUTH_SESSION_TTL_DAYS: '99999' }).sessionTtlDays, 365)
  assert.equal(build({ AUTH_SESSION_TTL_DAYS: '0' }).sessionTtlDays, 1)
  assert.equal(build({ AUTH_SESSION_TTL_DAYS: 'garbage' }).sessionTtlDays, 30)
})

test('phone allow-list normalizes numbers to E.164 and drops junk', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', AUTH_ALLOWED_PHONES: '(555) 123-4567, 15550009999, nope' } })
  assert.equal(config.allowedPhones.length, 2)
  assert.ok(config.allowedPhones[0].startsWith('+1'))
  assert.ok(config.allowedPhones[0].endsWith('4567'))
  assert.ok(config.allowedPhones[1].endsWith('9999'))
})

test('text email recipient phone is allowed for dev text-login without committing the number', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', SMTP_USER: 'sender@example.com', SMTP_PASSWORD: 'secret', TEXT_EMAIL_TO: '5551234567@msg.fi.google.com' } })
  assert.equal(config.allowedPhones.length, 1)
  assert.ok(config.allowedPhones[0].startsWith('+1'))
  assert.ok(config.allowedPhones[0].endsWith('4567'))
})
