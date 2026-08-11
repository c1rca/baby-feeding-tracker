import test from 'node:test'
import assert from 'node:assert/strict'
import { createSecurityHeaders, contentSecurityPolicyFor } from '../server/securityHeaders.js'

const runHeaders = (options) => {
  const headers = {}
  const res = { setHeader: (name, value) => { headers[name] = value } }
  let nextCalled = false
  createSecurityHeaders(options)({}, res, () => { nextCalled = true })
  return { headers, nextCalled }
}

test('security headers middleware sets a self-only CSP and hardening headers', () => {
  const { headers, nextCalled } = runHeaders()
  assert.equal(nextCalled, true)
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/)
  assert.match(headers['Content-Security-Policy'], /connect-src 'self'/)
  assert.match(headers['Content-Security-Policy'], /script-src 'self'/)
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['Referrer-Policy'], 'no-referrer')
})

test('HSTS is omitted by default and set when enabled', () => {
  assert.equal(runHeaders().headers['Strict-Transport-Security'], undefined)
  assert.match(runHeaders({ hsts: true }).headers['Strict-Transport-Security'], /max-age=\d+/)
})

test('action log origin widens connect-src only when configured, and only to an origin', () => {
  const base = contentSecurityPolicyFor({})
  assert.match(base, /connect-src 'self';?/)
  assert.ok(!base.includes('http://localhost:8099'), 'unset ACTION_LOG_ORIGIN must not widen the policy')

  const configured = contentSecurityPolicyFor({ ACTION_LOG_ORIGIN: 'http://localhost:8099/log' })
  assert.ok(configured.includes("connect-src 'self' http://localhost:8099"), configured)
  assert.ok(!configured.includes('/log'), 'a path must be dropped, leaving a bare origin')

  // A malformed value must not be able to inject another directive.
  const hostile = contentSecurityPolicyFor({ ACTION_LOG_ORIGIN: "nonsense; script-src 'unsafe-inline'" })
  assert.ok(!hostile.includes('unsafe-inline;'), hostile)
  assert.ok(hostile.includes("connect-src 'self'"), hostile)
  assert.ok(!hostile.includes('nonsense'), hostile)
})
