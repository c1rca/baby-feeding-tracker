import { useCallback, useEffect, useRef } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes } from '../domain/tummyTime'
import type { ServerState } from '../types'
import { hasPersistedThemePreference } from '../state/persistentTrackerStorage'
import { sortDiapers, sortEntries, sortGrowthMeasurements, sortMedicines, sortTummyTimes } from './serverSyncModels'
import type { UseServerSyncOptions } from './serverSyncTypes'

type ServerStateApplierOptions = Pick<
  UseServerSyncOptions,
  'setEntries' | 'setDiapers' | 'setMedicines' | 'setTummyTimes' | 'setTummySession' | 'setTummyGoalMinutes' | 'setGrowthMeasurements' | 'setBabyDob' | 'setSession' | 'setTheme'
>

export function useServerStateApplier({
  setEntries,
  setDiapers,
  setMedicines,
  setTummyTimes,
  setTummySession,
  setTummyGoalMinutes,
  setGrowthMeasurements,
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
    if (data.tummySession !== undefined) setTummySession(data.tummySession)
    if (data.tummyGoalMinutes !== undefined) setTummyGoalMinutes(normalizeTummyTimeGoalMinutes(data.tummyGoalMinutes))
    if (Array.isArray(data.growthMeasurements)) setGrowthMeasurements(sortGrowthMeasurements(data.growthMeasurements))
    if (typeof data.babyDob === 'string') setBabyDob(data.babyDob)
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if ((data.theme === 'light' || data.theme === 'dark') && !hasPersistedThemePreference()) setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingServerStateRef.current = false }, 0)
  }, [setBabyDob, setDiapers, setEntries, setGrowthMeasurements, setMedicines, setSession, setTheme, setTummyGoalMinutes, setTummySession, setTummyTimes])

  return { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef }
}

export function useLatestServerPayload({ entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme }: UseServerSyncOptions) {
  const latestPayloadRef = useRef({ entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme })
  useEffect(() => {
    latestPayloadRef.current = { entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme }
  }, [entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme])
  return latestPayloadRef
}
