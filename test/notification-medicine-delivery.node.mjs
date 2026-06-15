import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationScheduler } from '../server/notifications.js'

test('notification scheduler sends Gotify and text-email medication reminders once per missed dose window', async () => {
  let now = new Date('2026-06-05T14:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([]),
    medicines_json: JSON.stringify([{ id: 'dose-1', kind: 'motrin', at: now - 6 * 60 * 60 * 1000 }]),
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
  scheduler.evaluate()

  assert.equal(sent.length, 1)
  assert.equal(sent[0].title, 'Medicine reminder')
  assert.match(sent[0].message, /Take Motrin/i)
  assert.match(sent[0].message, /Last dose was Motrin/i)
  assert.match(sent[0].message, /Log Motrin now: https:\/\/feedr\.kjw\.lol\/\?quickMed=motrin$/)
  assert.equal(sent[0].extras?.['client::notification']?.click?.url, 'https://feedr.kjw.lol/?quickMed=motrin')
  assert.equal(textEmails.length, 1)
  assert.equal(textEmails[0].subject, 'Medicine reminder')
  assert.match(textEmails[0].message, /Take Motrin/i)
  assert.match(textEmails[0].message, /Last dose was Motrin/i)
  assert.match(textEmails[0].message, /Log Motrin now: https:\/\/feedr\.kjw\.lol\/\?quickMed=motrin$/)
  assert.ok(notificationRows.get('medicine:motrin:dose-1').sent_at)
  assert.equal(timers.length, 1)

  now += 7 * 60 * 60 * 1000
  row.medicines_json = JSON.stringify([
    { id: 'dose-2', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 },
    { id: 'dose-1', kind: 'motrin', at: new Date('2026-06-05T08:00:00Z').getTime() },
  ])
  scheduler.evaluate()
  assert.equal(timers[1].delay, 0)
  await timers[1].fn()

  assert.equal(sent.length, 2)
  assert.match(sent[1].message, /Take Tylenol/i)
  assert.match(sent[1].message, /Log Tylenol now: https:\/\/feedr\.kjw\.lol\/\?quickMed=tylenol$/)
  assert.equal(textEmails.length, 2)
  assert.ok(notificationRows.get('medicine:tylenol:dose-2').sent_at)
})

test('notification scheduler does not re-trigger a medicine reminder after one channel fails', async () => {
  const now = new Date('2026-06-05T14:00:00Z').getTime()
  const row = {
    entries_json: JSON.stringify([]),
    medicines_json: JSON.stringify([{ id: 'dose-partial', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 }]),
  }
  const sent = []
  const notificationRows = new Map()
  const timers = []

  const scheduler = createNotificationScheduler({
    selectState: { get: () => row },
    getNotificationState: { get: (id) => notificationRows.get(id) },
    upsertNotificationState: { run: (state) => notificationRows.set(state.entry_id, state) },
    sendGotify: async (payload) => sent.push(payload),
    sendTextEmail: async () => { throw new Error('sms gateway unavailable') },
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
  scheduler.evaluate()

  assert.equal(sent.length, 1)
  assert.ok(notificationRows.get('medicine:tylenol:dose-partial').sent_at)
  assert.equal(timers.length, 1)
})
