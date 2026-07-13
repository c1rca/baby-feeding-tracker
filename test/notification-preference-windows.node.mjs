import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler } from '../server/notifications.js'
import { normalizeNotificationPreferences } from '../server/notificationModels.js'

const HOUR = 60 * 60 * 1000

function schedulerHarness({ initialNow, preferences, row }) {
  let clock = initialNow
  const timers = []
  const sent = []
  const handled = new Map()
  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: (id) => handled.get(id) },
    upsertNotificationState: { run: (state) => handled.set(state.entry_id, state) },
    sendGotify: async (payload) => sent.push(payload),
    getNotificationPreferences: () => normalizeNotificationPreferences(preferences),
    now: () => clock,
    timeZone: 'America/New_York',
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length },
    clearTimer: () => {},
    logger: { warn: () => {} },
  })
  return { scheduler, timers, sent, setNow: (value) => { clock = value } }
}

test('scheduler wakes when quiet hours end and delivers a still-current due reminder', async () => {
  const quietNow = new Date('2026-06-06T10:30:00Z').getTime() // 6:30 AM Eastern
  const harness = schedulerHarness({
    initialNow: quietNow,
    preferences: { quietHours: { enabled: true, startHour: 22, endHour: 7 } },
    row: { entries_json: JSON.stringify([{ id: 'feed-quiet', startedAt: quietNow - 2 * HOUR, endedAt: quietNow - HOUR }]) },
  })

  harness.scheduler.evaluate()
  assert.ok(harness.timers[0].delay > 0)
  assert.ok(harness.timers[0].delay <= 30 * 60 * 1000)

  harness.setNow(new Date('2026-06-06T11:00:00Z').getTime()) // 7 AM Eastern
  await harness.timers[0].fn()
  await harness.timers.at(-1).fn()
  assert.equal(harness.sent.length, 1)
  assert.equal(harness.sent[0].title, 'Feeding reminder')
})

test('scheduler wakes for tummy active hours and sends only the enabled channel', async () => {
  const beforeWindow = new Date('2026-06-05T11:00:00Z').getTime() // 7 AM Eastern
  const harness = schedulerHarness({
    initialNow: beforeWindow,
    preferences: {
      feeding: { gotify: false },
      tummyTime: { gotify: true },
      tummyActiveHours: { startHour: 8, endHour: 20 },
    },
    row: { entries_json: '[]', medicines_json: '[]', tummy_times_json: '[]' },
  })

  harness.scheduler.evaluate()
  assert.ok(harness.timers[0].delay > 0)
  assert.ok(harness.timers[0].delay <= HOUR)

  harness.setNow(new Date('2026-06-05T12:00:00Z').getTime())
  await harness.timers[0].fn()
  await harness.timers.at(-1).fn()
  assert.equal(harness.sent.length, 1)
  assert.equal(harness.sent[0].title, 'Tummy Time reminder')
})
