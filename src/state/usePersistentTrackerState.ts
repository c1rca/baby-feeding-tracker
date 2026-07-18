import { useEffect, useState } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, PumpSession, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import {
  TRACKER_STORAGE_KEYS,
  getTrackerStorageKeys,
  persistTheme,
  readBabyDob,
  readBrowserRemindersEnabled,
  readFeedingNotificationsEnabled,
  readSession,
  readSortedDiapers,
  readSortedEntries,
  readSortedGrowthMeasurements,
  readSortedMedicines,
  readSortedTummyTimes,
  readSortedPumpEvents,
  readPumpSession,
  readTummySession,
  readTummyGoalMinutes,
  readTheme,
} from './persistentTrackerStorage'

export function usePersistentTrackerState(selectedBabyId?: string | null) {
  const storageKeys = getTrackerStorageKeys(selectedBabyId)
  const [entries, setEntries] = useState<Entry[]>(() => readSortedEntries(storageKeys))
  const [session, setSession] = useState<Session | null>(() => readSession(storageKeys))
  const [diapers, setDiapers] = useState<DiaperEvent[]>(() => readSortedDiapers(storageKeys))
  const [medicines, setMedicines] = useState<MedicineEvent[]>(() => readSortedMedicines(storageKeys))
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>(() => readSortedTummyTimes(storageKeys))
  const [pumpEvents, setPumpEvents] = useState<PumpEvent[]>(() => readSortedPumpEvents(storageKeys))
  const [pumpSession, setPumpSession] = useState<PumpSession | null>(() => readPumpSession(storageKeys))
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(() => readTummySession(storageKeys))
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(() => readTummyGoalMinutes(storageKeys))
  const [growthMeasurements, setGrowthMeasurements] = useState(() => readSortedGrowthMeasurements(storageKeys))
  const [babyDob, setBabyDob] = useState(() => readBabyDob(storageKeys))
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedingNotificationsEnabled, setFeedingNotificationsEnabled] = useState(() => readFeedingNotificationsEnabled(storageKeys))
  const [browserRemindersEnabled, setBrowserRemindersEnabled] = useState(() => readBrowserRemindersEnabled(storageKeys))

  useEffect(() => localStorage.setItem(storageKeys.entries, JSON.stringify(entries)), [entries, storageKeys.entries])
  useEffect(() => localStorage.setItem(storageKeys.diapers, JSON.stringify(diapers)), [diapers, storageKeys.diapers])
  useEffect(() => localStorage.setItem(storageKeys.medicines, JSON.stringify(medicines)), [medicines, storageKeys.medicines])
  useEffect(() => localStorage.setItem(storageKeys.tummyTimes, JSON.stringify(tummyTimes)), [tummyTimes, storageKeys.tummyTimes])
  useEffect(() => localStorage.setItem(storageKeys.pumpEvents, JSON.stringify(pumpEvents)), [pumpEvents, storageKeys.pumpEvents])
  useEffect(() => localStorage.setItem(storageKeys.pumpSession, JSON.stringify(pumpSession)), [pumpSession, storageKeys.pumpSession])
  useEffect(() => localStorage.setItem(storageKeys.tummySession, JSON.stringify(tummySession)), [tummySession, storageKeys.tummySession])
  useEffect(() => localStorage.setItem(storageKeys.tummyGoalMinutes, String(tummyGoalMinutes)), [tummyGoalMinutes, storageKeys.tummyGoalMinutes])
  useEffect(() => localStorage.setItem(storageKeys.growthMeasurements, JSON.stringify(growthMeasurements)), [growthMeasurements, storageKeys.growthMeasurements])
  useEffect(() => localStorage.setItem(storageKeys.babyDob, babyDob), [babyDob, storageKeys.babyDob])
  useEffect(() => localStorage.setItem(storageKeys.session, JSON.stringify(session)), [session, storageKeys.session])
  useEffect(() => persistTheme(theme), [theme])
  useEffect(() => localStorage.setItem(TRACKER_STORAGE_KEYS.settingsOpen, settingsOpen ? '1' : '0'), [settingsOpen])
  useEffect(() => localStorage.setItem(storageKeys.feedingNotifications, feedingNotificationsEnabled ? '1' : '0'), [feedingNotificationsEnabled, storageKeys.feedingNotifications])
  useEffect(() => localStorage.setItem(storageKeys.browserReminders, browserRemindersEnabled ? '1' : '0'), [browserRemindersEnabled, storageKeys.browserReminders])

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
    pumpEvents,
    setPumpEvents,
    pumpSession,
    setPumpSession,
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
    browserRemindersEnabled,
    setBrowserRemindersEnabled,
  }
}
