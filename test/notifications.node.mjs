import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMedicineReminder, buildReminder, createNotificationScheduler, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeTextEmailRecipients } from '../server/notifications.js'

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

test('getLatestMedicineDose uses newest Tylenol or Motrin dose', () => {
  const latest = getLatestMedicineDose([
    { id: 'older-tylenol', kind: 'tylenol', at: 10 },
    { id: 'bad', kind: 'vitamin', at: 30 },
    { id: 'newer-motrin', kind: 'motrin', at: 20 },
  ])

  assert.equal(latest.id, 'newer-motrin')
})

test('getLatestMedicineDosesByKind keeps Tylenol and Motrin schedules separate', () => {
  const latest = getLatestMedicineDosesByKind([
    { id: 'older-tylenol', kind: 'tylenol', at: 10 },
    { id: 'newer-tylenol', kind: 'tylenol', at: 30 },
    { id: 'latest-motrin', kind: 'motrin', at: 20 },
    { id: 'bad', kind: 'vitamin', at: 40 },
  ])

  assert.deepEqual(latest.map((dose) => dose.id), ['newer-tylenol', 'latest-motrin'])
})

test('buildMedicineReminder schedules the same medicine six hours after latest dose', () => {
  const at = new Date('2026-06-05T08:00:00Z').getTime()
  const reminder = buildMedicineReminder({ id: 'dose-1', kind: 'tylenol', at }, at)

  assert.equal(reminder.doseId, 'dose-1')
  assert.equal(reminder.dueAt, new Date('2026-06-05T14:00:00Z').getTime())
  assert.equal(reminder.medicineKind, 'tylenol')
  assert.equal(reminder.recommendedKind, 'tylenol')
})

test('normalizeTextEmailRecipients supports comma-separated addresses', () => {
  assert.deepEqual(
    normalizeTextEmailRecipients('15551230000@vtext.com, 15551230001@tmomail.net,,15551230002@txt.att.net '),
    ['15551230000@vtext.com', '15551230001@tmomail.net', '15551230002@txt.att.net'],
  )
})

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
  assert.match(sent[0].message, /https:\/\/feedr\.kjw\.lol$/)
  assert.equal(textEmails.length, 1)
  assert.equal(textEmails[0].subject, 'Medicine reminder')
  assert.match(textEmails[0].message, /Take Motrin/i)
  assert.match(textEmails[0].message, /Last dose was Motrin/i)
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
  assert.ok(notificationRows.get('medicine:tylenol:tylenol-1').sent_at)
  now = new Date('2026-06-05T16:00:00Z').getTime()
  scheduler.evaluate()
  assert.equal(timers[1].delay, 2 * 60 * 60 * 1000)
  await timers[1].fn()

  assert.equal(sent.length, 2)
  assert.match(sent[1].message, /Take Motrin/i)
  assert.ok(notificationRows.get('medicine:motrin:motrin-1').sent_at)
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
