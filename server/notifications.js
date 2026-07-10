import { DEFAULT_TIME_ZONE, FEEDR_URL } from './notificationConstants.js'
import { buildMedicineQuickLogUrl, formatTime, normalizeTextEmailRecipients } from './notificationFormatting.js'
import { buildMedicineReminder, buildReminder, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeMedicineReminderSettings, parseJsonArray } from './notificationModels.js'
import { buildFeedingNotificationPayload, buildMedicineNotificationPayload } from './notificationPayloads.js'

export { FEEDR_URL }
export { buildMedicineQuickLogUrl, buildMedicineReminder, buildReminder, formatTime, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeMedicineReminderSettings, normalizeTextEmailRecipients }

export function createNotificationScheduler({
  selectState,
  selectAllStates = null,
  getNotificationState,
  upsertNotificationState,
  sendGotify,
  sendTextEmail,
  enabled = true,
  getMedicineReminderSettings = () => ({ tylenol: 6, motrin: 6 }),
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
  timeZone = process.env.FEEDING_TIME_ZONE || process.env.TZ || DEFAULT_TIME_ZONE,
}) {
  let timer = null
  let scheduled = null
  let isEnabled = enabled

  const cancel = () => {
    if (timer) clearTimer(timer)
    timer = null
    scheduled = null
  }

  const markHandled = (reminder) => {
    upsertNotificationState.run({
      entry_id: reminder.notificationId,
      due_at: new Date(reminder.dueAt).toISOString(),
      sent_at: new Date(now()).toISOString(),
      updated_at: new Date(now()).toISOString(),
    })
  }

  const buildNextReminder = (row) => {
    const entries = parseJsonArray(row.entries_json)
    if (!entries) return null
    const medicines = parseJsonArray(row.medicines_json || '[]')
    if (!medicines) return null

    const reminders = []
    if (!hasActiveSession(row) && sendGotify) {
      const feeding = buildReminder(getLatestEndedFeed(entries), now())
      if (feeding) reminders.push({ ...feeding, householdId: row.household_id, babyId: row.baby_id, notificationId: feeding.entryId })
    }
    const medicineReminderSettings = getMedicineReminderSettings()
    for (const latestDose of getLatestMedicineDosesByKind(medicines)) {
      const medicine = buildMedicineReminder(latestDose, now(), medicineReminderSettings)
      if (medicine) reminders.push({ ...medicine, householdId: row.household_id, babyId: row.baby_id, notificationId: `medicine:${medicine.medicineKind}:${medicine.doseId}` })
    }

    return reminders
      .filter((reminder) => !getNotificationState.get(reminder.notificationId)?.sent_at)
      .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null
  }

  const sendDueReminder = async (freshReminder) => {
    if (freshReminder.kind === 'medicine') {
      const channelSends = [
        sendGotify ? sendGotify(buildMedicineNotificationPayload(freshReminder)) : null,
        sendTextEmail ? sendTextEmail(buildMedicineNotificationPayload(freshReminder)) : null,
      ].filter(Boolean)
      const results = await Promise.allSettled(channelSends)
      if (results.length === 0) throw new Error('No medicine notification channels configured')
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length === results.length) throw failures[0].reason
      if (failures.length > 0) logger.warn?.('Medicine notification channel failed', failures[0].reason)
      markHandled(freshReminder)
      return
    }

    await sendGotify(buildFeedingNotificationPayload(freshReminder, timeZone))
    markHandled(freshReminder)
  }

  const getStateRows = () => {
    const rows = selectAllStates?.all?.()
    if (Array.isArray(rows)) return rows
    const row = selectState.get()
    return row ? [row] : []
  }

  const evaluate = () => {
    if (!isEnabled) return cancel()
    const rows = getStateRows()
    if (rows.length === 0) return cancel()

    const reminder = rows.map((row) => buildNextReminder(row)).filter(Boolean).sort((a, b) => a.dueAt - b.dueAt)[0] ?? null
    if (!reminder) return cancel()

    if (scheduled?.notificationId === reminder.notificationId && scheduled?.dueAt === reminder.dueAt) return
    cancel()
    scheduled = reminder

    const delay = Math.max(0, reminder.dueAt - now())
    timer = setTimer(async () => {
      timer = null
      const freshRows = getStateRows()
      if (freshRows.length === 0) return cancel()

      const freshReminder = freshRows.map((row) => buildNextReminder(row)).filter(Boolean).sort((a, b) => a.dueAt - b.dueAt)[0] ?? null
      const freshRow = freshRows.find((row) => row.household_id === reminder.householdId && row.baby_id === reminder.babyId) || freshRows.find((row) => buildNextReminder(row)?.notificationId === reminder.notificationId)
      if (reminder.kind === 'feeding' && freshRow && hasActiveSession(freshRow)) {
        markHandled(reminder)
        scheduled = null
        return evaluate()
      }

      if (!freshReminder || freshReminder.notificationId !== reminder.notificationId || now() > freshReminder.catchUpUntil) return evaluate()

      try {
        await sendDueReminder(freshReminder)
      } catch (error) {
        scheduled = null
        logger.warn?.('Gotify notification failed', error)
      } finally {
        evaluate()
      }
    }, delay)
  }

  const setEnabled = (nextEnabled) => {
    isEnabled = Boolean(nextEnabled)
    if (isEnabled) evaluate()
    else cancel()
  }

  return { evaluate, cancel, setEnabled, isEnabled: () => isEnabled, getScheduled: () => scheduled }
}

export async function sendGotifyMessage({ url, token, title, message, priority = 5, extras }) {
  if (!url || !token) throw new Error('Gotify URL and token are required')
  const response = await fetch(`${url.replace(/\/$/, '')}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, message, priority, ...(extras ? { extras } : {}) }),
  })
  if (!response.ok) throw new Error(`Gotify responded ${response.status}`)
}
