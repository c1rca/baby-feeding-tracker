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
  return {
    feeding: normalizeChannelPrefs(prefs?.feeding),
    tylenol: normalizeChannelPrefs(prefs?.tylenol),
    motrin: normalizeChannelPrefs(prefs?.motrin),
    vitaminD: normalizeChannelPrefs(prefs?.vitaminD),
    tummyTime: normalizeChannelPrefs(prefs?.tummyTime),
    tummyActiveHours: normalizeHourWindow(prefs?.tummyActiveHours),
    quietHours: {
      enabled: Boolean(prefs?.quietHours?.enabled),
      ...normalizeHourWindow(prefs?.quietHours),
    },
    medicineIntervals: {
      tylenol: normalizeMedicineReminderSettings(prefs?.medicineIntervals)?.tylenol || 6,
      motrin: normalizeMedicineReminderSettings(prefs?.medicineIntervals)?.motrin || 6,
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
