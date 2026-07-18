import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler } from '../server/notifications.js'

test('notification scheduler sends independent six-hour reminders for Tylenol and Motrin doses', async () => {
  let now = new Date('2026-06-05T14:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([]),
    medicines_json: JSON.stringify([
      { id: 'tylenol-1', kind: 'tylenol', at: new Date('2026-06-05T08:00:00Z').getTime() },
      { id: 'motrin-1', kind: 'motrin', at: new Date('2026-06-05T10:00:00Z').getTime() },
    ]),
  }
  const sent = []
  const textEmails = []
  const notificationRows = new Map()
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: (id) => notificationRows.get(id) },
    upsertNotificationState: { run: (state) => notificationRows.set(state.entry_id, state) },
    sendGotify: async (payload) => sent.push(payload),
    sendTextEmail: async (payload) => textEmails.push(payload),
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

  assert.equal(sent.length, 1)
  assert.match(sent[0].message, /Take Tylenol/i)
  assert.ok(notificationRows.get('default-household:default-baby:medicine:tylenol:tylenol-1').sent_at)
  now = new Date('2026-06-05T16:00:00Z').getTime()
  scheduler.evaluate()
  assert.equal(timers[1].delay, 2 * 60 * 60 * 1000)
  await timers[1].fn()

  assert.equal(sent.length, 2)
  assert.match(sent[1].message, /Take Motrin/i)
  assert.ok(notificationRows.get('default-household:default-baby:medicine:motrin:motrin-1').sent_at)
  assert.equal(textEmails.length, 2)

  now += 7 * 60 * 60 * 1000
  scheduler.evaluate()
  assert.equal(timers.length, 2)
})

test('notification scheduler prefers the next due item when feed and medicine reminders coexist', () => {
  const now = new Date('2026-06-05T09:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([{ id: 'feed-1', endedAt: now - 90 * 60 * 1000 }]),
    medicines_json: JSON.stringify([{ id: 'dose-1', kind: 'tylenol', at: now - 5 * 60 * 60 * 1000 }]),
  }
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
    clearTimer: () => {},
    logger: { warn: () => {} },
  })

  scheduler.evaluate()

  assert.equal(timers[0].delay, 30 * 60 * 1000)
  assert.equal(scheduler.getScheduled().kind, 'feeding')
})
