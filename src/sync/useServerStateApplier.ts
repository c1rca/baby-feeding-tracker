import { useCallback, useEffect, useRef } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes } from '../domain/tummyTime'
import type { ServerState } from '../types'
import { hasPersistedThemePreference } from '../state/persistentTrackerStorage'
import { sortDiapers, sortEntries, sortGrowthMeasurements, sortHealthRecords, sortCustomTrackers, sortCustomEvents, sortMedicines, sortPumpEvents, sortTummyTimes } from './serverSyncModels'
import type { UseServerSyncOptions } from './serverSyncTypes'

type ServerStateApplierOptions = Pick<
  UseServerSyncOptions,
  'setEntries' | 'setDiapers' | 'setMedicines' | 'setTummyTimes' | 'setPumpEvents' | 'setPumpSession' | 'setTummySession' | 'setTummyGoalMinutes' | 'setPumpGoalOunces' | 'setPumpGoalSessions' | 'setGrowthMeasurements' | 'setHealthRecords' | 'setCustomTrackers' | 'setCustomEvents' | 'setBabyDob' | 'setSession' | 'setTheme'>

export function useServerStateApplier({
  setEntries,
  setDiapers,
  setMedicines,
  setTummyTimes,
  setPumpEvents,
  setPumpSession,
  setTummySession,
  setTummyGoalMinutes,
  setPumpGoalOunces,
  setPumpGoalSessions,
  setGrowthMeasurements,
  setHealthRecords,
  setCustomTrackers,
  setCustomEvents,
  setBabyDob,
  setSession,
  setTheme,
}: ServerStateApplierOptions) {
  const serverUpdatedAtRef = useRef<string | null>(null)
  const applyingServerStateRef = useRef(false)
  const skipNextSyncRef = useRef(false)

  const applyServerState = useCallback((data: ServerState) => {
    applyingServerStateRef.current = true
    skipNextSyncRef.current = true
    if (Array.isArray(data.entries)) setEntries(sortEntries(data.entries))
    if (Array.isArray(data.diapers)) setDiapers(sortDiapers(data.diapers))
    if (Array.isArray(data.medicines)) setMedicines(sortMedicines(data.medicines))
    if (Array.isArray(data.tummyTimes)) setTummyTimes(sortTummyTimes(data.tummyTimes))
    if (Array.isArray(data.pumpEvents)) setPumpEvents(sortPumpEvents(data.pumpEvents))
    if (data.pumpSession !== undefined) setPumpSession(data.pumpSession)
    if (data.tummySession !== undefined) setTummySession(data.tummySession)
    if (data.tummyGoalMinutes !== undefined) setTummyGoalMinutes(normalizeTummyTimeGoalMinutes(data.tummyGoalMinutes))
    if (data.pumpGoalOunces !== undefined) setPumpGoalOunces(Math.min(500, Math.max(0, Math.round(Number(data.pumpGoalOunces)) || 0)))
    if (data.pumpGoalSessions !== undefined) setPumpGoalSessions(Math.min(50, Math.max(0, Math.round(Number(data.pumpGoalSessions)) || 0)))
    if (Array.isArray(data.growthMeasurements)) setGrowthMeasurements(sortGrowthMeasurements(data.growthMeasurements))
    if (Array.isArray(data.healthRecords)) setHealthRecords(sortHealthRecords(data.healthRecords))
    if (Array.isArray(data.customTrackers)) setCustomTrackers(sortCustomTrackers(data.customTrackers))
    if (Array.isArray(data.customEvents)) setCustomEvents(sortCustomEvents(data.customEvents))
    if (typeof data.babyDob === 'string') setBabyDob(data.babyDob)
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if ((data.theme === 'light' || data.theme === 'dark') && !hasPersistedThemePreference()) setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingServerStateRef.current = false }, 0)
  }, [setBabyDob, setDiapers, setEntries, setGrowthMeasurements, setHealthRecords, setCustomTrackers, setCustomEvents, setMedicines, setPumpEvents, setPumpSession, setSession, setTheme, setPumpGoalOunces, setPumpGoalSessions, setTummyGoalMinutes, setTummySession, setTummyTimes])
  return { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef }
}

export function useLatestServerPayload({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme }: UseServerSyncOptions) {
  const latestPayloadRef = useRef({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme })
  useEffect(() => {
    latestPayloadRef.current = { entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme }
  }, [entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme])
  return latestPayloadRef
}
