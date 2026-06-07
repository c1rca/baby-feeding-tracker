const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const THREE_HOURS_MS = 3 * 60 * 60 * 1000
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const MAX_CATCH_UP_MS = 30 * 60 * 1000
export const FEEDR_URL = 'https://feedr.kjw.lol'

export function getLatestEndedFeed(entries) {
  if (!Array.isArray(entries)) return null
  return entries
    .filter((entry) => Number.isFinite(entry?.endedAt) && entry.endedAt > 0)
    .sort((a, b) => b.endedAt - a.endedAt)[0] ?? null
}

export function getLatestMedicineDose(medicines) {
  if (!Array.isArray(medicines)) return null
  return medicines
    .filter((dose) => (dose?.kind === 'tylenol' || dose?.kind === 'motrin') && Number.isFinite(dose?.at) && dose.at > 0)
    .sort((a, b) => b.at - a.at)[0] ?? null
}

export function buildReminder(latestFeed, now = Date.now()) {
  if (!latestFeed) return null
  const dueAt = latestFeed.endedAt + TWO_HOURS_MS
  const windowEndAt = latestFeed.endedAt + THREE_HOURS_MS
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS
  if (windowEndAt <= now - MAX_CATCH_UP_MS) return null
  return { kind: 'feeding', entryId: latestFeed.id ?? String(latestFeed.endedAt), dueAt, windowEndAt, catchUpUntil }
}

export function buildMedicineReminder(latestDose, now = Date.now()) {
  if (!latestDose) return null
  const dueAt = latestDose.at + SIX_HOURS_MS
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS
  if (dueAt <= now - MAX_CATCH_UP_MS) return null
  return { kind: 'medicine', doseId: latestDose.id ?? String(latestDose.at), medicineKind: latestDose.kind, recommendedKind: oppositeMedication(latestDose.kind), dueAt, catchUpUntil }
}

export function hasActiveSession(row) {
  if (!row?.session_json) return false
  try {
    return Boolean(JSON.parse(row.session_json))
  } catch {
    return Boolean(row.session_json)
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }
}

function medicationLabel(kind) {
  return kind === 'motrin' ? 'Motrin' : 'Tylenol'
}

function oppositeMedication(kind) {
  return kind === 'motrin' ? 'tylenol' : 'motrin'
}

export function createNotificationScheduler({
  selectState,
  getNotificationState,
  upsertNotificationState,
  sendGotify,
  enabled = true,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
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
    if (!hasActiveSession(row)) {
      const feeding = buildReminder(getLatestEndedFeed(entries), now())
      if (feeding) reminders.push({ ...feeding, notificationId: feeding.entryId })
    }
    const medicine = buildMedicineReminder(getLatestMedicineDose(medicines), now())
    if (medicine) reminders.push({ ...medicine, notificationId: `medicine:${medicine.doseId}` })

    return reminders
      .filter((reminder) => !getNotificationState.get(reminder.notificationId)?.sent_at)
      .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null
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
        if (freshReminder.kind === 'medicine') {
          await sendGotify({
            title: 'Medicine reminder',
            message: `Take ${medicationLabel(freshReminder.recommendedKind)}. Last dose was ${medicationLabel(freshReminder.medicineKind)} 6+ hours ago.\n\n${FEEDR_URL}`,
            priority: 5,
          })
        } else {
          await sendGotify({
            title: 'Feeding reminder',
            message: `Next feeding window is open (${formatTime(freshReminder.dueAt)}–${formatTime(freshReminder.windowEndAt)}).\n\n${FEEDR_URL}`,
            priority: 5,
          })
        }
        markHandled(freshReminder)
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

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export async function sendGotifyMessage({ url, token, title, message, priority = 5 }) {
  if (!url || !token) throw new Error('Gotify URL and token are required')
  const response = await fetch(`${url.replace(/\/$/, '')}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, message, priority }),
  })
  if (!response.ok) throw new Error(`Gotify responded ${response.status}`)
}
