import test from 'node:test'
import assert from 'node:assert/strict'
import { dedupeFeedEntries } from '../server/stateMerge.js'

const feed = (over) => ({ id: 'x', type: 'breast', startedAt: 1000, endedAt: 2000, leftSeconds: 100, rightSeconds: 0, bottleOunces: null, ...over })

test('dedupeFeedEntries collapses two ids from the same source session, keeping the first', () => {
  const entries = [
    feed({ id: 'a', sourceSessionId: 's1' }),
    feed({ id: 'b', sourceSessionId: 's1', leftSeconds: 999 }), // same session, different content — still a dupe
  ]
  assert.deepEqual(dedupeFeedEntries(entries).map((e) => e.id), ['a'])
})

test('dedupeFeedEntries collapses a legacy double-save (same start/type/side, near-equal timing)', () => {
  const entries = [
    feed({ id: 'a', startedAt: 5000, endedAt: 8000, leftSeconds: 1700 }),
    feed({ id: 'b', startedAt: 5000, endedAt: 8010, leftSeconds: 1699 }), // within tolerance
  ]
  assert.deepEqual(dedupeFeedEntries(entries).map((e) => e.id), ['a'])
})

test('dedupeFeedEntries keeps distinct feeds that only share a start time', () => {
  const entries = [
    feed({ id: 'a', startedAt: 5000, type: 'breast' }),
    feed({ id: 'b', startedAt: 5000, type: 'bottle', bottleOunces: 3, leftSeconds: 0 }), // different type/side
    feed({ id: 'c', startedAt: 5000, endedAt: 99999, leftSeconds: 5 }), // ended far outside tolerance
  ]
  assert.deepEqual(dedupeFeedEntries(entries).map((e) => e.id).sort(), ['a', 'b', 'c'])
})

test('dedupeFeedEntries never dedupes non-feed entries and skips id-less items', () => {
  const entries = [
    { id: 'd1', type: 'diaper', at: 10 },
    { id: 'd2', type: 'diaper', at: 10 },
    feed({ id: 'f1' }),
    { type: 'breast', startedAt: 1000 }, // no id — dropped
  ]
  assert.deepEqual(dedupeFeedEntries(entries).map((e) => e.id), ['d1', 'd2', 'f1'])
})

test('dedupeFeedEntries different sessions stay distinct; a session id never matches a legacy entry', () => {
  const entries = [
    feed({ id: 'a', sourceSessionId: 's1' }),
    feed({ id: 'b', sourceSessionId: 's2' }), // different session — kept
    feed({ id: 'c' }), // no session — legacy bucket, kept (one has a session id)
  ]
  assert.deepEqual(dedupeFeedEntries(entries).map((e) => e.id).sort(), ['a', 'b', 'c'])
})

test('dedupeFeedEntries handles a long unique history without O(n^2) blowup', () => {
  // Every entry has a distinct start time, so none dedupe — the O(n) bucketed
  // path returns all 20k quickly (an O(n^2) scan would be ~4e8 comparisons).
  const entries = Array.from({ length: 20000 }, (_, i) => feed({ id: `e${i}`, startedAt: 1000 + i }))
  const start = Date.now()
  const result = dedupeFeedEntries(entries)
  assert.equal(result.length, 20000)
  assert.ok(Date.now() - start < 1000, `dedupe of 20k entries took ${Date.now() - start}ms`)
})
