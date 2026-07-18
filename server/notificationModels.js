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

export function buildReminder(latestFeed, now = Date.now(), intervalHours = 2) {
  if (!latestFeed || !Number.isFinite(intervalHours) || intervalHours <= 0) return null
  const feedStartAt = Number.isFinite(latestFeed.startedAt) && latestFeed.startedAt > 0 ? latestFeed.startedAt : latestFeed.endedAt
  const dueAt = feedStartAt + intervalHours * 60 * 60 * 1000
  const windowEndAt = dueAt + 60 * 60 * 1000
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
  const startMinute = Math.max(0, Math.min(59, Math.round(Number(window?.startMinute) || 0)))
  const endMinute = Math.max(0, Math.min(59, Math.round(Number(window?.endMinute) || 0)))
  return { startHour: start, startMinute, endHour: end, endMinute }
}

export function normalizeChannelPrefs(prefs = {}) {
  return {
    inApp: Boolean(prefs?.inApp),
    browser: Boolean(prefs?.browser),
    gotify: Boolean(prefs?.gotify),
  }
}

export function normalizeReminderInterval(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 72 ? numeric : fallback
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
    reminderIntervals: {
      feeding: normalizeReminderInterval(prefs?.reminderIntervals?.feeding, 2),
      vitaminD: normalizeReminderInterval(prefs?.reminderIntervals?.vitaminD, 18),
      tummyTime: normalizeReminderInterval(prefs?.reminderIntervals?.tummyTime, 2),
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

export function buildVitaminDReminder(medicines, now = Date.now(), intervalHours = 18) {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return null
  const latestVitaminD = getLatestMedicineDosesByKind(medicines).find((dose) => dose.kind === 'vitamin_d')
  if (!latestVitaminD) return null

  const dueAt = latestVitaminD.at + intervalHours * 60 * 60 * 1000
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

const zonedMinuteOfDay = (timestamp, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(timestamp)
  const value = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return value('hour') * 60 + value('minute')
}

// Naps are stored alongside tummy time (kind: 'sleep') and must never count
// toward the tummy-time goal — mirror the client's isTummyTimeEvent filter.
export function tummyMinutesOnDay(tummyTimes, now, timeZone) {
  if (!Array.isArray(tummyTimes)) return 0
  const dayKey = zonedDateKey(now, timeZone)
  return tummyTimes
    .filter((event) => event?.kind !== 'sleep' && Number.isFinite(event?.startedAt) && zonedDateKey(event.startedAt, timeZone) === dayKey)
    .reduce((total, event) => total + Math.max(0, Math.round(((Number.isFinite(event?.endedAt) ? event.endedAt : event.startedAt) - event.startedAt) / 60000)), 0)
}

export function buildTummyTimeReminder(tummyTimes, now = Date.now(), activeHours = { startHour: 8, endHour: 20 }, timeZone = 'America/New_York', intervalHours = 2, goalMinutes = 0) {
  if (!Array.isArray(tummyTimes) || !Number.isFinite(intervalHours) || intervalHours <= 0) return null
  // Once the day's logged tummy time meets the goal, stop nagging (matches the
  // client banner). goalMinutes <= 0 means "no goal configured" — don't suppress.
  if (Number.isFinite(goalMinutes) && goalMinutes > 0 && tummyMinutesOnDay(tummyTimes, now, timeZone) >= goalMinutes) return null
  const currentMinute = zonedMinuteOfDay(now, timeZone)
  const startMinute = activeHours.startHour * 60 + (activeHours.startMinute ?? 0)
  const endMinute = activeHours.endHour * 60 + (activeHours.endMinute ?? 0)
  const inWindow = startMinute === endMinute || (startMinute < endMinute ? currentMinute >= startMinute && currentMinute < endMinute : currentMinute >= startMinute || currentMinute < endMinute)
  if (!inWindow) return null
  const elapsed = (currentMinute - startMinute + 1440) % 1440
  const slot = Math.floor(elapsed / (intervalHours * 60))
  const todayKey = zonedDateKey(now, timeZone)
  return { kind: 'tummy_time', dueAt: now, catchUpUntil: now + 2 * 60 * 60 * 1000, sessionId: `tummy:${todayKey}:${slot}` }
}
