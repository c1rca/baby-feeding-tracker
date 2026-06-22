import { useCallback, useEffect, useRef } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import type { ServerState } from '../types'
import { sortDiapers, sortEntries, sortGrowthMeasurements, sortMedicines } from './serverSyncModels'
import type { UseServerSyncOptions } from './serverSyncTypes'

type ServerStateApplierOptions = Pick<
  UseServerSyncOptions,
  'setEntries' | 'setDiapers' | 'setMedicines' | 'setGrowthMeasurements' | 'setBabyDob' | 'setSession' | 'setTheme'
>

export function useServerStateApplier({
  setEntries,
  setDiapers,
  setMedicines,
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
    if (Array.isArray(data.growthMeasurements)) setGrowthMeasurements(sortGrowthMeasurements(data.growthMeasurements))
    if (typeof data.babyDob === 'string') setBabyDob(data.babyDob)
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingServerStateRef.current = false }, 0)
  }, [setBabyDob, setDiapers, setEntries, setGrowthMeasurements, setMedicines, setSession, setTheme])

  return { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef }
}

export function useLatestServerPayload({ entries, diapers, medicines, growthMeasurements, babyDob, session, theme }: UseServerSyncOptions) {
  const latestPayloadRef = useRef({ entries, diapers, medicines, growthMeasurements, babyDob, session, theme })

  useEffect(() => {
    latestPayloadRef.current = { entries, diapers, medicines, growthMeasurements, babyDob, session, theme }
  }, [entries, diapers, medicines, growthMeasurements, babyDob, session, theme])

  return latestPayloadRef
}
