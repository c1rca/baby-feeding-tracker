import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMedicineQuickLogUrl, buildMedicineReminder, buildReminder, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeTextEmailRecipients } from '../server/notifications.js'

test('buildReminder schedules the next feeding window two to three hours after latest feed start', () => {
  const startedAt = new Date('2026-06-05T08:00:00Z').getTime()
  const endedAt = new Date('2026-06-05T11:00:00Z').getTime()
  const reminder = buildReminder({ id: 'feed-1', startedAt, endedAt }, endedAt)

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

test('buildMedicineQuickLogUrl links directly to quick logging the medicine kind', () => {
  assert.equal(buildMedicineQuickLogUrl('motrin'), 'https://feedr.kjw.lol/?quickMed=motrin')
})

test('hasActiveSession detects persisted active sessions', () => {
  assert.equal(hasActiveSession({ session_json: null }), false)
  assert.equal(hasActiveSession({ session_json: 'null' }), false)
  assert.equal(hasActiveSession({ session_json: JSON.stringify({ startedAt: Date.now(), activeSide: 'left' }) }), true)
})
