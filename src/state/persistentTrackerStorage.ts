import { normalizeGrowthMeasurements } from '../domain/growth'
import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes, TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES } from '../domain/tummyTime'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, HealthRecord, LegacySession, MedicineEvent, PumpEvent, PumpSession, Theme, TummyTimeEvent, TummyTimeSession, CustomTracker, CustomEvent } from '../types'
import { normalizeHealthRecords } from '../domain/healthRecords'
import { normalizeCustomEvents, normalizeCustomTrackers } from '../domain/customTrackers'

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
  pumpGoalOunces: 'baby-feeding-tracker:v1:pump-goal-ounces',
  pumpGoalSessions: 'baby-feeding-tracker:v1:pump-goal-sessions',
  growthMeasurements: 'baby-feeding-tracker:v1:growth-measurements',
  healthRecords: 'baby-feeding-tracker:v1:health-records',
  customTrackers: 'baby-feeding-tracker:v1:custom-trackers',
  customEvents: 'baby-feeding-tracker:v1:custom-events',
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
  pumpGoalOunces: scopedKey(TRACKER_STORAGE_KEYS.pumpGoalOunces, babyId),
  pumpGoalSessions: scopedKey(TRACKER_STORAGE_KEYS.pumpGoalSessions, babyId),
  growthMeasurements: scopedKey(TRACKER_STORAGE_KEYS.growthMeasurements, babyId),
  healthRecords: scopedKey(TRACKER_STORAGE_KEYS.healthRecords, babyId),
  customTrackers: scopedKey(TRACKER_STORAGE_KEYS.customTrackers, babyId),
  customEvents: scopedKey(TRACKER_STORAGE_KEYS.customEvents, babyId),
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

export const readSortedHealthRecords = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => {
  return normalizeHealthRecords(safeJsonParse<HealthRecord[]>(localStorage.getItem(keys.healthRecords)) ?? [])
}

export const readCustomTrackers = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) =>
  normalizeCustomTrackers(safeJsonParse<CustomTracker[]>(localStorage.getItem(keys.customTrackers)) ?? [])

export const readCustomEvents = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) =>
  normalizeCustomEvents(safeJsonParse<CustomEvent[]>(localStorage.getItem(keys.customEvents)) ?? [])

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
const clampPumpGoal = (raw: string | null, max: number) => { const n = Math.round(Number(raw)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0 }
export const readPumpGoalOunces = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => clampPumpGoal(localStorage.getItem(keys.pumpGoalOunces), 500)
export const readPumpGoalSessions = (keys: TrackerStorageKeys = TRACKER_STORAGE_KEYS) => clampPumpGoal(localStorage.getItem(keys.pumpGoalSessions), 50)

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


/**
 * Write to the local cache, tolerating a browser that refuses.
 *
 * These values also live in React state and sync to the server, so the cache is
 * a convenience — losing it must never take the app down with it. Unguarded,
 * every one of these writes ran inside a React effect, so a QuotaExceededError
 * (or Safari private mode, or a user blocking site data) propagated to the
 * ErrorBoundary and white-screened the whole tracker. The sync modules already
 * treat their own writes as best-effort; this layer was the exception.
 *
 * Reported once, not per key: a full quota fails every write on every change,
 * and a console full of identical warnings buries the one that mattered.
 */
let cacheWriteFailureReported = false
export const writeTrackerValue = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (!cacheWriteFailureReported) {
      cacheWriteFailureReported = true
      console.warn('local cache write failed; continuing from memory and the server', error)
    }
    return false
  }
}

export const persistTheme = (theme: Theme) => {
  writeTrackerValue(TRACKER_STORAGE_KEYS.theme, theme)
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.setAttribute('data-theme', theme)
}
