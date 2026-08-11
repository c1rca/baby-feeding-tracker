import test from 'node:test'
import assert from 'node:assert/strict'
import compressible from 'compressible'
import { shouldCompressApiResponse } from '../server/apiCompression.js'

const fakeRes = (contentType) => ({ getHeader: () => contentType })

test('the SSE endpoint is never compressed', () => {
  // Compressing an event stream does not fail loudly — it buffers, and live
  // sync goes silent. Both guards are asserted independently below because
  // either one alone leaves a window open.
  assert.equal(shouldCompressApiResponse({ path: '/state/events' }, fakeRes(undefined)), false)
  assert.equal(shouldCompressApiResponse({ path: '/state/events' }, fakeRes('text/event-stream')), false)
})

test('an event stream is refused even on an unexpected path', () => {
  assert.equal(shouldCompressApiResponse({ path: '/somewhere-else' }, fakeRes('text/event-stream; charset=utf-8')), false)
})

test('ordinary JSON API responses are still compressed', () => {
  assert.equal(shouldCompressApiResponse({ path: '/state' }, fakeRes('application/json')), true)
  assert.equal(shouldCompressApiResponse({ path: '/babies' }, fakeRes('application/json')), true)
})

test('the default filter alone would have compressed the event stream', () => {
  // This is the reason the carve-out exists. If a future version of
  // `compressible` starts refusing text/event-stream on its own, this test
  // fails and the guard above can be reconsidered — until then it is load
  // bearing, and this pins the assumption rather than leaving it in a comment.
  assert.equal(compressible('text/event-stream'), true)
})
