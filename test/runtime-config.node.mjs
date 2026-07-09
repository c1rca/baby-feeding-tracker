import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeConfig } from '../server/runtimeConfig.js'

test('runtime config exposes explicit auth bypass flag separately from auth required', () => {
  const config = createRuntimeConfig({ rootDir: '/app', env: { AUTH_REQUIRED: '1', AUTH_BYPASS: '1' } })

  assert.equal(config.authRequired, true)
  assert.equal(config.authBypass, true)
})
