import { DEFAULT_TIME_ZONE, FEEDR_URL } from './notificationConstants.js'
import { buildMedicineQuickLogUrl, formatTime, normalizeTextEmailRecipients } from './notificationFormatting.js'
import { buildMedicineReminder, buildReminder, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeMedicineReminderSettings, parseJsonArray } from './notificationModels.js'
import { buildFeedingNotificationPayload, buildMedicineNotificationPayload } from './notificationPayloads.js'

export { FEEDR_URL }
export { buildMedicineQuickLogUrl, buildMedicineReminder, buildReminder, formatTime, getLatestEndedFeed, getLatestMedicineDose, getLatestMedicineDosesByKind, hasActiveSession, normalizeMedicineReminderSettings, normalizeTextEmailRecipients }

export function createNotificationScheduler({
  selectState,
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
      if (feeding) reminders.push({ ...feeding, notificationId: feeding.entryId })
    }
    const medicineReminderSettings = getMedicineReminderSettings()
    for (const latestDose of getLatestMedicineDosesByKind(medicines)) {
      const medicine = buildMedicineReminder(latestDose, now(), medicineReminderSettings)
      if (medicine) reminders.push({ ...medicine, notificationId: `medicine:${medicine.medicineKind}:${medicine.doseId}` })
    }

    return reminders
      .filter((reminder) => !getNotificationState.get(reminder.notificationId)?.sent_at)
      .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null
  }

  const sendDueReminder = async (freshReminder) => {
    if (freshReminder.kind === 'medicine') {
      markHandled(freshReminder)
      const results = await Promise.allSettled([
        sendGotify ? sendGotify(buildMedicineNotificationPayload(freshReminder)) : Promise.resolve(),
        sendTextEmail ? sendTextEmail(buildMedicineNotificationPayload(freshReminder)) : Promise.resolve(),
      ])
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) logger.warn?.('Medicine notification channel failed', failed.reason)
      return
    }

    await sendGotify(buildFeedingNotificationPayload(freshReminder, timeZone))
    markHandled(freshReminder)
  }

  const evaluate = () => {
    if (!isEnabled) return cancel()
    const row = selectState.get()
    if (!row) return cancel()

    const reminder = buildNextReminder(row)
    if (!reminder) return cancel()

    if (scheduled?.notificationId === reminder.notificationId && scheduled?.dueAt === reminder.dueAt) return
    cancel()
    scheduled = reminder

    const delay = Math.max(0, reminder.dueAt - now())
    timer = setTimer(async () => {
      timer = null
      const freshRow = selectState.get()
      if (!freshRow) return cancel()

      if (reminder.kind === 'feeding' && hasActiveSession(freshRow)) {
        markHandled(reminder)
        scheduled = null
        return evaluate()
      }

      const freshReminder = buildNextReminder(freshRow)
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
