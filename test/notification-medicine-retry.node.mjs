import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler } from '../server/notifications.js'

test('notification scheduler retries medicine reminders when every channel fails', async () => {
  const now = new Date('2026-06-05T14:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([]),
    medicines_json: JSON.stringify([{ id: 'dose-all-fail', kind: 'motrin', at: now - 6 * 60 * 60 * 1000 }]),
  }
  const notificationRows = new Map()
  const timers = []
  const warnings = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: (id) => notificationRows.get(id) },
    upsertNotificationState: { run: (state) => notificationRows.set(state.entry_id, state) },
    sendGotify: async () => { throw new Error('gotify down') },
    sendTextEmail: async () => { throw new Error('smtp down') },
    now: () => now,
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length },
    clearTimer: () => {},
    logger: { warn: (...args) => warnings.push(args) },
  })

  scheduler.evaluate()
  await timers[0].fn()

  assert.equal(notificationRows.has('medicine:motrin:dose-all-fail'), false)
  assert.equal(timers.length, 2)
  assert.equal(timers[1].delay, 0)
  assert.ok(warnings.length > 0)
})
