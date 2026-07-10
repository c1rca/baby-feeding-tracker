import test from 'node:test'
import assert from 'node:assert/strict'
import { clientIp, createRateLimiter } from '../server/rateLimiter.js'

test('isLimited flips true once max hits are recorded', () => {
  const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => 0 })
  assert.equal(limiter.isLimited('k'), false)
  limiter.record('k')
  limiter.record('k')
  assert.equal(limiter.isLimited('k'), false)
  limiter.record('k')
  assert.equal(limiter.isLimited('k'), true)
})

test('keys are tracked independently', () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => 0 })
  limiter.record('a')
  assert.equal(limiter.isLimited('a'), true)
  assert.equal(limiter.isLimited('b'), false)
})

test('the window expires and the counter resets', () => {
  let clock = 0
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => clock })
  limiter.record('k')
  assert.equal(limiter.isLimited('k'), true)
  clock += 1001
  assert.equal(limiter.isLimited('k'), false)
})

test('reset clears a key immediately', () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => 0 })
  limiter.record('k')
  assert.equal(limiter.isLimited('k'), true)
  limiter.reset('k')
  assert.equal(limiter.isLimited('k'), false)
})

test('clientIp prefers req.ip then socket address then unknown', () => {
  assert.equal(clientIp({ ip: '1.2.3.4' }), '1.2.3.4')
  assert.equal(clientIp({ socket: { remoteAddress: '5.6.7.8' } }), '5.6.7.8')
  assert.equal(clientIp({}), 'unknown')
  assert.equal(clientIp(null), 'unknown')
})
