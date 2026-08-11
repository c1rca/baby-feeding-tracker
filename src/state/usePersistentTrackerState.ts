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
  readSortedHealthRecords,
  readCustomTrackers,
  readCustomEvents,
  readSortedMedicines,
  readSortedTummyTimes,
  readSortedPumpEvents,
  readPumpSession,
  readTummySession,
  readTummyGoalMinutes,
  readPumpGoalOunces,
  readPumpGoalSessions,
  readTheme,
  writeTrackerValue,
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
  const [pumpGoalOunces, setPumpGoalOunces] = useState(() => readPumpGoalOunces(storageKeys))
  const [pumpGoalSessions, setPumpGoalSessions] = useState(() => readPumpGoalSessions(storageKeys))
  const [growthMeasurements, setGrowthMeasurements] = useState(() => readSortedGrowthMeasurements(storageKeys))
  const [healthRecords, setHealthRecords] = useState(() => readSortedHealthRecords(storageKeys))
  const [customTrackers, setCustomTrackers] = useState(() => readCustomTrackers(storageKeys))
  const [customEvents, setCustomEvents] = useState(() => readCustomEvents(storageKeys))
  const [babyDob, setBabyDob] = useState(() => readBabyDob(storageKeys))
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedingNotificationsEnabled, setFeedingNotificationsEnabled] = useState(() => readFeedingNotificationsEnabled(storageKeys))
  const [browserRemindersEnabled, setBrowserRemindersEnabled] = useState(() => readBrowserRemindersEnabled(storageKeys))

  useEffect(() => { writeTrackerValue(storageKeys.entries, JSON.stringify(entries)) }, [entries, storageKeys.entries])
  useEffect(() => { writeTrackerValue(storageKeys.diapers, JSON.stringify(diapers)) }, [diapers, storageKeys.diapers])
  useEffect(() => { writeTrackerValue(storageKeys.medicines, JSON.stringify(medicines)) }, [medicines, storageKeys.medicines])
  useEffect(() => { writeTrackerValue(storageKeys.tummyTimes, JSON.stringify(tummyTimes)) }, [tummyTimes, storageKeys.tummyTimes])
  useEffect(() => { writeTrackerValue(storageKeys.pumpEvents, JSON.stringify(pumpEvents)) }, [pumpEvents, storageKeys.pumpEvents])
  useEffect(() => { writeTrackerValue(storageKeys.pumpSession, JSON.stringify(pumpSession)) }, [pumpSession, storageKeys.pumpSession])
  useEffect(() => { writeTrackerValue(storageKeys.tummySession, JSON.stringify(tummySession)) }, [tummySession, storageKeys.tummySession])
  useEffect(() => { writeTrackerValue(storageKeys.tummyGoalMinutes, String(tummyGoalMinutes)) }, [tummyGoalMinutes, storageKeys.tummyGoalMinutes])
  useEffect(() => { writeTrackerValue(storageKeys.pumpGoalOunces, String(pumpGoalOunces)) }, [pumpGoalOunces, storageKeys.pumpGoalOunces])
  useEffect(() => { writeTrackerValue(storageKeys.pumpGoalSessions, String(pumpGoalSessions)) }, [pumpGoalSessions, storageKeys.pumpGoalSessions])
  useEffect(() => { writeTrackerValue(storageKeys.growthMeasurements, JSON.stringify(growthMeasurements)) }, [growthMeasurements, storageKeys.growthMeasurements])
  useEffect(() => { writeTrackerValue(storageKeys.healthRecords, JSON.stringify(healthRecords)) }, [healthRecords, storageKeys.healthRecords])
  useEffect(() => { writeTrackerValue(storageKeys.customTrackers, JSON.stringify(customTrackers)) }, [customTrackers, storageKeys.customTrackers])
  useEffect(() => { writeTrackerValue(storageKeys.customEvents, JSON.stringify(customEvents)) }, [customEvents, storageKeys.customEvents])
  useEffect(() => { writeTrackerValue(storageKeys.babyDob, babyDob) }, [babyDob, storageKeys.babyDob])
  useEffect(() => { writeTrackerValue(storageKeys.session, JSON.stringify(session)) }, [session, storageKeys.session])
  useEffect(() => { persistTheme(theme) }, [theme])
  useEffect(() => { writeTrackerValue(TRACKER_STORAGE_KEYS.settingsOpen, settingsOpen ? '1' : '0') }, [settingsOpen])
  useEffect(() => { writeTrackerValue(storageKeys.feedingNotifications, feedingNotificationsEnabled ? '1' : '0') }, [feedingNotificationsEnabled, storageKeys.feedingNotifications])
  useEffect(() => { writeTrackerValue(storageKeys.browserReminders, browserRemindersEnabled ? '1' : '0') }, [browserRemindersEnabled, storageKeys.browserReminders])

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
    pumpGoalOunces,
    setPumpGoalOunces,
    pumpGoalSessions,
    setPumpGoalSessions,
    growthMeasurements,
    healthRecords,
    setHealthRecords,
    customTrackers,
    setCustomTrackers,
    customEvents,
    setCustomEvents,
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
