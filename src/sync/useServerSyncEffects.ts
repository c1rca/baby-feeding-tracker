import { useEffect, useRef } from 'react'
import { hasPendingSyncForBaby, markPendingSync, type ServerSyncPayload, type SyncToApiOverrides } from './serverSyncTypes'

// Trailing debounce so a burst of edits (e.g. typing a note, rapid taps)
// coalesces into one whole-state PUT instead of one PUT per mutation.
export const SYNC_DEBOUNCE_MS = 600

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
  pumpEvents: ServerSyncPayload['pumpEvents']
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
  pumpEvents,
  tummySession,
  tummyGoalMinutes,
  growthMeasurements,
  babyDob,
  session,
  theme,
}: PersistLocalChangesOptions) {
  const debounceRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!hasHydrated) return
    if (isApplyingServerState()) {
      consumeSkipNextSync()
      return
    }
    if (consumeSkipNextSync()) return

    // Record the pending marker immediately (so an offline state is captured
    // even before the debounce fires), then debounce the actual PUT.
    markPendingSync(selectedBabyId)
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = undefined
      void syncToApi()
    }, SYNC_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current)
    }
  }, [hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, selectedBabyId, entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme])
}

export function usePendingSyncRetry(syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>, selectedBabyId?: string | null) {
  useEffect(() => {
    const retrySync = () => {
      if (hasPendingSyncForBaby(selectedBabyId)) void syncToApi()
    }

    window.addEventListener('online', retrySync)
    window.addEventListener('focus', retrySync)
    return () => {
      window.removeEventListener('online', retrySync)
      window.removeEventListener('focus', retrySync)
    }
  }, [syncToApi, selectedBabyId])
}
