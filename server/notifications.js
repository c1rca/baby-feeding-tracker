const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const THREE_HOURS_MS = 3 * 60 * 60 * 1000
const MAX_CATCH_UP_MS = 30 * 60 * 1000
export const FEEDR_URL = 'https://feedr.kjw.lol'

export function getLatestEndedFeed(entries) {
  if (!Array.isArray(entries)) return null
  return entries
    .filter((entry) => Number.isFinite(entry?.endedAt) && entry.endedAt > 0)
    .sort((a, b) => b.endedAt - a.endedAt)[0] ?? null
}

export function buildReminder(latestFeed, now = Date.now()) {
  if (!latestFeed) return null
  const dueAt = latestFeed.endedAt + TWO_HOURS_MS
  const windowEndAt = latestFeed.endedAt + THREE_HOURS_MS
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS
  if (windowEndAt <= now - MAX_CATCH_UP_MS) return null
  return { entryId: latestFeed.id ?? String(latestFeed.endedAt), dueAt, windowEndAt, catchUpUntil }
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

  const evaluate = () => {
    if (!isEnabled) return cancel()
    const row = selectState.get()
    if (!row) return cancel()

    let entries = []
    try {
      entries = JSON.parse(row.entries_json)
    } catch {
      return cancel()
    }

    const latest = getLatestEndedFeed(entries)
    const reminder = buildReminder(latest, now())
    if (!reminder) return cancel()

    const notificationState = getNotificationState.get(reminder.entryId)
    if (notificationState?.sent_at) return cancel()

    if (scheduled?.entryId === reminder.entryId && scheduled?.dueAt === reminder.dueAt) return
    cancel()
    scheduled = reminder

    const delay = Math.max(0, reminder.dueAt - now())
    timer = setTimer(async () => {
      timer = null
      const freshRow = selectState.get()
      if (!freshRow) return cancel()

      let freshEntries = []
      try {
        freshEntries = JSON.parse(freshRow.entries_json)
      } catch {
        return cancel()
      }

      const freshLatest = getLatestEndedFeed(freshEntries)
      const freshReminder = buildReminder(freshLatest, now())
      if (!freshReminder || freshReminder.entryId !== reminder.entryId || now() > reminder.catchUpUntil) return evaluate()

      const freshNotificationState = getNotificationState.get(reminder.entryId)
      if (freshNotificationState?.sent_at) return cancel()

      try {
        await sendGotify({
          title: 'Feeding reminder',
          message: `Next feeding window is open (${formatTime(reminder.dueAt)}–${formatTime(reminder.windowEndAt)}).\n\n${FEEDR_URL}`,
          priority: 5,
        })
        upsertNotificationState.run({
          entry_id: reminder.entryId,
          due_at: new Date(reminder.dueAt).toISOString(),
          sent_at: new Date(now()).toISOString(),
          updated_at: new Date(now()).toISOString(),
        })
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
