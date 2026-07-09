import { useEffect } from 'react'
import { hasPendingSync, markPendingSync, type ServerSyncPayload, type SyncToApiOverrides } from './serverSyncTypes'

type PersistLocalChangesOptions = {
  hasHydrated: boolean
  isApplyingServerState: () => boolean
  consumeSkipNextSync: () => boolean
  syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>
  selectedBabyId?: string | null
  entries: ServerSyncPayload['entries']
  diapers: ServerSyncPayload['diapers']
  medicines: ServerSyncPayload['medicines']
  tummyTimes: ServerSyncPayload['tummyTimes']
  tummySession: ServerSyncPayload['tummySession']
  tummyGoalMinutes: ServerSyncPayload['tummyGoalMinutes']
  growthMeasurements: ServerSyncPayload['growthMeasurements']
  babyDob: ServerSyncPayload['babyDob']
  session: ServerSyncPayload['session']
  theme: ServerSyncPayload['theme']
}

export function usePersistLocalChanges({
  hasHydrated,
  isApplyingServerState,
  consumeSkipNextSync,
  syncToApi,
  selectedBabyId,
  entries,
  diapers,
  medicines,
  tummyTimes,
  tummySession,
  tummyGoalMinutes,
  growthMeasurements,
  babyDob,
  session,
  theme,
}: PersistLocalChangesOptions) {
  useEffect(() => {
    if (!hasHydrated) return
    if (isApplyingServerState()) {
      consumeSkipNextSync()
      return
    }
    if (consumeSkipNextSync()) return

    markPendingSync(selectedBabyId)
    window.setTimeout(() => void syncToApi(), 0)
  }, [hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, selectedBabyId, entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme])
}

export function usePendingSyncRetry(syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>) {
  useEffect(() => {
    const retrySync = () => {
      if (hasPendingSync()) void syncToApi()
    }

    window.addEventListener('online', retrySync)
    window.addEventListener('focus', retrySync)
    return () => {
      window.removeEventListener('online', retrySync)
      window.removeEventListener('focus', retrySync)
    }
  }, [syncToApi])
}
