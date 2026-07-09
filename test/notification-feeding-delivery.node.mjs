import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler, formatTime } from '../server/notifications.js'

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

test('notification scheduler formats feeding windows in configured app time zone', async () => {
  const now = new Date('2026-06-05T14:40:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-eastern', endedAt: now - 2 * 60 * 60 * 1000 }]),
  }
  const sent = []
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: () => null },
    upsertNotificationState: { run: () => {} },
    sendGotify: async (payload) => sent.push(payload),
    now: () => now,
    timeZone: 'America/New_York',
    setTimer: (fn, delay) => {
      timers.push({ fn, delay })
      return timers.length
    },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()
  await timers[0].fn()

  assert.match(sent[0].message, /Next feeding window is open \(10:40 AM–11:40 AM\)\./)
})

test('notification scheduler scans tenant baby states and sends the earliest unsent reminder', async () => {
  const now = new Date('2026-06-05T10:00:00Z').getTime()
  const rows = [
    { household_id: 'household-a', baby_id: 'baby-a', entries_json: JSON.stringify([{ id: 'feed-a', endedAt: now - 2 * 60 * 60 * 1000 }]) },
    { household_id: 'household-b', baby_id: 'baby-b', entries_json: JSON.stringify([{ id: 'feed-b', endedAt: now - 150 * 60 * 1000 }]) },
  ]
  const sent = []
  const handled = new Map()
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => { throw new Error('legacy app_state should not be used when tenant states are available') } },
    selectAllStates: { all: () => rows },
    getNotificationState: { get: (id) => handled.get(id) },
    upsertNotificationState: { run: (state) => handled.set(state.entry_id, state) },
    sendGotify: async (payload) => sent.push(payload),
    now: () => now,
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()
  assert.equal(timers[0].delay, 0)
  await timers[0].fn()

  assert.equal(sent.length, 1)
  assert.deepEqual([...handled.keys()], ['feed-b'])
})

function formatTestTime(timestamp) {
  return formatTime(timestamp)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
