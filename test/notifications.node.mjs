import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReminder, createNotificationScheduler, getLatestEndedFeed } from '../server/notifications.js'

test('buildReminder schedules the next feeding window two to three hours after latest feed', () => {
  const endedAt = new Date('2026-06-05T08:00:00Z').getTime()
  const reminder = buildReminder({ id: 'feed-1', endedAt }, endedAt)

  assert.equal(reminder.entryId, 'feed-1')
  assert.equal(reminder.dueAt, new Date('2026-06-05T10:00:00Z').getTime())
  assert.equal(reminder.windowEndAt, new Date('2026-06-05T11:00:00Z').getTime())
})

test('getLatestEndedFeed ignores invalid entries and uses newest endedAt', () => {
  const latest = getLatestEndedFeed([
    { id: 'older', endedAt: 10 },
    { id: 'invalid' },
    { id: 'newer', endedAt: 20 },
  ])

  assert.equal(latest.id, 'newer')
})

test('notification scheduler sends once for the current latest feed', async () => {
  const now = new Date('2026-06-05T10:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-1', endedAt: now - 2 * 60 * 60 * 1000 }]),
  }
  const sent = []
  const notificationRows = new Map()
  const timers = []

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
  assert.equal(timers[0].delay, 0)
  await timers[0].fn()
  scheduler.evaluate()

  assert.equal(sent.length, 1)
  assert.equal(sent[0].title, 'Feeding reminder')
  assert.match(sent[0].message, /Next feeding window is open/)
  assert.match(sent[0].message, /\n\nhttps:\/\/feedr\.kjw\.lol$/)
  assert.equal(timers.length, 1)
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
