import { normalizeGrowthMeasurements } from '../domain/growth'
import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes, TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES } from '../domain/tummyTime'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, LegacySession, MedicineEvent, Theme, TummyTimeEvent, TummyTimeSession } from '../types'

export const TRACKER_STORAGE_KEYS = {
  entries: 'baby-feeding-tracker:v1:entries',
  session: 'baby-feeding-tracker:v1:session',
  theme: 'baby-feeding-tracker:v1:theme',
  settingsOpen: 'baby-feeding-tracker:v1:settings-open',
  feedingNotifications: 'baby-feeding-tracker:v1:feeding-notifications',
  diapers: 'baby-feeding-tracker:v1:diapers',
  medicines: 'baby-feeding-tracker:v1:medicines',
  tummyTimes: 'baby-feeding-tracker:v1:tummy-times',
  tummySession: 'baby-feeding-tracker:v1:tummy-session',
  tummyGoalMinutes: 'baby-feeding-tracker:v1:tummy-goal-minutes',
  growthMeasurements: 'baby-feeding-tracker:v1:growth-measurements',
  babyDob: 'baby-feeding-tracker:v1:baby-dob',
} as const

const THEME_COOKIE = 'baby_feeding_theme'

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const readSortedEntries = () => {
  const parsed = safeJsonParse<Entry[]>(localStorage.getItem(TRACKER_STORAGE_KEYS.entries)) ?? []
  return parsed.sort((a, b) => b.endedAt - a.endedAt)
}

export const readSortedDiapers = () => {
  const parsed = safeJsonParse<DiaperEvent[]>(localStorage.getItem(TRACKER_STORAGE_KEYS.diapers)) ?? []
  return parsed.sort((a, b) => b.at - a.at)
}

export const readSortedMedicines = () => {
  const parsed = safeJsonParse<MedicineEvent[]>(localStorage.getItem(TRACKER_STORAGE_KEYS.medicines)) ?? []
  return parsed.sort((a, b) => b.at - a.at)
}

export const readSortedTummyTimes = () => {
  const parsed = safeJsonParse<TummyTimeEvent[]>(localStorage.getItem(TRACKER_STORAGE_KEYS.tummyTimes)) ?? []
  return parsed.sort((a, b) => b.startedAt - a.startedAt)
}

export const readTummySession = () => safeJsonParse<TummyTimeSession>(localStorage.getItem(TRACKER_STORAGE_KEYS.tummySession))

export const readSortedGrowthMeasurements = () => {
  const parsed = safeJsonParse<GrowthMeasurement[]>(localStorage.getItem(TRACKER_STORAGE_KEYS.growthMeasurements)) ?? []
  return normalizeGrowthMeasurements(parsed)
}

export const readSession = () => {
  const parsed = safeJsonParse<LegacySession>(localStorage.getItem(TRACKER_STORAGE_KEYS.session))
  return parsed ? normalizeSession(parsed) : null
}

export const readFeedingNotificationsEnabled = () => localStorage.getItem(TRACKER_STORAGE_KEYS.feedingNotifications) === '1'

export const readBabyDob = () => localStorage.getItem(TRACKER_STORAGE_KEYS.babyDob) || '2026-06-03'
export const readTummyGoalMinutes = () => normalizeTummyTimeGoalMinutes(localStorage.getItem(TRACKER_STORAGE_KEYS.tummyGoalMinutes) ?? TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES)

const getCookieTheme = (): Theme | null => {
  const match = document.cookie.match(/(?:^|; )baby_feeding_theme=([^;]+)/)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return value === 'dark' || value === 'light' ? value : null
}

export const readTheme = (): Theme => {
  const stored = localStorage.getItem(TRACKER_STORAGE_KEYS.theme)
  return getCookieTheme() || (stored === 'dark' || stored === 'light' ? stored : null) || 'light'
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
