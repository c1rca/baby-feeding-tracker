import { useCallback, useEffect, useRef, useState } from 'react'
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
  // Single-flight: never overlap PUTs. Concurrent writes could return out of
  // order, letting a stale updatedAt regress serverUpdatedAtRef so the next
  // write is treated as a stale replay and its deletes are dropped. A request
  // made while one is in flight schedules exactly one trailing rerun, which
  // reads the latest payload — so the newest state still lands.
  const inFlightRef = useRef(false)
  const rerunRef = useRef(false)
  const syncToApiRef = useRef<(overrides?: SyncToApiOverrides) => Promise<void>>(async () => {})

  const syncToApi = useCallback(async (overrides: SyncToApiOverrides = {}) => {
    if (inFlightRef.current) {
      // An override sync (the initial merge) must not be dropped; run it as a
      // trailing rerun with its overrides once the in-flight sync settles.
      rerunRef.current = true
      return
    }
    inFlightRef.current = true
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
    } finally {
      inFlightRef.current = false
      if (rerunRef.current) {
        rerunRef.current = false
        void syncToApiRef.current()
      }
    }
  }, [applyServerState, latestPayloadRef, selectedBabyId, serverUpdatedAtRef])
  // Keep the ref pointing at the latest syncToApi so the in-flight rerun calls
  // the current closure (setting a ref during render is disallowed).
  useEffect(() => {
    syncToApiRef.current = syncToApi
  }, [syncToApi])

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
