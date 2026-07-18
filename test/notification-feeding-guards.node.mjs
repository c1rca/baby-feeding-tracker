import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler } from '../server/notifications.js'

test('notification scheduler suppresses reminders while an active feed exists', () => {
  const now = new Date('2026-06-05T10:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-active', endedAt: now - 2 * 60 * 60 * 1000 }]),
    session_json: JSON.stringify({ startedAt: now - 5 * 60 * 1000, activeSide: 'right' }),
  }
  const timers = []
  const sent = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: () => null },
    upsertNotificationState: { run: () => {} },
    sendGotify: async (payload) => sent.push(payload),
    now: () => now,
    setTimer: (fn, delay) => {
      timers.push({ fn, delay })
      return timers.length
    },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()

  assert.equal(timers.length, 0)
  assert.equal(sent.length, 0)
  assert.equal(scheduler.getScheduled(), null)
})

test('notification scheduler marks due reminder handled when feed starts before timer fires', async () => {
  const now = new Date('2026-06-05T10:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-in-progress', endedAt: now - 2 * 60 * 60 * 1000 }]),
    session_json: null,
  }
  const timers = []
  const sent = []
  const notificationRows = new Map()

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: (id) => notificationRows.get(id) },
    upsertNotificationState: { run: (state) => notificationRows.set(state.entry_id, state) },
    sendGotify: async (payload) => sent.push(payload),
    now: () => now,
    setTimer: (fn, delay) => {
      timers.push({ fn, delay })
      return timers.length
    },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()
  row.session_json = JSON.stringify({ startedAt: now - 30_000, activeSide: 'left' })
  await timers[0].fn()

  assert.equal(sent.length, 0)
  assert.equal(notificationRows.get('default-household:default-baby:feed-in-progress').sent_at, new Date(now).toISOString())
  assert.equal(scheduler.getScheduled(), null)
})

test('notification scheduler retries after a transient send failure', async () => {
  const now = new Date('2026-06-05T10:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-retry', endedAt: now - 2 * 60 * 60 * 1000 }]),
  }
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: () => null },
    upsertNotificationState: { run: () => {} },
    sendGotify: async () => { throw new Error('transient') },
    now: () => now,
    setTimer: (fn, delay) => {
      timers.push({ fn, delay })
      return timers.length
    },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()
  await timers[0].fn()

  assert.equal(timers.length, 2)
  assert.equal(timers[1].delay, 0)
})

test('notification scheduler cancels timers when disabled and reschedules when enabled', () => {
  const now = new Date('2026-06-05T09:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-toggle', endedAt: now - 60 * 60 * 1000 }]),
  }
  let cleared = 0
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: () => null },
    upsertNotificationState: { run: () => {} },
    sendGotify: async () => {},
    now: () => now,
    setTimer: (fn, delay) => {
      timers.push({ fn, delay })
      return timers.length
    },
    clearTimer: () => { cleared += 1 },
    logger: { warn: () => {} },
  })

  scheduler.evaluate()
  assert.equal(timers.length, 1)
  scheduler.setEnabled(false)
  assert.equal(cleared, 1)
  assert.equal(scheduler.getScheduled(), null)
  scheduler.setEnabled(true)
  assert.equal(timers.length, 2)
})
