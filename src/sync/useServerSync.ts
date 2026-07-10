import { useCallback, useState } from 'react'
import { saveServerState } from './serverSyncApi'
import { buildApiStatePayload } from './serverSyncModels'
import { clearPendingSync, hasPendingSyncForBaby, markPendingSync, type SyncStatus, type SyncToApiOverrides, type UseServerSyncOptions } from './serverSyncTypes'
import { useInitialServerSync } from './useInitialServerSync'
import { useLatestServerPayload, useServerStateApplier } from './useServerStateApplier'
import { usePendingSyncRetry, usePersistLocalChanges } from './useServerSyncEffects'

export const useServerSync = (options: UseServerSyncOptions) => {
  const { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme, selectedBabyId } = options
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (hasPendingSyncForBaby(selectedBabyId) ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const latestPayloadRef = useLatestServerPayload(options)
  const { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef } = useServerStateApplier(options)

  const syncToApi = useCallback(async (overrides: SyncToApiOverrides = {}) => {
    const payload = latestPayloadRef.current
    setSyncStatus('syncing')
    try {
      const data = await saveServerState(buildApiStatePayload(payload, serverUpdatedAtRef.current, overrides), { babyId: selectedBabyId })
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      if (data.state) applyServerState(data.state)
      clearPendingSync(selectedBabyId)
      setSyncStatus('synced')
    } catch {
      markPendingSync(selectedBabyId)
      setSyncStatus('offline')
    }
  }, [applyServerState, latestPayloadRef, selectedBabyId, serverUpdatedAtRef])

  const isApplyingServerState = useCallback(() => applyingServerStateRef.current, [applyingServerStateRef])
  const consumeSkipNextSync = useCallback(() => {
    if (!skipNextSyncRef.current) return false
    skipNextSyncRef.current = false
    return true
  }, [skipNextSyncRef])

  useInitialServerSync({ latestPayloadRef, serverUpdatedAtRef, applyServerState, syncToApi, selectedBabyId, setHasHydrated, setSyncStatus })
  usePersistLocalChanges({ hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, selectedBabyId, entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme })
  usePendingSyncRetry(syncToApi, selectedBabyId)

  return { syncStatus, hasHydrated }
}
