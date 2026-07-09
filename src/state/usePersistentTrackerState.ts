import { useEffect, useState } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import {
  TRACKER_STORAGE_KEYS,
  persistTheme,
  readBabyDob,
  readFeedingNotificationsEnabled,
  readSession,
  readSortedDiapers,
  readSortedEntries,
  readSortedGrowthMeasurements,
  readSortedMedicines,
  readSortedTummyTimes,
  readTummySession,
  readTummyGoalMinutes,
  readTheme,
} from './persistentTrackerStorage'

export function usePersistentTrackerState() {
  const [entries, setEntries] = useState<Entry[]>(readSortedEntries)
  const [session, setSession] = useState<Session | null>(readSession)
  const [diapers, setDiapers] = useState<DiaperEvent[]>(readSortedDiapers)
  const [medicines, setMedicines] = useState<MedicineEvent[]>(readSortedMedicines)
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>(readSortedTummyTimes)
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(readTummySession)
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(readTummyGoalMinutes)
  const [growthMeasurements, setGrowthMeasurements] = useState(readSortedGrowthMeasurements)
  const [babyDob, setBabyDob] = useState(readBabyDob)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedingNotificationsEnabled, setFeedingNotificationsEnabled] = useState(readFeedingNotificationsEnabled)

  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.entries, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.diapers, JSON.stringify(diapers)), [diapers])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.medicines, JSON.stringify(medicines)), [medicines])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.tummyTimes, JSON.stringify(tummyTimes)), [tummyTimes])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.tummySession, JSON.stringify(tummySession)), [tummySession])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.tummyGoalMinutes, String(tummyGoalMinutes)), [tummyGoalMinutes])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.growthMeasurements, JSON.stringify(growthMeasurements)), [growthMeasurements])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.babyDob, babyDob), [babyDob])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.session, JSON.stringify(session)), [session])
  useEffect(() => persistTheme(theme), [theme])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.settingsOpen, settingsOpen ? '1' : '0'), [settingsOpen])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.feedingNotifications, feedingNotificationsEnabled ? '1' : '0'), [feedingNotificationsEnabled])

  return {
    entries,
    setEntries,
    session,
    setSession,
    diapers,
    setDiapers,
    medicines,
    setMedicines,
    tummyTimes,
    setTummyTimes,
    tummySession,
    setTummySession,
    tummyGoalMinutes,
    setTummyGoalMinutes,
    growthMeasurements,
    setGrowthMeasurements,
    babyDob,
    setBabyDob,
    theme,
    setTheme,
    settingsOpen,
    setSettingsOpen,
    feedingNotificationsEnabled,
    setFeedingNotificationsEnabled,
  }
}
