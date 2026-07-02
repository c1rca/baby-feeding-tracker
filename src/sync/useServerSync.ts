import { useCallback, useState } from 'react'
import type { Entry, Session, Theme } from '../types'
import { saveServerState } from './serverSyncApi'
import { buildApiStatePayload } from './serverSyncModels'
import { KEY_PENDING_SYNC, type ServerSyncPayload, type SyncStatus, type UseServerSyncOptions } from './serverSyncTypes'
import { useInitialServerSync } from './useInitialServerSync'
import { useLatestServerPayload, useServerStateApplier } from './useServerStateApplier'
import { usePendingSyncRetry, usePersistLocalChanges } from './useServerSyncEffects'

export const useServerSync = (options: UseServerSyncOptions) => {
  const { entries, diapers, medicines, tummyTimes, tummySession, growthMeasurements, babyDob, session, theme } = options
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const latestPayloadRef = useLatestServerPayload(options)
  const { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef } = useServerStateApplier(options)

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme, nextDiapers?: ServerSyncPayload['diapers'], nextMedicines?: ServerSyncPayload['medicines'], nextGrowthMeasurements?: ServerSyncPayload['growthMeasurements']) => {
    const payload = latestPayloadRef.current
    setSyncStatus('syncing')
    try {
      const data = await saveServerState(buildApiStatePayload(payload, serverUpdatedAtRef.current, {
        entries: nextEntries,
        diapers: nextDiapers,
        medicines: nextMedicines,
        growthMeasurements: nextGrowthMeasurements,
        session: nextSession,
        theme: nextTheme,
      }))
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      if (data.state) applyServerState(data.state)
      localStorage.removeItem(KEY_PENDING_SYNC)
      setSyncStatus('synced')
    } catch {
      localStorage.setItem(KEY_PENDING_SYNC, '1')
      setSyncStatus('offline')
    }
  }, [applyServerState, latestPayloadRef, serverUpdatedAtRef])

  const isApplyingServerState = useCallback(() => applyingServerStateRef.current, [applyingServerStateRef])
  const consumeSkipNextSync = useCallback(() => {
    if (!skipNextSyncRef.current) return false
    skipNextSyncRef.current = false
    return true
  }, [skipNextSyncRef])

  useInitialServerSync({ latestPayloadRef, serverUpdatedAtRef, applyServerState, syncToApi, setHasHydrated, setSyncStatus })
  usePersistLocalChanges({ hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, entries, diapers, medicines, tummyTimes, tummySession, growthMeasurements, babyDob, session, theme })
  usePendingSyncRetry(syncToApi)

  return { syncStatus, hasHydrated }
}
