import { useEffect, useState } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import type { DiaperEvent, Entry, LegacySession, MedicineEvent, Session, Theme } from '../types'

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'
const KEY_THEME = 'baby-feeding-tracker:v1:theme'
const KEY_SETTINGS_OPEN = 'baby-feeding-tracker:v1:settings-open'
const KEY_FEEDING_NOTIFICATIONS = 'baby-feeding-tracker:v1:feeding-notifications'
const KEY_DIAPERS = 'baby-feeding-tracker:v1:diapers'
const KEY_MEDICINES = 'baby-feeding-tracker:v1:medicines'
const THEME_COOKIE = 'baby_feeding_theme'

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const readSortedEntries = () => {
  const parsed = safeJsonParse<Entry[]>(localStorage.getItem(KEY_ENTRIES)) ?? []
  return parsed.sort((a, b) => b.endedAt - a.endedAt)
}

const readSortedDiapers = () => {
  const parsed = safeJsonParse<DiaperEvent[]>(localStorage.getItem(KEY_DIAPERS)) ?? []
  return parsed.sort((a, b) => b.at - a.at)
}

const readSortedMedicines = () => {
  const parsed = safeJsonParse<MedicineEvent[]>(localStorage.getItem(KEY_MEDICINES)) ?? []
  return parsed.sort((a, b) => b.at - a.at)
}

const readSession = () => {
  const parsed = safeJsonParse<LegacySession>(localStorage.getItem(KEY_SESSION))
  return parsed ? normalizeSession(parsed) : null
}

const getCookieTheme = (): Theme | null => {
  const match = document.cookie.match(/(?:^|; )baby_feeding_theme=([^;]+)/)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return value === 'dark' || value === 'light' ? value : null
}

const readTheme = (): Theme => {
  const stored = localStorage.getItem(KEY_THEME)
  return getCookieTheme() || (stored === 'dark' || stored === 'light' ? stored : null) || 'light'
}

export function usePersistentTrackerState() {
  const [entries, setEntries] = useState<Entry[]>(readSortedEntries)
  const [session, setSession] = useState<Session | null>(readSession)
  const [diapers, setDiapers] = useState<DiaperEvent[]>(readSortedDiapers)
  const [medicines, setMedicines] = useState<MedicineEvent[]>(readSortedMedicines)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedingNotificationsEnabled, setFeedingNotificationsEnabled] = useState(() => localStorage.getItem(KEY_FEEDING_NOTIFICATIONS) === '1')

  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(KEY_DIAPERS, JSON.stringify(diapers)), [diapers])
  useEffect(() => localStorage.setItem(KEY_MEDICINES, JSON.stringify(medicines)), [medicines])
  useEffect(() => localStorage.setItem(KEY_SESSION, JSON.stringify(session)), [session])
  useEffect(() => {
    localStorage.setItem(KEY_THEME, theme)
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => localStorage.setItem(KEY_SETTINGS_OPEN, settingsOpen ? '1' : '0'), [settingsOpen])
  useEffect(() => localStorage.setItem(KEY_FEEDING_NOTIFICATIONS, feedingNotificationsEnabled ? '1' : '0'), [feedingNotificationsEnabled])

  return {
    entries,
    setEntries,
    session,
    setSession,
    diapers,
    setDiapers,
    medicines,
    setMedicines,
    theme,
    setTheme,
    settingsOpen,
    setSettingsOpen,
    feedingNotificationsEnabled,
    setFeedingNotificationsEnabled,
  }
}
