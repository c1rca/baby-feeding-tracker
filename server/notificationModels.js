import { EIGHTEEN_HOURS_MS, FOUR_HOURS_MS, MAX_CATCH_UP_MS, SIX_HOURS_MS, THREE_HOURS_MS, TWO_HOURS_MS } from './notificationConstants.js'

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

export function getLatestMedicineDosesByKind(medicines) {
  if (!Array.isArray(medicines)) return []
  return ['tylenol', 'motrin', 'vitamin_d']
    .map((kind) => medicines
      .filter((dose) => dose?.kind === kind && Number.isFinite(dose?.at) && dose.at > 0)
      .sort((a, b) => b.at - a.at)[0])
    .filter(Boolean)
}

export function buildReminder(latestFeed, now = Date.now()) {
  if (!latestFeed) return null
  const feedStartAt = Number.isFinite(latestFeed.startedAt) && latestFeed.startedAt > 0 ? latestFeed.startedAt : latestFeed.endedAt
  const dueAt = feedStartAt + TWO_HOURS_MS
  const windowEndAt = feedStartAt + THREE_HOURS_MS
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS
  if (windowEndAt <= now - MAX_CATCH_UP_MS) return null
  return { kind: 'feeding', entryId: latestFeed.id ?? String(latestFeed.endedAt), dueAt, windowEndAt, catchUpUntil }
}

export function normalizeMedicineReminderSettings(settings = {}) {
  const intervalFor = (kind) => {
    const value = Number(settings?.[kind])
    return value === 0 || value === 4 || value === 6 ? value : 6
  }
  return { tylenol: intervalFor('tylenol'), motrin: intervalFor('motrin') }
}

export function normalizeHourWindow(window = {}) {
  const start = Math.max(0, Math.min(23, Math.round(Number(window?.startHour) || 0)))
  const end = Math.max(0, Math.min(23, Math.round(Number(window?.endHour) || 0)))
  return { startHour: start, endHour: end }
}

export function normalizeChannelPrefs(prefs = {}) {
  return {
    inApp: Boolean(prefs?.inApp),
    browser: Boolean(prefs?.browser),
    gotify: Boolean(prefs?.gotify),
  }
}

export function normalizeNotificationPreferences(prefs = {}) {
  const defaultChannels = { inApp: true, browser: false, gotify: true }
  const defaultFeedingChannels = { inApp: false, browser: true, gotify: true }
  const defaultTummyChannels = { ...defaultChannels, gotify: false }
  return {
    feeding: normalizeChannelPrefs({ ...defaultFeedingChannels, ...prefs?.feeding }),
    tylenol: normalizeChannelPrefs({ ...defaultChannels, ...prefs?.tylenol }),
    motrin: normalizeChannelPrefs({ ...defaultChannels, ...prefs?.motrin }),
    vitaminD: normalizeChannelPrefs({ ...defaultChannels, ...prefs?.vitaminD }),
    tummyTime: normalizeChannelPrefs({ ...defaultTummyChannels, ...prefs?.tummyTime }),
    tummyActiveHours: normalizeHourWindow({ startHour: 8, endHour: 20, ...prefs?.tummyActiveHours }),
    quietHours: {
      enabled: Boolean(prefs?.quietHours?.enabled),
      ...normalizeHourWindow({ startHour: 22, endHour: 7, ...prefs?.quietHours }),
    },
    medicineIntervals: {
      tylenol: normalizeMedicineReminderSettings(prefs?.medicineIntervals)?.tylenol ?? 6,
      motrin: normalizeMedicineReminderSettings(prefs?.medicineIntervals)?.motrin ?? 6,
    },
  }
}

export function buildMedicineReminder(latestDose, now = Date.now(), settings = {}) {
  if (!latestDose) return null
  if (latestDose.kind === 'vitamin_d') {
    const dueAt = latestDose.at + EIGHTEEN_HOURS_MS
    const catchUpUntil = dueAt + MAX_CATCH_UP_MS
    if (dueAt <= now - MAX_CATCH_UP_MS) return null
    return { kind: 'medicine', doseId: latestDose.id ?? String(latestDose.at), medicineKind: latestDose.kind, recommendedKind: latestDose.kind, dueAt, catchUpUntil, intervalHours: 18 }
  }
  const intervalHours = normalizeMedicineReminderSettings(settings)[latestDose.kind]
  if (!intervalHours) return null
  const dueAt = latestDose.at + (intervalHours === 4 ? FOUR_HOURS_MS : SIX_HOURS_MS)
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS
  if (dueAt <= now - MAX_CATCH_UP_MS) return null
  return { kind: 'medicine', doseId: latestDose.id ?? String(latestDose.at), medicineKind: latestDose.kind, recommendedKind: latestDose.kind, dueAt, catchUpUntil, intervalHours }
}

export function hasActiveSession(row) {
  if (!row?.session_json) return false
  try {
    return Boolean(JSON.parse(row.session_json))
  } catch {
    return Boolean(row.session_json)
  }
}

export function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }
}

const zonedDateKey = (timestamp, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(timestamp)

const zonedHour = (timestamp, timeZone) => Number(new Intl.DateTimeFormat('en-US', {
  timeZone,
  hour: 'numeric',
  hourCycle: 'h23',
}).format(timestamp))

export function buildVitaminDReminder(medicines, now = Date.now()) {
  const latestVitaminD = getLatestMedicineDosesByKind(medicines).find((dose) => dose.kind === 'vitamin_d')
  if (!latestVitaminD) return null

  const dueAt = latestVitaminD.at + EIGHTEEN_HOURS_MS
  const catchUpUntil = dueAt + MAX_CATCH_UP_MS

  if (dueAt <= now - MAX_CATCH_UP_MS) return null

  return {
    kind: 'vitamin_d',
    doseId: latestVitaminD.id ?? String(latestVitaminD.at),
    medicineKind: 'vitamin_d',
    recommendedKind: 'vitamin_d',
    dueAt,
    catchUpUntil,
    intervalHours: 18,
  }
}

export function buildTummyTimeReminder(tummyTimes, now = Date.now(), activeHours = { startHour: 8, endHour: 20 }, timeZone = 'America/New_York') {
  if (!Array.isArray(tummyTimes)) return null

  const todayKey = zonedDateKey(now, timeZone)
  const todayTummyTimes = tummyTimes.filter((t) => Number.isFinite(t?.startedAt) && zonedDateKey(t.startedAt, timeZone) === todayKey)

  // Only suggest once per day, and only during active hours
  const currentHour = zonedHour(now, timeZone)
  const isInActiveWindow = activeHours.startHour <= activeHours.endHour
    ? currentHour >= activeHours.startHour && currentHour < activeHours.endHour
    : currentHour >= activeHours.startHour || currentHour < activeHours.endHour

  if (!isInActiveWindow || todayTummyTimes.length > 0) return null

  // Suggest tummy time at the start of the active window
  const dueAt = now
  const catchUpUntil = now + 2 * 60 * 60 * 1000

  return {
    kind: 'tummy_time',
    dueAt,
    catchUpUntil,
    sessionId: `tummy:${todayKey}`,
  }
}
