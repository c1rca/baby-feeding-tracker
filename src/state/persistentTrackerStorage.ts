import { normalizeGrowthMeasurements } from '../domain/growth'
import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes, TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES } from '../domain/tummyTime'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, LegacySession, MedicineEvent, PumpEvent, PumpSession, Theme, TummyTimeEvent, TummyTimeSession } from '../types'

export const TRACKER_STORAGE_KEYS = {
  entries: 'baby-feeding-tracker:v1:entries',
  session: 'baby-feeding-tracker:v1:session',
  theme: 'baby-feeding-tracker:v1:theme',
  settingsOpen: 'baby-feeding-tracker:v1:settings-open',
  feedingNotifications: 'baby-feeding-tracker:v1:feeding-notifications',
  browserReminders: 'baby-feeding-tracker:v1:browser-reminders',
  diapers: 'baby-feeding-tracker:v1:diapers',
  medicines: 'baby-feeding-tracker:v1:medicines',
  tummyTimes: 'baby-feeding-tracker:v1:tummy-times',
  pumpEvents: 'baby-feeding-tracker:v1:pump-events',
  pumpSession: 'baby-feeding-tracker:v1:pump-session',
  tummySession: 'baby-feeding-tracker:v1:tummy-session',
  tummyGoalMinutes: 'baby-feeding-tracker:v1:tummy-goal-minutes',
  growthMeasurements: 'baby-feeding-tracker:v1:growth-measurements',
  babyDob: 'baby-feeding-tracker:v1:baby-dob',
} as const

type TrackerStorageKeys = Record<keyof typeof TRACKER_STORAGE_KEYS, string>

const scopedKey = (key: string, babyId?: string | null) => {
  const normalizedBabyId = String(babyId || '').trim()
  if (!normalizedBabyId) return key
  const prefix = 'baby-feeding-tracker:v1:'
  return key.startsWith(prefix)
    ? `${prefix}baby:${encodeURIComponent(normalizedBabyId)}:${key.slice(prefix.length)}`
    : `${key}:baby:${encodeURIComponent(normalizedBabyId)}`
}

export const getTrackerStorageKeys = (babyId?: string | null): TrackerStorageKeys => ({
  entries: scopedKey(TRACKER_STORAGE_KEYS.entries, babyId),
  session: scopedKey(TRACKER_STORAGE_KEYS.session, babyId),
  theme: TRACKER_STORAGE_KEYS.theme,
  settingsOpen: TRACKER_STORAGE_KEYS.settingsOpen,
  feedingNotifications: scopedKey(TRACKER_STORAGE_KEYS.feedingNotifications, babyId),
  browserReminders: scopedKey(TRACKER_STORAGE_KEYS.browserReminders, babyId),
  diapers: scopedKey(TRACKER_STORAGE_KEYS.diapers, babyId),
  medicines: scopedKey(TRACKER_STORAGE_KEYS.medicines, babyId),
  tummyTimes: scopedKey(TRACKER_STORAGE_KEYS.tummyTimes, babyId),
  pumpEvents: scopedKey(TRACKER_STORAGE_KEYS.pumpEvents, babyId),
  pumpSession: scopedKey(TRACKER_STORAGE_KEYS.pumpSession, babyId),
  tummySession: scopedKey(TRACKER_STORAGE_KEYS.tummySession, babyId),
  tummyGoalMinutes: scopedKey(TRACKER_STORAGE_KEYS.tummyGoalMinutes, babyId),
  growthMeasurements: scopedKey(TRACKER_STORAGE_KEYS.growthMeasurements, babyId),
  babyDob: scopedKey(TRACKER_STORAGE_KEYS.babyDob, babyId),
})

const THEME_COOKIE = 'baby_feeding_theme'

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// Collections are always persisted as arrays. A corrupt or wrong-type value
// (e.g. a stray object or string) must degrade to an empty list rather than
// throw inside `.sort()` during initial state hydration, which would crash the
// whole app for that baby with no recovery path. The server copy re-hydrates.
const safeJsonArray = <T,>(raw: string | null): T[] => {
  const parsed = safeJsonParse<unknown>(raw)
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

export const readSortedEntries = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return safeJsonArray<Entry>(localStorage.getItem(keys.entries)).sort((a, b) => b.endedAt - a.endedAt)
}

export const readSortedDiapers = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return safeJsonArray<DiaperEvent>(localStorage.getItem(keys.diapers)).sort((a, b) => b.at - a.at)
}

export const readSortedMedicines = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return safeJsonArray<MedicineEvent>(localStorage.getItem(keys.medicines)).sort((a, b) => b.at - a.at)
}

export const readSortedTummyTimes = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return safeJsonArray<TummyTimeEvent>(localStorage.getItem(keys.tummyTimes)).sort((a, b) => b.startedAt - a.startedAt)
}

export const readSortedPumpEvents = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return safeJsonArray<PumpEvent>(localStorage.getItem(keys.pumpEvents)).sort((a, b) => b.startedAt - a.startedAt)
}

export const readPumpSession = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => safeJsonParse<PumpSession>(localStorage.getItem(keys.pumpSession))

export const readTummySession = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => safeJsonParse<TummyTimeSession>(localStorage.getItem(keys.tummySession))

export const readSortedGrowthMeasurements = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  const parsed = safeJsonParse<GrowthMeasurement[]>(localStorage.getItem(keys.growthMeasurements)) ?? []
  return normalizeGrowthMeasurements(parsed)
}

export const readSession = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  const parsed = safeJsonParse<LegacySession>(localStorage.getItem(keys.session))
  return parsed ? normalizeSession(parsed) : null
}

export const readFeedingNotificationsEnabled = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => localStorage.getItem(keys.feedingNotifications) === '1'

export const readBrowserRemindersEnabled = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  // Try new key first, fall back to legacy feedingNotifications key for backward compatibility
  const newValue = localStorage.getItem(keys.browserReminders)
  if (newValue !== null) return newValue === '1'
  return localStorage.getItem(keys.feedingNotifications) === '1'
}

export const readBabyDob = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => localStorage.getItem(keys.babyDob) || '2026-06-03'
export const readTummyGoalMinutes = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => normalizeTummyTimeGoalMinutes(localStorage.getItem(keys.tummyGoalMinutes) ?? TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES)

const getCookieTheme = (): Theme | null => {
  const match = document.cookie.match(/(?:^|; )baby_feeding_theme=([^;]+)/)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return value === 'dark' || value === 'light' ? value : null
}

export const readTheme = (): Theme => {
  const stored = localStorage.getItem(TRACKER_STORAGE_KEYS.theme)
  return getCookieTheme() || (stored === 'dark' || stored === 'light' ? stored : null) || 'dark'
}

export const hasPersistedThemePreference = () => {
  const stored = localStorage.getItem(TRACKER_STORAGE_KEYS.theme)
  return getCookieTheme() !== null || stored === 'dark' || stored === 'light'
}

export const persistTheme = (theme: Theme) => {
  localStorage.setItem(TRACKER_STORAGE_KEYS.theme, theme)
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.setAttribute('data-theme', theme)
}
