import test from 'node:test'
import assert from 'node:assert/strict'
import { createSecurityHeaders } from '../server/securityHeaders.js'

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
