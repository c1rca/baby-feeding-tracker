import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReminder, createNotificationScheduler, getLatestEndedFeed, hasActiveSession } from '../server/notifications.js'

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
  const expectedWindow = `${formatTestTime(now)}–${formatTestTime(now + 60 * 60 * 1000)}`
  assert.match(sent[0].message, new RegExp(escapeRegExp(expectedWindow)))
  assert.match(sent[0].message, /\n\nhttps:\/\/feedr\.kjw\.lol$/)
  assert.equal(timers.length, 1)
})

function formatTestTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('hasActiveSession detects persisted active sessions', () => {
  assert.equal(hasActiveSession({ session_json: null }), false)
  assert.equal(hasActiveSession({ session_json: 'null' }), false)
  assert.equal(hasActiveSession({ session_json: JSON.stringify({ startedAt: Date.now(), activeSide: 'left' }) }), true)
})

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
  assert.equal(notificationRows.get('feed-in-progress').sent_at, new Date(now).toISOString())
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
