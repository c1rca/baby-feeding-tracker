import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeConfig } from '../server/runtimeConfig.js'

test('runtime config exposes explicit auth bypass flag separately from auth required', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', AUTH_BYPASS: '1', GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret', GOOGLE_REDIRECT_URI: 'https://app.example.com/api/auth/google/callback' } })

  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, true)
  assert.deepEqual(config.googleAuth, { clientId: 'google-client', clientSecret: 'google-secret', redirectUri: 'https://app.example.com/api/auth/google/callback' })
})
